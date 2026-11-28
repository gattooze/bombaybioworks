import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { Field, Btn, Modal, Empty, inputCls } from '../../components/ui.jsx';
import { SAMPLE_STATUSES, UNITS } from '../../../ontology/index.js';
import { CrmNav, Eyebrow, Num, OrgSelect, FilterChip, SearchBox, live, listStyle, rowStyle, isOrgPlaceholder } from './shared.jsx';

const STATUS_LABEL = { planned: 'Planned', sent: 'Sent', received: 'Received', testing: 'Testing', feedback: 'Feedback in', closed: 'Closed' };

function SampleForm({ sample, onClose }) {
  const { data, saveObj } = useApp();
  const [f, setF] = useState(sample || { org_id: '', contact_id: '', deal_id: '', grade: '', qty: '', unit: 'kg', spec: '', status: 'planned', sent_date: '', courier: '', tracking: '', feedback: '', result: '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const people = live(data.people).filter(p => !isOrgPlaceholder(p) && f.org_id && (p.org_ids || []).includes(f.org_id));
  const deals = live(data.deals).filter(d => f.org_id && d.org_id === f.org_id);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.org_id) return setErr('Choose the organisation.');
    if (!f.grade.trim()) return setErr('Grade is required.');
    if (!(Number(f.qty) > 0)) return setErr('Quantity must be more than zero.');
    const rec = { ...f, qty: Number(f.qty) };
    for (const k of ['contact_id', 'deal_id']) if (!rec[k]) delete rec[k];
    try { await saveObj('sample', rec); onClose(); } catch (e2) { setErr(e2.message); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Organisation"><OrgSelect value={f.org_id} onChange={v => setF(s => ({ ...s, org_id: v, contact_id: '', deal_id: '' }))} /></Field>
      {(people.length > 0 || deals.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contact">
            <select className={inputCls} value={f.contact_id || ''} onChange={e => set('contact_id', e.target.value)}>
              <option value="">None</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Deal">
            <select className={inputCls} value={f.deal_id || ''} onChange={e => set('deal_id', e.target.value)}>
              <option value="">None</option>{deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="grid grid-cols-[1fr_100px_90px] gap-3">
        <Field label="Grade"><input className={inputCls} value={f.grade} onChange={e => set('grade', e.target.value)} placeholder="e.g. AC iodine 1000" /></Field>
        <Field label="Quantity"><input type="number" min="0" step="any" className={inputCls} value={f.qty} onChange={e => set('qty', e.target.value)} /></Field>
        <Field label="Unit"><select className={inputCls} value={f.unit} onChange={e => set('unit', e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></Field>
      </div>
      <Field label="Spec sent with it"><input className={inputCls} value={f.spec} onChange={e => set('spec', e.target.value)} placeholder="e.g. Iodine 1000 mg/g min, ash 5% max" /></Field>
      <Field label="Status">
        <div className="flex flex-wrap gap-1.5">{SAMPLE_STATUSES.map(s => <FilterChip key={s} on={f.status === s} onClick={() => set('status', s)}>{STATUS_LABEL[s]}</FilterChip>)}</div>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Sent on"><input type="date" className={inputCls} value={f.sent_date || ''} onChange={e => set('sent_date', e.target.value)} /></Field>
        <Field label="Courier"><input className={inputCls} value={f.courier} onChange={e => set('courier', e.target.value)} /></Field>
        <Field label="Tracking"><input className={inputCls} value={f.tracking} onChange={e => set('tracking', e.target.value)} /></Field>
      </div>
      <Field label="Test result"><input className={inputCls} value={f.result} onChange={e => set('result', e.target.value)} placeholder="e.g. Iodine 1040 mg/g" /></Field>
      <Field label="Customer feedback"><textarea rows={2} className={inputCls} value={f.feedback} onChange={e => set('feedback', e.target.value)} /></Field>
      {err && <p className="text-sm" style={{ color: '#b91c1c' }}>{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit">Save sample</Btn>
      </div>
    </form>
  );
}

export default function SamplesView() {
  const { data } = useApp();
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const orgById = useMemo(() => Object.fromEntries(data.organisations.map(o => [o.id, o])), [data.organisations]);
  const q = search.trim().toLowerCase();
  const all = live(data.samples);
  const rows = all
    .filter(s => status === 'all' || (status === 'open' ? s.status !== 'closed' : s.status === status))
    .filter(s => !q || [s.grade, s.spec, s.result, s.feedback, orgById[s.org_id]?.name].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (b.sent_date || b.created_at || '').localeCompare(a.sent_date || a.created_at || ''));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <CrmNav />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tx)', letterSpacing: '-0.04em' }}>Samples</h1>
          <p className="text-sm" style={{ color: 'var(--tx2)' }}>What went to whom, what it tested at, and what they said.</p>
        </div>
        <Btn onClick={() => setEditing({ __new: true })}>＋ New sample</Btn>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SearchBox value={search} onChange={setSearch} placeholder="Search grade, organisation, result" />
        <div className="flex flex-wrap gap-1.5">
          {[['open', 'Open'], ...SAMPLE_STATUSES.map(s => [s, STATUS_LABEL[s]]), ['all', 'All']].map(([id, l]) => <FilterChip key={id} on={status === id} onClick={() => setStatus(id)}>{l}</FilterChip>)}
        </div>
      </div>

      {rows.length === 0 ? <Empty icon="🧪" label={all.length ? 'No matching samples' : 'No samples logged yet'} action={!all.length ? { label: 'Log the first sample', onClick: () => setEditing({ __new: true }) } : null} /> : (
        <div className="overflow-hidden" style={listStyle}>
          <div className="px-4 py-2" style={{ background: 'var(--bg)' }}><Eyebrow><Num>{rows.length}</Num> samples</Eyebrow></div>
          {rows.map(s => (
            <div key={s.id} onClick={() => setEditing(s)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setEditing(s)}
              className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-1 px-4 py-2.5 cursor-pointer hover:bg-forest-50 transition" style={rowStyle}>
              <div className="flex-1 min-w-0">
                <div className="type-h4 truncate" style={{ color: 'var(--tx)' }}>{s.grade} <span className="type-mono font-normal text-xs" style={{ color: 'var(--tx2)' }}>{s.qty} {s.unit}</span></div>
                <div className="type-body-sm truncate" style={{ color: 'var(--tx2)' }}>{orgById[s.org_id]?.name || 'Unknown organisation'}{s.result ? ' · ' + s.result : ''}</div>
              </div>
              <span className="type-mono text-xs shrink-0" style={{ color: 'var(--tx3)' }}>{s.sent_date || ''}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 shrink-0" style={{ background: s.status === 'closed' ? 'var(--bg)' : 'var(--p-c)', color: s.status === 'closed' ? 'var(--tx3)' : 'var(--p-dk)', borderRadius: 'var(--r-full)' }}>{STATUS_LABEL[s.status]}</span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal wide open onClose={() => setEditing(null)} title={editing.__new ? 'New sample' : `${editing.grade} sample`}>
          <SampleForm sample={editing.__new ? null : editing} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
