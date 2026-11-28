import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { Modal, Btn } from '../../components/ui.jsx';
import { Eyebrow, DUP_TAG, SEGMENTS } from './shared.jsx';

const FIELDS = {
  person: [
    ['name', 'Name'], ['role', 'Role'], ['org', 'Organisation (text)'], ['email', 'Email'],
    ['phone', 'Phone'], ['linkedin_url', 'LinkedIn'], ['segment', 'Segment'], ['notes', 'Notes'],
  ],
  organisation: [
    ['name', 'Name'], ['city', 'City'], ['country', 'Country'], ['website', 'Website'], ['gstin', 'GSTIN'], ['notes', 'Notes'],
  ],
};

const show = (k, v) => {
  if (v === undefined || v === null || v === '') return <span style={{ color: 'var(--tx3)' }}>Empty</span>;
  if (k === 'segment') return SEGMENTS.find(s => s.id === v)?.label || v;
  return String(v);
};

/**
 * Side by side merge. The person picks the surviving record and, field by field, which value to keep.
 * The other record is archived with merged_into and every reference moves to the survivor.
 */
export default function MergeModal({ type, a, b, onClose, onDone }) {
  const { mergeRecords } = useApp();
  const [winner, setWinner] = useState(a);
  const loser = winner.id === a.id ? b : a;
  const fields = FIELDS[type];

  // Default: keep the survivor's value, fall back to the other side when the survivor's is empty.
  const defaults = useMemo(() => Object.fromEntries(fields.map(([k]) => [k, winner[k] ? 'w' : (loser[k] ? 'l' : 'w')])), [winner, loser, fields]);
  const [choice, setChoice] = useState({});
  const pick = (k) => choice[`${winner.id}:${k}`] || defaults[k];
  const setPick = (k, v) => setChoice(c => ({ ...c, [`${winner.id}:${k}`]: v }));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const differs = fields.filter(([k]) => (winner[k] || '') !== (loser[k] || ''));
  const same = fields.filter(([k]) => (winner[k] || '') === (loser[k] || '') && winner[k]);

  const submit = async () => {
    setBusy(true); setErr('');
    const picks = {};
    for (const [k] of fields) if (pick(k) === 'l' && loser[k] !== undefined) picks[k] = loser[k];
    // Tags are unioned by the repo; drop duplicate markers that point at either record.
    const ids = [winner.id, loser.id];
    picks.tags = [...new Set([...(winner.tags || []), ...(loser.tags || [])])]
      .filter(t => !(t.startsWith(DUP_TAG) && ids.includes(t.slice(DUP_TAG.length))));
    try { await mergeRecords(type, winner.id, loser.id, picks); onDone?.(); onClose(); }
    catch (e) { setErr(e.message || 'Merge failed'); setBusy(false); }
  };

  const Side = ({ r, label }) => (
    <button type="button" onClick={() => setWinner(r)}
      className="flex-1 text-left p-3 transition"
      style={{ borderRadius: 'var(--r-md)', border: '1px solid ' + (winner.id === r.id ? 'var(--p)' : 'var(--line-hv)'), background: winner.id === r.id ? 'var(--p-c)' : 'var(--card)' }}>
      <Eyebrow>{label}</Eyebrow>
      <div className="font-semibold mt-0.5" style={{ color: 'var(--tx)' }}>{r.name}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--tx2)' }}>{winner.id === r.id ? 'Keeps this record' : 'Will be archived'}</div>
    </button>
  );

  return (
    <Modal wide open onClose={onClose} title={`Merge ${type === 'person' ? 'people' : 'organisations'}`}>
      <p className="text-sm mb-3" style={{ color: 'var(--tx2)' }}>
        Pick the record to keep, then the value to keep for each field that differs. The other record is archived, not deleted, and its notes, deals and links move across.
      </p>
      <div className="flex gap-2 mb-4">
        <Side r={a} label="Record A" />
        <Side r={b} label="Record B" />
      </div>

      {differs.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }} className="overflow-hidden mb-3">
          <div className="grid grid-cols-[110px_1fr_1fr] text-xs px-3 py-2" style={{ background: 'var(--bg)' }}>
            <Eyebrow>Field</Eyebrow><Eyebrow>Keep</Eyebrow><Eyebrow>Other</Eyebrow>
          </div>
          {differs.map(([k, lbl]) => (
            <div key={k} className="grid grid-cols-[110px_1fr_1fr] gap-2 px-3 py-2 text-sm items-start" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="text-xs font-semibold pt-1" style={{ color: 'var(--tx2)' }}>{lbl}</div>
              {['w', 'l'].map(side => {
                const r = side === 'w' ? winner : loser;
                const on = pick(k) === side;
                return (
                  <label key={side} className="flex gap-2 items-start cursor-pointer p-1.5 break-words min-w-0"
                    style={{ borderRadius: 'var(--r-sm)', background: on ? 'var(--p-c)' : 'transparent' }}>
                    <input type="radio" className="mt-1 accent-forest-500" checked={on} onChange={() => setPick(k, side)} name={`${winner.id}:${k}`} />
                    <span className="min-w-0 line-clamp-3" style={{ color: 'var(--tx)' }}>{show(k, r[k])}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {same.length > 0 && (
        <p className="text-xs mb-3" style={{ color: 'var(--tx3)' }}>Same on both: {same.map(([, l]) => l).join(', ')}.</p>
      )}
      <p className="text-xs mb-4" style={{ color: 'var(--tx3)' }}>Tags and linked organisations from both records are combined.</p>

      {err && <div className="text-sm mb-3 p-2" style={{ color: '#b91c1c', background: '#fef2f2', borderRadius: 'var(--r-sm)' }}>{err}</div>}
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={busy}>{busy ? 'Merging…' : `Merge into ${winner.name}`}</Btn>
      </div>
    </Modal>
  );
}
