/**
 * One-time migration: copies local Baileys session files → Firestore.
 * Run ONCE before deploying to GCE so the VM can connect without re-scanning QR.
 *
 * Usage: node src/migrate-session.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getDb } = require('./firestore');
const { BufferJSON } = require('@whiskeysockets/baileys');

const SESSION_DIR = process.env.SESSION_DIR || './sessions';
const SESSION_ID = 'whatsapp-bot';
const SESSION_COLLECTION = '_whatsapp_session';

async function migrate() {
  const firestore = getDb();
  const sessionRef = firestore.collection(SESSION_COLLECTION).doc(SESSION_ID);

  // 1. Migrate creds.json
  const credsPath = path.join(SESSION_DIR, 'creds.json');
  if (!fs.existsSync(credsPath)) {
    console.error('No creds.json found in', SESSION_DIR);
    process.exit(1);
  }
  const credsRaw = fs.readFileSync(credsPath, 'utf-8');
  await sessionRef.collection('data').doc('creds').set({
    value: credsRaw,
    updated_at: new Date().toISOString(),
  });
  console.log('✓ creds.json migrated');

  // 2. Migrate all key files (pre-key-N.json, sender-key-*, app-state-sync-key-*, session-*)
  const keysRef = sessionRef.collection('keys');
  const files = fs.readdirSync(SESSION_DIR);
  const keyFiles = files.filter(f => f !== 'creds.json' && f.endsWith('.json'));

  let count = 0;
  // Batch writes (500 max per batch)
  let batch = firestore.batch();
  let batchCount = 0;

  for (const file of keyFiles) {
    const filePath = path.join(SESSION_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');

    // Convert filename to Firestore key: "pre-key-10.json" → type="pre-key", id="10"
    // Local format: {type}-{id}.json where type can contain hyphens
    // Strategy: strip .json, then find the last hyphen-separated numeric/complex id
    // Examples:
    //   pre-key-10 → pre-key / 10
    //   sender-key-120363428077194867@g.us--51019983622223--0 → sender-key / 120363428077194867@g.us--51019983622223--0
    //   app-state-sync-key-AAAAAM60 → app-state-sync-key / AAAAAM60
    //   session-101919641071852.0 → session / 101919641071852.0
    //   app-state-sync-version-regular_low → app-state-sync-version / regular_low

    const name = file.replace(/\.json$/, '');

    // Known type prefixes (longest match first)
    const typePrefixes = [
      'app-state-sync-version',
      'app-state-sync-key',
      'sender-key',
      'pre-key',
      'session',
    ];

    let type = null;
    let id = null;
    for (const prefix of typePrefixes) {
      if (name.startsWith(prefix + '-')) {
        type = prefix;
        id = name.slice(prefix.length + 1); // +1 for the hyphen
        break;
      }
    }

    if (!type) {
      console.warn(`  Skipping unknown file: ${file}`);
      continue;
    }

    const docId = `${type}_${id}`;
    const ref = keysRef.doc(docId);
    batch.set(ref, {
      value: raw,
      type,
      id,
      updated_at: new Date().toISOString(),
    });
    batchCount++;
    count++;

    if (batchCount >= 450) {
      await batch.commit();
      batch = firestore.batch();
      batchCount = 0;
      process.stdout.write(`\r  Migrated ${count} keys…`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\r✓ ${count} session keys migrated to Firestore`);
  console.log('\nMigration complete. The bot can now connect from GCE without scanning QR.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
