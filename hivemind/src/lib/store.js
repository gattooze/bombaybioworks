import {
  db,
  storage,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  getDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from '../firebase.js';
import { uid } from './utils.js';
import { createRepo, firestoreClientAdapter, REGISTRY } from '../../ontology/index.js';

// ── IndexedDB (local fallback) ──────────────────────────────────────────────
const IDB_STORES = ['files', ...Object.values(REGISTRY).map(r => r.collection)];
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hivemind', 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      IDB_STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const idbAll = async (s) => { const d = await openIDB(); return new Promise((res, rej) => { const r = d.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); };
const idbGet = async (s, id) => { const d = await openIDB(); return new Promise((res, rej) => { const r = d.transaction(s).objectStore(s).get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
const idbPut = async (s, v) => { const d = await openIDB(); return new Promise((res, rej) => { const tx = d.transaction(s, 'readwrite'); tx.objectStore(s).put(v); tx.oncomplete = () => res(v); tx.onerror = () => rej(tx.error); }); };
const idbDel = async (s, id) => { const d = await openIDB(); return new Promise((res, rej) => { const tx = d.transaction(s, 'readwrite'); tx.objectStore(s).delete(id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); };

export const LocalAdapter = {
  mode: 'local',
  async list(t) { const r = await idbAll(t); return r.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); },
  async put(t, rec) { return idbPut(t, rec); },
  async remove(t, id) { return idbDel(t, id); },
  async uploadFile(file, meta) {
    const id = uid();
    await idbPut('files', { id, blob: file, name: file.name, type: file.type, size: file.size, created_at: new Date().toISOString(), ...meta });
    return { id, name: file.name, type: file.type, size: file.size, storage: 'local' };
  },
  async fileURL(att) {
    if (att.url) return att.url;
    const rec = await idbGet('files', att.id);
    return rec && rec.blob ? URL.createObjectURL(rec.blob) : null;
  },
  async removeFile(id) { return idbDel('files', id); },
  // Ontology adapter contract
  async get(t, id) { return (await idbGet(t, id)) || null; },
  async commit(ops) {
    for (const op of ops) { if (op.kind === 'set') await idbPut(op.collection, op.data); else await idbDel(op.collection, op.id); }
  },
};

// ── Firebase Adapter (Firestore + Storage) ──────────────────────────────────
const fsAdapter = firestoreClientAdapter(db, { doc, getDoc, getDocs, collection, writeBatch });

export const FirebaseAdapter = {
  mode: 'cloud',
  get: fsAdapter.get,
  commit: fsAdapter.commit,
  async list(collName) {
    const q = query(collection(db, collName), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },
  async put(collName, rec) {
    await setDoc(doc(db, collName, rec.id), rec, { merge: true });
    return rec;
  },
  async remove(collName, id) {
    await deleteDoc(doc(db, collName, id));
  },
  async uploadFile(file, meta) {
    const path = `attachments/${(meta && meta.folder) || 'misc'}/${uid()}-${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { id: path, name: file.name, type: file.type, size: file.size, url, storage: 'cloud' };
  },
  async fileURL(att) { return att.url || null; },
  async removeFile(path) {
    try { await deleteObject(ref(storage, path)); } catch (e) { console.warn('removeFile', e); }
  },
};

// ── Ontology repo: every app write goes through this ───────────────────────
export const makeRepo = (store, actor) => createRepo({ adapter: store, actor, source: { channel: 'manual', by: actor } });
