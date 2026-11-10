import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { fmtDate, typeOf, cx } from '../../lib/utils.js';
import { Tag, TypeBadge, Empty, Btn } from '../../components/ui.jsx';

function NoteCard({ note, onClick }) {
  const t = typeOf(note.type);
  const { data } = useApp();
  const participants = (note.participant_ids || []).map(pid => data.people.find(p => p.id === pid)?.name).filter(Boolean);

  return (
    <button
      onClick={onClick}
      className="p-4 text-left w-full group transition"
      style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-hv)'; e.currentTarget.style.boxShadow = 'var(--shadow-card-forest)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="type-h4 leading-snug line-clamp-2 flex-1 transition" style={{ color: 'var(--tx)' }}>{note.title}</span>
        <TypeBadge type={note.type} />
      </div>
      {note.summary && (
        <p className="type-body-sm leading-relaxed mb-2 line-clamp-2" style={{ color: 'var(--tx2)' }}>{note.summary}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="type-caption" style={{ color: 'var(--tx3)' }}>{fmtDate(note.datetime)}</span>
          {participants.length > 0 && (
            <span className="type-caption" style={{ color: 'var(--tx3)' }}>· {participants.slice(0, 2).join(', ')}{participants.length > 2 ? ` +${participants.length - 2}` : ''}</span>
          )}
        </div>
        {(note.tags || []).length > 0 && (
          <div className="flex gap-1">
            {note.tags.slice(0, 2).map(t => <Tag key={t} small>{t}</Tag>)}
          </div>
        )}
      </div>
    </button>
  );
}

const TYPES_FILTER = [
  { id: 'all', label: 'All' },
  { id: 'in_person', label: 'In person' },
  { id: 'phone', label: 'Phone' },
  { id: 'video', label: 'Video' },
  { id: 'email', label: 'Email' },
  { id: 'note', label: 'Note' },
  { id: 'other', label: 'Other' },
];

export default function NotesView() {
  const { data, openNewNote } = useApp();
  const ctx = useOutletContext() || {};
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const notes = data.notes
    .filter(n => typeFilter === 'all' || n.type === typeFilter)
    .filter(n => !search.trim() || (n.title + n.summary + n.context + (n.tags || []).join(' ')).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tx)', letterSpacing: '-0.03em' }}>Notes</h1>
          <p className="text-sm" style={{ color: 'var(--tx2)' }}>{data.notes.length} interaction{data.notes.length !== 1 ? 's' : ''} logged</p>
        </div>
        <Btn onClick={() => openNewNote()}>＋ New note</Btn>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 flex-1 max-w-xs transition"
          style={{ background: 'var(--card)', border: '1px solid var(--line-hv)', borderRadius: 'var(--r-md)', color: 'var(--tx)' }}
        />
        <div className="flex gap-1 flex-wrap">
          {TYPES_FILTER.map(t => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className="px-3 py-1 text-xs font-medium transition"
              style={typeFilter === t.id
                ? { background: 'var(--p)', color: '#fff', borderRadius: 'var(--r-full)', border: '1px solid var(--p)' }
                : { background: 'var(--card)', color: 'var(--tx2)', borderRadius: 'var(--r-full)', border: '1px solid var(--line-hv)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {notes.length === 0 ? (
        <Empty icon="📝" label={search ? 'No matching notes' : 'No notes yet'} action={!search ? { label: 'Log first interaction', onClick: () => openNewNote() } : null} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} onClick={() => ctx.setOpenNoteId?.(note.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
