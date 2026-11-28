// Hivemind tools for Claude. Every write goes through the ontology repo, so it is
// validated and logged as an Event with actor "assistant". There is deliberately no
// delete tool, and nothing here can send a message: outbound stays a draft until a
// person approves it in Hivemind.
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { REGISTRY, PIPELINES, CLOSED_STAGES } from '../../ontology/index.js';

// Types Claude may read. Approvals are readable so the assistant knows its limits.
export const READABLE = ['organisation', 'person', 'interaction', 'task', 'deal', 'sample', 'commitment', 'decision', 'observation', 'outbox', 'approval', 'objective', 'workstream', 'status_report'];
// Types Claude may create or edit. Approvals (blanket permission) are Pratik's alone.
export const WRITABLE = ['organisation', 'person', 'interaction', 'task', 'deal', 'sample', 'commitment', 'decision', 'observation', 'outbox', 'objective', 'workstream', 'status_report'];

const label = (r) => r.name || r.title || r.text || r.subject || r.grade || r.summary || r.id;
const text = (r) => JSON.stringify(r).toLowerCase();
const json = (v) => ({ content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

/** Which records point at this one, across every type. */
function referencesTo(all, type, id) {
  const out = [];
  for (const [t, recs] of Object.entries(all)) {
    for (const r of recs) {
      if (r.id === id) continue;
      const hit =
        (r.links || []).some(l => l.type === type && l.id === id) ||
        (type === 'organisation' && (r.org_id === id || (r.org_ids || []).includes(id) || r.counterparty_id === id)) ||
        (type === 'person' && ((r.participant_ids || []).includes(id) || (r.owner_ids || []).includes(id) || (r.contact_ids || []).includes(id) || r.owner_id === id || r.assigned_to === id || r.counterparty_id === id || r.contact_id === id)) ||
        (type === 'deal' && r.deal_id === id) ||
        (type === 'objective' && (r.objective_ids || []).includes(id)) ||
        (type === 'workstream' && (r.workstreams || []).some(w => w.workstream_id === id)) ||
        (type === 'interaction' && r.linked_note_id === id);
      if (hit) out.push({ type: t, id: r.id, label: label(r), date: r.datetime || r.due_date || r.next_action_date || r.sent_date || r.created_at, status: r.status || r.stage });
    }
  }
  return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/**
 * Tool handlers, independent of MCP so they can be tested directly.
 * @param {ReturnType<import('../../ontology/repo.js').createRepo>} repo
 * @param {{ today?: () => string }} [opts]
 */
export function makeHandlers(repo, { today = () => new Date().toISOString().slice(0, 10) } = {}) {
  const loadAll = async (types = READABLE) => Object.fromEntries(await Promise.all(types.map(async t => [t, await repo.list(t)])));

  return {
    async describe({ type }) {
      if (!REGISTRY[type]) return fail(`Unknown type ${type}. Known: ${Object.keys(REGISTRY).join(', ')}`);
      const schema = zodToJsonSchema(REGISTRY[type].schema, { target: 'jsonSchema7', $refStrategy: 'none' });
      return json({ type, collection: REGISTRY[type].collection, writable: WRITABLE.includes(type), schema, ...(type === 'deal' ? { pipelines: PIPELINES } : {}) });
    },

    async search({ query, types, limit = 20 }) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const all = await loadAll(types?.length ? types : READABLE);
      const hits = [];
      for (const [t, recs] of Object.entries(all)) {
        for (const r of recs) {
          if (r.archived) continue;
          const hay = text(r);
          const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
          if (score === words.length) hits.push({ type: t, id: r.id, label: label(r), score, updated: r.updated_at || r.created_at });
        }
      }
      hits.sort((a, b) => b.score - a.score || String(b.updated).localeCompare(String(a.updated)));
      return json({ total: hits.length, results: hits.slice(0, limit) });
    },

    async get({ type, id }) {
      if (!READABLE.includes(type)) return fail(`Type ${type} is not readable.`);
      const rec = await repo.get(type, id);
      if (!rec) return fail(`${type} ${id} not found.`);
      const history = (await repo.history(type, id)).slice(0, 10);
      return json({ record: rec, history });
    },

    async timeline({ type, id, limit = 50 }) {
      const rec = await repo.get(type, id);
      if (!rec) return fail(`${type} ${id} not found.`);
      const all = await loadAll();
      return json({ record: { type, id, label: label(rec) }, related: referencesTo(all, type, id).slice(0, limit) });
    },

    async list({ type, where = {}, limit = 50 }) {
      if (!READABLE.includes(type)) return fail(`Type ${type} is not readable.`);
      const recs = (await repo.list(type)).filter(r => !r.archived && Object.entries(where).every(([k, v]) => (Array.isArray(r[k]) ? r[k].includes(v) : r[k] === v)));
      recs.sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
      return json({ total: recs.length, records: recs.slice(0, limit) });
    },

    /** Everything that needs a person's attention today. The core of the daily brief. */
    async attention() {
      const t = today();
      const all = await loadAll(['task', 'deal', 'commitment', 'observation', 'outbox', 'sample']);
      const overdue = (d) => d && d < t;
      return json({
        today: t,
        overdue_tasks: all.task.filter(x => x.status !== 'done' && overdue(x.due_date)).map(x => ({ id: x.id, title: x.title, due: x.due_date, owner: x.assigned_to_name })),
        overdue_commitments: all.commitment.filter(x => x.status === 'open' && overdue(x.due_date)).map(x => ({ id: x.id, text: x.text, due: x.due_date, owner_id: x.owner_id })),
        deals_needing_action: all.deal.filter(x => !CLOSED_STAGES.includes(x.stage) && (!x.next_action_date || x.next_action_date <= t)).map(x => ({ id: x.id, title: x.title, stage: x.stage, next_action: x.next_action, due: x.next_action_date })),
        samples_awaiting_feedback: all.sample.filter(x => ['sent', 'received', 'testing'].includes(x.status)).map(x => ({ id: x.id, grade: x.grade, org_id: x.org_id, sent: x.sent_date })),
        inbox_pending: all.observation.filter(x => x.status === 'pending').length,
        drafts_awaiting_approval: all.outbox.filter(x => x.status === 'draft').map(x => ({ id: x.id, to: x.to, subject: x.subject })),
      });
    },

    async create({ type, data }) {
      if (!WRITABLE.includes(type)) return fail(`Claude cannot create ${type} records.`);
      if (type === 'outbox' && data.status && data.status !== 'draft') return fail('Outbound messages are created as drafts. A person approves them in Hivemind.');
      if (type === 'observation' && data.status && data.status !== 'pending') return fail('Captured items start as pending.');
      try {
        const { id, created_at, created_by, ...clean } = data;
        const rec = await repo.create(type, { ...clean, ...(type === 'outbox' ? { status: 'draft' } : {}) });
        return json({ created: { type, id: rec.id, label: label(rec) }, record: rec });
      } catch (e) { return fail(e.message); }
    },

    async update({ type, id, patch }) {
      if (!WRITABLE.includes(type)) return fail(`Claude cannot edit ${type} records.`);
      const before = await repo.get(type, id);
      if (!before) return fail(`${type} ${id} not found.`);
      if (type === 'outbox') {
        if (!['draft'].includes(before.status)) return fail(`This message is ${before.status}; only drafts can be edited.`);
        if (patch.status && !['draft', 'cancelled'].includes(patch.status)) return fail('Claude can edit or cancel a draft, never approve or send it.');
        delete patch.approved_by; delete patch.approval_id;
      }
      const { created_at, created_by, ...clean } = patch;
      try {
        const rec = await repo.update(type, id, clean);
        return json({ updated: { type, id, label: label(rec) }, record: rec });
      } catch (e) { return fail(e.message); }
    },

    /** Put something extracted from a conversation into the capture inbox for a person to accept. */
    async capture({ kind, summary, payload, suggested_links = [], source_ref }) {
      try {
        const rec = await repo.create('observation', { kind, summary, payload, suggested_links, status: 'pending', source: { channel: 'assistant', ref: source_ref, by: 'assistant' } });
        return json({ captured: rec.id });
      } catch (e) { return fail(e.message); }
    },
  };
}

const TypeEnum = z.enum(READABLE);
const WritableEnum = z.enum(WRITABLE);
const Link = z.object({ type: z.string(), id: z.string() });

/** Register the handlers on an McpServer. */
export function registerTools(server, handlers) {
  const ro = { readOnlyHint: true, openWorldHint: false };
  server.registerTool('hivemind_describe', {
    title: 'Describe a Hivemind object type',
    description: 'Field definitions for an object type (JSON Schema), and for deals the pipelines and their stages. Call before creating or updating a type you have not used yet.',
    inputSchema: { type: z.enum(Object.keys(REGISTRY)) },
    annotations: ro,
  }, handlers.describe);

  server.registerTool('hivemind_search', {
    title: 'Search Hivemind',
    description: 'Find organisations, people, interactions (notes, calls, meetings), deals, tasks, samples, commitments and decisions whose content contains every word of the query.',
    inputSchema: { query: z.string().min(1), types: z.array(TypeEnum).optional(), limit: z.number().int().min(1).max(100).optional() },
    annotations: ro,
  }, handlers.search);

  server.registerTool('hivemind_get', {
    title: 'Get one Hivemind record',
    description: 'One record by type and id, with its last 10 change events.',
    inputSchema: { type: TypeEnum, id: z.string() },
    annotations: ro,
  }, handlers.get);

  server.registerTool('hivemind_timeline', {
    title: 'Everything linked to a record',
    description: 'For a person or organisation (or any record): every interaction, deal, sample, task and commitment that refers to it, newest first.',
    inputSchema: { type: TypeEnum, id: z.string(), limit: z.number().int().min(1).max(200).optional() },
    annotations: ro,
  }, handlers.timeline);

  server.registerTool('hivemind_list', {
    title: 'List Hivemind records',
    description: 'Records of one type, newest first, optionally filtered by exact field values, for example {"stage":"sample_sent"} or {"status":"open"}.',
    inputSchema: { type: TypeEnum, where: z.record(z.any()).optional(), limit: z.number().int().min(1).max(500).optional() },
    annotations: ro,
  }, handlers.list);

  server.registerTool('hivemind_attention', {
    title: 'What needs attention today',
    description: 'Overdue tasks and commitments, deals whose next action is due, samples awaiting feedback, pending inbox items and drafts awaiting approval. Use for the daily brief.',
    inputSchema: {},
    annotations: ro,
  }, handlers.attention);

  server.registerTool('hivemind_create', {
    title: 'Create a Hivemind record',
    description: 'Create a record. It is validated against the schema and logged as done by the assistant. Outbound messages (type outbox) are always saved as drafts for a person to approve; nothing is sent.',
    inputSchema: { type: WritableEnum, data: z.record(z.any()) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, handlers.create);

  server.registerTool('hivemind_update', {
    title: 'Update a Hivemind record',
    description: 'Change fields on a record. Validated and logged. Drafts in the outbox can be edited or cancelled, never approved.',
    inputSchema: { type: WritableEnum, id: z.string(), patch: z.record(z.any()) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, handlers.update);

  server.registerTool('hivemind_capture', {
    title: 'Send something to the capture inbox',
    description: 'For facts, people, commitments or decisions you extracted from a conversation and are not sure about: they wait in the inbox for a person to accept, edit or reject.',
    inputSchema: {
      kind: z.enum(['person', 'organisation', 'fact', 'commitment', 'decision', 'profile', 'email']),
      summary: z.string().min(1),
      payload: z.record(z.any()),
      suggested_links: z.array(Link).optional(),
      source_ref: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, handlers.capture);
}
