import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { Field, Btn, Modal, Empty, inputCls } from '../../components/ui.jsx';
import { PIPELINES, CLOSED_STAGES, UNITS } from '../../../ontology/index.js';
import { CrmNav, Eyebrow, Num, OrgSelect, STAGE_LABEL, money, live, localToday, isOrgPlaceholder, FilterChip } from './shared.jsx';

const PIPE_LABEL = { sales: 'Sales', sourcing: 'Sourcing', funding: 'Funding' };
const num = (v) => (v === '' || v === undefined || v === null ? undefined : Number(v));

export function DealForm({ deal, defaults, onClose }) {
  const { data, saveObj } = useApp();
  const [f, setF] = useState(deal || { title: '', pipeline: 'sales', stage: 'lead', org_id: '', contact_ids: [], product: '', qty: '', unit: 'MT', price: '', currency: 'INR', next_action: '', next_action_date: '', closed_reason: '', ...defaults });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const people = live(data.people).filter(p => !isOrgPlaceholder(p) && (!f.org_id || (p.org_ids || []).includes(f.org_id)));
  const value = num(f.qty) && num(f.price) ? num(f.qty) * num(f.price) : num(f.value);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.title.trim()) return setErr('Give the deal a title.');
    if (!f.org_id) return setErr('Choose the organisation.');
    const rec = { ...f, qty: num(f.qty), price: num(f.price), value };
    if (!rec.unit || rec.qty === undefined) delete rec.unit;
    try { await saveObj('deal', rec); onClose(); } catch (e2) { setErr(e2.message); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Title"><input className={inputCls} value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. JSW bio coke trial" autoFocus /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Pipeline">
          <select className={inputCls} value={f.pipeline} onChange={e => setF(s => ({ ...s, pipeline: e.target.value, stage: PIPELINES[e.target.value][0] }))}>
            {Object.keys(PIPELINES).map(p => <option key={p} value={p}>{PIPE_LABEL[p]}</option>)}
          </select>
        </Field>
        <Field label="Stage">
          <select className={inputCls} value={f.stage} onChange={e => set('stage', e.target.value)}>
            {PIPELINES[f.pipeline].map(s => <option key={s} value={s}>{STAGE_LABEL(s)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Organisation"><OrgSelect value={f.org_id} onChange={v => set('org_id', v)} /></Field>
      {people.length > 0 && (
        <Field label="Contacts">
          <div className="flex flex-wrap gap-1.5">
            {people.slice(0, 20).map(p => (
              <FilterChip key={p.id} on={f.contact_ids.includes(p.id)} onClick={() => set('contact_ids', f.contact_ids.includes(p.id) ? f.contact_ids.filter(x => x !== p.id) : [...f.contact_ids, p.id])}>{p.name}</FilterChip>
            ))}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Product"><input className={inputCls} value={f.product} onChange={e => set('product', e.target.value)} placeholder="Grade" /></Field>
        <Field label="Quantity"><input type="number" min="0" step="any" className={inputCls} value={f.qty ?? ''} onChange={e => set('qty', e.target.value)} /></Field>
        <Field label="Unit"><select className={inputCls} value={f.unit || 'MT'} onChange={e => set('unit', e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Price per unit"><input type="number" min="0" step="any" className={inputCls} value={f.price ?? ''} onChange={e => set('price', e.target.value)} /></Field>
      </div>
      {value ? <p className="text-xs" style={{ color: 'var(--tx2)' }}>Deal value <span className="type-mono">{money(value, f.currency)}</span></p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
        <Field label="Next action"><input className={inputCls} value={f.next_action} onChange={e => set('next_action', e.target.value)} placeholder="e.g. Send COA" /></Field>
        <Field label="By"><input type="date" className={inputCls} value={f.next_action_date || ''} onChange={e => set('next_action_date', e.target.value)} /></Field>
      </div>
      {CLOSED_STAGES.includes(f.stage) && <Field label="Why it closed"><input className={inputCls} value={f.closed_reason} onChange={e => set('closed_reason', e.target.value)} /></Field>}
      {err && <p className="text-sm" style={{ color: '#b91c1c' }}>{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit">Save deal</Btn>
      </div>
    </form>
  );
}

function DealCard({ deal, org, onOpen, onMove }) {
  const stages = PIPELINES[deal.pipeline];
  const i = stages.indexOf(deal.stage);
  const late = deal.next_action_date && deal.next_action_date < localToday() && !CLOSED_STAGES.includes(deal.stage);
  return (
    <div onClick={onOpen}
      className="p-3 cursor-pointer transition hover:border-[rgba(0,0,0,0.16)]"
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-card-forest)' }}>
      <button type="button" className="block text-left font-semibold text-sm leading-snug hover:underline" style={{ color: 'var(--tx)' }}>{deal.title}</button>
      <div className="text-xs mt-0.5" style={{ color: 'var(--tx2)' }}>{org?.name || 'Unknown organisation'}</div>
      {deal.value ? <div className="type-mono text-xs mt-1.5" style={{ color: 'var(--tx)' }}>{money(deal.value, deal.currency)}</div> : null}
      {deal.next_action && (
        <div className="text-xs mt-1.5" style={{ color: late ? '#b91c1c' : 'var(--tx2)' }}>
          {deal.next_action}{deal.next_action_date ? <span className="type-mono"> · {deal.next_action_date}</span> : null}
        </div>
      )}
      <div className="flex justify-between mt-2">
        <button type="button" disabled={i <= 0} onClick={e => { e.stopPropagation(); onMove(stages[i - 1]); }} className="text-xs px-1.5 disabled:opacity-30 hover:underline" style={{ color: 'var(--tx2)' }} aria-label="Move back a stage">‹ Back</button>
        <button type="button" disabled={i >= stages.length - 1} onClick={e => { e.stopPropagation(); onMove(stages[i + 1]); }} className="text-xs px-1.5 disabled:opacity-30 hover:underline font-medium" style={{ color: 'var(--p)' }} aria-label="Move to next stage">Next ›</button>
      </div>
    </div>
  );
}

export default function PipelinesView() {
  const { data, updateObj } = useApp();
  const [params, setParams] = useSearchParams();
  const pipe = params.get('p') || 'sales';
  const [editing, setEditing] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const orgById = useMemo(() => Object.fromEntries(data.organisations.map(o => [o.id, o])), [data.organisations]);

  const deals = live(data.deals).filter(d => d.pipeline === pipe);
  const stages = PIPELINES[pipe].filter(s => showClosed || !CLOSED_STAGES.includes(s));
  const openValue = deals.filter(d => !CLOSED_STAGES.includes(d.stage)).reduce((a, d) => a + (d.value || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <CrmNav />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tx)', letterSpacing: '-0.04em' }}>Pipelines</h1>
          <p className="text-sm" style={{ color: 'var(--tx2)' }}>
            <Num>{deals.filter(d => !CLOSED_STAGES.includes(d.stage)).length}</Num> open{openValue ? <> · <span className="type-mono">{money(openValue)}</span></> : null}
          </p>
        </div>
        <Btn onClick={() => setEditing({ __new: true })}>＋ New deal</Btn>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(PIPELINES).map(p => <FilterChip key={p} on={pipe === p} onClick={() => setParams(p === 'sales' ? {} : { p })}>{PIPE_LABEL[p]} <Num>{live(data.deals).filter(d => d.pipeline === p && !CLOSED_STAGES.includes(d.stage)).length}</Num></FilterChip>)}
        <span className="w-px mx-1" style={{ background: 'var(--line-hv)' }} />
        <FilterChip on={showClosed} onClick={() => setShowClosed(v => !v)}>Show closed</FilterChip>
      </div>

      {deals.length === 0 ? (
        <Empty icon="📈" label={`No ${PIPE_LABEL[pipe].toLowerCase()} deals yet`} action={{ label: 'Add the first deal', onClick: () => setEditing({ __new: true }) }} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x">
          {stages.map(s => {
            const col = deals.filter(d => d.stage === s);
            return (
              <div key={s} className="w-64 shrink-0 snap-start">
                <div className="flex justify-between items-center px-1 mb-2">
                  <Eyebrow>{STAGE_LABEL(s)}</Eyebrow>
                  <span className="type-mono text-xs" style={{ color: 'var(--tx3)' }}>{col.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px] p-1.5" style={{ background: 'rgba(62,100,72,.04)', borderRadius: 'var(--r-lg)' }}>
                  {col.map(d => (
                    <DealCard key={d.id} deal={d} org={orgById[d.org_id]} onOpen={() => setEditing(d)}
                      onMove={stage => updateObj('deal', d.id, { stage }, `Moved to ${STAGE_LABEL(stage)}`)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal wide open onClose={() => setEditing(null)} title={editing.__new ? 'New deal' : editing.title}>
          <DealForm deal={editing.__new ? null : editing} defaults={{ pipeline: pipe, stage: PIPELINES[pipe][0] }} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
