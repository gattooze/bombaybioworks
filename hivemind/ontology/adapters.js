// Storage adapters for the ontology repo. Each takes its SDK as an argument so this
// package never imports Firebase itself and runs in the browser, Node and tests alike.

/** In-memory store. Used by tests and dry runs. */
export function memoryAdapter(seed = {}) {
  const data = new Map(Object.entries(seed).map(([c, recs]) => [c, new Map(recs.map(r => [r.id, structuredClone(r)]))]));
  const coll = (c) => { if (!data.has(c)) data.set(c, new Map()); return data.get(c); };
  return {
    data,
    async get(c, id) { const r = coll(c).get(id); return r ? structuredClone(r) : null; },
    async list(c) { return [...coll(c).values()].map(r => structuredClone(r)); },
    async commit(ops) {
      for (const op of ops) {
        if (op.kind === 'set') coll(op.collection).set(op.id, structuredClone(op.data));
        else if (op.kind === 'delete') coll(op.collection).delete(op.id);
        else throw new Error(`Unknown op ${op.kind}`);
      }
    },
  };
}

/**
 * Firestore web SDK. Pass the functions from 'firebase/firestore':
 * firestoreClientAdapter(db, { doc, getDoc, getDocs, collection, writeBatch })
 */
export function firestoreClientAdapter(db, fs) {
  return {
    async get(c, id) { const s = await fs.getDoc(fs.doc(db, c, id)); return s.exists() ? s.data() : null; },
    async list(c) { const s = await fs.getDocs(fs.collection(db, c)); return s.docs.map(d => d.data()); },
    async commit(ops) {
      const b = fs.writeBatch(db);
      for (const op of ops) {
        const ref = fs.doc(db, op.collection, op.id);
        if (op.kind === 'set') b.set(ref, op.data); else b.delete(ref);
      }
      await b.commit();
    },
  };
}

/** firebase-admin Firestore (bot, scripts, MCP server). Bypasses rules, so validation here matters most. */
export function firestoreAdminAdapter(firestore) {
  return {
    async get(c, id) { const s = await firestore.collection(c).doc(id).get(); return s.exists ? s.data() : null; },
    async list(c) { const s = await firestore.collection(c).get(); return s.docs.map(d => d.data()); },
    async commit(ops) {
      const b = firestore.batch();
      for (const op of ops) {
        const ref = firestore.collection(op.collection).doc(op.id);
        if (op.kind === 'set') b.set(ref, op.data); else b.delete(ref);
      }
      await b.commit();
    },
  };
}
