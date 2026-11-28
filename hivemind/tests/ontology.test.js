import { describe, it, expect } from 'vitest';
import {
  createRepo, memoryAdapter, ValidationError,
  orgKey, phoneKey, findPersonDuplicates, findOrgDuplicates,
} from '../ontology/index.js';

let n = 0;
const fixed = () => createRepo({
  adapter: memoryAdapter(),
  actor: 'test@bombaybioworks.com',
  uid: () => `id-${++n}`,
  now: () => '2026-11-27T10:00:00.000Z',
});

describe('repo writes', () => {
  it('creates a record and an event in one commit', async () => {
    const repo = fixed();
    const org = await repo.create('organisation', { name: 'Ankur Carbons Pvt. Ltd.', roles: ['supplier'] });
    expect(org.name_key).toBe('ankur carbons');
    expect(org.created_by).toBe('test@bombaybioworks.com');
    const events = await repo.list('event');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ verb: 'created', object: { type: 'organisation', id: org.id } });
  });

  it('rejects an invalid record and writes nothing', async () => {
    const repo = fixed();
    await expect(repo.create('organisation', { name: '' })).rejects.toBeInstanceOf(ValidationError);
    expect(await repo.list('organisation')).toHaveLength(0);
    expect(await repo.list('event')).toHaveLength(0);
  });

  it('rejects a deal stage that is not in its pipeline', async () => {
    const repo = fixed();
    const err = await repo.create('deal', { title: 'Char offtake', pipeline: 'sales', stage: 'term_sheet', org_id: 'o1' }).catch(e => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toMatch(/not in the sales pipeline/);
  });

  it('records which fields changed on update', async () => {
    const repo = fixed();
    const d = await repo.create('deal', { title: 'AC grade trial', pipeline: 'sales', stage: 'lead', org_id: 'o1' });
    await repo.update('deal', d.id, { stage: 'sample_sent', next_action: 'Chase feedback' });
    const [latest] = await repo.history('deal', d.id);
    expect(latest.verb).toBe('updated');
    expect(latest.fields).toEqual(['next_action', 'stage']);
  });

  it('keeps unknown fields on legacy people and fills missing audit fields', async () => {
    const adapter = memoryAdapter({ people: [{ id: 'p1', name: 'Ramesh', legacy_field: 'keep me' }] });
    const repo = createRepo({ adapter, actor: 'a@b.com' });
    const p = await repo.update('person', 'p1', { phone: '98640 12345' });
    expect(p.legacy_field).toBe('keep me');
    expect(p.created_by).toBe('unknown');
    expect(p.updated_by).toBe('a@b.com');
  });

  it('save() creates new and updates existing', async () => {
    const repo = fixed();
    const t = await repo.save('task', { title: 'Send COA' });
    await repo.save('task', { ...t, status: 'done' });
    expect((await repo.get('task', t.id)).status).toBe('done');
    expect((await repo.list('event')).map(e => e.verb)).toEqual(['created', 'updated']);
  });

  it('never lets callers write events directly', async () => {
    const repo = fixed();
    await expect(repo.create('event', {})).rejects.toThrow(/repo only/);
  });

  it('strips undefined so Firestore accepts the write', async () => {
    const repo = fixed();
    const s = await repo.create('sample', { org_id: 'o1', grade: 'BB-1000', qty: 2, deal_id: undefined });
    expect('deal_id' in s).toBe(false);
  });

  it('requires at least one recipient on outbound messages', async () => {
    const repo = fixed();
    await expect(repo.create('outbox', { channel: 'email', to: [], body: 'Hi' })).rejects.toBeInstanceOf(ValidationError);
    const m = await repo.create('outbox', { channel: 'email', to: ['buyer@example.com'], subject: 'Samples', body: 'Hi' });
    expect(m.status).toBe('draft');
  });
});

