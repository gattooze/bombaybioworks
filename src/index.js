/**
 * Bombay Bioworks WhatsApp intelligence bot.
 *
 * Always-on service that:
 * - Listens to the team WhatsApp group
 * - Extracts people, commitments, decisions and facts into the Hivemind capture inbox
 * - When READ_ONLY=false: answers when tagged (@hive, an @mention, or a reply to Hive),
 *   and takes instructions from founders only (FOUNDER_PHONES)
 *
 * Session stored in Firestore (USE_FIRESTORE_AUTH=true) for cloud/server deployment,
 * or in local files for development.
 *
 * Usage: node src/index.js
 */
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const { cfg, validate } = require('./config');
const { extract, answer } = require('./llm');
const { captureItems } = require('./capture');
const { isTagged, senderPhone, isFounder, Recent } = require('./group');
const { useFirestoreAuthState } = require('./auth-state');

validate();

const USE_FIRESTORE_AUTH = process.env.USE_FIRESTORE_AUTH === 'true';

if (!cfg.groupJid) {
  console.log('\n⚠  GROUP_JID is not set in .env');
  console.log('   Run `npm run groups` after connecting to get your group JID.\n');
}

function msgText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  );
}

const recent = new Recent(40);

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  if (!jid?.endsWith('@g.us')) return;
  if (cfg.groupJid && jid !== cfg.groupJid) return;

  const text = msgText(msg);
  if (!text) return;
  const sender = msg.pushName || senderPhone(msg.key) || 'unknown';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (msg.key.fromMe) { recent.add('Hive', text); return; }
  recent.add(sender, text);

  if (!cfg.readOnly && isTagged(msg, sock.user, cfg.triggerPrefix)) {
    const founder = isFounder(msg.key, cfg.founderPhones);
    console.log(`[Q] ${sender}${founder ? ' (founder)' : ''}: ${text.slice(0, 100)}`);
    try {
      await sock.sendPresenceUpdate('composing', jid);
      const reply = await answer({ question: text, sender, isFounder: founder, recent: recent.lines().slice(0, -1) });
      if (reply) await sock.sendMessage(jid, { text: reply }, { quoted: msg });
    } catch (err) {
      console.error('[answer error]', err.message);
      await sock.sendMessage(jid, { text: 'Hive hit an error. Try again in a minute.' }, { quoted: msg });
    }
    return;
  }

  // Everything else: extract into the capture inbox without blocking the socket.
  if (text.length < 8) return;
  setImmediate(async () => {
    try {
      const items = await extract([`[${today}] ${sender}: ${text}`]);
      if (!items.length) return;
      const n = await captureItems(items, { sourceRef: `whatsapp:${msg.key.id}`, sender, date: today });
      console.log(`[+] ${sender}: ${n} item(s) → Hivemind inbox`);
    } catch (err) {
      console.error('[extract error]', err.message);
    }
  });
}

async function connect() {
  let authState, saveCreds;

  if (USE_FIRESTORE_AUTH) {
    console.log('Using Firestore session storage…');
    const { getDb } = require('./firestore');
    ({ state: authState, saveCreds } = await useFirestoreAuthState(getDb(), 'whatsapp-bot'));
  } else {
    fs.mkdirSync(cfg.sessionDir, { recursive: true });
    ({ state: authState, saveCreds } = await useMultiFileAuthState(cfg.sessionDir));
  }

  const sock = makeWASocket({
    auth: authState,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
    getMessage: async () => ({ conversation: '' }),
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nScan with WhatsApp → Linked Devices → Link a Device:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('\n✓ Connected to WhatsApp');
      console.log(cfg.groupJid
        ? `  Listening on group: ${cfg.groupJid}`
        : '  Listening on ALL groups (set GROUP_JID to restrict)'
      );
      console.log(cfg.readOnly ? '  Read-only: extracting, never replying\n' : `  Replies when tagged: "${cfg.triggerPrefix}", an @mention, or a reply to Hive\n`);
    }

    if (connection === 'close') {
      const err = lastDisconnect?.error;
      const code = new Boom(err)?.output?.statusCode;
      console.log(`Connection closed — code: ${code}, reason: ${err?.message?.slice(0,80) || 'unknown'}`);
      if (code === DisconnectReason.loggedOut) {
        console.log('Logged out. Delete ./sessions/ and restart to re-link.');
        process.exit(1);
      }
      // Long backoff: let WhatsApp flush its history queue before we reconnect
      const delay = 60000;
      console.log(`Reconnecting in ${delay/1000}s…`);
      setTimeout(connect, delay);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      // Skip messages sent before the bot started — avoids decrypting old history
      const ts = Number(msg.messageTimestamp);
      if (ts && ts < BOT_START_TIME - 30) continue;
      await handleMessage(sock, msg).catch(err =>
        console.error('[message handler error]', err.message)
      );
    }
  });
}

const BOT_START_TIME = Math.floor(Date.now() / 1000);

console.log('Bombay Bioworks WhatsApp bot starting…');
connect().catch(err => { console.error(err); process.exit(1); });
