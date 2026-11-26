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

  const [data, setData] = useState({ people: [], notes: [], tasks: [] });
  const [loading, setLoading] = useState(true);

  // Global modals (note + task editors are app-level since they open from anywhere)
  const [editNote, setEditNote] = useState(null);
  const [editTask, setEditTask] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [people, notes, tasks] = await Promise.all([
        store.list('people'),
        store.list('notes'),
        store.list('tasks'),
      ]);
      setData({ people, notes, tasks });
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

  const savePerson = (p) => guarded(() => repo.save('person', { created_by: me, ...p }));
  const removePerson = (id) => guarded(() => repo.remove('person', id));

  const saveNote = (n) => {
    const { summaryEdited, __new, ...rest } = n;
    return guarded(() => repo.save('interaction', { created_by: me, logged_by: n.logged_by || me, ...rest }));
  };
  const removeNote = (id) => guarded(() => repo.remove('interaction', id));

  const saveTask = (t) => {
    const { __new, ...rest } = t;
    return guarded(() => repo.save('task', { created_by: me, ...rest }));
  };
  const removeTask = (id) => guarded(() => repo.remove('task', id));

  const openNewTask = (defaults = {}) => setEditTask({ __new: true, ...defaults });
  const openNewNote = (defaults = {}) => setEditNote({ __new: true, ...(typeof defaults === 'string' ? { type: defaults } : defaults) });

  const ctx = {
    cfg, setConfig, store, repo, me, user, data, loading, reload,
    savePerson, removePerson,
    saveNote, removeNote,
    saveTask, removeTask,
    editNote, setEditNote, openNewNote,
    editTask, setEditTask, openNewTask,
  };

  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}
