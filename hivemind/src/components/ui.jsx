import { useState, useEffect } from 'react';
import { cx, typeOf } from '../lib/utils.js';

export function Tag({ children, onRemove, small }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full bg-forest-100 text-forest-800 font-medium', small ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5')}>
      {children}
      {onRemove && <button type="button" onClick={onRemove} className="hover:text-red-600">×</button>}
    </span>
  );
}

export function TypeBadge({ type, small }) {
  const t = typeOf(type);
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-full font-medium', small ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5')}
      style={{ background: t.color + '1a', color: t.color }}
    >
      {t.icon} {t.label}
    </span>
  );
}

export function Field({ label, children, hint, right }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
        <span>{label}</span>{right}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-forest-400 bg-white';

export function Btn({ children, onClick, variant = 'primary', size = 'md', type = 'button', className, disabled }) {
  const v = {
    primary: 'bg-forest-500 hover:bg-forest-600 text-white shadow-sm',
    ghost:   'bg-white hover:bg-forest-50 text-slate-700 border border-slate-200',
    danger:  'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
    dark:    'bg-slate-800 hover:bg-slate-900 text-white',
  }[variant];
  const s = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-2.5' }[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx('rounded-lg font-semibold transition inline-flex items-center gap-1.5 disabled:opacity-50', v, s, className)}
    >
      {children}
    </button>
  );
}

export function TagInput({ value = [], onChange, placeholder = 'Add tag + Enter' }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return (
    <div className="flex flex-wrap gap-1.5 items-center rounded-lg border border-slate-300 px-2 py-1.5 bg-white">
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
      />
    </div>
  );
}

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
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={cx('bg-white rounded-2xl shadow-2xl w-full my-4', wide ? 'max-w-3xl' : 'max-w-xl')}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-20">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, label, title, sub, action }) {
  const heading = label || title;
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="font-semibold text-slate-700">{heading}</h3>
      {sub && <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">{sub}</p>}
      {action && (
        <div className="mt-4">
          {typeof action === 'object' && action.label
            ? <button onClick={action.onClick} className="text-sm text-forest-600 hover:underline font-medium">{action.label}</button>
            : action}
        </div>
      )}
    </div>
  );
}
