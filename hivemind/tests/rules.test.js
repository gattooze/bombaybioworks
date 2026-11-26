// Firestore security rules tests. Run with: npm run test:rules (starts the emulator).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { createRepo, firestoreClientAdapter } from '../ontology/index.js';

let env;
const T = '2026-11-27T10:00:00.000Z';
const base = (id, by = 'mk@bombaybioworks.com') => ({ id, created_at: T, created_by: by, tags: [], links: [], archived: false });

const as = (email) => env.authenticatedContext(email.replace(/\W/g, ''), { email }).firestore();
const team = () => as('mk@bombaybioworks.com');
const admin = () => as('connect@pratikagarwal.com');
const stranger = () => as('someone@gmail.com');

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hivemind',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const seed = (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));

describe('access', () => {
  it('keeps strangers out of everything', async () => {
    await seed('people/p1', { ...base('p1'), name: 'Ramesh' });
    await assertFails(getDoc(doc(stranger(), 'people/p1')));
    await assertFails(setDoc(doc(stranger(), 'people/p2'), { ...base('p2'), name: 'X' }));
  });

  it('closes collections that are not declared', async () => {
    await assertFails(setDoc(doc(team(), 'random/x'), { a: 1 }));
  });
});

describe('object shape', () => {
  it('requires id to match the document and audit fields to exist', async () => {
    await assertSucceeds(setDoc(doc(team(), 'organisations/o1'), { ...base('o1'), name: 'Ankur Carbons', name_key: 'ankur carbons', roles: [] }));
    await assertFails(setDoc(doc(team(), 'organisations/o2'), { ...base('wrong'), name: 'X', roles: [] }));
    await assertFails(setDoc(doc(team(), 'organisations/o3'), { id: 'o3', name: 'X', roles: [] }));
  });

  it('never lets created_by change', async () => {
    await seed('tasks/t1', { ...base('t1'), title: 'Send COA', status: 'todo' });
    await assertFails(updateDoc(doc(team(), 'tasks/t1'), { created_by: 'someone-else' }));
    await assertSucceeds(updateDoc(doc(team(), 'tasks/t1'), { status: 'done' }));
  });

  it('lets old records without audit fields be edited once the repo fills them', async () => {
    await seed('people/old', { id: 'old', name: 'Legacy' });
    await assertSucceeds(setDoc(doc(team(), 'people/old'), { id: 'old', name: 'Legacy', created_at: T, created_by: 'unknown' }));
  });

  it('rejects a deal in an unknown pipeline', async () => {
    await assertFails(setDoc(doc(team(), 'deals/d1'), { ...base('d1'), org_id: 'o1', pipeline: 'marketing', stage: 'lead' }));
  });
});

describe('event log', () => {
  const ev = (id, actor) => ({ id, at: T, actor, verb: 'created', object: { type: 'task', id: 't1' } });

  it('accepts events written as yourself', async () => {
    await assertSucceeds(setDoc(doc(team(), 'events/e1'), ev('e1', 'mk@bombaybioworks.com')));
  });
  it('rejects events written as someone else', async () => {
    await assertFails(setDoc(doc(team(), 'events/e2'), ev('e2', 'connect@pratikagarwal.com')));
  });
  it('is append-only', async () => {
    await seed('events/e3', ev('e3', 'mk@bombaybioworks.com'));
    await assertFails(updateDoc(doc(team(), 'events/e3'), { verb: 'deleted' }));
    await assertFails(deleteDoc(doc(admin(), 'events/e3')));
  });
  it('does not let a client claim it sent something', async () => {
    await assertFails(setDoc(doc(team(), 'events/e4'), { ...ev('e4', 'mk@bombaybioworks.com'), verb: 'sent' }));
  });
});

