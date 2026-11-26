#!/usr/bin/env node
// Turns the free-text `people.org` field into Organisation records and links each
// person to theirs through `org_ids`. Dry run by default: prints the plan, writes nothing.
//
//   npm run migrate:orgs                      # dry run against the project in GOOGLE_APPLICATION_CREDENTIALS
//   npm run migrate:orgs -- --apply           # write it
//   npm run migrate:orgs -- --project bombay-bioworks-staging
//
// Every write goes through the ontology repo, so each new organisation and each
// person update gets an Event with actor "migration".
import admin from 'firebase-admin';
import { createRepo, firestoreAdminAdapter, memoryAdapter, orgKey } from '../ontology/index.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const pi = args.indexOf('--project');
const projectId = pi >= 0 ? args[pi + 1] : (process.env.GCLOUD_PROJECT || 'bombay-bioworks');


/** Pure planning step, exported for tests. */
export function planOrgMigration(people, existingOrgs) {
  const byKey = new Map(existingOrgs.map(o => [o.name_key || orgKey(o.name), o]));
  const newOrgs = new Map(); // key → { name, people: [] }
  const links = [];          // { personId, key }
  const skipped = [];
  for (const p of people) {
    const raw = (p.org || '').trim();
    if (!raw) { skipped.push({ id: p.id, name: p.name, why: 'no org text' }); continue; }
    const key = orgKey(raw);
    if (!key) { skipped.push({ id: p.id, name: p.name, why: `org "${raw}" is empty after normalising` }); continue; }
    if (!byKey.has(key) && !newOrgs.has(key)) newOrgs.set(key, { name: raw, people: [] });
    newOrgs.get(key)?.people.push(p.name);
    links.push({ personId: p.id, key });
  }
  return { newOrgs, links, skipped, byKey };
}

async function main() {
  admin.initializeApp({ projectId });
  const live = firestoreAdminAdapter(admin.firestore());
  console.log(`Project: ${projectId}  Mode: ${apply ? 'APPLY' : 'dry run'}`);
  const people = await live.list('people');
  const orgs = await live.list('organisations');
  const { newOrgs, links, skipped, byKey } = planOrgMigration(people, orgs);

  console.log(`\n${people.length} people, ${orgs.length} existing organisations`);
  console.log(`${newOrgs.size} organisations to create:`);
  for (const [key, o] of newOrgs) console.log(`  + ${o.name}  [${key}]  ← ${o.people.join(', ')}`);
  console.log(`${links.length} people to link, ${skipped.length} skipped`);
  for (const s of skipped) console.log(`  - ${s.name}: ${s.why}`);

  // Dry run still executes every write against an in-memory copy, so schema errors surface now.
  const adapter = apply ? live : memoryAdapter({ people, organisations: orgs });
  const repo = createRepo({ adapter, actor: 'migration', source: { channel: 'import', by: 'migrate-orgs' } });

  const idByKey = new Map([...byKey].map(([k, o]) => [k, o.id]));
  for (const [key, o] of newOrgs) {
    const rec = await repo.create('organisation', { name: o.name, roles: [] }, { summary: 'Created from people.org' });
    idByKey.set(key, rec.id);
  }
  let linked = 0;
  for (const { personId, key } of links) {
    const person = people.find(p => p.id === personId);
    const orgId = idByKey.get(key);
    if ((person.org_ids || []).includes(orgId)) continue;
    await repo.update('person', personId, { org_ids: [...(person.org_ids || []), orgId] }, { summary: 'Linked to organisation' });
    linked++;
  }
  console.log(`\n${apply ? 'Wrote' : 'Would write'} ${newOrgs.size} organisations and ${linked} person links.`);
  if (!apply) console.log('Nothing was written. Re-run with --apply to write.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1); });
}
