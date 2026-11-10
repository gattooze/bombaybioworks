import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { todayLocal, TYPES, cx, stripHtml } from '../../lib/utils.js';
import { autoSummary } from '../../lib/autoSummary.js';
import { Field, Btn, TagInput, inputCls } from '../../components/ui.jsx';
import { RichEditor } from '../../components/RichEditor.jsx';
import AttachmentUploader from '../../components/AttachmentUploader.jsx';
import { PeoplePicker } from '../../components/PeoplePicker.jsx';

export default function NoteForm({ note, onSave, onClose, defaultType }) {
  const { me } = useApp();
  const [f, setF] = useState(note || {
    title: '', type: defaultType || 'in_person', datetime: todayLocal(), context: '', location: '',
    participant_ids: [], external_participants: [], body: '', summary: '', tags: [], attachments: [], logged_by: me, summaryEdited: false,
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim() && !stripHtml(f.body)) { alert('Add a title or some notes first.'); return; }
    const summary = (f.summary && f.summaryEdited) ? f.summary : autoSummary(f.body);
    const title = f.title.trim() || (summary ? summary.slice(0, 60) : 'Untitled note');
    onSave({ ...f, title, summary });
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Title">
            <input className={inputCls} value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Intro call with Acme Labs" autoFocus />
          </Field>
        </div>
        <Field label="When">
          <input type="datetime-local" className={inputCls} value={f.datetime} onChange={e => set('datetime', e.target.value)} />
        </Field>
      </div>
      <Field label="Type of interaction">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(t => (
            <button type="button" key={t.id} onClick={() => set('type', t.id)}
              className={cx('px-2.5 py-1 rounded-full text-xs font-medium border transition', f.type === t.id ? 'text-white' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}
              style={f.type === t.id ? { background: t.color, borderColor: t.color } : {}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </Field>
      {f.type !== 'note' && (
        <Field label="Participants" hint="Who was part of this conversation">
          <PeoplePicker value={f.participant_ids} external={f.external_participants} onChange={v => set('participant_ids', v)} onExternalChange={v => set('external_participants', v)} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Context / Purpose"><input className={inputCls} value={f.context} onChange={e => set('context', e.target.value)} placeholder="fundraising, BD, hiring…" /></Field>
        <Field label="Location / Channel"><input className={inputCls} value={f.location} onChange={e => set('location', e.target.value)} placeholder="Zoom, Mumbai office…" /></Field>
      </div>
      <Field label="Notes">
        <RichEditor value={f.body} onChange={v => setF(s => ({ ...s, body: v, summary: s.summaryEdited ? s.summary : autoSummary(v) }))} />
      </Field>
      <Field
        label="Summary"
        right={<button type="button" onClick={() => setF(s => ({ ...s, summary: autoSummary(s.body), summaryEdited: false }))} className="text-forest-600 hover:underline font-medium">✨ Auto-summarise</button>}
        hint="Generated automatically — edit freely."
      >
        <textarea rows={2} className={inputCls} value={f.summary} onChange={e => setF(s => ({ ...s, summary: e.target.value, summaryEdited: true }))} placeholder="A one-line summary will appear here as you type…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tags"><TagInput value={f.tags} onChange={v => set('tags', v)} /></Field>
        <Field label="Logged by"><input className={inputCls} value={f.logged_by} onChange={e => set('logged_by', e.target.value)} /></Field>
      </div>
      <Field label="Attachments">
        <AttachmentUploader folder="notes" attachments={f.attachments} onChange={v => set('attachments', v)} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit">Save note</Btn>
      </div>
    </form>
  );
}
