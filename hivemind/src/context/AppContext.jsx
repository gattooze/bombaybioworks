import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { FirebaseAdapter, LocalAdapter } from '../lib/store.js';
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

  const savePerson = async (p) => {
    const rec = { id: p.id || uid(), created_at: p.created_at || nowISO(), created_by: p.created_by || me, ...p };
    await store.put('people', rec);
    reload();
  };
  const removePerson = async (id) => { await store.remove('people', id); reload(); };

  const saveNote = async (n) => {
    const { summaryEdited, ...rest } = n;
    const rec = { id: n.id || uid(), created_at: n.created_at || nowISO(), created_by: n.created_by || me, logged_by: n.logged_by || me, ...rest };
    await store.put('notes', rec);
    reload();
  };
  const removeNote = async (id) => { await store.remove('notes', id); reload(); };

  const saveTask = async (t) => {
    const { __new, ...rest } = t;
    const rec = { id: t.id || uid(), created_at: t.created_at || nowISO(), created_by: t.created_by || me, ...rest };
    await store.put('tasks', rec);
    reload();
  };
  const removeTask = async (id) => { await store.remove('tasks', id); reload(); };

  const openNewTask = (defaults = {}) => setEditTask({ __new: true, ...defaults });
  const openNewNote = (defaults = {}) => setEditNote({ __new: true, ...(typeof defaults === 'string' ? { type: defaults } : defaults) });

  const ctx = {
    cfg, setConfig, store, me, user, data, loading, reload,
    savePerson, removePerson,
    saveNote, removeNote,
    saveTask, removeTask,
    editNote, setEditNote, openNewNote,
    editTask, setEditTask, openNewTask,
  };

  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}
