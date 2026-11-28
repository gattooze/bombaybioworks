/**
 * Parse a WhatsApp chat export (.txt) and send what matters to the Hivemind capture inbox.
 * Run: node src/history.js path/to/chat.txt
 *
 * Progress is checkpointed in SQLite so it can resume if interrupted.
 */
const fs = require('fs');
const { cfg, validate } = require('./config');
const store = require('./store');
const { extract } = require('./llm');
const { captureItems } = require('./capture');

validate();

const CHAT_FILE = process.argv[2];
if (!CHAT_FILE) {
  console.error('Usage: node src/history.js path/to/WhatsApp_Chat.txt');
  process.exit(1);
}

// Handles both iOS ([DD/MM/YYYY, HH:MM:SS] Name: msg)
// and Android (DD/MM/YY, HH:MM AM/PM - Name: msg)
const IOS_RE     = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*[\d:]+(?:\s*[AP]M)?\]\s*(.+?):\s*(.*)/i;
const ANDROID_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*[\d:]+(?:\s*[AP]M)?\s*[-–]\s*(.+?):\s*(.*)/i;
const SYSTEM_MSG = /messages? (and calls?)?to this (group|chat) are now secured|added|removed|changed the subject|changed this group|left|joined using this group/i;

function parseDate(d) {
  const parts = d.split('/');
  if (parts.length !== 3) return d;
  const [dd, mm, yy] = parts;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseExport(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  const msgs = [];
  let cur = null;

  for (const line of lines) {
    const m = line.match(IOS_RE) || line.match(ANDROID_RE);
    if (m) {
      if (cur) msgs.push(cur);
      const [, date, sender, text] = m;
      if (SYSTEM_MSG.test(text)) { cur = null; continue; }
      cur = { msg_date: parseDate(date), sender: sender.trim(), text: text.trim() };
    } else if (cur && line.trim()) {
      cur.text += '\n' + line.trim();
    }
  }
  if (cur) msgs.push(cur);
  return msgs;
}

async function ingest() {
  console.log(`\nParsing ${CHAT_FILE}…`);
  const messages = parseExport(CHAT_FILE);
  console.log(`Found ${messages.length} messages`);

  const BATCH = 60;
  const offsetKey = 'history_offset';
  let offset = parseInt(store.getState(offsetKey) || '0', 10);

  if (offset > 0) {
    console.log(`Resuming from message ${offset} (${messages.length - offset} remaining)`);
  }

  let processed = 0;
  let captured = 0;

  for (let i = offset; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);

    try {
      const items = await extract(batch.map(m => `[${m.msg_date}] ${m.sender}: ${m.text}`));
      captured += await captureItems(items, { sourceRef: `export:${CHAT_FILE}#${i}`, sender: 'group export', date: batch[batch.length - 1].msg_date });
    } catch (err) {
      console.error(`\n  Extraction error at batch ${i}:`, err.message);
    }

    processed += batch.length;
    store.setState(offsetKey, String(i + BATCH));

    const pct = Math.round((processed / messages.length) * 100);
    process.stdout.write(
      `\r  ${pct}% (${processed}/${messages.length} msgs), ${captured} items to the inbox`
    );

    if (i + BATCH < messages.length) await new Promise(r => setTimeout(r, 1000));
  }

  store.setState(offsetKey, '0');
  console.log(`\n\nDone. ${captured} items wait in the Hivemind inbox for a founder to accept or reject.\n`);
}

ingest().catch(err => { console.error('\n', err); process.exit(1); });
