import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { cx } from '../../lib/utils.js';

export const SEGMENTS = [
  { id: 'demand',    label: 'Demand',    hint: 'Buyers and prospects. This is the CRM.' },
  { id: 'directory', label: 'Directory', hint: 'Suppliers, peers, competitors, advisors, government.' },
  { id: 'unsorted',  label: 'Unsorted',  hint: 'Waiting to be filed.' },
];

export const DUP_TAG = 'possible-duplicate-of:';
export const dupTargetId = (r) => (r.tags || []).find(t => t.startsWith(DUP_TAG))?.slice(DUP_TAG.length) || null;
export const live = (xs = []) => xs.filter(x => !x.archived);
export const segOf = (p) => p.segment || 'unsorted';
// Person records the WhatsApp bot created for companies. The cleanup gave each one a real
// Organisation and tagged it; the People screens hide them so lists show actual people.
export const ORG_RECORD_TAG = 'org-record';
export const isOrgPlaceholder = (p) => (p.tags || []).includes(ORG_RECORD_TAG);

/** DS eyebrow: Plex Mono, uppercase, wide tracking. */
export function Eyebrow({ children, className }) {
  return <div className={cx('type-mono uppercase', className)} style={{ fontSize: 11, letterSpacing: '0.09em', color: 'var(--tx3)' }}>{children}</div>;
}

/** Mono number, used for counts. */
export const Num = ({ children }) => <span className="type-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{children}</span>;

/** Sub-navigation shared by every CRM screen. */
export function CrmNav() {
  const { data } = useApp();
  const pending = data.observations.filter(o => o.status === 'pending').length;
  const dups = live(data.people).filter(dupTargetId).length;
  const items = [
    { to: '/crm', label: 'People', end: true },
    { to: '/crm/orgs', label: 'Organisations' },
    { to: '/crm/duplicates', label: 'Duplicates', count: dups },
    { to: '/inbox', label: 'Review inbox', count: pending },
  ];
  return (
    <nav className="flex gap-1 mb-5 overflow-x-auto -mx-1 px-1" aria-label="CRM">
      {items.map(i => (
        <NavLink key={i.to} to={i.to} end={i.end}
          className="shrink-0 px-3 py-1.5 text-sm font-medium transition"
          style={({ isActive }) => ({
            borderRadius: 'var(--r-full)',
            background: isActive ? 'var(--p)' : 'transparent',
            color: isActive ? '#fff' : 'var(--tx2)',
            border: isActive ? '1px solid var(--p)' : '1px solid var(--line-hv)',
          })}>
          {i.label}{i.count ? <span className="ml-1.5 type-mono text-xs opacity-80">{i.count}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

/** Segmented control for the three Person segments. */
export function SegmentPicker({ value, onChange, size = 'md', counts }) {
  return (
    <div className="inline-flex p-0.5" role="radiogroup" style={{ background: 'var(--p-c)', borderRadius: 'var(--r-full)' }}>
      {SEGMENTS.map(s => {
        const on = value === s.id;
        return (
          <button key={s.id} type="button" role="radio" aria-checked={on} title={s.hint}
            onClick={(e) => { e.stopPropagation(); if (!on) onChange(s.id); }}
            className={cx('font-medium transition', size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-sm')}
            style={{ borderRadius: 'var(--r-full)', background: on ? 'var(--card)' : 'transparent', color: on ? 'var(--p-dk)' : 'var(--tx2)', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>
            {s.label}{counts ? <span className="ml-1.5 type-mono opacity-70">{counts[s.id] || 0}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="search"
      className="px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 w-full sm:max-w-xs transition"
      style={{ background: 'var(--card)', border: '1px solid var(--line-hv)', borderRadius: 'var(--r-md)', color: 'var(--tx)' }} />
  );
}

/** Small toggle chip for filters. */
export function FilterChip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="px-2.5 py-1 text-xs font-medium transition"
      style={{ borderRadius: 'var(--r-full)', border: '1px solid ' + (on ? 'var(--p)' : 'var(--line-hv)'), background: on ? 'var(--p-c)' : 'var(--card)', color: on ? 'var(--p-dk)' : 'var(--tx2)' }}>
      {children}
    </button>
  );
}

/** Card surface for list rows. */
export const listCls = 'overflow-hidden';
export const listStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' };
export const rowStyle = { borderTop: '1px solid var(--line)' };

// ── Organisation duplicate detection ────────────────────────────────────────
const SUFFIX = /\b(pvt|private|ltd|limited|inc|llc|llp|co|company|corp|corporation|group|india|team)\b\.?/g;
export const compactKey = (name = '') => name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(SUFFIX, ' ').replace(/[^a-z0-9]/g, '');
const squash = (name = '') => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
  }
  return dp[a.length][b.length];
}

/** Likely duplicate organisation pairs, strongest first. Suggestions only: a person decides. */
export function orgDuplicatePairs(orgs) {
  const xs = live(orgs).map(o => ({ o, k: compactKey(o.name), s: squash(o.name) }));
  const pairs = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
    const a = xs[i], b = xs[j];
    let why = null, score = 0;
    if (a.s === b.s || (a.k && a.k === b.k)) { why = 'Same name'; score = 3; }
    else if (a.k.length >= 5 && b.k.length >= 5 && editDistance(a.k, b.k) <= 1) { why = 'One letter apart'; score = 2; }
    else {
      const [sh, lo] = a.k.length <= b.k.length ? [a, b] : [b, a];
      if (sh.k.length >= 3 && lo.s.startsWith(sh.s)) {
        why = 'One name contains the other'; score = 1;
      }
    }
    if (why) pairs.push({ a: a.o, b: b.o, why, score });
  }
  return pairs.sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name));
}

/** Pick the record that should survive a merge: more links, then older. */
export function suggestWinner(a, b, refCount) {
  const ra = refCount(a.id), rb = refCount(b.id);
  if (ra !== rb) return ra > rb ? [a, b] : [b, a];
  return (a.name || '').length >= (b.name || '').length ? [a, b] : [b, a];
}