describe('person segment', () => {
  it('defaults to unsorted and rejects unknown values', async () => {
    const repo = createRepo({ adapter: memoryAdapter(), actor: 'pa', source: { channel: 'manual' } });
    expect((await repo.create('person', { name: 'New Contact' })).segment).toBe('unsorted');
    expect((await repo.create('person', { name: 'Buyer', segment: 'demand' })).segment).toBe('demand');
    await expect(repo.create('person', { name: 'X', segment: 'friends' })).rejects.toThrow();
  });
});

describe('normalisation and duplicates', () => {
  it('normalises organisation names', () => {
    expect(orgKey('Assam Bamboo Co.')).toBe('assam bamboo');
    expect(orgKey('XYZ Carbons Private Limited')).toBe('xyz carbons');
    expect(orgKey('Smith & Sons Ltd')).toBe('smith and sons');
  });

  it('normalises Indian phone numbers', () => {
    expect(phoneKey('98640 12345')).toBe('+919864012345');
    expect(phoneKey('+91-98640-12345')).toBe('+919864012345');
    expect(phoneKey('098640 12345')).toBe('+919864012345');
  });

  it('finds strong and weak person duplicates', () => {
    const people = [
      { id: 'a', name: 'Ramesh Das', email: 'ramesh@xyz.in', phone: '' },
      { id: 'b', name: 'Priya', email: '', phone: '+91 98640 12345' },
    ];
    const byName = findPersonDuplicates({ name: 'Ramesh' }, people);
    expect(byName).toEqual([expect.objectContaining({ strength: 'weak' })]);
    const byPhone = findPersonDuplicates({ name: 'P. Sharma', phone: '9864012345' }, people);
    expect(byPhone[0]).toMatchObject({ strength: 'strong', reason: 'same phone' });
  });

  it('finds organisation duplicates across suffixes', () => {
    const orgs = [{ id: 'o1', name: 'Ankur Carbons Pvt Ltd', name_key: 'ankur carbons' }];
    expect(findOrgDuplicates({ name: 'ANKUR CARBONS LIMITED' }, orgs)).toHaveLength(1);
  });
});

describe('organisation migration plan', async () => {
  const { planOrgMigration } = await import('../scripts/migrate-orgs.mjs');
  it('groups people by normalised org name and reuses existing organisations', () => {
    const people = [
      { id: 'p1', name: 'A', org: 'Ankur Carbons Pvt Ltd' },
      { id: 'p2', name: 'B', org: 'ankur carbons' },
      { id: 'p3', name: 'C', org: 'IIT Guwahati' },
      { id: 'p4', name: 'D', org: '' },
    ];
    const existing = [{ id: 'o9', name: 'IIT Guwahati', name_key: 'iit guwahati' }];
    const { newOrgs, links, skipped } = planOrgMigration(people, existing);
    expect([...newOrgs.keys()]).toEqual(['ankur carbons']);
    expect(newOrgs.get('ankur carbons').people).toEqual(['A', 'B']);
    expect(links).toHaveLength(3);
    expect(skipped.map(s => s.id)).toEqual(['p4']);
  });
});