describe('outbox', () => {
  const msg = (id, extra = {}) => ({ ...base(id), channel: 'email', to: ['buyer@example.com'], body: 'Hi', status: 'draft', ...extra });

  it('lets the team draft and approve as themselves', async () => {
    await assertSucceeds(setDoc(doc(team(), 'outbox/m1'), msg('m1')));
    await assertSucceeds(updateDoc(doc(team(), 'outbox/m1'), { status: 'approved', approved_by: 'mk@bombaybioworks.com' }));
  });
  it('rejects approval on behalf of someone else', async () => {
    await seed('outbox/m2', msg('m2'));
    await assertFails(updateDoc(doc(team(), 'outbox/m2'), { status: 'approved', approved_by: 'connect@pratikagarwal.com' }));
  });
  it('never lets a client mark a message sent', async () => {
    await seed('outbox/m3', msg('m3', { status: 'approved' }));
    await assertFails(updateDoc(doc(team(), 'outbox/m3'), { status: 'sent' }));
    await assertFails(setDoc(doc(team(), 'outbox/m4'), msg('m4', { status: 'sent' })));
  });
  it('freezes a message once it has been sent', async () => {
    await seed('outbox/m5', msg('m5', { status: 'sent' }));
    await assertFails(updateDoc(doc(admin(), 'outbox/m5'), { status: 'draft' }));
    await assertFails(deleteDoc(doc(team(), 'outbox/m5')));
  });
});

describe('standing approvals', () => {
  const ap = (id) => ({ ...base(id, 'connect@pratikagarwal.com'), description: 'Supplier follow-ups', channel: 'email', max_sends: 20, sends_used: 0, expires_at: '2026-12-31T23:59:59.000Z', revoked: false });
  it('only Pratik can grant them', async () => {
    await assertFails(setDoc(doc(team(), 'approvals/a1'), ap('a1')));
    await assertSucceeds(setDoc(doc(admin(), 'approvals/a1'), ap('a1')));
  });
  it('cannot be deleted, only revoked', async () => {
    await seed('approvals/a2', ap('a2'));
    await assertFails(deleteDoc(doc(admin(), 'approvals/a2')));
    await assertSucceeds(updateDoc(doc(admin(), 'approvals/a2'), { revoked: true }));
  });
});

describe('the app repo against the real rules', () => {
  const repoAs = (email) => createRepo({ adapter: firestoreClientAdapter(as(email), { doc, getDoc, getDocs, collection, writeBatch }), actor: email });

  it('creates, updates and deletes every app type with its event', async () => {
    const repo = repoAs('mk@bombaybioworks.com');
    const org = await repo.create('organisation', { name: 'Ankur Carbons', roles: ['supplier'] });
    const p = await repo.create('person', { name: 'Ramesh Das', org_ids: [org.id] });
    await repo.update('person', p.id, { phone: '9864012345' });
    const n = await repo.create('interaction', { title: 'Plant visit', datetime: T, participant_ids: [p.id] });
    const t = await repo.create('task', { title: 'Send COA', status: 'todo' });
    await repo.create('deal', { title: 'Char supply', pipeline: 'sourcing', stage: 'identified', org_id: org.id });
    await repo.create('sample', { org_id: org.id, grade: 'BB-1000', qty: 2 });
    await repo.create('commitment', { text: 'Send samples by Friday', owner_id: p.id });
    await repo.create('decision', { text: 'Use steam activation for trials', decided_at: '2026-11-27' });
    await repo.create('outbox', { channel: 'email', to: ['buyer@example.com'], subject: 'Hi', body: 'Hello' });
    await repo.remove('task', t.id);
    await repo.remove('interaction', n.id);
    const events = await getDocs(collection(as('mk@bombaybioworks.com'), 'events'));
    expect(events.size).toBe(12);
  });

  it('blocks a repo acting under another email', async () => {
    const forged = createRepo({ adapter: firestoreClientAdapter(as('mk@bombaybioworks.com'), { doc, getDoc, getDocs, collection, writeBatch }), actor: 'connect@pratikagarwal.com' });
    await assertFails(forged.create('task', { title: 'X' }));
  });
});
