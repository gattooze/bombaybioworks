/**
 * Lists all WhatsApp groups and their JIDs.
 * Run AFTER the first QR scan to find your group's JID, then set GROUP_JID in .env.
 */
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { cfg } = require('./config');

async function listGroups() {
  const { state, saveCreds } = await useMultiFileAuthState(cfg.sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nScan this QR code with WhatsApp (Linked Devices → Link a Device):\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('\nConnected. Fetching groups…\n');
      const groups = await sock.groupFetchAllParticipating();
      const list = Object.values(groups).sort((a, b) => a.subject.localeCompare(b.subject));
      console.log(`Found ${list.length} groups:\n`);
      for (const g of list) {
        console.log(`  ${g.subject}`);
        console.log(`    JID: ${g.id}`);
        console.log(`    Participants: ${g.participants.length}`);
        console.log();
      }
      console.log('Copy the JID of your group and set GROUP_JID= in .env\n');
      process.exit(0);
    }
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Reconnecting…');
        listGroups();
      } else {
        console.log('Logged out — delete ./sessions and try again.');
        process.exit(1);
      }
    }
  });
}

listGroups().catch(err => { console.error(err); process.exit(1); });