describe('company state', () => {
  it('validates objectives, workstreams and status reports', async () => {
    const repo = fixed();
    const o = await repo.create('objective', { title: 'First 1 MT steel order', target_date: '2027-03-31' });
    expect(o.status).toBe('active');
    const w = await repo.create('workstream', { name: 'Machinery', objective_ids: [o.id] });
    const s = await repo.create('status_report', { week_of: '2026-11-23', summary: 'Ontology live', workstreams: [{ workstream_id: w.id, health: 'on_track' }] });
    expect(s.workstreams[0].note).toBe('');
    await expect(repo.create('status_report', { week_of: '2026-11-23', summary: 'x', workstreams: [{ workstream_id: w.id, health: 'fine' }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.create('workstream', { name: 'X', status: 'stalled' })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('merge', () => {
  it('merges a duplicate person, re-points references and logs merged events', async () => {
    const repo = fixed();
    const org = await repo.create('organisation', { name: 'Ankur Carbons' });
    const a = await repo.create('person', { name: 'Ramesh Das', email: 'ramesh@ankur.in', tags: ['buyer'] });
    const b = await repo.create('person', { name: 'Ramesh', phone: '+919864012345', org_ids: [org.id], tags: ['assam'] });
    const note = await repo.create('interaction', { title: 'Call', datetime: '2026-11-20T10:00:00Z', participant_ids: [b.id, a.id] });
    const c = await repo.create('commitment', { text: 'Send price', owner_id: b.id, links: [{ type: 'person', id: b.id }] });
    const r = await repo.merge('person', a.id, b.id, { phone: '+919864012345' });
    expect(r.repointed).toBe(2);
    expect(r.winner).toMatchObject({ phone: '+919864012345', org_ids: [org.id], tags: ['buyer', 'assam'] });
    expect(r.loser).toMatchObject({ archived: true, merged_into: a.id });
    expect((await repo.get('interaction', note.id)).participant_ids).toEqual([a.id]);
    const cm = await repo.get('commitment', c.id);
    expect(cm.owner_id).toBe(a.id);
    expect(cm.links).toEqual([{ type: 'person', id: a.id }]);
    expect((await repo.history('person', b.id))[0].verb).toBe('merged');
  });

  it('merges organisations and re-points people', async () => {
    const repo = fixed();
    const o1 = await repo.create('organisation', { name: 'PepsiCo India', roles: ['customer'] });
    const o2 = await repo.create('organisation', { name: 'Pepsi', roles: ['partner'] });
    const p = await repo.create('person', { name: 'Anita', org_ids: [o2.id] });
    const r = await repo.merge('organisation', o1.id, o2.id);
    expect(r.winner.roles).toEqual(['customer', 'partner']);
    expect((await repo.get('person', p.id)).org_ids).toEqual([o1.id]);
  });

  it('refuses other types, self merges and archived records', async () => {
    const repo = fixed();
    const a = await repo.create('person', { name: 'A' });
    const b = await repo.create('person', { name: 'B' });
    await expect(repo.merge('deal', a.id, b.id)).rejects.toThrow();
    await expect(repo.merge('person', a.id, a.id)).rejects.toThrow();
    await repo.merge('person', a.id, b.id);
    await expect(repo.merge('person', a.id, b.id)).rejects.toThrow(/archived/);
  });
});

describe('capture inbox', () => {
  it('accepts an observation into a new record in one commit', async () => {
    const repo = fixed();
    const obs = await repo.create('observation', { kind: 'person', summary: 'New buyer Ravi', payload: { name: 'Ravi' } });
    const r = await repo.acceptObservation(obs.id, { type: 'person', data: { name: 'Ravi', segment: 'demand' } });
    expect(r.record.segment).toBe('demand');
    expect(r.observation).toMatchObject({ status: 'accepted', resolved_by: 'test@bombaybioworks.com', result_link: { type: 'person', id: r.record.id } });
    await expect(repo.acceptObservation(obs.id, { type: 'person', data: { name: 'Ravi' } })).rejects.toThrow(/already/);
  });

  it('merges an observation into an existing record, or rejects it', async () => {
    const repo = fixed();
    const p = await repo.create('person', { name: 'Ravi' });
    const o1 = await repo.create('observation', { kind: 'fact', summary: 'Ravi phone', payload: {} });
    const r = await repo.acceptObservation(o1.id, { type: 'person', id: p.id, data: { phone: '9864000000' } });
    expect(r.observation.status).toBe('merged');
    expect((await repo.get('person', p.id)).phone).toBe('9864000000');
    const o2 = await repo.create('observation', { kind: 'fact', summary: 'Noise', payload: {} });
    expect((await repo.rejectObservation(o2.id)).status).toBe('rejected');
    await expect(repo.acceptObservation(o2.id, { type: 'observation', data: {} })).rejects.toThrow();
  });
});
