import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { auth, signOut } from '../firebase.js';
import { cx, typeOf, fmtDate, stripHtml } from '../lib/utils.js';
import BBLogo from '../components/BBLogo.jsx';
import Avatar from '../components/Avatar.jsx';
import { Modal } from '../components/ui.jsx';
import NoteFormModule from '../modules/notes/NoteForm.jsx';
import TaskFormModule from '../modules/tasks/TaskForm.jsx';
import NoteDetailModule from '../modules/notes/NoteDetail.jsx';

const ROUTE_LABELS = {
  '/':        'Hivemind',
  '/notes':   'Notes',
  '/crm':     'People',
  '/tasks':   'Tasks',
  '/timeline':'Timeline',
  '/settings':'Settings',
};

export default function Shell() {
  const { me, user, data, editNote, setEditNote, editTask, setEditTask, saveNote, saveTask, removeTask } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [openNoteId, setOpenNoteId] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Global search results
  const results = (() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return {
      notes:  data.notes.filter(n => (n.title + n.summary + stripHtml(n.body) + n.context).toLowerCase().includes(q)).slice(0, 4),
      people: data.people.filter(p => (p.name + p.org + p.role + (p.tags || []).join('')).toLowerCase().includes(q)).slice(0, 4),
      tasks:  (data.tasks || []).filter(t => (t.title + (t.description || '') + (t.assigned_to_name || '')).toLowerCase().includes(q)).slice(0, 4),
    };
  })();

  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-forest-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 font-extrabold text-slate-800 hover:text-forest-700 transition shrink-0"
          >
            <BBLogo size={28} />
            <span>Hivemind</span>
            {!isHome && (
              <span className="hidden sm:inline text-xs font-medium text-slate-400 ml-1">
                · {ROUTE_LABELS[location.pathname] || ''}
              </span>
            )}
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md mx-auto relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search the hive…"
              className="w-full rounded-full bg-forest-50 border border-forest-100 px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
            />
            {results && (
              <div className="absolute mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
                {!results.notes.length && !results.people.length && !results.tasks.length && (
                  <div className="p-3 text-sm text-slate-400">No matches.</div>
                )}
                {results.notes.length > 0 && (
                  <>
                    <div className="px-3 pt-2 text-[11px] font-semibold text-slate-400 uppercase">Notes</div>
                    {results.notes.map(n => (
                      <button key={n.id} onClick={() => { setOpenNoteId(n.id); setSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-forest-50 text-sm">
                        {typeOf(n.type).icon} {n.title} <span className="text-slate-400">· {fmtDate(n.datetime)}</span>
                      </button>
                    ))}
                  </>
                )}
                {results.tasks.length > 0 && (
                  <>
                    <div className="px-3 pt-2 text-[11px] font-semibold text-slate-400 uppercase">Tasks</div>
                    {results.tasks.map(t => (
                      <button key={t.id} onClick={() => { setEditTask(t); setSearch(''); navigate('/tasks'); }} className="w-full text-left px-3 py-2 hover:bg-forest-50 text-sm">
                        ✅ {t.title} <span className="text-slate-400">{t.assigned_to_name ? '· ' + t.assigned_to_name : ''}</span>
                      </button>
                    ))}
                  </>
                )}
                {results.people.length > 0 && (
                  <>
                    <div className="px-3 pt-2 text-[11px] font-semibold text-slate-400 uppercase">People</div>
                    {results.people.map(p => (
                      <button key={p.id} onClick={() => { navigate('/crm?person=' + p.id); setSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-forest-50 text-sm">
                        🙋 {p.name} <span className="text-slate-400">· {p.org}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* User avatar + sign out */}
          {user && (
            <div className="hidden sm:flex items-center gap-2">
              <div title={`${me} · Sign out`} onClick={() => signOut(auth)} className="cursor-pointer hover:opacity-70 transition">
                <Avatar name={me} size={32} />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet context={{ setOpenNoteId }} />
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        🧠 Hivemind · Bombay Bioworks
      </footer>

      {/* Global: note detail */}
      {openNoteId && (
        <NoteDetailModule
          id={openNoteId}
          onClose={() => setOpenNoteId(null)}
          onEdit={n => { setOpenNoteId(null); setEditNote(n); }}
        />
      )}

      {/* Global: note editor modal */}
      {editNote && (
        <Modal wide open onClose={() => setEditNote(null)} title={editNote.__new ? 'New note' : 'Edit note'}>
          <NoteFormModule
            note={editNote.__new ? null : editNote}
            defaultType={editNote.type}
            onSave={saveNote}
            onClose={() => setEditNote(null)}
          />
        </Modal>
      )}

      {/* Global: task editor modal */}
      {editTask && (
        <Modal open onClose={() => setEditTask(null)} title={editTask.__new ? 'New task' : 'Edit task'}>
          {!editTask.__new && (
            <div className="flex justify-end mb-3">
              <button
                className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg"
                onClick={() => { if (confirm('Delete this task?')) { removeTask(editTask.id); setEditTask(null); } }}
              >
                Delete task
              </button>
            </div>
          )}
          <TaskFormModule
            task={editTask.__new ? null : editTask}
            defaults={editTask.__new ? editTask : {}}
            onSave={async (t) => { await saveTask(t); setEditTask(null); }}
            onClose={() => setEditTask(null)}
          />
        </Modal>
      )}
    </div>
  );
}
