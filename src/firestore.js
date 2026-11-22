/**
 * Writes extracted intelligence directly into Hivemind's Firestore collections.
 * Uses the same schema as the Hivemind app (notes, people).
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { cfg } = require('./config');

let db;

function getDb() {
  if (db) return db;

  if (!admin.apps.length) {
    // Accept service account as JSON env var (for cloud/GCE) or file path (local dev)
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let credential;
    if (saJson) {
      credential = admin.credential.cert(JSON.parse(saJson));
    } else {
      const saPath = path.resolve(cfg.firebaseServiceAccount);
      if (!fs.existsSync(saPath)) {
        console.error(`Firebase service account not found at ${saPath}`);
        console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON env var or place serviceAccount.json here.');
        process.exit(1);
      }
      credential = admin.credential.cert(require(saPath));
    }
    admin.initializeApp({ credential, projectId: cfg.firebaseProjectId });
  }
  db = admin.firestore();
  return db;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + '-' +
         Math.random().toString(36).slice(2, 10) + '-' +
         Date.now().toString(36);
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * Write extracted facts from a batch as individual Hivemind notes.
 * Each fact becomes a note tagged 'whatsapp' + its category.
 */
async function writeFacts(facts) {
  if (!facts.length) return 0;
  const firestore = getDb();
  const batch = firestore.batch();
  let count = 0;

  for (const f of facts) {
    if (!f.context || !f.value) continue;
    const id = uid();
    const ref = firestore.collection('notes').doc(id);
    const title = `[WhatsApp] ${f.value}${f.unit ? ' ' + f.unit : ''} — ${f.category}`;
    batch.set(ref, {
      id,
      title,
      type: 'note',
      datetime: (() => { try { const d = new Date(f.date + 'T00:00:00+05:30'); return isNaN(d) ? nowISO() : d.toISOString(); } catch { return nowISO(); } })(),
      context: `Extracted from WhatsApp group. Sent by ${f.sender || 'unknown'} on ${f.date || 'unknown date'}.`,
      location: '',
      participant_ids: [],
      external_participants: [],
      tags: ['whatsapp', 'extracted', f.category || 'other'],
      body: `<p><strong>${f.value}${f.unit ? ' ' + f.unit : ''}</strong></p><p>${f.context}</p>`,
      summary: f.context,
      attachments: [],
      created_at: nowISO(),
      created_by: 'whatsapp-bot',
      logged_by: f.sender || 'whatsapp-bot',
      source_channel: 'whatsapp',
    });
    count++;
    // Firestore batch limit is 500
    if (count % 450 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();
  return count;
}

/**
 * Upsert people extracted from chat into Hivemind's people collection.
 * Skips team members (PA/MK/KV) — they're already in Firestore.
 */
const SKIP_NAMES = ['pratik', 'mukund', 'karan', 'pa', 'mk', 'kv'];

async function writePeople(people) {
  if (!people.length) return 0;
  const firestore = getDb();
  let count = 0;

  for (const p of people) {
    if (!p.name) continue;
    const nameLower = p.name.toLowerCase();
    if (SKIP_NAMES.some(s => nameLower.includes(s))) continue;

    // Check if person already exists by name
    const existing = await firestore.collection('people')
      .where('name', '==', p.name)
      .limit(1)
      .get();

    if (existing.empty) {
      // Create new person
      const id = uid();
      await firestore.collection('people').doc(id).set({
        id,
        name: p.name,
        org: '',
        role: '',
        email: '',
        phone: '',
        tags: ['whatsapp'],
        notes: p.context || '',
        created_at: nowISO(),
        created_by: 'whatsapp-bot',
        source_channel: 'whatsapp',
      });
      count++;
    } else {
      // Update notes with new context if different
      const doc = existing.docs[0];
      const existing_notes = doc.data().notes || '';
      if (p.context && !existing_notes.includes(p.context)) {
        await doc.ref.update({
          notes: existing_notes ? `${existing_notes}\n• ${p.context}` : p.context,
        });
      }
    }
  }

  return count;
}

/**
 * Write a live message observation as a note (used for messages with significant data).
 */
async function writeLiveMessage({ sender, text, msg_date, tags = [] }) {
  const firestore = getDb();
  const id = uid();
  await firestore.collection('notes').doc(id).set({
    id,
    title: `[WhatsApp] ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
    type: 'note',
    datetime: new Date().toISOString(),
    context: `Live message from ${sender} on ${msg_date}`,
    location: '',
    participant_ids: [],
    external_participants: [],
    tags: ['whatsapp', 'live', ...tags],
    body: `<p>${text}</p>`,
    summary: text.slice(0, 200),
    attachments: [],
    created_at: nowISO(),
    created_by: 'whatsapp-bot',
    logged_by: sender,
    source_channel: 'whatsapp',
  });
  return id;
}

/**
 * Fetch recent whatsapp-tagged notes for question answering context.
 */
async function fetchContext(limit = 60) {
  const firestore = getDb();
  // Fetch more than needed then filter in memory — avoids composite index requirement
  const snapshot = await firestore.collection('notes')
    .orderBy('datetime', 'desc')
    .limit(limit * 3)
    .get();
  return snapshot.docs
    .map(d => d.data())
    .filter(d => Array.isArray(d.tags) && d.tags.includes('whatsapp'))
    .slice(0, limit);
}

module.exports = { getDb, writeFacts, writePeople, writeLiveMessage, fetchContext };
