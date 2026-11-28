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

  const createOps = (type, data, { summary = '' } = {}) => {
    if (type === 'event') throw new Error('Events are written by the repo only');
    const t = now();
    const rec = parse(type, prepare(type, {
      source,
      ...data,
      id: data.id || uid(),
      created_at: data.created_at || t,
      created_by: data.created_by || actor,
    }));
    return { rec, ops: [
      { kind: 'set', collection: collectionOf(type), id: rec.id, data: rec },
      eventOp('created', type, rec.id, Object.keys(rec).sort(), summary || rec.name || rec.title || rec.text || '', rec.source || source),
    ] };
  };

  const updateOps = async (type, id, patch, { summary = '', verb = 'updated', before: given } = {}) => {
    if (type === 'event') throw new Error('Events are append-only');
    const before = given || await adapter.get(collectionOf(type), id);
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
    return { rec, ops: [
      { kind: 'set', collection: collectionOf(type), id, data: rec },
      eventOp(verb, type, id, changedFields(before, rec), summary),
    ] };
  };

  const repo = {
    actor,

    validate(type, data) {
      try { return { ok: true, data: parse(type, data) }; }
      catch (e) { if (e instanceof ValidationError) return { ok: false, errors: e.issues, message: e.message }; throw e; }
    },

    async get(type, id) { return adapter.get(collectionOf(type), id); },

    async list(type) { return adapter.list(collectionOf(type)); },

    async create(type, data, opts = {}) {
      const { rec, ops } = createOps(type, data, opts);
      await adapter.commit(ops);
      return rec;
    },

    async update(type, id, patch, opts = {}) {
      const { rec, ops } = await updateOps(type, id, patch, opts);
      await adapter.commit(ops);
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

    /**
     * Merge a duplicate person or organisation into another, in one commit.
     * The winner keeps its values except for `picks` (field -> value to use); list fields are
     * unioned. The loser is archived with merged_into, and every reference to it is re-pointed.
     */
    async merge(type, winnerId, loserId, picks = {}) {
      if (!MERGEABLE.includes(type)) throw new Error(`Only ${MERGEABLE.join(' and ')} records can be merged`);
      if (winnerId === loserId) throw new Error('Cannot merge a record into itself');
      const col = collectionOf(type);
      const [winner, loser] = await Promise.all([adapter.get(col, winnerId), adapter.get(col, loserId)]);
      if (!winner || !loser) throw new Error(`${REGISTRY[type].label} not found`);
      if (winner.archived || loser.archived) throw new Error('Cannot merge an archived record');
      const unions = {};
      for (const k of UNION_FIELDS) {
        if (Array.isArray(winner[k]) || Array.isArray(loser[k])) {
          unions[k] = [...new Set([...(winner[k] || []), ...(loser[k] || [])])].filter(v => v !== winnerId && v !== loserId);
        }
      }
      if (unions.links) unions.links = dedupeLinks([...(winner.links || []), ...(loser.links || [])]).filter(l => !(l.type === type && (l.id === loserId || l.id === winnerId)));
      const ops = [];
      const w = await updateOps(type, winnerId, { ...unions, ...picks }, { verb: 'merged', summary: `Merged ${label(loser)} into this record`, before: winner });
      ops.push(...w.ops);
      const l = await updateOps(type, loserId, { archived: true, merged_into: winnerId }, { verb: 'merged', summary: `Merged into ${label(winner)}`, before: loser });
      ops.push(...l.ops);
      let repointed = 0;
      for (const t of Object.keys(REGISTRY)) {
        if (t === 'event') continue;
        for (const r of await adapter.list(collectionOf(t))) {
          if (r.id === winnerId || r.id === loserId) continue;
          const patch = repointPatch(r, type, loserId, winnerId);
          if (!patch) continue;
          const u = await updateOps(t, r.id, patch, { summary: `Re-pointed from merged ${REGISTRY[type].label.toLowerCase()} ${label(loser)}`, before: r });
          ops.push(...u.ops);
          repointed++;
        }
      }
      if (ops.length > 490) throw new Error(`Merge touches ${repointed} records, too many for one commit`);
      await adapter.commit(ops);
      return { winner: w.rec, loser: l.rec, repointed };
    },

    /**
     * Accept a capture-inbox item: create (or update, when target.id is given) the target
     * record and resolve the observation, in one commit.
     */
    async acceptObservation(obsId, target) {
      const obs = await adapter.get(collectionOf('observation'), obsId);
      if (!obs) throw new Error(`Observation ${obsId} not found`);
      if (obs.status !== 'pending') throw new Error(`Observation ${obsId} is already ${obs.status}`);
      const { type, id, data = {} } = target || {};
      if (!REGISTRY[type] || ['event', 'observation', 'approval'].includes(type)) throw new Error(`Cannot accept into ${type}`);
      const res = id ? await updateOps(type, id, data, { summary: `From inbox: ${obs.summary}` })
                     : createOps(type, data, { summary: `From inbox: ${obs.summary}` });
      const o = await updateOps('observation', obsId, {
        status: id ? 'merged' : 'accepted', resolved_by: actor, resolved_at: now(), result_link: { type, id: res.rec.id },
      }, { before: obs, summary: id ? 'Merged into an existing record' : 'Accepted' });
      await adapter.commit([...res.ops, ...o.ops]);
      return { record: res.rec, observation: o.rec };
    },

    async rejectObservation(obsId, { reason = '' } = {}) {
      const obs = await adapter.get(collectionOf('observation'), obsId);
      if (!obs) throw new Error(`Observation ${obsId} not found`);
      if (obs.status !== 'pending') throw new Error(`Observation ${obsId} is already ${obs.status}`);
      return repo.update('observation', obsId, { status: 'rejected', resolved_by: actor, resolved_at: now() }, { summary: reason || 'Rejected' });
    },
  };
  return repo;
}

const MERGEABLE = ['person', 'organisation'];
const UNION_FIELDS = ['org_ids', 'roles', 'tags', 'links'];
const label = (r) => r.name || r.title || r.id;
const dedupeLinks = (ls) => [...new Map(ls.map(l => [`${l.type}:${l.id}`, l])).values()];

// Fields that hold a person or organisation id, by kind of value.
const REF_SINGLE = ['org_id', 'contact_id', 'counterparty_id', 'owner_id', 'assigned_to'];
const REF_LIST = ['org_ids', 'contact_ids', 'participant_ids', 'owner_ids', 'decided_by'];

/** The patch that swaps loserId for winnerId on one record, or null if it does not refer to it. */
export function repointPatch(r, type, loserId, winnerId) {
  const patch = {};
  for (const k of REF_SINGLE) if (r[k] === loserId) patch[k] = winnerId;
  for (const k of REF_LIST) {
    if (Array.isArray(r[k]) && r[k].includes(loserId)) patch[k] = [...new Set(r[k].map(v => (v === loserId ? winnerId : v)))];
  }
  if ((r.links || []).some(l => l.type === type && l.id === loserId)) {
    patch.links = dedupeLinks(r.links.map(l => (l.type === type && l.id === loserId ? { type, id: winnerId } : l)));
  }
  if ((r.suggested_links || []).some(l => l.type === type && l.id === loserId)) {
    patch.suggested_links = dedupeLinks(r.suggested_links.map(l => (l.type === type && l.id === loserId ? { type, id: winnerId } : l)));
  }
  return Object.keys(patch).length ? patch : null;
}
