export const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
export const nowISO = () => new Date().toISOString();
export const todayLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const cx = (...a) => a.filter(Boolean).join(' ');
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
export const fmtTime = (d) => d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
export const dayKey = (d) => d ? new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
export const avatarColor = (s = '') => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 60% 45%)`; };
export const isOverdue = (d) => d && d < todayStr();
export const isDueToday = (d) => d && d === todayStr();

export const TYPES = [
  { id: 'in_person', label: 'In person',         icon: '🤝', color: '#16a34a' },
  { id: 'phone',     label: 'Phone call',         icon: '📞', color: '#0ea5e9' },
  { id: 'video',     label: 'Video call',         icon: '🎥', color: '#8b5cf6' },
  { id: 'email',     label: 'Email',              icon: '✉️', color: '#f59e0b' },
  { id: 'message',   label: 'Message / Chat',     icon: '💬', color: '#14b8a6' },
  { id: 'event',     label: 'Event / Conference', icon: '🎪', color: '#ec4899' },
  { id: 'note',      label: 'Note',               icon: '📝', color: '#64748b' },
  { id: 'other',     label: 'Other',              icon: '•',  color: '#94a3b8' },
];
export const typeOf = (id) => TYPES.find(t => t.id === id) || TYPES[TYPES.length - 1];

export const PRIORITIES = [
  { id: 'high',   label: 'High',   color: '#ef4444', bg: '#fef2f2', icon: '🔴' },
  { id: 'medium', label: 'Medium', color: '#f59e0b', bg: '#fffbeb', icon: '🟡' },
  { id: 'low',    label: 'Low',    color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
];
export const STATUSES = [
  { id: 'todo',        label: 'To Do',       color: '#64748b', bg: '#f8fafc' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'done',        label: 'Done',        color: '#22c55e', bg: '#f0fdf4' },
];
export const prioOf = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];
export const statOf = (id) => STATUSES.find(s => s.id === id) || STATUSES[0];

export function stripHtml(html = '') {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}
