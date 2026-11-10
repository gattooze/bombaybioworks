import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { uid, nowISO, cx, fmtDateTime, typeOf } from '../../lib/utils.js';
import { Field, Tag, TagInput, Btn, Modal, Empty, inputCls } from '../../components/ui.jsx';
import Avatar from '../../components/Avatar.jsx';

function PersonForm({ person, onSave, onClose }) {
  const [f, setF] = useState(person || { name: '', org: '', role: '', email: '', phone: '', tags: [], notes: '' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) { alert('Name is required.'); return; }
    onSave(f);
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Organisation"><input className={inputCls} value={f.org} onChange={e => set('org', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role / Title"><input className={inputCls} value={f.role} onChange={e => set('role', e.target.value)} /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={f.email} onChange={e => set('email', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Tags"><TagInput value={f.tags} onChange={v => set('tags', v)} /></Field>
      </div>
      <Field label="Notes"><textarea rows={2} className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit">Save contact</Btn>
      </div>
    </form>
  );
}

function PersonDetail({ person, onEdit, onClose }) {
  const { data, openNewNote } = useApp();
  const interactions = data.notes
    .filter(n => (n.participant_ids || []).includes(person.id))
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  return (
    <Modal wide open onClose={onClose} title={
      <span className="flex items-center gap-3">
        <Avatar name={person.name} size={36} />
        <span>
          <span className="block font-bold">{person.name}</span>
          {(person.role || person.org) && <span className="block text-xs font-normal text-slate-400">{[person.role, person.org].filter(Boolean).join(' · ')}</span>}
        </span>
      </span>
    }>
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        {person.email && <a href={`mailto:${person.email}`} className="text-forest-600 hover:underline">{person.email}</a>}
        {person.phone && <span className="text-slate-600">{person.phone}</span>}
      </div>
      {(person.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {person.tags.map(t => <Tag key={t}>{t}</Tag>)}
        </div>
      )}
      {person.notes && (
        <div className="mb-4 bg-slate-50 rounded-lg p-3 text-sm text-slate-600">{person.notes}</div>
      )}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{interactions.length} interaction{interactions.length !== 1 ? 's' : ''}</h3>
          <button onClick={() => { onClose(); openNewNote({ participant_ids: [person.id] }); }} className="text-xs text-forest-600 hover:underline font-medium">＋ Log interaction</button>
        </div>
        {interactions.length === 0 ? (
          <p className="text-sm text-slate-400">No interactions logged yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {interactions.map(n => {
              const t = typeOf(n.type);
              return (
                <div key={n.id} className="flex gap-3 p-3 rounded-lg bg-slate-50 text-sm">
                  <span className="text-lg shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-700 truncate">{n.title}</div>
                    {n.summary && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{n.summary}</div>}
                    <div className="text-xs text-slate-400 mt-1">{fmtDateTime(n.datetime)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
        <span />
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn onClick={() => onEdit(person)}>Edit</Btn>
        </div>
      </div>
    </Modal>
  );
}

function PersonCard({ person, onClick }) {
  const { data } = useApp();
  const count = data.notes.filter(n => (n.participant_ids || []).includes(person.id)).length;
  return (
    <button
      onClick={onClick}
      className="p-4 text-left w-full transition"
      style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-hv)'; e.currentTarget.style.boxShadow = 'var(--shadow-card-forest)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
    >
      <div className="flex items-center gap-3 mb-2">
        <Avatar name={person.name} size={36} />
        <div className="flex-1 min-w-0">
          <div className="type-h4 truncate" style={{ color: 'var(--tx)' }}>{person.name}</div>
          <div className="type-body-sm truncate" style={{ color: 'var(--tx2)' }}>{[person.role, person.org].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1 flex-wrap">
          {(person.tags || []).slice(0, 3).map(t => <Tag key={t} small>{t}</Tag>)}
        </div>
        <span className="type-body-sm" style={{ color: 'var(--tx3)' }}>{count} note{count !== 1 ? 's' : ''}</span>
      </div>
    </button>
  );
}

export default function PeopleView() {
  const { data, savePerson, removePerson } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    const pid = searchParams.get('person');
    if (pid) {
      const p = data.people.find(x => x.id === pid);
      if (p) { setViewing(p); setSearchParams({}); }
    }
  }, [searchParams, data.people]);

  const people = data.people
    .filter(p => !search.trim() || (p.name + p.org + p.role + (p.tags || []).join(' ')).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = async (f) => {
    await savePerson({ ...f, id: f.id || uid(), created_at: f.created_at || nowISO() });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tx)', letterSpacing: '-0.03em' }}>People</h1>
          <p className="text-sm" style={{ color: 'var(--tx2)' }}>{data.people.length} contact{data.people.length !== 1 ? 's' : ''}</p>
        </div>
        <Btn onClick={() => setEditing({})}>＋ New contact</Btn>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search people…"
          className="px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 max-w-xs transition"
          style={{ background: 'var(--card)', border: '1px solid var(--line-hv)', borderRadius: 'var(--r-md)', color: 'var(--tx)' }}
        />
      </div>

      {people.length === 0 ? (
        <Empty icon="👥" label={search ? 'No matching contacts' : 'No contacts yet'} action={!search ? { label: 'Add first contact', onClick: () => setEditing({}) } : null} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {people.map(p => (
            <PersonCard key={p.id} person={p} onClick={() => setViewing(p)} />
          ))}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Edit contact' : 'New contact'}>
          {editing.id && (
            <div className="flex justify-end mb-3">
              <button className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg"
                onClick={() => { if (confirm('Delete this contact?')) { removePerson(editing.id); setEditing(null); } }}>
                Delete contact
              </button>
            </div>
          )}
          <PersonForm person={editing.id ? editing : null} onSave={handleSave} onClose={() => setEditing(null)} />
        </Modal>
      )}

      {viewing && (
        <PersonDetail
          person={viewing}
          onClose={() => setViewing(null)}
          onEdit={(p) => { setViewing(null); setEditing(p); }}
        />
      )}
    </div>
  );
}
