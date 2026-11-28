import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { Btn, Modal, Empty } from '../../components/ui.jsx';
import { CLOSED_STAGES } from '../../../ontology/index.js';
import { DealForm } from './Pipelines.jsx';
import { CrmNav, Eyebrow, Num, STAGE_LABEL, live, localToday, addDaysIso, listStyle, rowStyle } from './shared.jsx';


/** One list of what is due: deal next actions, open commitments, and samples waiting on feedback. */
export default function FollowUpsView() {
  const { data, updateObj } = useApp();
  const navigate = useNavigate();
  const [editingDeal, setEditingDeal] = useState(null);
  const today = localToday();
  const week = addDaysIso(today, 7);
  const name = useMemo(() => {
    const m = {};
    for (const p of data.people) m[p.id] = p.name;
    for (const o of data.organisations) m[o.id] = o.name;
    return m;
  }, [data.people, data.organisations]);

  const items = [
    ...live(data.deals).filter(d => !CLOSED_STAGES.includes(d.stage) && d.next_action_date).map(d => ({
      key: 'd' + d.id, due: d.next_action_date, kind: 'Deal', title: d.next_action || `Move ${d.title} forward`,
      sub: `${d.title} · ${name[d.org_id] || ''} · ${STAGE_LABEL(d.stage)}`, open: () => setEditingDeal(d),
    })),
    ...live(data.commitments).filter(c => c.status === 'open').map(c => ({
      key: 'c' + c.id, due: c.due_date || '', kind: 'Promise', title: c.text,
      sub: `${name[c.owner_id] || 'Someone'} owes ${name[c.counterparty_id] || 'it'}`,
      done: () => updateObj('commitment', c.id, { status: 'done' }, 'Done'),
    })),
    // A sample sent more than 14 days ago with no feedback needs a nudge.
    ...live(data.samples).filter(s => ['sent', 'received', 'testing'].includes(s.status) && s.sent_date && addDaysIso(s.sent_date, 14) <= today).map(s => ({
      key: 's' + s.id, due: addDaysIso(s.sent_date, 14), kind: 'Sample', title: `Ask ${name[s.org_id] || 'them'} for feedback on ${s.grade}`,
      sub: `Sent ${s.sent_date} · ${s.status}`, open: () => navigate('/crm/samples'),
    })),
  ];
  const groups = [
    ['Overdue', items.filter(i => i.due && i.due < today)],
    ['Today', items.filter(i => i.due === today)],
    ['Next 7 days', items.filter(i => i.due > today && i.due <= week)],
    ['No date', items.filter(i => !i.due)],
  ].map(([l, xs]) => [l, xs.sort((a, b) => a.due.localeCompare(b.due))]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <CrmNav />
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--tx)', letterSpacing: '-0.04em' }}>Follow-ups</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--tx2)' }}>Deal next actions, open promises, and samples waiting on feedback.</p>
      {groups.every(([, xs]) => !xs.length) ? <Empty icon="✓" label="Nothing due" sub="Add a next action and date on a deal, and it shows up here." /> : groups.filter(([, xs]) => xs.length).map(([label, xs]) => (
        <section key={label} className="mb-6">
          <Eyebrow className="mb-2" >{label} · <Num>{xs.length}</Num></Eyebrow>
          <div className="overflow-hidden" style={listStyle}>
            {xs.map(i => (
              <div key={i.key} className="flex items-center gap-3 px-4 py-2.5" style={rowStyle}>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 shrink-0 w-16 text-center" style={{ background: 'var(--p-c)', color: 'var(--p-dk)', borderRadius: 'var(--r-full)' }}>{i.kind}</span>
                <button className="flex-1 min-w-0 text-left" onClick={i.open} disabled={!i.open}>
                  <div className="type-h4 truncate" style={{ color: 'var(--tx)' }}>{i.title}</div>
                  <div className="type-body-sm truncate" style={{ color: 'var(--tx2)' }}>{i.sub}</div>
                </button>
                {i.due && <span className="type-mono text-xs shrink-0" style={{ color: label === 'Overdue' ? '#b91c1c' : 'var(--tx3)' }}>{i.due}</span>}
                {i.done && <Btn size="sm" variant="ghost" onClick={i.done}>Done</Btn>}
              </div>
            ))}
          </div>
        </section>
      ))}
      {editingDeal && (
        <Modal wide open onClose={() => setEditingDeal(null)} title={editingDeal.title}>
          <DealForm deal={editingDeal} onClose={() => setEditingDeal(null)} />
        </Modal>
      )}
    </div>
  );
}
