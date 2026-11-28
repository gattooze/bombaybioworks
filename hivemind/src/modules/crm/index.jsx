import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { uid, nowISO, fmtDateTime, typeOf } from '../../lib/utils.js';
import { Field, Tag, TagInput, Btn, Modal, Empty, inputCls } from '../../components/ui.jsx';
import Avatar from '../../components/Avatar.jsx';
import MergeModal from './MergeModal.jsx';
import {
  CrmNav, SegmentPicker, SearchBox, FilterChip, Eyebrow, Num, SEGMENTS,
  dupTargetId, live, segOf, listCls, listStyle, rowStyle, DUP_TAG, isOrgPlaceholder,
} from './shared.jsx';

const visibleTags = (p) => (p.tags || []).filter(t => !t.startsWith(DUP_TAG) && t !== 'whatsapp' && t !== 'org-record');

/** Choose organisations for a person from the Organisations list. */
export function OrgPicker({ value = [], onChange }) {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const orgs = live(data.organisations);
  const byId = Object.fromEntries(orgs.map(o => [o.id, o]));
  const matches = q.trim() ? orgs.filter(o => !value.includes(o.id) && o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map(id => <Tag key={id} onRemove={() => onChange(value.filter(x => x !== id))}>{byId[id]?.name || 'Unknown organisation'}</Tag>)}
      </div>
      <input className={inputCls} value={q} onChange={e => setQ(e.target.value)} placeholder="Find an organisation" />
      {matches.length > 0 && (
        <div className="mt-1 overflow-hidden" style={listStyle}>
          {matches.map(o => (
            <button type="button" key={o.id} onClick={() => { onChange([...value, o.id]); setQ(''); }}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-forest-50" style={{ color: 'var(--tx)' }}>{o.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonForm({ person, defaults, onSave, onClose }) {
  const [f, setF] = useState(person || { name: '', org: '', org_ids: [], role: '', email: '', phone: '', tags: [], notes: '', segment: 'demand', ...defaults });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('Name is required.'); return; }
    try { await onSave(f); onClose(); } catch (e2) { setErr(e2.message || 'Save failed'); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name"><input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Role or title"><input className={inputCls} value={f.role} onChange={e => set('role', e.target.value)} /></Field>
      </div>
      <Field label="Segment"><div><SegmentPicker value={segOf(f)} onChange={v => set('segment', v)} /></div></Field>
      <Field label="Organisations" hint={f.org && !(f.org_ids || []).length ? `Old text value: ${f.org}` : null}>
        <OrgPicker value={f.org_ids || []} onChange={v => set('org_ids', v)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Email"><input type="email" className={inputCls} value={f.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
      </div>
      <Field label="Tags"><TagInput value={visibleTags(f)} onChange={v => set('tags', [...(f.tags || []).filter(t => !visibleTags(f).includes(t)), ...v])} /></Field>
      <Field label="Notes"><textarea rows={3} className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      {err && <p className="text-sm" style={{ color: '#b91c1c' }}>{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit">Save contact</Btn>
      </div>
    </form>
  );
}

/** Find a second person to merge with. */
function PersonFinder({ exclude, onPick }) {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const res = q.trim().length < 2 ? [] : live(data.people).filter(p => p.id !== exclude && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div>
      <input className={inputCls} value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name" autoFocus />
      <div className="mt-2 space-y-1">
        {res.map(p => (
          <button key={p.id} onClick={() => onPick(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-forest-50 flex justify-between gap-2" style={{ borderRadius: 'var(--r-sm)', color: 'var(--tx)' }}>
            <span>{p.name}</span><span className="text-xs" style={{ color: 'var(--tx3)' }}>{p.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonDetail({ person, onEdit, onClose, onMerge }) {
  const { data, openNewNote, updatePerson } = useApp();
  const navigate = useNavigate();
  const orgById = Object.fromEntries(data.organisations.map(o => [o.id, o]));
  const dupOf = dupTargetId(person);
  const dupPerson = dupOf && data.people.find(p => p.id === dupOf && !p.archived);
  const interactions = data.notes
    .filter(n => (n.participant_ids || []).includes(person.id))
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  const archive = async () => {
    if (!confirm(`Archive ${person.name}? It leaves every list but is kept in the history.`)) return;
    await updatePerson(person.id, { archived: true }, 'Archived');
    onClose();
  };

  return (
    <Modal wide open onClose={onClose} title={
      <span className="flex items-center gap-3">
        <Avatar name={person.name} size={36} />
        <span>
          <span className="block font-bold">{person.name}</span>
          {person.role && <span className="block text-xs font-normal" style={{ color: 'var(--tx2)' }}>{person.role}</span>}
        </span>
      </span>
    }>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SegmentPicker value={segOf(person)} onChange={v => updatePerson(person.id, { segment: v }, `Moved to ${v}`)} />
      </div>

      {dupPerson && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-3 text-sm" style={{ background: 'var(--p-c)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--p-dk)' }}>Possibly the same person as <b>{dupPerson.name}</b>.</span>
          <Btn size="sm" onClick={() => onMerge(person, dupPerson)}>Compare and merge</Btn>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
        <div>
          <Eyebrow className="mb-1">Organisations</Eyebrow>
          {(person.org_ids || []).length ? (
            <div className="flex flex-wrap gap-1.5">
              {person.org_ids.map(id => (
                <button key={id} onClick={() => { onClose(); navigate('/crm/orgs?org=' + id); }} className="hover:underline font-medium" style={{ color: 'var(--p)' }}>
                  {orgById[id]?.name || 'Unknown'}
                </button>
              ))}
            </div>
          ) : <span style={{ color: 'var(--tx3)' }}>{person.org || 'None linked'}</span>}
        </div>
        <div>
          <Eyebrow className="mb-1">Contact</Eyebrow>
          {person.email && <a href={`mailto:${person.email}`} className="block hover:underline" style={{ color: 'var(--p)' }}>{person.email}</a>}
          {person.phone && <span className="block" style={{ color: 'var(--tx)' }}>{person.phone}</span>}
          {!person.email && !person.phone && <span style={{ color: 'var(--tx3)' }}>No email or phone</span>}
        </div>
      </div>

      {visibleTags(person).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">{visibleTags(person).map(t => <Tag key={t}>{t}</Tag>)}</div>
      )}
      {person.notes && <div className="mb-4 p-3 text-sm whitespace-pre-wrap" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', color: 'var(--tx)' }}>{person.notes}</div>}

      <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between mb-3">
          <Eyebrow><Num>{interactions.length}</Num> interaction{interactions.length !== 1 ? 's' : ''}</Eyebrow>
          <button onClick={() => { onClose(); openNewNote({ participant_ids: [person.id] }); }} className="text-xs hover:underline font-medium" style={{ color: 'var(--p)' }}>＋ Log interaction</button>
        </div>
        {interactions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--tx3)' }}>No interactions logged yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {interactions.map(n => {
              const t = typeOf(n.type);
              return (
                <div key={n.id} className="flex gap-3 p-3 text-sm" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
                  <span className="text-lg shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: 'var(--tx)' }}>{n.title}</div>
                    {n.summary && <div className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--tx2)' }}>{n.summary}</div>}
                    <div className="text-xs mt-1 type-mono" style={{ color: 'var(--tx3)' }}>{fmtDateTime(n.datetime)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2 pt-4 mt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={archive}>Archive</Btn>
          <Btn variant="ghost" size="sm" onClick={() => onMerge(person, null)}>Merge with…</Btn>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn onClick={() => onEdit(person)}>Edit</Btn>
        </div>
      </div>
    </Modal>
  );
}

function PersonRow({ person, orgNames, noteCount, onOpen, onSegment }) {
  const dup = !!dupTargetId(person);
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen()}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-forest-50 transition" style={rowStyle}>
      <Avatar name={person.name} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="type-h4 truncate" style={{ color: 'var(--tx)' }}>{person.name}</span>
          {dup && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5" style={{ background: 'var(--s-lt)', color: 'var(--s-dk)', borderRadius: 'var(--r-full)' }}>Possible duplicate</span>}
        </div>
        <div className="type-body-sm truncate" style={{ color: 'var(--tx2)' }}>{[person.role, orgNames || person.org].filter(Boolean).join(' · ') || 'No role or organisation'}</div>
      </div>
      <span className="hidden md:inline type-mono text-xs shrink-0" style={{ color: 'var(--tx3)' }}>{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
      <div className="hidden sm:block shrink-0"><SegmentPicker size="sm" value={segOf(person)} onChange={onSegment} /></div>
    </div>
  );
}

export default function PeopleView() {
  const { data, savePerson, updatePerson } = useApp();
  const [params, setParams] = useSearchParams();
  const seg = params.get('seg') || 'demand';
  const [search, setSearch] = useState('');
  const [noOrg, setNoOrg] = useState(false);
  const [dupOnly, setDupOnly] = useState(false);
  const [showCompanies, setShowCompanies] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [merge, setMerge] = useState(null); // { a, b|null }

  useEffect(() => {
    const pid = params.get('person');
    if (pid && data.people.some(x => x.id === pid)) {
      setViewingId(pid);
      const next = new URLSearchParams(params); next.delete('person'); setParams(next, { replace: true });
    }
  }, [params, data.people]);

  const allPeople = live(data.people).filter(p => !p.is_team);
  const people = showCompanies ? allPeople : allPeople.filter(p => !isOrgPlaceholder(p));
  const hiddenHere = allPeople.filter(p => isOrgPlaceholder(p) && segOf(p) === seg).length;
  const counts = useMemo(() => people.reduce((m, p) => ({ ...m, [segOf(p)]: (m[segOf(p)] || 0) + 1 }), {}), [people]);
  const orgById = useMemo(() => Object.fromEntries(data.organisations.map(o => [o.id, o])), [data.organisations]);
  const noteCount = useMemo(() => {
    const m = {};
    for (const n of data.notes) for (const id of n.participant_ids || []) m[id] = (m[id] || 0) + 1;
    return m;
  }, [data.notes]);

  const orgNames = (p) => (p.org_ids || []).map(id => orgById[id]?.name).filter(Boolean).join(', ');
  const q = search.trim().toLowerCase();
  const rows = people
    .filter(p => segOf(p) === seg)
    .filter(p => !noOrg || !(p.org_ids || []).length)
    .filter(p => !dupOnly || dupTargetId(p))
    .filter(p => !q || [p.name, p.role, p.org, orgNames(p), p.email, p.notes, ...(p.tags || [])].join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const viewing = viewingId && data.people.find(p => p.id === viewingId);
  const segInfo = SEGMENTS.find(s => s.id === seg);

  const handleSave = (f) => savePerson({ ...f, id: f.id || uid(), created_at: f.created_at || nowISO() });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <CrmNav />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tx)', letterSpacing: '-0.04em' }}>People</h1>
          <p className="text-sm" style={{ color: 'var(--tx2)' }}>{segInfo.hint}</p>
        </div>
        <Btn onClick={() => setEditing({ __new: true })}>＋ New contact</Btn>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SegmentPicker value={seg} counts={counts} onChange={v => setParams(v === 'demand' ? {} : { seg: v })} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, role, organisation" />
        <div className="flex gap-2">
          <FilterChip on={noOrg} onClick={() => setNoOrg(v => !v)}>No organisation</FilterChip>
          <FilterChip on={dupOnly} onClick={() => setDupOnly(v => !v)}>Possible duplicates</FilterChip>
        </div>
      </div>

      {hiddenHere > 0 && !showCompanies && (
        <p className="text-xs mb-3" style={{ color: 'var(--tx3)' }}>
          {hiddenHere} {hiddenHere === 1 ? 'entry is a company' : 'entries are companies'}, not people, so {hiddenHere === 1 ? 'it is' : 'they are'} listed under Organisations.{' '}
          <button className="hover:underline font-medium" style={{ color: 'var(--p)' }} onClick={() => setShowCompanies(true)}>Show here too</button>
        </p>
      )}

      {rows.length === 0 ? (
        <Empty icon="👥" label={q || noOrg || dupOnly ? 'No matching contacts' : `No ${segInfo.label.toLowerCase()} contacts yet`} />
      ) : (
        <div className={listCls} style={listStyle}>
          <div className="px-4 py-2 flex justify-between" style={{ background: 'var(--bg)' }}>
            <Eyebrow><Num>{rows.length}</Num> {rows.length === 1 ? 'contact' : 'contacts'}</Eyebrow>
            <Eyebrow className="hidden sm:block">Move to</Eyebrow>
          </div>
          {rows.map(p => (
            <PersonRow key={p.id} person={p} orgNames={orgNames(p)} noteCount={noteCount[p.id] || 0}
              onOpen={() => setViewingId(p.id)}
              onSegment={v => updatePerson(p.id, { segment: v }, `Moved to ${v}`)} />
          ))}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.__new ? 'New contact' : 'Edit contact'}>
          <PersonForm person={editing.__new ? null : editing} defaults={{ segment: seg }} onSave={handleSave} onClose={() => setEditing(null)} />
        </Modal>
      )}

      {viewing && !merge && (
        <PersonDetail person={viewing}
          onClose={() => setViewingId(null)}
          onEdit={(p) => { setViewingId(null); setEditing(p); }}
          onMerge={(a, b) => setMerge({ a, b })} />
      )}

      {merge && !merge.b && (
        <Modal open onClose={() => setMerge(null)} title={`Merge ${merge.a.name} with`}>
          <PersonFinder exclude={merge.a.id} onPick={b => setMerge({ ...merge, b })} />
        </Modal>
      )}
      {merge?.b && (
        <MergeModal type="person" a={merge.a} b={merge.b}
          onClose={() => setMerge(null)} onDone={() => setViewingId(null)} />
      )}
    </div>
  );
}
