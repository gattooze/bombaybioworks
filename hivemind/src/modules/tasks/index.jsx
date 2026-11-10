import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { fmtDate, prioOf, statOf, cx, isOverdue, isDueToday } from '../../lib/utils.js';
import { Tag, Empty, Btn } from '../../components/ui.jsx';
import Avatar from '../../components/Avatar.jsx';

function TaskCard({ task, onEdit }) {
  const prio = prioOf(task.priority);
  const stat = statOf(task.status);
  const overdue = isOverdue(task.due_date) && task.status !== 'done';
  const dueToday = isDueToday(task.due_date) && task.status !== 'done';

  const borderColor = task.status === 'done' ? 'var(--line)' : overdue ? 'rgba(220,38,38,.3)' : 'var(--line)';
  return (
    <div
      onClick={() => onEdit(task)}
      className="p-4 cursor-pointer transition"
      style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', border: `1px solid ${borderColor}`, opacity: task.status === 'done' ? 0.6 : 1 }}
      onMouseEnter={e => { if (task.status !== 'done') { e.currentTarget.style.borderColor = 'var(--line-hv)'; e.currentTarget.style.boxShadow = overdue ? '0 12px 40px rgba(220,38,38,.08)' : 'var(--shadow-card-forest)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base mt-0.5">{stat.icon}</span>
        <span className={cx('type-h4 flex-1', task.status === 'done' ? 'line-through' : '')} style={{ color: task.status === 'done' ? 'var(--tx2)' : 'var(--tx)' }}>
          {task.title}
        </span>
        <span className="text-xs font-semibold px-1.5 py-0.5" style={{ background: prio.color + '20', color: prio.color, borderRadius: 'var(--r-sm)' }}>
          {prio.icon} {prio.label}
        </span>
      </div>
      {task.description && (
        <p className="type-body-sm mb-2 line-clamp-2" style={{ color: 'var(--tx2)' }}>{task.description}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          {task.assigned_to_name && (
            <span className="flex items-center gap-1 type-body-sm" style={{ color: 'var(--tx2)' }}>
              <Avatar name={task.assigned_to_name} size={16} />
              {task.assigned_to_name}
            </span>
          )}
          {task.due_date && (
            <span className={cx('type-body-sm', overdue ? 'font-semibold' : dueToday ? 'font-semibold' : '')} style={{ color: overdue ? '#dc2626' : dueToday ? '#d97706' : 'var(--tx3)' }}>
              {overdue ? '⚠ Overdue · ' : dueToday ? '⚡ Today · ' : ''}{fmtDate(task.due_date)}
            </span>
          )}
        </div>
        {(task.tags || []).length > 0 && (
          <div className="flex gap-1">
            {task.tags.slice(0, 2).map(t => <Tag key={t} small>{t}</Tag>)}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_COLS = [
  { id: 'todo',        label: 'To do',       icon: '⬜' },
  { id: 'in_progress', label: 'In progress',  icon: '🔵' },
  { id: 'done',        label: 'Done',         icon: '✅' },
];

export default function TasksView() {
  const { data, openNewTask, setEditTask } = useApp();
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');

  const tasks = (data.tasks || []).filter(t =>
    !search.trim() || (t.title + (t.description || '') + (t.assigned_to_name || '') + (t.tags || []).join(' ')).toLowerCase().includes(search.toLowerCase())
  );

  const openCount = tasks.filter(t => t.status !== 'done').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tx)', letterSpacing: '-0.03em' }}>Tasks</h1>
          <p className="text-sm" style={{ color: 'var(--tx2)' }}>{openCount} open · {tasks.length} total</p>
        </div>
        <div className="flex gap-2">
          <div className="flex overflow-hidden" style={{ border: '1px solid var(--line-hv)', borderRadius: 'var(--r-md)' }}>
            {['board', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 text-xs font-medium transition"
                style={view === v ? { background: 'var(--p)', color: '#fff' } : { background: 'var(--card)', color: 'var(--tx2)' }}>
                {v === 'board' ? '⊞ Board' : '☰ List'}
              </button>
            ))}
          </div>
          <Btn onClick={() => openNewTask()}>＋ New task</Btn>
        </div>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 max-w-xs transition"
          style={{ background: 'var(--card)', border: '1px solid var(--line-hv)', borderRadius: 'var(--r-md)', color: 'var(--tx)' }}
        />
      </div>

      {tasks.length === 0 ? (
        <Empty icon="✅" label={search ? 'No matching tasks' : 'No tasks yet'} action={!search ? { label: 'Create first task', onClick: () => openNewTask() } : null} />
      ) : view === 'board' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STATUS_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id).sort((a, b) => {
              const pOrder = { high: 0, medium: 1, low: 2 };
              return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
            });
            return (
              <div key={col.id}>
                <div className="flex items-center justify-between mb-3">
                  <span className="type-caption" style={{ color: 'var(--tx2)' }}>{col.icon} {col.label}</span>
                  <span className="text-xs px-2 py-0.5" style={{ color: 'var(--tx3)', background: 'var(--line)', borderRadius: 'var(--r-full)' }}>{colTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {colTasks.map(t => <TaskCard key={t.id} task={t} onEdit={setEditTask} />)}
                  <button
                    onClick={() => openNewTask({ status: col.id })}
                    className="w-full text-center text-xs py-2 transition"
                    style={{ color: 'var(--tx3)', border: '1px dashed var(--line-hv)', borderRadius: 'var(--r-lg)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--p)'; e.currentTarget.style.borderColor = 'var(--p)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx3)'; e.currentTarget.style.borderColor = 'var(--line-hv)'; }}
                  >
                    ＋ Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.sort((a, b) => {
            if (a.status === 'done' && b.status !== 'done') return 1;
            if (b.status === 'done' && a.status !== 'done') return -1;
            const pOrder = { high: 0, medium: 1, low: 2 };
            return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
          }).map(t => <TaskCard key={t.id} task={t} onEdit={setEditTask} />)}
        </div>
      )}
    </div>
  );
}
