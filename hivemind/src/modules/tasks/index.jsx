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

  return (
    <div
      onClick={() => onEdit(task)}
      className={cx('bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition group', task.status === 'done' ? 'border-slate-100 opacity-60' : overdue ? 'border-red-200' : 'border-slate-200 hover:border-forest-300')}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base mt-0.5">{stat.icon}</span>
        <span className={cx('font-semibold text-sm flex-1 group-hover:text-forest-700 transition', task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800')}>
          {task.title}
        </span>
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: prio.color + '20', color: prio.color }}>
          {prio.icon} {prio.label}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          {task.assigned_to_name && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Avatar name={task.assigned_to_name} size={16} />
              {task.assigned_to_name}
            </span>
          )}
          {task.due_date && (
            <span className={cx('text-xs', overdue ? 'text-red-600 font-semibold' : dueToday ? 'text-amber-600 font-semibold' : 'text-slate-400')}>
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
          <h1 className="text-xl font-bold text-slate-800">Tasks</h1>
          <p className="text-sm text-slate-400">{openCount} open · {tasks.length} total</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {['board', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)} className={cx('px-3 py-1.5 text-xs font-medium', view === v ? 'bg-forest-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
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
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 bg-white max-w-xs"
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
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{col.icon} {col.label}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {colTasks.map(t => <TaskCard key={t.id} task={t} onEdit={setEditTask} />)}
                  <button
                    onClick={() => openNewTask({ status: col.id })}
                    className="w-full text-center text-xs text-slate-400 hover:text-forest-600 py-2 border border-dashed border-slate-200 hover:border-forest-300 rounded-lg transition"
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
