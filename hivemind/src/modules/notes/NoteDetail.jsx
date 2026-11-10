import { useApp } from '../../context/AppContext.jsx';
import { fmtDateTime, typeOf, cx } from '../../lib/utils.js';
import { Modal, Tag, Btn } from '../../components/ui.jsx';
import { NoteContent } from '../../components/RichEditor.jsx';
import { AttachmentChip } from '../../components/AttachmentUploader.jsx';
import Avatar from '../../components/Avatar.jsx';

export default function NoteDetail({ id, onClose, onEdit }) {
  const { data, removeNote } = useApp();
  const note = data.notes.find(n => n.id === id);
  if (!note) return null;
  const t = typeOf(note.type);
  const participants = (note.participant_ids || []).map(pid => data.people.find(p => p.id === pid)).filter(Boolean);

  return (
    <Modal wide open onClose={onClose} title={
      <span className="flex items-center gap-2">
        <span className="text-lg">{t.icon}</span>
        <span>{note.title}</span>
        <span className="text-xs font-normal text-slate-400">{fmtDateTime(note.datetime)}</span>
      </span>
    }>
      {note.summary && (
        <div className="bg-forest-50 border border-forest-100 rounded-lg px-4 py-3 mb-4 text-sm text-forest-800">
          {note.summary}
        </div>
      )}
      {(participants.length > 0 || (note.external_participants || []).length > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {participants.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-sm">
              <Avatar name={p.name} size={20} />
              <span className="text-slate-700">{p.name}</span>
              {p.org && <span className="text-slate-400 text-xs">· {p.org}</span>}
            </span>
          ))}
          {(note.external_participants || []).map((n, i) => (
            <span key={'e' + i} className="px-2.5 py-1 rounded-full bg-slate-100 text-sm text-slate-600">{n}</span>
          ))}
        </div>
      )}
      {(note.context || note.location) && (
        <div className="flex gap-4 mb-4 text-sm text-slate-500">
          {note.context && <span>🏷 {note.context}</span>}
          {note.location && <span>📍 {note.location}</span>}
        </div>
      )}
      {note.body && (
        <div className="mb-4 border border-slate-100 rounded-lg p-3 bg-white">
          <NoteContent html={note.body} />
        </div>
      )}
      {(note.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {note.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
        </div>
      )}
      {(note.attachments || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {note.attachments.map((a, i) => <AttachmentChip key={i} a={a} />)}
        </div>
      )}
      {note.logged_by && (
        <div className="text-xs text-slate-400 mb-4">Logged by {note.logged_by}</div>
      )}
      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
        <button
          className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg"
          onClick={() => { if (confirm('Delete this note?')) { removeNote(note.id); onClose(); } }}
        >
          Delete
        </button>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn onClick={() => onEdit(note)}>Edit</Btn>
        </div>
      </div>
    </Modal>
  );
}
