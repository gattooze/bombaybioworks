import { useState, useMemo, Fragment } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { fmtDateTime, todayStr, nowISO } from '../../lib/utils.js';
import { Field, Btn, Modal, Empty, inputCls } from '../../components/ui.jsx';
import { CrmNav, Eyebrow, Num, FilterChip, SegmentPicker, live, listStyle } from '../crm/shared.jsx';

// What each capture kind becomes when accepted.
const KIND = {
  person:       { label: 'New person',       target: 'person' },
  organisation: { label: 'New organisation', target: 'organisation' },
  commitment:   { label: 'Commitment',       target: 'commitment' },
  decision:     { label: 'Decision',         target: 'decision' },
  fact:         { label: 'Fact',             target: 'interaction' },
  profile:      { label: 'Profile',          target: 'interaction' },
  email:        { label: 'Email',            target: 'interaction' },
};
const CHANNEL = { whatsapp: 'WhatsApp', email: 'Email', assistant: 'Assistant', manual: 'Manual', calendar: 'Calendar', import: 'Import', linkedin_paste: 'LinkedIn paste', other: 'Other' };
const str = (v) => (v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v));

/** Pre-fill the target record from the capture. A person reviews every field before it is saved. */
function draftFrom(obs) {
  const p = obs.payload || {};
  const linked = (t) => (obs.suggested_links || []).filter(l => l.type === t).map(l => l.id);
  const target = KIND[obs.kind]?.target || 'interaction';
  switch (target) {
    case 'person': return { name: str(p.name), role: str(p.role), email: str(p.email), phone: str(p.phone), notes: str(p.notes || obs.summary), segment: p.segment || 'unsorted', org_ids: linked('organisation') };
    case 'organisation': return { name: str(p.name), city: str(p.city), website: str(p.website), notes: str(p.notes || obs.summary), roles: Array.isArray(p.roles) ? p.roles : [] };
    case 'commitment': return { text: str(p.text || obs.summary), owner_id: str(p.owner_id) || linked('person')[0] || '', counterparty_id: str(p.counterparty_id), due_date: str(p.due_date) };
    case 'decision': return { text: str(p.text || obs.summary), rationale: str(p.rationale), decided_at: str(p.decided_at) || todayStr(), decided_by: Array.isArray(p.decided_by) ? p.decided_by : [] };
    default: return {
      title: str(p.title || obs.summary).slice(0, 140) || 'Captured note',
      type: obs.kind === 'email' ? 'email' : 'note',
      datetime: str(p.datetime) || obs.created_at || nowISO(),
      body: str(p.body || p.text || Object.entries(p).map(([k, v]) => `${k}: ${str(v)}`).join('\n')),
      summary: obs.summary || '',
      participant_ids: linked('person'), org_ids: linked('organisation'),
    };
  }
}

