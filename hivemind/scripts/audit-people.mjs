#!/usr/bin/env node
// READ-ONLY audit of the `people` collection. Proposes what to delete, convert, merge or keep.
// It never writes to Firestore. Output goes to ./people-audit/ (JSON + Markdown + CSV).
//
//   GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/audit-people.mjs
//   node scripts/audit-people.mjs --from people.json   # offline, from an exported array
import fs from 'node:fs';
import { findPersonDuplicates, personNameKey, phoneKey } from '../ontology/index.js';

const FOUNDERS = new Set([
  'b74cd94f-1949-407a-af1e-18985667ade3', '3acbe1d8-a619-4627-911b-1384446aa47d', 'c50858cb-a46c-4686-8ebf-0b948dd19eb1',
]);
const ORG_WORDS = /\b(ltd|limited|pvt|private|llp|inc|corp|corporation|industries|industry|group|enterprises?|traders?|trading|exports?|imports?|carbons?|chemicals?|steel|power|energy|foods?|textiles?|pharma|solutions|technologies|systems|bank|university|institute|associates)\b/i;
const GENERIC = /^(unknown|user|admin|group|everyone|all|me|you|sir|madam|team|company|customer|client|supplier|buyer|seller|bot|test|na|n\/a|none|null|undefined)$/i;
const UNITS = /^(mt|kg|kgs|ton|tons|tonne|tonnes|rs|inr|usd|lakh|lakhs|crore|cr|pcs|nos)$/i;

const hasLetters = (s) => /\p{L}/u.test(s);
const refCount = (id, refs) => refs.get(id) || 0;

/** Pure, exported for tests. people: all person docs; refs: Map(personId → count of notes/tasks mentioning them). */
export function auditPeople(people, refs = new Map()) {
  const dupes = new Map(); // id → [{id,name,reason,strength}]
  for (const p of people) {
    const d = findPersonDuplicates(p, people);
    if (d.length) dupes.set(p.id, d.map(x => ({ id: x.person.id, name: x.person.name, reason: x.reason, strength: x.strength })));
  }
  const rows = people.map((p) => {
    const name = String(p.name || '').trim();
    const bot = p.created_by === 'whatsapp-bot';
    const contactable = !!(p.email || phoneKey(p.phone) || p.linkedin_url);
    const linked = !!(p.org_ids?.length || (p.org || '').trim());
    const refs_n = refCount(p.id, refs);
    const reasons = [];
    let action = 'keep';

    const protectedRec = FOUNDERS.has(p.id) || p.is_team || !bot || contactable || linked || refs_n > 0;
    const junkName = !hasLetters(name) || name.length < 2 || /^https?:|^www\.|@/.test(name) || GENERIC.test(name) || UNITS.test(name) || /^[\d\s.,+\-/:]+$/.test(name);
    const orgLike = ORG_WORDS.test(name);

    if (junkName) { reasons.push('name has no letters, or is a generic word, unit or link'); action = protectedRec ? 'review' : 'delete'; }
    else if (orgLike) { reasons.push('name looks like a company'); action = 'convert_to_org'; }
    else if (bot && !protectedRec) {
      const single = personNameKey(name).split(' ').length === 1;
      if (single) { reasons.push('bot-created, first name only, no contact, org or references'); action = 'review'; }
    }
    if (dupes.has(p.id) && action === 'keep') {
      const strong = dupes.get(p.id).some(d => d.strength === 'strong');
      action = 'merge'; reasons.push(strong ? 'same email or phone as another record' : 'same or overlapping name as another record');
    }
    if (protectedRec && action === 'delete') action = 'review';
    return { id: p.id, name, org: p.org || '', email: p.email || '', phone: p.phone || '', created_by: p.created_by || '', refs: refs_n, action, reasons, duplicates: dupes.get(p.id) || [] };
  });
  const counts = rows.reduce((a, r) => (a[r.action] = (a[r.action] || 0) + 1, a), {});
  return { total: people.length, counts, rows };
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function load() {
  const i = process.argv.indexOf('--from');
  if (i >= 0) return { people: JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8')), notes: [], tasks: [] };
  const { default: admin } = await import('firebase-admin');
  const pi = process.argv.indexOf('--project');
  admin.initializeApp({ projectId: pi >= 0 ? process.argv[pi + 1] : 'bombay-bioworks' });
  const db = admin.firestore();
  const all = async (c) => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
  return { people: await all('people'), notes: await all('notes'), tasks: await all('tasks') };
}

async function main() {
  const { people, notes, tasks } = await load();
  const refs = new Map();
  for (const rec of [...notes, ...tasks]) {
    for (const id of new Set([...(rec.participant_ids || []), ...(rec.assignee_ids || []), rec.assignee, rec.owner_id].filter(Boolean))) refs.set(id, (refs.get(id) || 0) + 1);
  }
  const res = auditPeople(people, refs);
  fs.mkdirSync('people-audit', { recursive: true });
  fs.writeFileSync('people-audit/audit.json', JSON.stringify(res, null, 2));
  fs.writeFileSync('people-audit/audit.csv', ['id,name,action,reasons,org,email,phone,created_by,refs,duplicates']
    .concat(res.rows.map(r => [r.id, r.name, r.action, r.reasons.join('; '), r.org, r.email, r.phone, r.created_by, r.refs, r.duplicates.map(d => d.name).join(' | ')].map(csvCell).join(','))).join('\n'));
  const md = [`# People audit: ${res.total} records`, '', Object.entries(res.counts).map(([k, v]) => `- ${k}: ${v}`).join('\n'), ''];
  for (const a of ['delete', 'convert_to_org', 'merge', 'review']) {
    const rs = res.rows.filter(r => r.action === a);
    if (!rs.length) continue;
    md.push(`## ${a} (${rs.length})`, '', ...rs.map(r => `- ${r.name || '(blank)'} (${r.id.slice(0, 8)}): ${r.reasons.join('; ')}${r.duplicates.length ? ' → ' + r.duplicates.map(d => d.name).join(', ') : ''}`), '');
  }
  fs.writeFileSync('people-audit/audit.md', md.join('\n'));
  console.log(res.counts, '\nWrote people-audit/audit.{md,csv,json}. Nothing was changed in Firestore.');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
