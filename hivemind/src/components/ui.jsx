import { useState, useEffect } from 'react';
import { cx, typeOf } from '../lib/utils.js';

/* Tag / Chip — DS: r-full pill, p-c bg, p text */
export function Tag({ children, onRemove, small }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 font-medium', small ? 'text-[10px] px-1.5 py-0' : 'text-[11px] px-2 py-0.5')}
      style={{ background: 'var(--p-c)', color: 'var(--p)', borderRadius: 'var(--r-full)' }}
    >
      {children}
      {onRemove && <button type="button" onClick={onRemove} className="hover:text-red-600 leading-none">×</button>}
    </span>
  );
}

/* TypeBadge — DS pill shape, type colour at 10% bg */
export function TypeBadge({ type, small }) {
  const t = typeOf(type);
  return (
    <span
      className={cx('inline-flex items-center gap-1 font-medium', small ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5')}
      style={{ background: t.color + '1a', color: t.color, borderRadius: 'var(--r-full)', letterSpacing: '-0.005em' }}
    >
      {t.icon} {t.label}
    </span>
  );
}

/* Field label */
export function Field({ label, children, hint, right }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx2)' }}>
        <span>{label}</span>{right}
      </span>
      {children}
      {hint && <span className="block mt-1" style={{ fontSize: '11px', color: 'var(--tx3)' }}>{hint}</span>}
    </label>
  );
}

/* Input base class — DS: card bg, line border, r-md radius */
export const inputCls = 'w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 transition'
  + ' bg-white border border-[rgba(0,0,0,0.12)] rounded-[7px]';

/* Btn — DS: r-md=7px, shadow-btn-primary on primary, hover to p-dk */
export function Btn({ children, onClick, variant = 'primary', size = 'md', type = 'button', className, disabled }) {
  const base = 'inline-flex items-center gap-1.5 font-semibold transition disabled:opacity-50 select-none';
  const r = 'rounded-[7px]';

  const variants = {
    primary: { style: { background: 'var(--p)', color: '#fff', boxShadow: 'var(--shadow-btn-primary)' }, hoverCls: 'hover:brightness-90 active:translate-y-px' },
    ghost:   { style: { background: '#fff', color: 'var(--tx)', border: '1px solid var(--line-hv)' },     hoverCls: 'hover:bg-forest-50' },
    danger:  { style: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },           hoverCls: 'hover:bg-red-100' },
    dark:    { style: { background: '#1e293b', color: '#fff' },                                            hoverCls: 'hover:bg-slate-900' },
  };
  const v = variants[variant] || variants.primary;

  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };
  const s = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={v.style}
      className={cx(base, r, v.hoverCls, s, className)}
    >
      {children}
    </button>
  );
}

/* TagInput */
export function TagInput({ value = [], onChange, placeholder = 'Add tag + Enter' }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return (
    <div className="flex flex-wrap gap-1.5 items-center rounded-[7px] px-2 py-1.5 bg-white" style={{ border: '1px solid var(--line-hv)' }}>
      {value.map(tg => <Tag key={tg} onRemove={() => onChange(value.filter(x => x !== tg))}>{tg}</Tag>)}
      <input
        value={t}
        onChange={e => setT(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1));
        }}
        className="flex-1 min-w-[120px] text-sm outline-none py-0.5"
        style={{ color: 'var(--tx)' }}
      />
    </div>
  );
}

/* Modal — DS card surface, r-lg, line border */
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-8 overflow-y-auto"
      style={{ background: 'rgba(10,10,10,.4)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={cx('w-full my-4', wide ? 'max-w-3xl' : 'max-w-xl')}
        style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-float)', border: '1px solid var(--line)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-20"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}
        >
          <h3 className="font-bold text-lg" style={{ color: 'var(--tx)', letterSpacing: '-0.02em' }}>{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none transition hover:opacity-60" style={{ color: 'var(--tx2)' }}>×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* Empty state */
export function Empty({ icon, label, title, sub, action }) {
  const heading = label || title;
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="font-semibold" style={{ color: 'var(--tx)' }}>{heading}</h3>
      {sub && <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: 'var(--tx2)' }}>{sub}</p>}
      {action && (
        <div className="mt-4">
          {typeof action === 'object' && action.label
            ? <button onClick={action.onClick} className="text-sm font-medium hover:underline" style={{ color: 'var(--p)' }}>{action.label}</button>
            : action}
        </div>
      )}
    </div>
  );
}
