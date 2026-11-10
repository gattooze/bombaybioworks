import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';

function AttachmentChip({ att, onRemove }) {
  const { store } = useApp();
  const [url, setUrl] = useState(att.url || null);
  useEffect(() => {
    let live = true;
    if (!url) store.fileURL(att).then(u => live && setUrl(u));
    return () => { live = false; };
  }, []);
  const k = att.type || '';
  const isImg = k.startsWith('image/');
  const isAudio = k.startsWith('audio/');
  const isVideo = k.startsWith('video/');
  return (
    <div className="relative group rounded-lg border border-slate-200 bg-white overflow-hidden" style={{ maxWidth: 210 }}>
      {onRemove && (
        <button onClick={onRemove} className="absolute top-1 right-1 z-10 bg-white/90 rounded-full w-5 h-5 text-xs text-red-600 hidden group-hover:block">×</button>
      )}
      {isImg && url && <a href={url} target="_blank" rel="noreferrer"><img src={url} className="h-24 w-full object-cover" alt={att.name} /></a>}
      {isAudio && url && <audio controls src={url} className="w-52 h-9 m-1" />}
      {isVideo && url && <video controls src={url} className="h-24" />}
      {!isImg && !isAudio && !isVideo && (
        <a href={url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-3 text-xs">
          <span className="text-lg">📄</span><span className="truncate">{att.name}</span>
        </a>
      )}
      <div className="px-2 py-1 text-[10px] text-slate-400 truncate border-t border-slate-100">{att.name}</div>
    </div>
  );
}

export { AttachmentChip };

export default function AttachmentUploader({ attachments = [], onChange, folder }) {
  const { store } = useApp();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const handle = async (files) => {
    setBusy(true);
    try {
      const out = [];
      for (const f of files) out.push(await store.uploadFile(f, { folder }));
      onChange([...attachments, ...out]);
    } catch (e) {
      alert('Upload failed: ' + e.message);
    }
    setBusy(false);
  };
  return (
    <div>
      <div
        onClick={() => fileRef.current.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handle([...e.dataTransfer.files]); }}
        className="cursor-pointer rounded-lg border-2 border-dashed border-forest-300 bg-forest-50/50 px-4 py-4 text-center text-sm text-forest-700 hover:bg-forest-50"
      >
        {busy ? 'Uploading…' : '📎 Drop or click to add images, voice recordings, video or files'}
        <input ref={fileRef} type="file" multiple hidden accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt" onChange={e => handle([...e.target.files])} />
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map((a, i) => (
            <AttachmentChip key={a.id || i} att={a} onRemove={() => onChange(attachments.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
    </div>
  );
}
