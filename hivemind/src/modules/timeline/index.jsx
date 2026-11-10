import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { fmtDate, typeOf, cx } from '../../lib/utils.js';
import { Empty } from '../../components/ui.jsx';
import Avatar from '../../components/Avatar.jsx';

function groupByMonth(notes) {
  const groups = {};
  for (const note of notes) {
    const d = new Date(note.datetime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, notes: [] };
    groups[key].notes.push(note);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function TimelineView() {
  const { data } = useApp();
  const ctx = useOutletContext() || {};
  const [search, setSearch] = useState('');

  const notes = data.notes
    .filter(n => !search.trim() || (n.title + n.summary + (n.participant_ids || []).map(id => data.people.find(p => p.id === id)?.name || '').join(' ')).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  const groups = groupByMonth(notes);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Timeline</h1>
          <p className="text-sm text-slate-400">Every interaction, in order</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 bg-white max-w-xs"
        />
      </div>

      {notes.length === 0 ? (
        <Empty icon="🕸️" label={search ? 'No matching interactions' : 'No interactions yet'} />
      ) : (
        <div className="space-y-8">
          {groups.map(([key, group]) => (
            <div key={key}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.label}</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">{group.notes.length}</span>
              </div>
              <div className="space-y-3 relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
                {group.notes.map(note => {
                  const t = typeOf(note.type);
                  const participants = (note.participant_ids || []).map(id => data.people.find(p => p.id === id)).filter(Boolean);
                  return (
                    <div key={note.id} className="flex gap-4 pl-10 relative">
                      <span
                        className="absolute left-0 top-3 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                        style={{ background: t.color + '20', border: `2px solid ${t.color}40` }}
                      >
                        {t.icon}
                      </span>
                      <button
                        onClick={() => ctx.setOpenNoteId && ctx.setOpenNoteId(note.id)}
                        className="flex-1 bg-white rounded-xl border border-slate-200 p-4 text-left hover:shadow-md hover:border-forest-300 transition group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm text-slate-800 group-hover:text-forest-700 transition">{note.title}</span>
                          <span className="text-xs text-slate-400 shrink-0">{fmtDate(note.datetime)}</span>
                        </div>
                        {note.summary && <p className="text-xs text-slate-500 leading-relaxed mb-2">{note.summary}</p>}
                        {participants.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {participants.map(p => (
                              <span key={p.id} className="flex items-center gap-1 text-xs text-slate-500">
                                <Avatar name={p.name} size={16} />{p.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