function PeopleSelect({ value, onChange, preferIds = [] }) {
  const { data } = useApp();
  const ppl = live(data.people);
  const team = ppl.filter(p => p.is_team);
  const pref = ppl.filter(p => preferIds.includes(p.id) && !p.is_team);
  return (
    <select className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Choose a person</option>
      {team.length > 0 && <optgroup label="Team">{team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
      {pref.length > 0 && <optgroup label="Mentioned">{pref.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
    </select>
  );
}

function ExistingFinder({ type, onPick, picked }) {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const pool = live(type === 'person' ? data.people : data.organisations);
  const res = q.trim().length < 2 ? [] : pool.filter(r => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  return (
    <div>
      {picked ? (
        <div className="flex items-center justify-between p-2 text-sm" style={{ background: 'var(--p-c)', borderRadius: 'var(--r-sm)' }}>
          <span style={{ color: 'var(--p-dk)' }}>Adds to <b>{picked.name}</b></span>
          <button type="button" onClick={() => onPick(null)} className="text-xs hover:underline" style={{ color: 'var(--p)' }}>Change</button>
        </div>
      ) : (
        <>
          <input className={inputCls} value={q} onChange={e => setQ(e.target.value)} placeholder={`Find the existing ${type === 'person' ? 'person' : 'organisation'}`} />
          {res.map(r => <button type="button" key={r.id} onClick={() => onPick(r)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-forest-50" style={{ color: 'var(--tx)' }}>{r.name}</button>)}
        </>
      )}
    </div>
  );
}

function AcceptModal({ obs, onClose }) {
  const { acceptObservation, repo } = useApp();
  const target = KIND[obs.kind]?.target || 'interaction';
  const canMerge = target === 'person' || target === 'organisation';
  const [f, setF] = useState(() => draftFrom(obs));
  const [existing, setExisting] = useState(null);
  const [mode, setMode] = useState('new');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const preferIds = (obs.suggested_links || []).filter(l => l.type === 'person').map(l => l.id);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    let data = { ...f, source: obs.source || { channel: 'assistant' } };
    if (mode === 'existing') {
      if (!existing) { setErr('Pick the existing record first.'); return; }
      // Only fill what the existing record lacks; append notes rather than replace them.
      data = Object.fromEntries(Object.entries(f).filter(([k, v]) => v && (k === 'notes' || !existing[k] || (Array.isArray(v) && v.length))));
      if (data.notes && existing.notes && !existing.notes.includes(data.notes)) data.notes = existing.notes + '\n\n' + data.notes;
      for (const k of ['org_ids', 'roles']) if (data[k]) data[k] = [...new Set([...(existing[k] || []), ...data[k]])];
      delete data.segment; delete data.name;
    } else {
      const check = repo.validate(target, { id: 'check', created_at: nowISO(), created_by: repo.actor, ...data });
      if (!check.ok) { setErr(check.message); return; }
    }
    setBusy(true);
    try { await acceptObservation(obs.id, mode === 'existing' ? { type: target, id: existing.id, data } : { type: target, data }); onClose(); }
    catch (e2) { setErr(e2.message || 'Could not accept'); setBusy(false); }
  };

  const text = (k, label, opts = {}) => (
    <Field label={label}>{opts.area
      ? <textarea rows={opts.rows || 3} className={inputCls} value={f[k] || ''} onChange={e => set(k, e.target.value)} />
      : <input type={opts.type || 'text'} className={inputCls} value={f[k] || ''} onChange={e => set(k, e.target.value)} />}</Field>
  );

  return (
    <Modal open onClose={onClose} title={`Accept ${KIND[obs.kind]?.label.toLowerCase() || 'capture'}`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm p-3" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', color: 'var(--tx2)' }}>{obs.summary || 'No summary'}</p>
        {canMerge && (
          <div className="flex gap-2">
            <FilterChip on={mode === 'new'} onClick={() => setMode('new')}>Create new</FilterChip>
            <FilterChip on={mode === 'existing'} onClick={() => setMode('existing')}>Add to existing</FilterChip>
          </div>
        )}
        {mode === 'existing' && <ExistingFinder type={target} picked={existing} onPick={setExisting} />}

        {target === 'person' && <>
          {mode === 'new' && text('name', 'Name')}
          {text('role', 'Role')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{text('email', 'Email', { type: 'email' })}{text('phone', 'Phone')}</div>
          {mode === 'new' && <Field label="Segment"><div><SegmentPicker value={f.segment} onChange={v => set('segment', v)} /></div></Field>}
          {text('notes', 'Notes', { area: true })}
        </>}
        {target === 'organisation' && <>
          {mode === 'new' && text('name', 'Name')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{text('city', 'City')}{text('website', 'Website')}</div>
          {text('notes', 'Notes', { area: true })}
        </>}
        {target === 'commitment' && <>
          {text('text', 'What was promised', { area: true, rows: 2 })}
          <Field label="Who owes it"><PeopleSelect value={f.owner_id} onChange={v => set('owner_id', v)} preferIds={preferIds} /></Field>
          {text('due_date', 'Due date', { type: 'date' })}
        </>}
        {target === 'decision' && <>
          {text('text', 'Decision', { area: true, rows: 2 })}
          {text('rationale', 'Why', { area: true, rows: 2 })}
          {text('decided_at', 'Decided on', { type: 'date' })}
        </>}
        {target === 'interaction' && <>
          {text('title', 'Title')}
          {text('body', 'Details', { area: true, rows: 5 })}
        </>}

        {err && <p className="text-sm" style={{ color: '#b91c1c' }}>{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Accept'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function ObsCard({ obs, names, onAccept, onReject }) {
  const p = obs.payload || {};
  const entries = Object.entries(p).filter(([, v]) => v !== '' && v !== null && v !== undefined).slice(0, 6);
  return (
    <div className="p-4" style={listStyle}>
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="text-[11px] font-semibold px-2 py-0.5" style={{ background: 'var(--p-c)', color: 'var(--p-dk)', borderRadius: 'var(--r-full)' }}>{KIND[obs.kind]?.label || obs.kind}</span>
        <Eyebrow>{CHANNEL[obs.source?.channel] || 'Unknown source'}{obs.source?.by ? ' · ' + obs.source.by : ''} · {fmtDateTime(obs.created_at)}</Eyebrow>
      </div>
      <div className="type-h4 mb-1" style={{ color: 'var(--tx)' }}>{obs.summary || 'No summary'}</div>
      {entries.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs mb-2">
          {entries.map(([k, v]) => <Fragment key={k}><dt style={{ color: 'var(--tx3)' }}>{k}</dt><dd className="truncate" style={{ color: 'var(--tx2)' }}>{str(v)}</dd></Fragment>)}
        </dl>
      )}
      {names.length > 0 && <div className="text-xs mb-2" style={{ color: 'var(--tx2)' }}>Mentions: {names.join(', ')}</div>}
      <div className="flex justify-end gap-2">
        <Btn size="sm" variant="ghost" onClick={onReject}>Reject</Btn>
        <Btn size="sm" onClick={onAccept}>Review and accept</Btn>
      </div>
    </div>
  );
}

export default function InboxView() {
  const { data, rejectObservation } = useApp();
  const [kind, setKind] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [showDone, setShowDone] = useState(false);

  const nameOf = useMemo(() => {
    const m = {};
    for (const p of data.people) m['person:' + p.id] = p.name;
    for (const o of data.organisations) m['organisation:' + o.id] = o.name;
    return m;
  }, [data.people, data.organisations]);

  const pending = data.observations.filter(o => o.status === 'pending');
  const done = data.observations.filter(o => o.status !== 'pending').sort((a, b) => (b.resolved_at || '').localeCompare(a.resolved_at || '')).slice(0, 30);
  const rows = pending.filter(o => !kind || o.kind === kind).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const kinds = [...new Set(pending.map(o => o.kind))];

  const reject = (o) => {
    const reason = prompt('Why reject it? (optional)');
    if (reason === null) return;
    rejectObservation(o.id, reason);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <CrmNav />
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--tx)', letterSpacing: '-0.04em' }}>Review inbox</h1>
      <p className="text-sm mb-4" style={{ color: 'var(--tx2)' }}>What the assistant, WhatsApp and email picked up. Nothing reaches Hivemind until someone accepts it here.</p>

      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <FilterChip on={!kind} onClick={() => setKind('')}>All <Num>{pending.length}</Num></FilterChip>
          {kinds.map(k => <FilterChip key={k} on={kind === k} onClick={() => setKind(k)}>{KIND[k]?.label || k} <Num>{pending.filter(o => o.kind === k).length}</Num></FilterChip>)}
        </div>
      )}

      {rows.length === 0 ? <Empty icon="📥" label="Nothing to review" sub="New captures from the assistant and WhatsApp will appear here." /> : (
        <div className="space-y-3">
          {rows.map(o => (
            <ObsCard key={o.id} obs={o}
              names={(o.suggested_links || []).map(l => nameOf[l.type + ':' + l.id]).filter(Boolean)}
              onAccept={() => setAccepting(o)} onReject={() => reject(o)} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowDone(v => !v)} className="text-sm font-medium hover:underline" style={{ color: 'var(--p)' }}>{showDone ? 'Hide' : 'Show'} recently resolved ({done.length})</button>
          {showDone && (
            <div className="mt-2 overflow-hidden" style={listStyle}>
              {done.map(o => (
                <div key={o.id} className="flex justify-between gap-3 px-4 py-2 text-sm" style={{ borderTop: '1px solid var(--line)' }}>
                  <span className="truncate" style={{ color: 'var(--tx)' }}>{o.summary}</span>
                  <span className="text-xs shrink-0 capitalize" style={{ color: 'var(--tx3)' }}>{o.status} · {o.resolved_by}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {accepting && <AcceptModal obs={accepting} onClose={() => setAccepting(null)} />}
    </div>
  );
}
