import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { fmtDateTime, typeOf } from '../../lib/utils.js';
import { Field, Btn, Modal, Empty, inputCls } from '../../components/ui.jsx';
import { ORG_ROLES } from '../../../ontology/index.js';
import MergeModal from './MergeModal.jsx';
import { CrmNav, SearchBox, FilterChip, Eyebrow, Num, live, segOf, SEGMENTS, listStyle, rowStyle, isOrgPlaceholder } from './shared.jsx';

const roleLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1);

function OrgForm({ org, onSave, onClose }) {
  const [f, setF] = useState(org || { name: '', roles: [], city: '', country: 'IN', website: '', gstin: '', notes: '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const toggleRole = (r) => set('roles', f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r]);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('Name is required.'); return; }
    try { await onSave(f); onClose(); } catch (e2) { setErr(e2.message || 'Save failed'); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Name"><input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
      <Field label="Roles">
        <div className="flex flex-wrap gap-1.5">{ORG_ROLES.map(r => <FilterChip key={r} on={f.roles.includes(r)} onClick={() => toggleRole(r)}>{roleLabel(r)}</FilterChip>)}</div>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="City"><input className={inputCls} value={f.city || ''} onChange={e => set('city', e.target.value)} /></Field>
        <Field label="Country"><input className={inputCls} value={f.country || ''} onChange={e => set('country', e.target.value)} /></Field>
        <Field label="GSTIN"><input className={inputCls} value={f.gstin || ''} onChange={e => set('gstin', e.target.value.toUpperCase())} /></Field>
      </div>
      <Field label="Website"><input className={inputCls} value={f.website || ''} onChange={e => set('website', e.target.value)} /></Field>
      <Field label="Notes"><textarea rows={3} className={inputCls} value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
      {err && <p className="text-sm" style={{ color: '#b91c1c' }}>{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit">Save organisation</Btn>
      </div>
    </form>
  );
}

function OrgFinder({ exclude, onPick }) {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const res = q.trim().length < 2 ? [] : live(data.organisations).filter(o => o.id !== exclude && o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div>
      <input className={inputCls} value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name" autoFocus />
      <div className="mt-2 space-y-1">
        {res.map(o => <button key={o.id} onClick={() => onPick(o)} className="w-full text-left px-3 py-2 text-sm hover:bg-forest-50" style={{ borderRadius: 'var(--r-sm)', color: 'var(--tx)' }}>{o.name}</button>)}
      </div>
    </div>
  );
}

function OrgDetail({ org, onClose, onEdit, onMerge }) {
  const { data, updateOrg, openNewNote } = useApp();
  const navigate = useNavigate();
  const linked = live(data.people).filter(p => (p.org_ids || []).includes(org.id));
  const people = linked.filter(p => !isOrgPlaceholder(p)).sort((a, b) => a.name.localeCompare(b.name));
  const pids = new Set(linked.map(p => p.id));
  const notes = data.notes
    .filter(n => (n.org_ids || []).includes(org.id) || (n.participant_ids || []).some(id => pids.has(id)))
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  const deals = data.deals.filter(d => d.org_id === org.id && !d.archived);
  const samples = data.samples.filter(s => s.org_id === org.id && !s.archived);

  const archive = async () => {
    if (!confirm(`Archive ${org.name}? It leaves every list but is kept in the history.`)) return;
    await updateOrg(org.id, { archived: true }, 'Archived');
    onClose();
  };

  return (
    <Modal wide open onClose={onClose} title={
      <span>
        <span className="block font-bold">{org.name}</span>
        <span className="block text-xs font-normal" style={{ color: 'var(--tx2)' }}>{[(org.roles || []).map(roleLabel).join(', '), org.city].filter(Boolean).join(' · ') || 'No role set'}</span>
      </span>
    }>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[['People', people.length], ['Deals', deals.length], ['Samples', samples.length]].map(([l, n]) => (
          <div key={l} className="p-3" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
            <Eyebrow>{l}</Eyebrow>
            <div className="text-xl font-bold type-mono" style={{ color: 'var(--tx)' }}>{n}</div>
          </div>
        ))}
      </div>
      {org.website && <a href={/^https?:/.test(org.website) ? org.website : 'https://' + org.website} target="_blank" rel="noreferrer" className="text-sm hover:underline block mb-3" style={{ color: 'var(--p)' }}>{org.website}</a>}
      {[org.notes, ...linked.filter(isOrgPlaceholder).map(p => p.notes)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((t, i) => (
        <div key={i} className="mb-2 p-3 text-sm whitespace-pre-wrap" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', color: 'var(--tx)' }}>{t}</div>
      ))}
      <div className="mb-2" />

      <Eyebrow className="mb-2">People</Eyebrow>
      {people.length === 0 ? <p className="text-sm mb-4" style={{ color: 'var(--tx3)' }}>No one linked yet. Link people from their contact page.</p> : (
        <div className="mb-4 space-y-1">
          {people.map(p => (
            <button key={p.id} onClick={() => { onClose(); navigate(`/crm?${segOf(p) === 'demand' ? '' : 'seg=' + segOf(p) + '&'}person=${p.id}`); }}
              className="w-full flex justify-between gap-2 px-3 py-1.5 text-sm hover:bg-forest-50 text-left" style={{ borderRadius: 'var(--r-sm)' }}>
              <span style={{ color: 'var(--tx)' }}>{p.name}<span className="ml-2 text-xs" style={{ color: 'var(--tx3)' }}>{p.role}</span></span>
              <span className="text-xs" style={{ color: 'var(--tx3)' }}>{SEGMENTS.find(s => s.id === segOf(p)).label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>Timeline · <Num>{notes.length}</Num></Eyebrow>
          <button onClick={() => { onClose(); openNewNote({ org_ids: [org.id], participant_ids: [] }); }} className="text-xs hover:underline font-medium" style={{ color: 'var(--p)' }}>＋ Log interaction</button>
        </div>
        {notes.length === 0 ? <p className="text-sm" style={{ color: 'var(--tx3)' }}>Nothing logged yet.</p> : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {notes.map(n => (
              <div key={n.id} className="flex gap-3 p-3 text-sm" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
                <span className="text-lg shrink-0">{typeOf(n.type).icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" style={{ color: 'var(--tx)' }}>{n.title}</div>
                  {n.summary && <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--tx2)' }}>{n.summary}</div>}
                  <div className="text-xs mt-1 type-mono" style={{ color: 'var(--tx3)' }}>{fmtDateTime(n.datetime)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2 pt-4 mt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={archive}>Archive</Btn>
          <Btn variant="ghost" size="sm" onClick={() => onMerge(org)}>Merge with…</Btn>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn onClick={() => onEdit(org)}>Edit</Btn>
        </div>
      </div>
    </Modal>
  );
}

export default function OrganisationsView() {
  const { data, saveOrg } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [demandOnly, setDemandOnly] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [merge, setMerge] = useState(null);

  useEffect(() => {
    const oid = params.get('org');
    if (oid && data.organisations.some(o => o.id === oid)) { setViewingId(oid); setParams({}, { replace: true }); }
  }, [params, data.organisations]);

  const stats = useMemo(() => {
    const m = {};
    for (const p of live(data.people)) for (const id of p.org_ids || []) {
      m[id] = m[id] || { people: 0, demand: 0 };
      if (!isOrgPlaceholder(p)) m[id].people++;
      if (segOf(p) === 'demand') m[id].demand++;
    }
    return m;
  }, [data.people]);

  const q = search.trim().toLowerCase();
  const orgs = live(data.organisations);
  const rows = orgs
    .filter(o => !demandOnly || stats[o.id]?.demand || (o.roles || []).includes('customer'))
    .filter(o => !role || (o.roles || []).includes(role))
    .filter(o => !q || [o.name, o.city, o.notes].join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const viewing = viewingId && data.organisations.find(o => o.id === viewingId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <CrmNav />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tx)', letterSpacing: '-0.04em' }}>Organisations</h1>
          <p className="text-sm" style={{ color: 'var(--tx2)' }}>Companies and institutions, with their people and history.</p>
        </div>
        <Btn onClick={() => setEditing({ __new: true })}>＋ New organisation</Btn>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SearchBox value={search} onChange={setSearch} placeholder="Search organisations" />
        <div className="flex flex-wrap gap-2">
          <FilterChip on={demandOnly} onClick={() => setDemandOnly(v => !v)}>Demand only</FilterChip>
          {['customer', 'supplier', 'investor', 'government', 'partner'].map(r => (
            <FilterChip key={r} on={role === r} onClick={() => setRole(role === r ? '' : r)}>{roleLabel(r)}</FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty icon="🏢" label="No matching organisations" sub={demandOnly ? 'Turn off Demand only to see every organisation.' : null} />
      ) : (
        <div className="overflow-hidden" style={listStyle}>
          <div className="px-4 py-2 flex justify-between" style={{ background: 'var(--bg)' }}>
            <Eyebrow><Num>{rows.length}</Num> of <Num>{orgs.length}</Num></Eyebrow>
            <Eyebrow>People</Eyebrow>
          </div>
          {rows.map(o => (
            <div key={o.id} onClick={() => setViewingId(o.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setViewingId(o.id)}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-forest-50 transition" style={rowStyle}>
              <div className="flex-1 min-w-0">
                <div className="type-h4 truncate" style={{ color: 'var(--tx)' }}>{o.name}</div>
                <div className="type-body-sm truncate" style={{ color: 'var(--tx2)' }}>{[(o.roles || []).map(roleLabel).join(', '), o.city].filter(Boolean).join(' · ') || 'No role set'}</div>
              </div>
              <span className="type-mono text-sm shrink-0" style={{ color: 'var(--tx2)' }}>{stats[o.id]?.people || 0}</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.__new ? 'New organisation' : 'Edit organisation'}>
          <OrgForm org={editing.__new ? null : editing} onSave={saveOrg} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {viewing && !merge && (
        <OrgDetail org={viewing} onClose={() => setViewingId(null)}
          onEdit={(o) => { setViewingId(null); setEditing(o); }}
          onMerge={(o) => setMerge({ a: o, b: null })} />
      )}
      {merge && !merge.b && (
        <Modal open onClose={() => setMerge(null)} title={`Merge ${merge.a.name} with`}>
          <OrgFinder exclude={merge.a.id} onPick={b => setMerge({ ...merge, b })} />
        </Modal>
      )}
      {merge?.b && <MergeModal type="organisation" a={merge.a} b={merge.b} onClose={() => setMerge(null)} onDone={() => setViewingId(null)} />}
    </div>
  );
}
