import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { uid, nowISO } from '../lib/utils.js';
import { Tag } from './ui.jsx';
import Avatar from './Avatar.jsx';
import { inputCls } from './ui.jsx';

export function PeoplePicker({ value = [], external = [], onChange, onExternalChange }) {
  const { data, savePerson } = useApp();
  const [q, setQ] = useState('');
  const matches = data.people.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const exact = data.people.find(p => p.name.toLowerCase() === q.trim().toLowerCase());
  const addNew = async () => {
    const name = q.trim();
    if (!name) return;
    const p = { id: uid(), name, org: '', role: '', email: '', phone: '', tags: [], notes: '', created_at: nowISO() };
    await savePerson(p);
    onChange([...value, p.id]);
    setQ('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(id => { const p = data.people.find(x => x.id === id); return p ? <Tag key={id} onRemove={() => onChange(value.filter(v => v !== id))}>{p.name}</Tag> : null; })}
        {external.map((n, i) => (
          <span key={'e' + i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
            {n}<button type="button" onClick={() => onExternalChange(external.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
      </div>
      <input
        className={inputCls}
        placeholder="Type a name to add a participant…"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const m = matches.find(p => !value.includes(p.id));
            if (m) { onChange([...value, m.id]); setQ(''); }
            else if (q.trim()) addNew();
          }
        }}
      />
      {q && (
        <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
          {matches.filter(p => !value.includes(p.id)).map(p => (
            <button type="button" key={p.id} onClick={() => { onChange([...value, p.id]); setQ(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-forest-50 flex items-center gap-2">
              <Avatar name={p.name} size={24} />{p.name}<span className="text-slate-400 text-xs">{p.org}</span>
            </button>
          ))}
          {!exact && q.trim() && (
            <button type="button" onClick={addNew} className="w-full text-left px-3 py-2 text-sm hover:bg-forest-50 text-forest-700 font-medium">
              ＋ Create contact "{q.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PersonSelect({ value, onChange }) {
  const { data } = useApp();
  return (
    <select className={inputCls} value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">Unassigned</option>
      {data.people.map(p => <option key={p.id} value={p.id}>{p.name}{p.org ? ' · ' + p.org : ''}</option>)}
    </select>
  );
}
