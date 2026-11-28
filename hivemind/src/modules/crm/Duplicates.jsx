import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { Btn, Empty } from '../../components/ui.jsx';
import MergeModal from './MergeModal.jsx';
import { CrmNav, Eyebrow, Num, DUP_TAG, dupTargetId, live, orgDuplicatePairs, listStyle, rowStyle, SEGMENTS } from './shared.jsx';

const NOT_DUP = 'not-duplicate-of:';
const dismissed = (a, b) => (a.tags || []).includes(NOT_DUP + b.id) || (b.tags || []).includes(NOT_DUP + a.id);
const segLabel = (p) => SEGMENTS.find(s => s.id === p.segment)?.label || 'Unsorted';

function PairRow({ a, b, why, detail, onMerge, onDismiss }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3" style={rowStyle}>
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-3">
        {[a, b].map(r => (
          <div key={r.id} className="min-w-0">
            <div className="type-h4 truncate" style={{ color: 'var(--tx)' }}>{r.name}</div>
            <div className="type-body-sm truncate" style={{ color: 'var(--tx2)' }}>{detail(r)}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs mr-1" style={{ color: 'var(--tx3)' }}>{why}</span>
        <Btn size="sm" variant="ghost" onClick={onDismiss}>Not the same</Btn>
        <Btn size="sm" onClick={onMerge}>Compare</Btn>
      </div>
    </div>
  );
}

export default function DuplicatesView() {
  const { data, updatePerson, updateOrg } = useApp();
  const [merge, setMerge] = useState(null);

  const peopleById = useMemo(() => Object.fromEntries(data.people.map(p => [p.id, p])), [data.people]);
  const orgById = useMemo(() => Object.fromEntries(data.organisations.map(o => [o.id, o])), [data.organisations]);
  const personPairs = live(data.people)
    .map(p => ({ a: p, b: peopleById[dupTargetId(p)] }))
    .filter(x => x.b && !x.b.archived)
    .sort((x, y) => x.a.name.localeCompare(y.a.name));
  const orgPairs = orgDuplicatePairs(data.organisations).filter(x => !dismissed(x.a, x.b));

  const peopleIn = useMemo(() => {
    const m = {};
    for (const p of live(data.people)) for (const id of p.org_ids || []) m[id] = (m[id] || 0) + 1; // includes company placeholders, so merge keeps the better-linked org
    return m;
  }, [data.people]);

  const personDetail = (p) => [segLabel(p), p.role, (p.org_ids || []).map(id => orgById[id]?.name).filter(Boolean).join(', ') || p.org].filter(Boolean).join(' · ');
  const orgDetail = (o) => `${peopleIn[o.id] || 0} people${o.city ? ' · ' + o.city : ''}`;

  // "Not the same": drop the duplicate marker on people; remember the choice on organisations.
  const notSamePerson = (a) => updatePerson(a.id, { tags: (a.tags || []).filter(t => !t.startsWith(DUP_TAG)) }, 'Marked not a duplicate');
  const notSameOrg = (a, b) => updateOrg(a.id, { tags: [...new Set([...(a.tags || []), NOT_DUP + b.id])] }, `Marked not a duplicate of ${b.name}`);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <CrmNav />
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--tx)', letterSpacing: '-0.04em' }}>Duplicates</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--tx2)' }}>Compare each pair and merge, or mark it as two different records. Merging archives one record and keeps its history.</p>

      <section className="mb-8">
        <Eyebrow className="mb-2">People · <Num>{personPairs.length}</Num></Eyebrow>
        {personPairs.length === 0 ? <Empty icon="✓" label="No people to review" /> : (
          <div className="overflow-hidden" style={listStyle}>
            {personPairs.map(({ a, b }) => (
              <PairRow key={a.id} a={a} b={b} why="Tagged in cleanup" detail={personDetail}
                onMerge={() => setMerge({ type: 'person', a: b, b: a })}
                onDismiss={() => notSamePerson(a)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <Eyebrow className="mb-2">Organisations · <Num>{orgPairs.length}</Num></Eyebrow>
        {orgPairs.length === 0 ? <Empty icon="✓" label="No organisations to review" /> : (
          <div className="overflow-hidden" style={listStyle}>
            {orgPairs.map(({ a, b, why }) => {
              const [w, l] = (peopleIn[a.id] || 0) >= (peopleIn[b.id] || 0) ? [a, b] : [b, a];
              return (
                <PairRow key={a.id + b.id} a={a} b={b} why={why} detail={orgDetail}
                  onMerge={() => setMerge({ type: 'organisation', a: w, b: l })}
                  onDismiss={() => notSameOrg(a, b)} />
              );
            })}
          </div>
        )}
      </section>

      {merge && <MergeModal type={merge.type} a={merge.a} b={merge.b} onClose={() => setMerge(null)} />}
    </div>
  );
}
