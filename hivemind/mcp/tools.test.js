import { describe, it, expect, beforeEach } from 'vitest';
import { createRepo, memoryAdapter } from '../ontology/index.js';
import { makeHandlers, registerTools } from './src/tools.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const T = '2026-11-27T10:00:00.000Z';
const base = (id) => ({ id, created_at: T, created_by: 'seed', tags: [], links: [], archived: false });
const out = (r) => JSON.parse(r.content[0].text);

let repo, h, adapter;
beforeEach(() => {
  adapter = memoryAdapter({
    organisations: [{ ...base('o1'), name: 'Ankur Carbons', name_key: 'ankur carbons', roles: ['supplier'], country: 'IN', notes: '', source: { channel: 'manual' } }],
    people: [{ ...base('p1'), name: 'Ramesh Das', org_ids: ['o1'], email: 'ramesh@ankur.in' }],
    notes: [{ ...base('n1'), title: 'Plant visit at Ankur', datetime: '2026-11-20T10:00:00Z', participant_ids: ['p1'], body: 'Char yield 28 percent' }],
    tasks: [{ ...base('t1'), title: 'Send COA', status: 'todo', due_date: '2026-11-25' }],
    deals: [{ ...base('d1'), title: 'Char supply', pipeline: 'sourcing', stage: 'visited', org_id: 'o1', next_action: 'Ask for price', next_action_date: '2026-11-26' }],
  });
  repo = createRepo({ adapter, actor: 'assistant', source: { channel: 'assistant' } });
  h = makeHandlers(repo, { today: () => '2026-11-27' });
});

describe('reading', () => {
  it('searches across types', async () => {
    const r = out(await h.search({ query: 'ankur' }));
    expect(r.results.map(x => x.type).sort()).toEqual(['interaction', 'organisation', 'person']);
  });

  it('builds a timeline for an organisation', async () => {
    const r = out(await h.timeline({ type: 'organisation', id: 'o1' }));
    expect(r.related.map(x => x.id).sort()).toEqual(['d1', 'p1']);
  });

  it('builds a timeline for a person from participants', async () => {
    const r = out(await h.timeline({ type: 'person', id: 'p1' }));
    expect(r.related.map(x => x.id)).toEqual(['n1']);
  });

  it('lists with filters', async () => {
    const r = out(await h.list({ type: 'deal', where: { pipeline: 'sourcing' } }));
    expect(r.total).toBe(1);
  });

  it('reports what needs attention today', async () => {
    const r = out(await h.attention());
    expect(r.overdue_tasks.map(x => x.id)).toEqual(['t1']);
    expect(r.deals_needing_action.map(x => x.id)).toEqual(['d1']);
  });

  it('describes a schema with pipelines for deals', async () => {
    const r = out(await h.describe({ type: 'deal' }));
    expect(r.pipelines.sales).toContain('sample_sent');
    expect(r.schema.properties).toHaveProperty('stage');
  });
});

describe('writing', () => {
  it('creates through the repo and logs the assistant as actor', async () => {
    const r = out(await h.create({ type: 'commitment', data: { text: 'MK sends samples by Friday', owner_id: 'p1', due_date: '2026-11-28' } }));
    const events = await repo.history('commitment', r.created.id);
    expect(events[0]).toMatchObject({ actor: 'assistant', verb: 'created' });
  });

  it('returns validation errors instead of throwing', async () => {
    const r = await h.create({ type: 'deal', data: { title: 'X', pipeline: 'sales', stage: 'visited', org_id: 'o1' } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/not in the sales pipeline/);
  });

  it('never creates approvals or events', async () => {
    expect((await h.create({ type: 'approval', data: {} })).isError).toBe(true);
    expect((await h.create({ type: 'event', data: {} })).isError).toBe(true);
  });

  it('forces outbound messages to drafts and blocks approval', async () => {
    expect((await h.create({ type: 'outbox', data: { channel: 'email', to: ['a@b.com'], body: 'Hi', status: 'approved' } })).isError).toBe(true);
    const m = out(await h.create({ type: 'outbox', data: { channel: 'email', to: ['a@b.com'], body: 'Hi' } }));
    expect(m.record.status).toBe('draft');
    expect((await h.update({ type: 'outbox', id: m.created.id, patch: { status: 'approved' } })).isError).toBe(true);
    expect(out(await h.update({ type: 'outbox', id: m.created.id, patch: { body: 'Hello' } })).record.body).toBe('Hello');
  });

  it('refuses to edit a message that has left the draft state', async () => {
    await adapter.commit([{ kind: 'set', collection: 'outbox', id: 'm9', data: { ...base('m9'), channel: 'email', to: ['a@b.com'], body: 'x', status: 'sent', from: 'f', cc: [], subject: '', category: '', source: { channel: 'manual' } } }]);
    expect((await h.update({ type: 'outbox', id: 'm9', patch: { body: 'y' } })).isError).toBe(true);
  });

  it('cannot rewrite who created a record', async () => {
    const r = out(await h.update({ type: 'task', id: 't1', patch: { status: 'done', created_by: 'someone' } }));
    expect(r.record.created_by).toBe('seed');
  });

  it('captures into the inbox as pending', async () => {
    const r = out(await h.capture({ kind: 'person', summary: 'New buyer Priya at XYZ', payload: { name: 'Priya' } }));
    expect((await repo.get('observation', r.captured)).status).toBe('pending');
  });
});

describe('MCP wiring', () => {
  it('exposes the tools over the protocol', async () => {
    const server = new McpServer({ name: 'hivemind', version: 'test' });
    registerTools(server, h);
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(b);
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name)).toEqual(expect.arrayContaining(['hivemind_search', 'hivemind_create', 'hivemind_attention']));
    expect(tools.map(t => t.name).some(n => /delete|send|approve/.test(n))).toBe(false);
    const res = await client.callTool({ name: 'hivemind_search', arguments: { query: 'Ramesh' } });
    expect(JSON.parse(res.content[0].text).results[0].id).toBe('p1');
  });
});
