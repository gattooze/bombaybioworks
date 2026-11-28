import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { FirebaseAdapter, LocalAdapter, makeRepo } from '../lib/store.js';
import { uid, nowISO } from '../lib/utils.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const CFG_KEY = 'hivemind.config';
const loadCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } };
const saveCfg = (c) => localStorage.setItem(CFG_KEY, JSON.stringify(c));

export function AppProvider({ user, children }) {
  const [cfg, setCfg] = useState(loadCfg);
  // Use Firebase if user is signed in, local otherwise
  const store = useMemo(() => user ? FirebaseAdapter : LocalAdapter, [user]);
  const me = cfg.me || user?.displayName || 'Me';
  // Events and audit fields record the signed-in email (rules check it), else the local name.
  const repo = useMemo(() => makeRepo(store, user?.email || me), [store, user, me]);

  const [data, setData] = useState({ people: [], notes: [], tasks: [], organisations: [], observations: [], deals: [], samples: [], commitments: [] });
  const [loading, setLoading] = useState(true);

  // Global modals (note + task editors are app-level since they open from anywhere)
  const [editNote, setEditNote] = useState(null);
  const [editTask, setEditTask] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // CRM collections are optional: an older local store or a rules error must not blank the app.
      const soft = (c) => store.list(c).catch(e => { console.warn(`load ${c} failed`, e); return []; });
      const [people, notes, tasks, organisations, observations, deals, samples, commitments] = await Promise.all([
        store.list('people'),
        store.list('notes'),
        store.list('tasks'),
        soft('organisations'),
        soft('observations'),
        soft('deals'),
        soft('samples'),
        soft('commitments'),
      ]);
      setData({ people, notes, tasks, organisations, observations, deals, samples, commitments });
    } catch (e) {
      console.error('reload failed', e);
    }
    setLoading(false);
  }, [store]);

  useEffect(() => { reload(); }, [reload]);

  const setConfig = (c) => { saveCfg(c); setCfg(c); };

  // Every write goes through the ontology repo: validated, and logged as an Event.
  const guarded = async (fn) => {
    try { await fn(); }
    catch (e) { console.error(e); alert(e.message || 'Save failed'); throw e; }
    finally { reload(); }
  };

  const savePerson = (p) => guarded(() => repo.save('person', { created_by: repo.actor, ...p }));
  const removePerson = (id) => guarded(() => repo.remove('person', id));
  // CRM: records are archived, never deleted (Pratik's rule).
  const updatePerson = (id, patch, summary) => guarded(() => repo.update('person', id, patch, { summary }));
  const saveOrg = (o) => guarded(() => repo.save('organisation', { created_by: repo.actor, ...o }));
  const updateOrg = (id, patch, summary) => guarded(() => repo.update('organisation', id, patch, { summary }));
  // Generic CRM writes (deal, sample, commitment): validated and logged by the repo.
  const saveObj = (type, o) => guarded(() => repo.save(type, { created_by: repo.actor, ...o }));
  const updateObj = (type, id, patch, summary) => guarded(() => repo.update(type, id, patch, { summary }));
  const mergeRecords = (type, winnerId, loserId, picks) => guarded(() => repo.merge(type, winnerId, loserId, picks));
  const acceptObservation = (id, target) => guarded(() => repo.acceptObservation(id, target));
  const rejectObservation = (id, reason) => guarded(() => repo.rejectObservation(id, { reason }));

  const saveNote = (n) => {
    const { summaryEdited, __new, ...rest } = n;
    return guarded(() => repo.save('interaction', { created_by: repo.actor, logged_by: n.logged_by || me, ...rest }));
  };
  const removeNote = (id) => guarded(() => repo.remove('interaction', id));

  const saveTask = (t) => {
    const { __new, ...rest } = t;
    return guarded(() => repo.save('task', { created_by: repo.actor, ...rest }));
  };
  const removeTask = (id) => guarded(() => repo.remove('task', id));

  const openNewTask = (defaults = {}) => setEditTask({ __new: true, ...defaults });
  const openNewNote = (defaults = {}) => setEditNote({ __new: true, ...(typeof defaults === 'string' ? { type: defaults } : defaults) });

  const ctx = {
    cfg, setConfig, store, repo, me, user, data, loading, reload,
    savePerson, removePerson, updatePerson,
    saveOrg, updateOrg, mergeRecords, saveObj, updateObj,
    acceptObservation, rejectObservation,
    saveNote, removeNote,
    saveTask, removeTask,
    editNote, setEditNote, openNewNote,
    editTask, setEditTask, openNewTask,
  };

  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}
