// The only way to read or write Hivemind objects.
// It validates every write against the ontology schema and records an Event in the
// same atomic commit, whatever the storage underneath (Firestore client, Firestore
// admin, IndexedDB, or an in-memory store in tests).
//
// Adapter contract:
//   get(collection, id)        → record | null
//   list(collection)           → record[]
//   commit(ops)                → atomically apply [{ kind: 'set'|'delete', collection, id, data? }]
import { REGISTRY, collectionOf } from './schemas.js';
import { orgKey } from './normalize.js';

export class ValidationError extends Error {
  constructor(type, issues) {
    super(`${REGISTRY[type]?.label || type}: ${issues.map(i => `${i.path.join('.') || 'record'} ${i.message}`).join('; ')}`);
    this.name = 'ValidationError';
    this.type = type;
    this.issues = issues;
  }
}

const defaultUid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID()
  : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2));

/** Firestore rejects undefined; drop it recursively from plain objects and arrays. */
export function stripUndefined(v) {
  if (Array.isArray(v)) return v.map(stripUndefined);
  if (v && typeof v === 'object' && v.constructor === Object) {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = stripUndefined(x);
    return out;
  }
  return v;
}

function prepare(type, rec) {
  if (type === 'organisation' && rec.name) rec.name_key = orgKey(rec.name);
  return rec;
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const skip = new Set(['updated_at', 'updated_by']);
  return [...keys].filter(k => !skip.has(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])).sort();
}

/**
 * @param {object} opts
 * @param {object} opts.adapter  storage adapter (see contract above)
 * @param {string} opts.actor    who is writing: an email, 'whatsapp-bot', 'assistant'
 * @param {object} [opts.source] default Source for records and events
 * @param {() => string} [opts.uid]
 * @param {() => string} [opts.now]
 */
export function createRepo({ adapter, actor, source = { channel: 'manual' }, uid = defaultUid, now = () => new Date().toISOString() }) {
  if (!adapter) throw new Error('createRepo needs an adapter');
  if (!actor) throw new Error('createRepo needs an actor');

  const parse = (type, rec) => {
    const r = REGISTRY[type];
    if (!r) throw new Error(`Unknown ontology type: ${type}`);
    const res = r.schema.safeParse(rec);
    if (!res.success) throw new ValidationError(type, res.error.issues);
    return stripUndefined(res.data);
  };

  const eventOp = (verb, type, objId, fields = [], summary = '', src = source) => {
    const ev = parse('event', { id: uid(), at: now(), actor, verb, object: { type, id: objId }, fields, summary, source: src });
    return { kind: 'set', collection: 'events', id: ev.id, data: ev };
  };

  const repo = {
    actor,

    validate(type, data) {
      try { return { ok: true, data: parse(type, data) }; }
      catch (e) { if (e instanceof ValidationError) return { ok: false, errors: e.issues, message: e.message }; throw e; }
    },

    async get(type, id) { return adapter.get(collectionOf(type), id); },

    async list(type) { return adapter.list(collectionOf(type)); },

    async create(type, data, { summary = '' } = {}) {
      if (type === 'event') throw new Error('Events are written by the repo only');
      const t = now();
      const rec = parse(type, prepare(type, {
        source,
        ...data,
        id: data.id || uid(),
        created_at: data.created_at || t,
        created_by: data.created_by || actor,
      }));
      await adapter.commit([
        { kind: 'set', collection: collectionOf(type), id: rec.id, data: rec },
        eventOp('created', type, rec.id, Object.keys(rec).sort(), summary || rec.name || rec.title || rec.text || '', rec.source || source),
      ]);
      return rec;
    },

    async update(type, id, patch, { summary = '', verb = 'updated' } = {}) {
      if (type === 'event') throw new Error('Events are append-only');
      const before = await adapter.get(collectionOf(type), id);
      if (!before) throw new Error(`${REGISTRY[type].label} ${id} not found`);
      const merged = prepare(type, {
        ...before,
        ...patch,
        id,
        // Older records may lack these; fill them rather than block the edit.
        created_at: before.created_at || patch.created_at || now(),
        created_by: before.created_by || patch.created_by || 'unknown',
        updated_at: now(),
        updated_by: actor,
      });
      const rec = parse(type, merged);
      const fields = changedFields(before, rec);
      await adapter.commit([
        { kind: 'set', collection: collectionOf(type), id, data: rec },
        eventOp(verb, type, id, fields, summary),
      ]);
      return rec;
    },

    /** Create when new, update when it exists. What the app forms call. */
    async save(type, data, opts) {
      if (data.id && await adapter.get(collectionOf(type), data.id)) {
        const { id, ...patch } = data;
        return repo.update(type, id, patch, opts);
      }
      return repo.create(type, data, opts);
    },

    async remove(type, id, { summary = '' } = {}) {
      if (type === 'event') throw new Error('Events are append-only');
      await adapter.commit([
        { kind: 'delete', collection: collectionOf(type), id },
        eventOp('deleted', type, id, [], summary),
      ]);
    },

    /** Events for one object, newest first. */
    async history(type, id) {
      const all = await adapter.list('events');
      return all.filter(e => e.object?.type === type && e.object?.id === id).sort((a, b) => a.at.localeCompare(b.at)).reverse();
    },
  };
  return repo;
}
