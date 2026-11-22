/**
 * Bombay Bioworks WhatsApp intelligence bot.
 *
 * Always-on service that:
 * - Listens to the team WhatsApp group
 * - Extracts data/numbers from messages → Hivemind Firestore
 * - Answers @hive questions using Hivemind's knowledge base
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
const { extractBatch } = require('./extract');
const { writeFacts, writePeople } = require('./firestore');
const { answer } = require('./responder');
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

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  if (!jid?.endsWith('@g.us')) return;
  if (cfg.groupJid && jid !== cfg.groupJid) return;
  if (msg.key.fromMe) return;

  const text = msgText(msg);
  if (!text || text.length < 3) return;

  const sender = msg.pushName || msg.key.participant || 'unknown';
  const today = new Date().toISOString().slice(0, 10);

  // Question trigger: @hive ...
  const triggerRE = new RegExp(`^\\s*${cfg.triggerPrefix}\\b`, 'i');
  if (triggerRE.test(text)) {
    console.log(`[Q] ${sender}: ${text.slice(0, 100)}`);
    try {
      const reply = await answer(text);
      if (reply) {
        await sock.sendMessage(jid, { text: reply }, { quoted: msg });
        console.log(`[A] ${reply.slice(0, 80)}…`);
      }
    } catch (err) {
      console.error('[responder error]', err.message);
      await sock.sendMessage(jid, { text: '⚡ Hive had a brain freeze. Try again in a moment.' }, { quoted: msg });
    }
    return;
  }

  // For regular messages: extract intelligence (don't block message handling)
  setImmediate(async () => {
    try {
      const extracted = await extractBatch([{ msg_date: today, sender, text }]);
      if (extracted.facts?.length) await writeFacts(extracted.facts);
      if (extracted.people?.length) await writePeople(extracted.people);
      if (extracted.facts?.length) {
        console.log(`[+] ${sender}: ${extracted.facts.length} fact(s) → Hivemind`);
      }
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
      console.log(`  Trigger: "${cfg.triggerPrefix} <question>"\n`);
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
