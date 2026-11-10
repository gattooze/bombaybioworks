import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { todayStr, PRIORITIES, STATUSES, prioOf, statOf } from '../../lib/utils.js';
import { Field, Btn, TagInput, inputCls } from '../../components/ui.jsx';
import { PersonSelect } from '../../components/PeoplePicker.jsx';

export default function TaskForm({ task, defaults = {}, onSave, onClose }) {
  const { data } = useApp();
  const [f, setF] = useState(task || {
    title: defaults.title || '',
    description: defaults.description || '',
    assigned_to: defaults.assigned_to || null,
    due_date: defaults.due_date || todayStr(),
    priority: defaults.priority || 'medium',
    status: defaults.status || 'todo',
    linked_note_id: defaults.linked_note_id || null,
    linked_note_title: defaults.linked_note_title || null,
    tags: defaults.tags || [],
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) { alert('Title is required.'); return; }
    const person = f.assigned_to ? data.people.find(p => p.id === f.assigned_to) : null;
    onSave({ ...f, assigned_to_name: person?.name || '' });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Task title">
        <input className={inputCls} value={f.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" autoFocus />
      </Field>
      <Field label="Description">
        <textarea rows={2} className={inputCls} value={f.description} onChange={e => set('description', e.target.value)} placeholder="Optional details…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Assigned to">
          <PersonSelect value={f.assigned_to} onChange={v => set('assigned_to', v)} />
        </Field>
        <Field label="Due date">
          <input type="date" className={inputCls} value={f.due_date} onChange={e => set('due_date', e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <div className="flex gap-1">
            {PRIORITIES.map(p => (
              <button type="button" key={p.id} onClick={() => set('priority', p.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${f.priority === p.id ? 'text-white' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                style={f.priority === p.id ? { background: p.color, borderColor: p.color } : {}}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Status">
          <div className="flex gap-1">
            {STATUSES.map(s => (
              <button type="button" key={s.id} onClick={() => set('status', s.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${f.status === s.id ? 'text-white bg-forest-600 border-forest-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <Field label="Tags">
        <TagInput value={f.tags} onChange={v => set('tags', v)} />
      </Field>
      {f.linked_note_id && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
          Linked to: <span className="font-medium">{f.linked_note_title}</span>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit">Save task</Btn>
      </div>
    </form>
  );
}
