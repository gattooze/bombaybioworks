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
      {/* Header — DS: nav-bg + blur, 56px nav-h, line border */}
      <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: 'var(--nav-bg)', borderBottom: '1px solid var(--line)', height: 'var(--nav-h)' }}>
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center gap-3">
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
              className="w-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 transition"
              style={{ background: 'var(--p-c)', border: '1px solid var(--line)', borderRadius: 'var(--r-full)', color: 'var(--tx)' }}
            />
            {results && (
              <div className="absolute mt-1 w-full overflow-hidden z-50 max-h-96 overflow-y-auto" style={{ background: 'var(--card)', border: '1px solid var(--line-hv)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-float)' }}>
                {!results.notes.length && !results.people.length && !results.tasks.length && (
                  <div className="p-3 text-sm" style={{ color: 'var(--tx2)' }}>No matches.</div>
                )}
                {results.notes.length > 0 && (
                  <>
                    <div className="type-caption px-3 pt-2" style={{ color: 'var(--tx3)' }}>Notes</div>
                    {results.notes.map(n => (
                      <button key={n.id} onClick={() => { setOpenNoteId(n.id); setSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-forest-50 text-sm transition" style={{ color: 'var(--tx)' }}>
                        {typeOf(n.type).icon} {n.title} <span style={{ color: 'var(--tx3)' }}>· {fmtDate(n.datetime)}</span>
                      </button>
                    ))}
                  </>
                )}
                {results.tasks.length > 0 && (
                  <>
                    <div className="type-caption px-3 pt-2" style={{ color: 'var(--tx3)' }}>Tasks</div>
                    {results.tasks.map(t => (
                      <button key={t.id} onClick={() => { setEditTask(t); setSearch(''); navigate('/tasks'); }} className="w-full text-left px-3 py-2 hover:bg-forest-50 text-sm transition" style={{ color: 'var(--tx)' }}>
                        ✅ {t.title} <span style={{ color: 'var(--tx3)' }}>{t.assigned_to_name ? '· ' + t.assigned_to_name : ''}</span>
                      </button>
                    ))}
                  </>
                )}
                {results.people.length > 0 && (
                  <>
                    <div className="type-caption px-3 pt-2" style={{ color: 'var(--tx3)' }}>People</div>
                    {results.people.map(p => (
                      <button key={p.id} onClick={() => { navigate('/crm?person=' + p.id); setSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-forest-50 text-sm transition" style={{ color: 'var(--tx)' }}>
                        🙋 {p.name} <span style={{ color: 'var(--tx3)' }}>· {p.org}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* User avatar + menu */}
          {user && (
            <div className="hidden sm:flex items-center gap-2 relative">
              <div onClick={() => setShowUserMenu(v => !v)} className="cursor-pointer hover:opacity-80 transition">
                <Avatar name={me} size={32} />
              </div>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 py-1 w-44" style={{ background: 'var(--card)', border: '1px solid var(--line-hv)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-float)' }}>
                    <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                      <div className="text-xs font-semibold truncate" style={{ color: 'var(--tx)' }}>{me}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--tx3)' }}>{user.email}</div>
                    </div>
                    <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-forest-50 transition" style={{ color: 'var(--tx)' }}>
                      Settings
                    </button>
                    <button onClick={() => { signOut(auth); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                      Sign out
                    </button>
                  </div>
                </>
              )}
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
