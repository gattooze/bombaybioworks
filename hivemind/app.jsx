/** @jsxRuntime classic */
const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } = React;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const nowISO = () => new Date().toISOString();
const todayLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const todayStr = () => new Date().toISOString().slice(0, 10);
const cx = (...a) => a.filter(Boolean).join(' ');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' }) : '';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString(undefined, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' }) : '';
const dayKey = (d) => d ? new Date(d).toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '';
const initials = (name='') => name.trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?';
const avatarColor = (s='') => { let h=0; for (const c of s) h=(h*31+c.charCodeAt(0))%360; return `hsl(${h} 60% 45%)`; };
const isOverdue = (d) => d && d < todayStr();
const isDueToday = (d) => d && d === todayStr();

/* ── Interaction types ── */
const TYPES = [
  { id:'in_person', label:'In person',         icon:'🤝', color:'#16a34a' },
  { id:'phone',     label:'Phone call',         icon:'📞', color:'#0ea5e9' },
  { id:'video',     label:'Video call',         icon:'🎥', color:'#8b5cf6' },
  { id:'email',     label:'Email',              icon:'✉️', color:'#f59e0b' },
  { id:'message',   label:'Message / Chat',     icon:'💬', color:'#14b8a6' },
  { id:'event',     label:'Event / Conference', icon:'🎪', color:'#ec4899' },
  { id:'note',      label:'Note',               icon:'📝', color:'#64748b' },
  { id:'other',     label:'Other',              icon:'•',  color:'#94a3b8' },
];
const typeOf = (id) => TYPES.find(t=>t.id===id) || TYPES[TYPES.length-1];

/* ── Task priorities & statuses ── */
const PRIORITIES = [
  { id:'high',   label:'High',   color:'#ef4444', bg:'#fef2f2', icon:'🔴' },
  { id:'medium', label:'Medium', color:'#f59e0b', bg:'#fffbeb', icon:'🟡' },
  { id:'low',    label:'Low',    color:'#3b82f6', bg:'#eff6ff', icon:'🔵' },
];
const STATUSES = [
  { id:'todo',        label:'To Do',       color:'#64748b', bg:'#f8fafc' },
  { id:'in_progress', label:'In Progress', color:'#f59e0b', bg:'#fffbeb' },
  { id:'done',        label:'Done',        color:'#22c55e', bg:'#f0fdf4' },
];
const prioOf = (id) => PRIORITIES.find(p=>p.id===id) || PRIORITIES[1];
const statOf = (id) => STATUSES.find(s=>s.id===id) || STATUSES[0];

/* ── Auto-summary ── */
function stripHtml(html='') { const d=document.createElement('div'); d.innerHTML=html||''; return (d.textContent||'').replace(/\s+/g,' ').trim(); }
const STOP = new Set('the a an and or but of to in on for with at by from is are was were be been being this that these those it its as we our us you your they their he she his her i me my will would can could should have has had do does did not no so if then than also about into over under after before more most very just'.split(' '));
function autoSummary(html, maxSentences=2) {
  const text = stripHtml(html);
  if (!text) return '';
  const sentences = (text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [text]).map(s=>s.trim()).filter(Boolean);
  if (sentences.length <= maxSentences) return text.length>240 ? text.slice(0,237)+'…' : text;
  const freq = {};
  (text.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g) || []).forEach(w => { if(!STOP.has(w)) freq[w]=(freq[w]||0)+1; });
  const scored = sentences.map((s,i) => {
    const words = s.toLowerCase().match(/\b[a-z][a-z'-]{2,}\b/g) || [];
    const score = words.reduce((a,w)=>a+(freq[w]||0),0) / (words.length||1) * (i===0?1.15:1);
    return { s, score, i };
  });
  const top = scored.sort((a,b)=>b.score-a.score).slice(0,maxSentences).sort((a,b)=>a.i-b.i);
  let out = top.map(t=>t.s).join(' ');
  if (out.length>260) out = out.slice(0,257)+'…';
  return out;
}

/* ── IndexedDB — version 2 adds 'tasks' store without touching existing data ── */
const STORES = ['people', 'notes', 'files', 'tasks'];
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hivemind', 2);
    req.onupgradeneeded = () => { const db=req.result; STORES.forEach(s=>{ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'}); }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const idbAll = async (s) => { const db=await openDB(); return new Promise((res,rej)=>{const r=db.transaction(s).objectStore(s).getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error);}); };
const idbGet = async (s,id) => { const db=await openDB(); return new Promise((res,rej)=>{const r=db.transaction(s).objectStore(s).get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);}); };
const idbPut = async (s,v) => { const db=await openDB(); return new Promise((res,rej)=>{const tx=db.transaction(s,'readwrite'); tx.objectStore(s).put(v); tx.oncomplete=()=>res(v); tx.onerror=()=>rej(tx.error);}); };
const idbDel = async (s,id) => { const db=await openDB(); return new Promise((res,rej)=>{const tx=db.transaction(s,'readwrite'); tx.objectStore(s).delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);}); };

const LocalAdapter = {
  mode: 'local',
  async list(t) { const r = await idbAll(t); return r.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')); },
  async put(t, rec) { return idbPut(t, rec); },
  async remove(t, id) { return idbDel(t, id); },
  async uploadFile(file, meta) { const id=uid(); await idbPut('files',{id,blob:file,name:file.name,type:file.type,size:file.size,created_at:nowISO(),...meta}); return {id,name:file.name,type:file.type,size:file.size,storage:'local'}; },
  async fileURL(att) { if(att.url) return att.url; const rec=await idbGet('files',att.id); return rec&&rec.blob?URL.createObjectURL(rec.blob):null; },
  async removeFile(id) { return idbDel('files', id); },
};

function makeCloudAdapter(client) {
  return {
    mode: 'cloud', client,
    async list(t) { const { data, error } = await client.from(t).select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[]; },
    async put(t, rec) { const { data, error } = await client.from(t).upsert(rec).select().single(); if(error) throw error; return data; },
    async remove(t, id) { const { error } = await client.from(t).delete().eq('id',id); if(error) throw error; },
    async uploadFile(file, meta) {
      const path = `${(meta&&meta.folder)||'misc'}/${uid()}-${file.name}`;
      const { error } = await client.storage.from('attachments').upload(path, file, { upsert:false });
      if(error) throw error;
      const { data } = client.storage.from('attachments').getPublicUrl(path);
      return { id:path, name:file.name, type:file.type, size:file.size, url:data.publicUrl, storage:'cloud' };
    },
    async fileURL(att) { return att.url || null; },
    async removeFile(path) { await client.storage.from('attachments').remove([path]); },
  };
}

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);
const CFG_KEY = 'hivemind.config';
const loadCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } };
const saveCfg = (c) => localStorage.setItem(CFG_KEY, JSON.stringify(c));
function buildAdapter(cfg) {
  if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase) {
    try { return makeCloudAdapter(window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)); }
    catch (e) { console.error('Supabase init failed', e); }
  }
  return LocalAdapter;
}

/* ══════════════════════════════════════════════════════════════
   REUSABLE UI
══════════════════════════════════════════════════════════════ */
function Avatar({ name, size=36 }) {
  return <div className="shrink-0 rounded-full grid place-items-center text-white font-semibold"
              style={{ width:size, height:size, background:avatarColor(name||'?'), fontSize:size*0.4 }}>{initials(name)}</div>;
}
function Tag({ children, onRemove }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-honey-100 text-honey-800 text-xs font-medium">
    {children}{onRemove && <button type="button" onClick={onRemove} className="hover:text-red-600">×</button>}</span>;
}
function TypeBadge({ id, small }) {
  const t = typeOf(id);
  return <span className={cx('inline-flex items-center gap-1 rounded-full font-medium', small?'text-[11px] px-1.5 py-0.5':'text-xs px-2 py-0.5')}
               style={{ background:t.color+'1a', color:t.color }}>{t.icon} {t.label}</span>;
}
function Field({ label, children, hint, right }) {
  return <label className="block">
    <span className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1"><span>{label}</span>{right}</span>
    {children}{hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}</label>;
}
const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400 bg-white";
function Btn({ children, onClick, variant='primary', size='md', type='button', className }) {
  const v = { primary:'bg-honey-500 hover:bg-honey-600 text-white shadow-sm', ghost:'bg-white hover:bg-honey-50 text-slate-700 border border-slate-200',
              danger:'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200', dark:'bg-slate-800 hover:bg-slate-900 text-white' }[variant];
  const s = { sm:'px-2.5 py-1 text-xs', md:'px-3.5 py-2 text-sm', lg:'px-5 py-2.5' }[size];
  return <button type={type} onClick={onClick} className={cx('rounded-lg font-semibold transition inline-flex items-center gap-1.5', v, s, className)}>{children}</button>;
}
function TagInput({ value=[], onChange, placeholder='Add tag + Enter' }) {
  const [t, setT] = useState('');
  const add = () => { const v=t.trim(); if(v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return <div className="flex flex-wrap gap-1.5 items-center rounded-lg border border-slate-300 px-2 py-1.5 bg-white">
    {value.map(tg=><Tag key={tg} onRemove={()=>onChange(value.filter(x=>x!==tg))}>{tg}</Tag>)}
    <input value={t} onChange={e=>setT(e.target.value)} placeholder={placeholder}
           onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();add();} if(e.key==='Backspace'&&!t&&value.length){onChange(value.slice(0,-1));} }}
           className="flex-1 min-w-[120px] text-sm outline-none py-0.5" /></div>;
}
function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => { if(!open) return; const h=e=>e.key==='Escape'&&onClose(); window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h); }, [open,onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
    <div className={cx('bg-white rounded-2xl shadow-2xl w-full my-4', wide?'max-w-3xl':'max-w-xl')} onClick={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-20">
        <h3 className="font-bold text-lg text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
      </div>
      <div className="p-5">{children}</div>
    </div></div>;
}
function Empty({ icon, title, sub, action }) {
  return <div className="text-center py-16 px-4"><div className="text-5xl mb-3">{icon}</div>
    <h3 className="font-semibold text-slate-700">{title}</h3>
    {sub && <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">{sub}</p>}
    {action && <div className="mt-4">{action}</div>}</div>;
}

/* ── Quill rich-text editor ── */
function RichEditor({ value, onChange, placeholder }) {
  const elRef = useRef(); const qRef = useRef(); const cbRef = useRef(onChange); cbRef.current = onChange;
  useEffect(() => {
    const q = new Quill(elRef.current, {
      theme: 'snow', placeholder: placeholder||'Start typing your notes…',
      modules: { toolbar: [
        [{ header:[1,2,3,false] }], [{ size:['small', false, 'large', 'huge'] }],
        ['bold','italic','underline','strike'],
        [{ color:[] }, { background:[] }],
        [{ list:'ordered' }, { list:'bullet' }, { list:'check' }],
        [{ indent:'-1' }, { indent:'+1' }], [{ align:[] }],
        ['blockquote','code-block'], ['link'], ['clean'],
      ] },
    });
    qRef.current = q;
    if (value) q.clipboard.dangerouslyPasteHTML(value);
    q.on('text-change', () => { const html = q.root.innerHTML; cbRef.current(html === '<p><br></p>' ? '' : html); });
    return () => { qRef.current = null; };
  }, []);
  return <div className="bg-white rounded-lg"><div ref={elRef} /></div>;
}
function NoteContent({ html }) {
  if (!html) return null;
  return <div className="note-render ql-snow"><div className="ql-editor" dangerouslySetInnerHTML={{ __html: html }} /></div>;
}

/* ── Attachments ── */
function AttachmentUploader({ attachments=[], onChange, folder }) {
  const { store } = useApp();
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  const handle = async (files) => {
    setBusy(true);
    try { const out=[]; for (const f of files) out.push(await store.uploadFile(f,{folder})); onChange([...attachments, ...out]); }
    catch (e) { alert('Upload failed: '+e.message); }
    setBusy(false);
  };
  return <div>
    <div onClick={()=>ref.current.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handle([...e.dataTransfer.files]);}}
         className="cursor-pointer rounded-lg border-2 border-dashed border-honey-300 bg-honey-50/50 px-4 py-4 text-center text-sm text-honey-700 hover:bg-honey-50">
      {busy ? 'Uploading…' : '📎 Drop or click to add images, voice recordings, video or files'}
      <input ref={ref} type="file" multiple hidden accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt" onChange={e=>handle([...e.target.files])} />
    </div>
    {attachments.length>0 && <div className="flex flex-wrap gap-2 mt-2">{attachments.map((a,i)=><AttachmentChip key={a.id||i} att={a} onRemove={()=>onChange(attachments.filter((_,j)=>j!==i))} />)}</div>}
  </div>;
}
function AttachmentChip({ att, onRemove }) {
  const { store } = useApp();
  const [url, setUrl] = useState(att.url || null);
  useEffect(() => { let live=true; if(!url) store.fileURL(att).then(u=>live&&setUrl(u)); return ()=>{live=false;}; }, []);
  const k = (att.type||''); const isImg=k.startsWith('image/'), isAudio=k.startsWith('audio/'), isVideo=k.startsWith('video/');
  return <div className="relative group rounded-lg border border-slate-200 bg-white overflow-hidden" style={{maxWidth:210}}>
    {onRemove && <button onClick={onRemove} className="absolute top-1 right-1 z-10 bg-white/90 rounded-full w-5 h-5 text-xs text-red-600 hidden group-hover:block">×</button>}
    {isImg && url && <a href={url} target="_blank"><img src={url} className="h-24 w-full object-cover" /></a>}
    {isAudio && url && <audio controls src={url} className="w-52 h-9 m-1" />}
    {isVideo && url && <video controls src={url} className="h-24" />}
    {!isImg && !isAudio && !isVideo && <a href={url||'#'} target="_blank" className="flex items-center gap-2 px-3 py-3 text-xs"><span className="text-lg">📄</span><span className="truncate">{att.name}</span></a>}
    <div className="px-2 py-1 text-[10px] text-slate-400 truncate border-t border-slate-100">{att.name}</div>
  </div>;
}

/* ── People picker (multi, for notes) ── */
function PeoplePicker({ value=[], external=[], onChange, onExternalChange }) {
  const { data, savePerson } = useApp();
  const [q, setQ] = useState('');
  const matches = data.people.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())).slice(0,6);
  const exact = data.people.find(p=>p.name.toLowerCase()===q.trim().toLowerCase());
  const addNew = async () => { const name=q.trim(); if(!name) return; const p={id:uid(),name,org:'',role:'',email:'',phone:'',tags:[],notes:'',created_at:nowISO()}; await savePerson(p); onChange([...value,p.id]); setQ(''); };
  return <div>
    <div className="flex flex-wrap gap-1.5 mb-2">
      {value.map(id=>{ const p=data.people.find(x=>x.id===id); return p?<Tag key={id} onRemove={()=>onChange(value.filter(v=>v!==id))}>{p.name}</Tag>:null; })}
      {external.map((n,i)=><span key={'e'+i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{n}<button type="button" onClick={()=>onExternalChange(external.filter((_,j)=>j!==i))}>×</button></span>)}
    </div>
    <input className={inputCls} placeholder="Type a name to add a participant…" value={q} onChange={e=>setQ(e.target.value)}
           onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); const m=matches.find(p=>!value.includes(p.id)); if(m){onChange([...value,m.id]);setQ('');} else if(q.trim()){addNew();} } }} />
    {q && <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
      {matches.filter(p=>!value.includes(p.id)).map(p=><button type="button" key={p.id} onClick={()=>{onChange([...value,p.id]);setQ('');}} className="w-full text-left px-3 py-2 text-sm hover:bg-honey-50 flex items-center gap-2"><Avatar name={p.name} size={24} />{p.name}<span className="text-slate-400 text-xs">{p.org}</span></button>)}
      {!exact && q.trim() && <button type="button" onClick={addNew} className="w-full text-left px-3 py-2 text-sm hover:bg-honey-50 text-honey-700 font-medium">＋ Create contact "{q.trim()}"</button>}
    </div>}
  </div>;
}

/* ── Person select (single, for task assignment) ── */
function PersonSelect({ value, onChange }) {
  const { data } = useApp();
  return <select className={inputCls} value={value||''} onChange={e=>onChange(e.target.value||null)}>
    <option value="">Unassigned</option>
    {data.people.map(p=><option key={p.id} value={p.id}>{p.name}{p.org?' · '+p.org:''}</option>)}
  </select>;
}

/* ══════════════════════════════════════════════════════════════
   TASK FORM
══════════════════════════════════════════════════════════════ */
function TaskForm({ task, defaults={}, onSave, onClose }) {
  const { me, data } = useApp();
  const [f, setF] = useState(task || {
    title:'', description:'',
    assigned_to: defaults.assigned_to||null, assigned_to_name:'',
    due_date:'', priority:'medium', status: defaults.status||'todo',
    linked_note_id: defaults.linked_note_id||null, linked_note_title: defaults.linked_note_title||null,
    tags:[], created_by:me,
  });
  const set = (k,v) => setF(s=>({...s,[k]:v}));
  const submit = e => {
    e.preventDefault();
    if (!f.title.trim()) { alert('Task needs a title.'); return; }
    const assignee = f.assigned_to ? data.people.find(p=>p.id===f.assigned_to) : null;
    onSave({ ...f, assigned_to_name: assignee ? assignee.name : (f.assigned_to_name||'') });
    onClose();
  };
  return <form onSubmit={submit} className="space-y-3">
    <Field label="Task *">
      <input className={inputCls} value={f.title} onChange={e=>set('title',e.target.value)} placeholder="What needs to get done?" autoFocus />
    </Field>
    <Field label="Description">
      <textarea rows={2} className={inputCls} value={f.description} onChange={e=>set('description',e.target.value)} placeholder="Any extra context…" />
    </Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Assigned to"><PersonSelect value={f.assigned_to} onChange={v=>set('assigned_to',v)} /></Field>
      <Field label="Due date"><input type="date" className={inputCls} value={f.due_date} onChange={e=>set('due_date',e.target.value)} /></Field>
    </div>
    <Field label="Priority">
      <div className="flex gap-1.5">
        {PRIORITIES.map(p=><button type="button" key={p.id} onClick={()=>set('priority',p.id)}
          className={cx('flex-1 py-1.5 rounded-lg text-xs font-medium border transition', f.priority===p.id?'text-white':'bg-white text-slate-600 border-slate-200')}
          style={f.priority===p.id?{background:p.color,borderColor:p.color}:{}}>{p.icon} {p.label}</button>)}
      </div>
    </Field>
    <Field label="Status">
      <div className="flex gap-1.5">
        {STATUSES.map(s=><button type="button" key={s.id} onClick={()=>set('status',s.id)}
          className={cx('flex-1 py-1.5 rounded-lg text-xs font-medium border transition', f.status===s.id?'text-white':'bg-white text-slate-600 border-slate-200')}
          style={f.status===s.id?{background:s.color,borderColor:s.color}:{}}>{s.label}</button>)}
      </div>
    </Field>
    {f.linked_note_title && <div className="text-xs text-slate-500 bg-honey-50 rounded-lg px-3 py-2">📝 From note: <span className="font-medium">{f.linked_note_title}</span></div>}
    <Field label="Tags"><TagInput value={f.tags||[]} onChange={v=>set('tags',v)} /></Field>
    <div className="flex justify-end gap-2 pt-1"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit">Save task</Btn></div>
  </form>;
}

/* ── Task card (list + kanban) ── */
function TaskCard({ t, onOpen, onStatusChange }) {
  const { data } = useApp();
  const assignee = t.assigned_to ? data.people.find(p=>p.id===t.assigned_to) : null;
  const name = assignee?.name || t.assigned_to_name || '';
  const prio = prioOf(t.priority);
  const overdue = isOverdue(t.due_date) && t.status !== 'done';
  const today = isDueToday(t.due_date);
  const nextStatus = { todo:'in_progress', in_progress:'done', done:'todo' };
  return <div className={cx('bg-white rounded-xl border p-3 hover:shadow-sm transition cursor-pointer', overdue?'border-red-200':'border-slate-200')} onClick={()=>onOpen(t)}>
    <div className="flex items-start gap-2">
      <button type="button" onClick={e=>{e.stopPropagation();onStatusChange(t,nextStatus[t.status]);}}
        className="mt-0.5 shrink-0 w-4 h-4 rounded border-2 transition flex items-center justify-center"
        style={t.status==='done'?{background:'#22c55e',borderColor:'#22c55e'}:t.status==='in_progress'?{borderColor:'#f59e0b'}:{borderColor:'#cbd5e1'}}
        title="Click to advance status">
        {t.status==='done' && <span className="text-white text-[9px] font-bold">✓</span>}
        {t.status==='in_progress' && <span style={{color:'#f59e0b',fontSize:8}}>●</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium leading-snug', t.status==='done'?'line-through text-slate-400':'text-slate-800')}>{t.title}</p>
        {t.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>}
      </div>
      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{background:prio.bg,color:prio.color}}>{prio.icon}</span>
    </div>
    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50">
      <div className="flex items-center gap-1.5">
        {name ? <><Avatar name={name} size={18} /><span className="text-[11px] text-slate-500">{name}</span></> : <span className="text-[11px] text-slate-300">Unassigned</span>}
      </div>
      {t.due_date && <span className={cx('text-[11px] font-medium', overdue?'text-red-600':today?'text-honey-600':'text-slate-400')}>
        {overdue?'⚠ ':today?'Today · ':''}{!overdue&&!today?fmtDate(t.due_date):today?fmtTime(new Date()):fmtDate(t.due_date)}
      </span>}
    </div>
    {t.linked_note_title && <div className="text-[10px] text-slate-400 mt-1 truncate">📝 {t.linked_note_title}</div>}
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   TASKS VIEW
══════════════════════════════════════════════════════════════ */
function TasksView() {
  const { data, me, saveTask, removeTask, openNewTask } = useApp();
  const [view, setView] = useState('list');
  const [q, setQ] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPrio, setFilterPrio] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editTask, setEditTask] = useState(null);

  const myPersonId = useMemo(() => data.people.find(p=>p.name.toLowerCase()===me.toLowerCase())?.id||null, [data.people, me]);

  const filtered = useMemo(() => {
    return (data.tasks||[]).filter(t => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPrio && t.priority !== filterPrio) return false;
      if (filterAssignee === '__me__') {
        const matchId = myPersonId && t.assigned_to === myPersonId;
        const matchName = (t.assigned_to_name||'').toLowerCase() === me.toLowerCase();
        if (!matchId && !matchName) return false;
      } else if (filterAssignee) {
        if (t.assigned_to !== filterAssignee) return false;
      }
      if (q) {
        const hay = (t.title+' '+(t.description||'')+' '+(t.assigned_to_name||'')+' '+(t.tags||[]).join(' ')).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    }).sort((a,b) => {
      const aO=isOverdue(a.due_date)&&a.status!=='done', bO=isOverdue(b.due_date)&&b.status!=='done';
      if (aO!==bO) return aO?-1:1;
      if (a.due_date&&b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1; if (b.due_date) return 1;
      return (b.created_at||'').localeCompare(a.created_at||'');
    });
  }, [data.tasks, q, filterAssignee, filterPrio, filterStatus, me, myPersonId]);

  const handleStatusChange = async (task, newStatus) => { await saveTask({...task, status:newStatus}); };
  const overdueCount = (data.tasks||[]).filter(t=>isOverdue(t.due_date)&&t.status!=='done').length;
  const openCount = (data.tasks||[]).filter(t=>t.status!=='done').length;

  return <div>
    <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          Tasks <span className="text-slate-400 font-normal">· {openCount} open</span>
          {overdueCount > 0 && <span className="ml-2 text-sm font-semibold text-red-600">⚠ {overdueCount} overdue</span>}
        </h2>
        <p className="text-sm text-slate-500">Who's doing what, and by when.</p>
      </div>
      <div className="flex gap-2">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={()=>setView('list')} className={cx('px-3 py-1.5 text-xs font-medium', view==='list'?'bg-honey-500 text-white':'bg-white text-slate-600 hover:bg-slate-50')}>☰ List</button>
          <button onClick={()=>setView('board')} className={cx('px-3 py-1.5 text-xs font-medium', view==='board'?'bg-honey-500 text-white':'bg-white text-slate-600 hover:bg-slate-50')}>⊞ Board</button>
        </div>
        <Btn onClick={()=>openNewTask()}>＋ New task</Btn>
      </div>
    </div>

    <div className="flex flex-wrap gap-2 mb-4">
      <input className={cx(inputCls,'max-w-xs')} placeholder="Search tasks…" value={q} onChange={e=>setQ(e.target.value)} />
      <select className={cx(inputCls,'max-w-[160px]')} value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}>
        <option value="">All assignees</option>
        {data.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select className={cx(inputCls,'max-w-[140px]')} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select className={cx(inputCls,'max-w-[140px]')} value={filterPrio} onChange={e=>setFilterPrio(e.target.value)}>
        <option value="">All priorities</option>
        {PRIORITIES.map(p=><option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
      </select>
      <Btn variant="ghost" size="sm" onClick={()=>setFilterAssignee('__me__')}>🙋 My tasks</Btn>
      {(filterAssignee||filterStatus||filterPrio||q) && <Btn variant="ghost" size="sm" onClick={()=>{setFilterAssignee('');setFilterStatus('');setFilterPrio('');setQ('');}}>✕ Clear</Btn>}
    </div>

    {view==='list' && (
      filtered.length===0
        ? <Empty icon="✅" title="No tasks here" sub="Create a task, or try adjusting the filters." action={<Btn onClick={()=>openNewTask()}>＋ New task</Btn>} />
        : <div className="space-y-2">{filtered.map(t=><TaskCard key={t.id} t={t} onOpen={setEditTask} onStatusChange={handleStatusChange} />)}</div>
    )}

    {view==='board' && (
      <div className="grid grid-cols-3 gap-4">
        {STATUSES.map(s => {
          const col = filtered.filter(t=>t.status===s.id);
          return <div key={s.id} className="rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between" style={{background:s.bg}}>
              <span className="text-sm font-bold" style={{color:s.color}}>{s.label}</span>
              <span className="text-xs font-medium bg-white/60 px-2 py-0.5 rounded-full" style={{color:s.color}}>{col.length}</span>
            </div>
            <div className="p-2 space-y-2 flex-1 min-h-[180px] bg-slate-50/50">
              {col.map(t=><TaskCard key={t.id} t={t} onOpen={setEditTask} onStatusChange={handleStatusChange} />)}
              {col.length===0 && <div className="text-xs text-slate-300 text-center py-10">Nothing here</div>}
            </div>
            <div className="p-2 border-t border-slate-100">
              <button onClick={()=>openNewTask({status:s.id})} className="w-full text-xs text-slate-400 hover:text-honey-600 py-1.5 hover:bg-white rounded-lg transition">＋ Add task</button>
            </div>
          </div>;
        })}
      </div>
    )}

    {editTask && <Modal open onClose={()=>setEditTask(null)} title="Edit task">
      <div className="flex justify-end mb-3">
        <Btn variant="danger" size="sm" onClick={()=>{if(confirm('Delete this task?')){removeTask(editTask.id);setEditTask(null);}}}>Delete task</Btn>
      </div>
      <TaskForm task={editTask} onSave={async(t)=>{await saveTask(t);setEditTask(null);}} onClose={()=>setEditTask(null)} />
    </Modal>}
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   NOTE FORM
══════════════════════════════════════════════════════════════ */
function NoteForm({ note, onSave, onClose, defaultType }) {
  const { me } = useApp();
  const [f, setF] = useState(note || {
    title:'', type:defaultType||'in_person', datetime:todayLocal(), context:'', location:'',
    participant_ids:[], external_participants:[], body:'', summary:'', tags:[], attachments:[], logged_by:me, summaryEdited:false,
  });
  const set = (k,v)=>setF(s=>({...s,[k]:v}));
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim() && !stripHtml(f.body)) { alert('Add a title or some notes first.'); return; }
    const summary = (f.summary && f.summaryEdited) ? f.summary : autoSummary(f.body);
    const title = f.title.trim() || (summary ? summary.slice(0,60) : 'Untitled note');
    onSave({ ...f, title, summary }); onClose();
  };
  return <form onSubmit={submit} className="space-y-3">
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2"><Field label="Title"><input className={inputCls} value={f.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Intro call with Acme Labs" autoFocus /></Field></div>
      <Field label="When"><input type="datetime-local" className={inputCls} value={f.datetime} onChange={e=>set('datetime',e.target.value)} /></Field>
    </div>
    <Field label="Type of interaction">
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map(t=><button type="button" key={t.id} onClick={()=>set('type',t.id)}
          className={cx('px-2.5 py-1 rounded-full text-xs font-medium border transition', f.type===t.id?'text-white':'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}
          style={f.type===t.id?{background:t.color,borderColor:t.color}:{}}>{t.icon} {t.label}</button>)}
      </div>
    </Field>
    {f.type!=='note' && <Field label="Participants" hint="Who was part of this conversation"><PeoplePicker value={f.participant_ids} external={f.external_participants} onChange={v=>set('participant_ids',v)} onExternalChange={v=>set('external_participants',v)} /></Field>}
    <div className="grid grid-cols-2 gap-3">
      <Field label="Context / Purpose"><input className={inputCls} value={f.context} onChange={e=>set('context',e.target.value)} placeholder="fundraising, BD, hiring…" /></Field>
      <Field label="Location / Channel"><input className={inputCls} value={f.location} onChange={e=>set('location',e.target.value)} placeholder="Zoom, Mumbai office…" /></Field>
    </div>
    <Field label="Notes"><RichEditor value={f.body} onChange={v=>setF(s=>({...s, body:v, summary:s.summaryEdited?s.summary:autoSummary(v)}))} /></Field>
    <Field label="Summary" right={<button type="button" onClick={()=>setF(s=>({...s,summary:autoSummary(s.body),summaryEdited:false}))} className="text-honey-600 hover:underline font-medium">✨ Auto-summarise</button>}
           hint="Generated automatically — edit freely.">
      <textarea rows={2} className={inputCls} value={f.summary} onChange={e=>setF(s=>({...s,summary:e.target.value,summaryEdited:true}))} placeholder="A one-line summary will appear here as you type…" />
    </Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Tags"><TagInput value={f.tags} onChange={v=>set('tags',v)} /></Field>
      <Field label="Logged by"><input className={inputCls} value={f.logged_by} onChange={e=>set('logged_by',e.target.value)} /></Field>
    </div>
    <Field label="Attachments"><AttachmentUploader folder="notes" attachments={f.attachments} onChange={v=>set('attachments',v)} /></Field>
    <div className="flex justify-end gap-2 pt-1"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit">Save note</Btn></div>
  </form>;
}

/* ── Note card ── */
function NoteCard({ n, onOpen }) {
  const { data } = useApp();
  const people = (n.participant_ids||[]).map(id=>data.people.find(p=>p.id===id)).filter(Boolean);
  return <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition cursor-pointer" onClick={()=>onOpen(n.id)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-slate-800">{n.title}</h3><TypeBadge id={n.type} small /></div>
        {n.summary && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{n.summary}</p>}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-medium text-slate-600">{fmtDate(n.datetime)}</div>
        {n.logged_by && <div className="text-[11px] text-slate-400">by {n.logged_by}</div>}
      </div>
    </div>
    <div className="flex items-center justify-between mt-3">
      <div className="flex -space-x-2 items-center">
        {people.slice(0,5).map(p=><div key={p.id} title={p.name}><Avatar name={p.name} size={26} /></div>)}
        {(n.external_participants||[]).slice(0,3).map((x,i)=><div key={'e'+i} title={x}><Avatar name={x} size={26} /></div>)}
        {n.context && <span className="ml-3 text-[11px] px-1.5 py-0.5 rounded bg-honey-100 text-honey-700">{n.context}</span>}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {(n.attachments||[]).length>0 && <span>📎 {n.attachments.length}</span>}
        {(n.tags||[]).slice(0,2).map(t=><Tag key={t}>{t}</Tag>)}
      </div>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   NOTES VIEW
══════════════════════════════════════════════════════════════ */
function NotesView({ onOpen, openNew }) {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const filtered = data.notes.filter(n => {
    if (type && n.type!==type) return false;
    const names = (n.participant_ids||[]).map(id=>(data.people.find(p=>p.id===id)||{}).name||'').join(' ');
    const hay = (n.title+' '+n.summary+' '+stripHtml(n.body)+' '+n.context+' '+names+' '+(n.tags||[]).join(' ')+' '+(n.external_participants||[]).join(' ')).toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  return <div>
    <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
      <div><h2 className="text-xl font-bold text-slate-800">Notes <span className="text-slate-400 font-normal">· {data.notes.length}</span></h2>
        <p className="text-sm text-slate-500">Every conversation and thought, in the shared brain.</p></div>
      <Btn onClick={()=>openNew()}>＋ New note</Btn>
    </div>
    <div className="flex flex-wrap gap-2 mb-4">
      <input className={cx(inputCls,'max-w-sm')} placeholder="Search notes, people, context, tags…" value={q} onChange={e=>setQ(e.target.value)} />
      <select className={cx(inputCls,'max-w-[200px]')} value={type} onChange={e=>setType(e.target.value)}>
        <option value="">All types</option>{TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
      </select>
    </div>
    {filtered.length===0 ? <Empty icon="📝" title="No notes yet" sub="Capture your first conversation or thought." action={<Btn onClick={()=>openNew()}>＋ New note</Btn>} />
      : <div className="grid gap-3 lg:grid-cols-2">{filtered.map(n=><NoteCard key={n.id} n={n} onOpen={onOpen} />)}</div>}
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   TIMELINE VIEW
══════════════════════════════════════════════════════════════ */
function TimelineView({ onOpen }) {
  const { data } = useApp();
  const nameOf = id => (data.people.find(p=>p.id===id)||{}).name || '—';
  const withPeople = data.notes.filter(n=>(n.participant_ids||[]).length || (n.external_participants||[]).length);
  const sorted = [...withPeople].sort((a,b)=>(b.datetime||'').localeCompare(a.datetime||''));
  const groups = [];
  sorted.forEach(n => { const k=dayKey(n.datetime); let g=groups.find(x=>x.k===k); if(!g){g={k,items:[]};groups.push(g);} g.items.push(n); });
  return <div>
    <div className="mb-4"><h2 className="text-xl font-bold text-slate-800">Timeline</h2>
      <p className="text-sm text-slate-500">Who spoke to whom, when, and in what form — the relationship history of the hive.</p></div>
    {sorted.length===0 ? <Empty icon="🕸️" title="No interactions yet" sub="Log a note with participants and it shows up here." />
      : groups.map(g => <div key={g.k} className="mb-5">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{g.k}</div>
        <div className="relative pl-6">
          <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-honey-200" />
          {g.items.map(n => { const who=[...(n.participant_ids||[]).map(nameOf), ...(n.external_participants||[])]; const t=typeOf(n.type);
            return <div key={n.id} className="relative mb-3">
              <div className="absolute -left-[18px] top-2 w-3 h-3 rounded-full ring-2 ring-white" style={{background:t.color}} />
              <div className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-sm cursor-pointer" onClick={()=>onOpen(n.id)}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm"><span className="font-semibold text-slate-700">{n.logged_by||'Someone'}</span>
                    <span className="text-slate-400"> · {t.label.toLowerCase()} with </span>
                    <span className="font-semibold text-slate-700">{who.join(', ')||'—'}</span>
                    {n.context && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-honey-100 text-honey-700">{n.context}</span>}</div>
                  <span className="text-xs text-slate-400">{fmtTime(n.datetime)}</span>
                </div>
                {(n.summary||n.title) && <p className="text-sm text-slate-500 mt-1">{n.summary||n.title}</p>}
              </div>
            </div>; })}
        </div>
      </div>)}
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   PEOPLE
══════════════════════════════════════════════════════════════ */
function PersonForm({ person, onSave, onClose }) {
  const [f, setF] = useState(person || { name:'', org:'', role:'', email:'', phone:'', tags:[], notes:'' });
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  return <form onSubmit={e=>{e.preventDefault(); if(!f.name.trim())return; onSave(f); onClose();}} className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <Field label="Name *"><input className={inputCls} value={f.name} onChange={e=>set('name',e.target.value)} autoFocus required /></Field>
      <Field label="Organisation"><input className={inputCls} value={f.org} onChange={e=>set('org',e.target.value)} /></Field>
      <Field label="Role / Title"><input className={inputCls} value={f.role} onChange={e=>set('role',e.target.value)} /></Field>
      <Field label="Email"><input className={inputCls} value={f.email} onChange={e=>set('email',e.target.value)} /></Field>
      <Field label="Phone"><input className={inputCls} value={f.phone} onChange={e=>set('phone',e.target.value)} /></Field>
      <Field label="Tags" hint="investor, supplier, scientist…"><TagInput value={f.tags} onChange={v=>set('tags',v)} /></Field>
    </div>
    <Field label="Background notes"><textarea rows={3} className={inputCls} value={f.notes} onChange={e=>set('notes',e.target.value)} /></Field>
    <div className="flex justify-end gap-2 pt-1"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit">Save contact</Btn></div>
  </form>;
}

function PeopleView({ onOpenPerson }) {
  const { data, savePerson, removePerson } = useApp();
  const [q, setQ] = useState(''); const [tag, setTag] = useState(''); const [editing, setEditing] = useState(null);
  const allTags = useMemo(()=>[...new Set(data.people.flatMap(p=>p.tags||[]))].sort(), [data.people]);
  const filtered = data.people.filter(p=>{ const hay=(p.name+' '+p.org+' '+p.role+' '+(p.tags||[]).join(' ')+' '+p.notes).toLowerCase(); return hay.includes(q.toLowerCase()) && (!tag||(p.tags||[]).includes(tag)); });
  const noteCount = pid => data.notes.filter(n=>(n.participant_ids||[]).includes(pid)).length;
  const taskCount = pid => (data.tasks||[]).filter(t=>t.assigned_to===pid&&t.status!=='done').length;
  return <div>
    <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
      <div><h2 className="text-xl font-bold text-slate-800">People <span className="text-slate-400 font-normal">· {data.people.length}</span></h2>
        <p className="text-sm text-slate-500">Everyone the hive is talking to.</p></div>
      <Btn onClick={()=>setEditing({})}>＋ Add contact</Btn>
    </div>
    <div className="flex flex-wrap gap-2 mb-4">
      <input className={cx(inputCls,'max-w-xs')} placeholder="Search people…" value={q} onChange={e=>setQ(e.target.value)} />
      <select className={cx(inputCls,'max-w-[180px]')} value={tag} onChange={e=>setTag(e.target.value)}><option value="">All tags</option>{allTags.map(t=><option key={t}>{t}</option>)}</select>
    </div>
    {filtered.length===0 ? <Empty icon="🙋" title="No contacts yet" sub="Add the people you're meeting so the hive can connect the dots." action={<Btn onClick={()=>setEditing({})}>＋ Add the first contact</Btn>} />
      : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(p=>(
        <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition cursor-pointer group" onClick={()=>onOpenPerson(p.id)}>
          <div className="flex items-start gap-3"><Avatar name={p.name} size={44} />
            <div className="min-w-0 flex-1"><div className="font-semibold text-slate-800 truncate">{p.name}</div>
              <div className="text-xs text-slate-500 truncate">{[p.role,p.org].filter(Boolean).join(' · ')||'—'}</div>
              <div className="flex flex-wrap gap-1 mt-2">{(p.tags||[]).slice(0,3).map(t=><Tag key={t}>{t}</Tag>)}</div></div></div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 text-xs text-slate-400">
            <span className="flex gap-3">
              <span>{noteCount(p.id)} note{noteCount(p.id)!==1?'s':''}</span>
              {taskCount(p.id)>0 && <span className="text-honey-600 font-medium">✅ {taskCount(p.id)} open</span>}
            </span>
            <div className="opacity-0 group-hover:opacity-100 flex gap-2" onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setEditing(p)} className="hover:text-honey-600">Edit</button>
              <button onClick={()=>{ if(confirm('Delete '+p.name+'?')) removePerson(p.id); }} className="hover:text-red-600">Delete</button></div></div>
        </div>))}</div>}
    <Modal open={!!editing} onClose={()=>setEditing(null)} title={editing&&editing.id?'Edit contact':'New contact'}>
      {editing && <PersonForm person={editing.id?editing:null} onSave={savePerson} onClose={()=>setEditing(null)} />}</Modal>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   DETAIL VIEWS
══════════════════════════════════════════════════════════════ */
function PersonDetail({ id, onClose, onOpenNote }) {
  const { data, saveTask, openNewTask } = useApp();
  const p = data.people.find(x=>x.id===id); if(!p) return null;
  const notes = data.notes.filter(n=>(n.participant_ids||[]).includes(id)).sort((a,b)=>(b.datetime||'').localeCompare(a.datetime||''));
  const tasks = (data.tasks||[]).filter(t=>t.assigned_to===id).sort((a,b)=>(a.due_date||'').localeCompare(b.due_date||''));
  const openTasks = tasks.filter(t=>t.status!=='done');
  return <Modal open onClose={onClose} title="Contact" wide>
    <div className="flex items-start gap-4"><Avatar name={p.name} size={56} />
      <div className="flex-1"><h3 className="text-xl font-bold text-slate-800">{p.name}</h3>
        <p className="text-slate-500">{[p.role,p.org].filter(Boolean).join(' · ')}</p>
        <div className="flex flex-wrap gap-3 mt-2 text-sm">{p.email && <a href={'mailto:'+p.email} className="text-honey-600 hover:underline">✉ {p.email}</a>}{p.phone && <a href={'tel:'+p.phone} className="text-honey-600 hover:underline">☎ {p.phone}</a>}</div>
        <div className="flex flex-wrap gap-1 mt-2">{(p.tags||[]).map(t=><Tag key={t}>{t}</Tag>)}</div></div></div>
    {p.notes && <div className="mt-4 bg-honey-50 rounded-lg p-3 text-sm text-slate-600 whitespace-pre-wrap">{p.notes}</div>}

    <div className="flex items-center justify-between mt-5 mb-2">
      <h4 className="font-bold text-slate-700">Tasks · {openTasks.length} open</h4>
      <Btn size="sm" variant="ghost" onClick={()=>{ onClose(); openNewTask({assigned_to:p.id}); }}>＋ Assign task</Btn>
    </div>
    <div className="space-y-2">
      {tasks.length===0 && <p className="text-sm text-slate-400">No tasks assigned to {p.name} yet.</p>}
      {tasks.map(t=><TaskCard key={t.id} t={t} onOpen={()=>{}} onStatusChange={async(task,s)=>saveTask({...task,status:s})} />)}
    </div>

    <h4 className="font-bold text-slate-700 mt-5 mb-2">Interaction history · {notes.length}</h4>
    <div className="space-y-2">{notes.map(n=><NoteCard key={n.id} n={n} onOpen={(nid)=>{onClose();onOpenNote(nid);}} />)}
      {notes.length===0 && <p className="text-sm text-slate-400">No notes with {p.name} yet.</p>}</div>
  </Modal>;
}

function NoteDetail({ id, onClose, onEdit }) {
  const { data, removeNote, openNewTask } = useApp();
  const n = data.notes.find(x=>x.id===id); if(!n) return null;
  const people = (n.participant_ids||[]).map(pid=>data.people.find(p=>p.id===pid)).filter(Boolean);
  const linkedTasks = (data.tasks||[]).filter(t=>t.linked_note_id===id);
  return <Modal open onClose={onClose} title="Note" wide>
    <div className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2 flex-wrap"><h3 className="text-xl font-bold text-slate-800">{n.title}</h3><TypeBadge id={n.type} /></div>
        <div className="text-sm text-slate-500 mt-0.5">{fmtDateTime(n.datetime)} {n.location && '· '+n.location} {n.logged_by && '· logged by '+n.logged_by}</div>
        <div className="flex flex-wrap gap-1.5 mt-2">{n.context && <span className="text-xs px-2 py-0.5 rounded bg-honey-100 text-honey-700">{n.context}</span>}{(n.tags||[]).map(t=><Tag key={t}>{t}</Tag>)}</div></div>
      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
        <Btn variant="ghost" size="sm" onClick={()=>openNewTask({linked_note_id:n.id,linked_note_title:n.title})}>＋ Action item</Btn>
        <Btn variant="ghost" size="sm" onClick={()=>{onClose();onEdit(n);}}>Edit</Btn>
        <Btn variant="danger" size="sm" onClick={()=>{ if(confirm('Delete this note?')){removeNote(n.id);onClose();} }}>Delete</Btn>
      </div>
    </div>
    {(people.length>0 || (n.external_participants||[]).length>0) && <div className="mt-4"><div className="text-xs font-semibold text-slate-500 mb-1">Participants</div>
      <div className="flex flex-wrap gap-2">{people.map(p=><span key={p.id} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-3 py-1 text-sm"><Avatar name={p.name} size={22} />{p.name}</span>)}
        {(n.external_participants||[]).map((x,i)=><span key={'e'+i} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1 pr-3 py-1 text-sm"><Avatar name={x} size={22} />{x}</span>)}</div></div>}
    {n.summary && <div className="mt-4 bg-honey-50 border border-honey-100 rounded-lg p-3"><div className="text-xs font-semibold text-honey-700 mb-0.5">✨ Summary</div><p className="text-slate-700">{n.summary}</p></div>}
    {n.body && <div className="mt-4"><div className="text-xs font-semibold text-slate-500 mb-1">Notes</div><div className="bg-white border border-slate-200 rounded-lg p-4"><NoteContent html={n.body} /></div></div>}
    {linkedTasks.length>0 && <div className="mt-4"><div className="text-xs font-semibold text-slate-500 mb-1">Action items · {linkedTasks.length}</div>
      <div className="space-y-1.5">{linkedTasks.map(t=><div key={t.id} className="flex items-center gap-2 text-sm py-1">
        <span style={{color:statOf(t.status).color}} className="font-bold text-xs">{t.status==='done'?'✓':t.status==='in_progress'?'●':'○'}</span>
        <span className={t.status==='done'?'line-through text-slate-400':'text-slate-700'}>{t.title}</span>
        {t.assigned_to_name && <span className="text-slate-400 text-xs ml-auto">{t.assigned_to_name}</span>}
      </div>)}</div></div>}
    {(n.attachments||[]).length>0 && <div className="mt-4"><div className="text-xs font-semibold text-slate-500 mb-1">Attachments</div><div className="flex flex-wrap gap-2">{n.attachments.map((a,i)=><AttachmentChip key={i} att={a} />)}</div></div>}
  </Modal>;
}

/* ══════════════════════════════════════════════════════════════
   HOME
══════════════════════════════════════════════════════════════ */
function Stat({ label, value, icon, highlight }) {
  return <div className={cx('rounded-xl border p-4 flex items-center gap-3', highlight?'bg-red-50 border-red-200':'bg-white border-slate-200')}>
    <div className="text-2xl">{icon}</div>
    <div><div className={cx('text-2xl font-bold', highlight?'text-red-700':'text-slate-800')}>{value}</div><div className="text-xs text-slate-500">{label}</div></div></div>;
}
function Home({ go, onOpen, openNew }) {
  const { data, me, openNewTask } = useApp();
  const recent = useMemo(()=>[...data.notes].sort((a,b)=>(b.datetime||'').localeCompare(a.datetime||'')).slice(0,4), [data.notes]);
  const thisWeek = data.notes.filter(n=>{ const d=new Date(n.datetime); return (Date.now()-d.getTime())<7*864e5; }).length;

  const myPersonId = data.people.find(p=>p.name.toLowerCase()===me.toLowerCase())?.id;
  const myOpenTasks = (data.tasks||[]).filter(t=>{
    if (t.status==='done') return false;
    return (myPersonId&&t.assigned_to===myPersonId) || (t.assigned_to_name||'').toLowerCase()===me.toLowerCase();
  }).sort((a,b)=>{
    const aO=isOverdue(a.due_date),bO=isOverdue(b.due_date);
    if(aO!==bO) return aO?-1:1;
    if(a.due_date&&b.due_date) return a.due_date.localeCompare(b.due_date);
    return 0;
  });
  const overdueCount = myOpenTasks.filter(t=>isOverdue(t.due_date)).length;
  const openTasksTotal = (data.tasks||[]).filter(t=>t.status!=='done').length;
  const byType = TYPES.map(t=>({ t, n:data.notes.filter(x=>x.type===t.id).length })).filter(x=>x.n>0);

  return <div className="space-y-5">
    <div className="rounded-2xl bg-gradient-to-br from-honey-400 to-honey-600 text-white p-6 shadow-lg">
      <div className="text-sm font-medium text-honey-100">Welcome back, {me} 🧠</div>
      <h1 className="text-2xl font-extrabold mt-1">Hivemind · Bombay Bioworks</h1>
      <p className="text-honey-50/90 text-sm mt-1 max-w-lg">The shared brain and control panel of the company — notes, relationships, tasks, all in one place.</p>
      <div className="flex gap-2 mt-4 flex-wrap">
        <Btn variant="dark" onClick={()=>openNew()}>＋ New note</Btn>
        <Btn variant="ghost" onClick={()=>openNewTask()}>＋ New task</Btn>
        <Btn variant="ghost" onClick={()=>go('people')}>Add a contact</Btn>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat icon="📝" label="Notes" value={data.notes.length} />
      <Stat icon="🙋" label="People" value={data.people.length} />
      <Stat icon="✅" label="Open tasks" value={openTasksTotal} />
      <Stat icon="📅" label="This week" value={thisWeek} />
    </div>

    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-slate-700">Recent notes</h3><button onClick={()=>go('notes')} className="text-sm text-honey-600 hover:underline">All notes →</button></div>
          {recent.length===0 ? <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">Nothing yet — start with your latest conversation.</div>
            : <div className="space-y-2">{recent.map(n=><NoteCard key={n.id} n={n} onOpen={onOpen} />)}</div>}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-700">My tasks{overdueCount>0&&<span className="ml-1 text-xs text-red-600 font-semibold">⚠ {overdueCount}</span>}</h3>
            <button onClick={()=>go('tasks')} className="text-sm text-honey-600 hover:underline">All tasks →</button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {myOpenTasks.length===0
              ? <div className="p-4 text-sm text-slate-400 text-center">No open tasks for you.<br /><button onClick={()=>openNewTask()} className="text-honey-600 hover:underline mt-1">Create one →</button></div>
              : <div className="divide-y divide-slate-50">
                  {myOpenTasks.slice(0,5).map(t=><div key={t.id} className="px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 cursor-pointer" onClick={()=>go('tasks')}>
                    <span className={cx('text-xs font-bold', isOverdue(t.due_date)?'text-red-600':'text-honey-500')}>{isOverdue(t.due_date)?'⚠':'●'}</span>
                    <span className={cx('text-sm flex-1 truncate', t.status==='done'?'line-through text-slate-400':'text-slate-700')}>{t.title}</span>
                    {t.due_date && <span className={cx('text-[11px] shrink-0', isOverdue(t.due_date)?'text-red-600 font-medium':isDueToday(t.due_date)?'text-honey-600 font-medium':'text-slate-400')}>{isDueToday(t.due_date)?'Today':fmtDate(t.due_date)}</span>}
                  </div>)}
                  {myOpenTasks.length>5 && <div className="px-3 py-2 text-xs text-slate-400 text-center">+{myOpenTasks.length-5} more</div>}
                </div>}
          </div>
        </div>
        <div>
          <h3 className="font-bold text-slate-700 mb-2">By type</h3>
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
            {byType.length===0 ? <div className="text-sm text-slate-400">No data yet.</div> : byType.map(({t,n})=>(
              <div key={t.id} className="flex items-center gap-2 text-sm"><span style={{color:t.color}}>{t.icon}</span><span className="flex-1">{t.label}</span><span className="text-slate-400">{n}</span></div>))}
          </div>
        </div>
        <div>
          <h3 className="font-bold text-slate-700 mb-2">Jump in</h3>
          <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-2 gap-2">
            <Btn variant="ghost" size="sm" onClick={()=>openNew('in_person')}>🤝 Meeting</Btn>
            <Btn variant="ghost" size="sm" onClick={()=>openNew('phone')}>📞 Call</Btn>
            <Btn variant="ghost" size="sm" onClick={()=>openNewTask()}>✅ Task</Btn>
            <Btn variant="ghost" size="sm" onClick={()=>go('timeline')}>🕸️ Timeline</Btn>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════════════════ */
function SettingsView() {
  const { cfg, setConfig, store, data, reload } = useApp();
  const [url, setUrl] = useState(cfg.supabaseUrl||''); const [key, setKey] = useState(cfg.supabaseKey||''); const [name, setName] = useState(cfg.me||'');
  const exportData = () => {
    const blob=new Blob([JSON.stringify({people:data.people, notes:data.notes, tasks:data.tasks||[], exported:nowISO()},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='hivemind-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  };
  const importData = async (file) => {
    const j=JSON.parse(await file.text());
    for(const p of j.people||[]) await store.put('people',p);
    for(const n of j.notes||[]) await store.put('notes',n);
    for(const t of j.tasks||[]) await store.put('tasks',t);
    await reload();
    alert(`Imported ${(j.people||[]).length} people, ${(j.notes||[]).length} notes, ${(j.tasks||[]).length} tasks.`);
  };
  return <div className="max-w-2xl space-y-6">
    <h2 className="text-xl font-bold text-slate-800">Settings</h2>
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-700 mb-3">Your identity</h3>
      <Field label="Your name" hint="Used to filter 'My Tasks' and stamp what you log.">
        <div className="flex gap-2"><input className={inputCls} value={name} onChange={e=>setName(e.target.value)} /><Btn onClick={()=>setConfig({...cfg,me:name.trim()||'Me'})}>Save</Btn></div></Field>
    </section>
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1"><h3 className="font-bold text-slate-700">Shared cloud sync</h3>
        <span className={cx('text-xs px-2 py-0.5 rounded-full', store.mode==='cloud'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500')}>{store.mode==='cloud'?'● Connected':'Local only'}</span></div>
      <p className="text-sm text-slate-500 mb-3">Connect a free Supabase project to share one brain across the team. See README for the 2-minute setup.</p>
      <div className="space-y-3">
        <Field label="Supabase Project URL"><input className={inputCls} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></Field>
        <Field label="Supabase anon public key"><input className={inputCls} value={key} onChange={e=>setKey(e.target.value)} placeholder="eyJ…" /></Field>
        <div className="flex gap-2"><Btn onClick={()=>setConfig({...cfg,supabaseUrl:url.trim(),supabaseKey:key.trim()})}>Connect & reload</Btn>
          {store.mode==='cloud' && <Btn variant="ghost" onClick={()=>setConfig({...cfg,supabaseUrl:'',supabaseKey:''})}>Disconnect</Btn>}</div></div>
    </section>
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-700 mb-3">Backup & restore</h3>
      <div className="flex gap-2"><Btn variant="ghost" onClick={exportData}>⬇ Export JSON</Btn>
        <label><Btn variant="ghost" onClick={()=>document.getElementById('imp').click()}>⬆ Import JSON</Btn><input id="imp" type="file" accept=".json" hidden onChange={e=>e.target.files[0]&&importData(e.target.files[0])} /></label></div>
    </section>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════ */
const NAV = [
  { id:'home',     label:'Home',     icon:'🏠' },
  { id:'notes',    label:'Notes',    icon:'📝' },
  { id:'tasks',    label:'Tasks',    icon:'✅' },
  { id:'timeline', label:'Timeline', icon:'🕸️' },
  { id:'people',   label:'People',   icon:'🙋' },
  { id:'settings', label:'Settings', icon:'⚙️' },
];

function App() {
  const [cfg, setCfg] = useState(loadCfg);
  const store = useMemo(()=>buildAdapter(cfg), [cfg.supabaseUrl, cfg.supabaseKey]);
  const me = cfg.me || 'Me';
  const [tab, setTab] = useState('home');
  const [data, setData] = useState({ people:[], notes:[], tasks:[] });
  const [loading, setLoading] = useState(true);
  const [openPerson, setOpenPerson] = useState(null);
  const [openNoteId, setOpenNoteId] = useState(null);
  const [editNote, setEditNote] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [search, setSearch] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [people, notes, tasks] = await Promise.all([store.list('people'), store.list('notes'), store.list('tasks')]);
      setData({ people, notes, tasks });
    } catch (e) { console.error(e); alert('Could not load data: '+e.message); }
    setLoading(false);
  }, [store]);
  useEffect(()=>{ reload(); }, [reload]);

  const setConfig = (c) => { saveCfg(c); setCfg(c); };
  const savePerson = async (p) => { const rec={id:p.id||uid(),created_at:p.created_at||nowISO(),created_by:p.created_by||me,...p}; await store.put('people',rec); reload(); };
  const removePerson = async (id) => { await store.remove('people',id); reload(); };
  const saveNote = async (n) => { const {summaryEdited,...rest}=n; const rec={id:n.id||uid(),created_at:n.created_at||nowISO(),created_by:n.created_by||me,logged_by:n.logged_by||me,...rest}; await store.put('notes',rec); reload(); };
  const removeNote = async (id) => { await store.remove('notes',id); reload(); };
  const saveTask = async (t) => { const {__new,...rest}=t; const rec={id:t.id||uid(),created_at:t.created_at||nowISO(),created_by:t.created_by||me,...rest}; await store.put('tasks',rec); reload(); };
  const removeTask = async (id) => { await store.remove('tasks',id); reload(); };
  const openNewTask = (defaults={}) => setEditTask({__new:true,...defaults});

  const ctx = { cfg, setConfig, store, me, data, reload, savePerson, removePerson, saveNote, removeNote, saveTask, removeTask, openNewTask };

  const results = useMemo(()=>{
    if(!search.trim()) return null;
    const q=search.toLowerCase();
    return {
      notes: data.notes.filter(n=>(n.title+n.summary+stripHtml(n.body)+n.context).toLowerCase().includes(q)).slice(0,4),
      people: data.people.filter(p=>(p.name+p.org+p.role+(p.tags||[]).join('')).toLowerCase().includes(q)).slice(0,4),
      tasks: (data.tasks||[]).filter(t=>(t.title+(t.description||'')+(t.assigned_to_name||'')).toLowerCase().includes(q)).slice(0,4),
    };
  }, [search, data]);

  return <AppCtx.Provider value={ctx}>
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-honey-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 font-extrabold text-slate-800 cursor-pointer" onClick={()=>setTab('home')}>
            <span className="text-xl">🧠</span><span>Hivemind</span><span className="hidden sm:inline text-xs font-medium text-slate-400">· Bombay Bioworks</span></div>
          <div className="flex-1 max-w-md mx-auto relative">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search the hive…" className="w-full rounded-full bg-honey-50 border border-honey-100 px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-honey-300" />
            {results && <div className="absolute mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
              {!results.notes.length&&!results.people.length&&!results.tasks.length && <div className="p-3 text-sm text-slate-400">No matches.</div>}
              {results.notes.length>0 && <><div className="px-3 pt-2 text-[11px] font-semibold text-slate-400 uppercase">Notes</div>
                {results.notes.map(n=><button key={n.id} onClick={()=>{setOpenNoteId(n.id);setSearch('');}} className="w-full text-left px-3 py-2 hover:bg-honey-50 text-sm">{typeOf(n.type).icon} {n.title} <span className="text-slate-400">· {fmtDate(n.datetime)}</span></button>)}</>}
              {results.tasks.length>0 && <><div className="px-3 pt-2 text-[11px] font-semibold text-slate-400 uppercase">Tasks</div>
                {results.tasks.map(t=><button key={t.id} onClick={()=>{setEditTask(t);setSearch('');setTab('tasks');}} className="w-full text-left px-3 py-2 hover:bg-honey-50 text-sm">✅ {t.title} <span className="text-slate-400">{t.assigned_to_name?'· '+t.assigned_to_name:''}</span></button>)}</>}
              {results.people.length>0 && <><div className="px-3 pt-2 text-[11px] font-semibold text-slate-400 uppercase">People</div>
                {results.people.map(p=><button key={p.id} onClick={()=>{setOpenPerson(p.id);setSearch('');}} className="w-full text-left px-3 py-2 hover:bg-honey-50 text-sm">🙋 {p.name} <span className="text-slate-400">· {p.org}</span></button>)}</>}
            </div>}
          </div>
          <div title={me} className="hidden sm:block"><Avatar name={me} size={32} /></div>
        </div>
        <nav className="max-w-6xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {NAV.map(n=><button key={n.id} onClick={()=>setTab(n.id)} className={cx('px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition', tab===n.id?'border-honey-500 text-honey-700':'border-transparent text-slate-500 hover:text-slate-800')}><span className="mr-1">{n.icon}</span>{n.label}</button>)}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {loading ? <div className="text-center py-20 text-honey-600">Loading the hive…</div> : <>
          {tab==='home'     && <Home go={setTab} onOpen={setOpenNoteId} openNew={(t)=>setEditNote({__new:true,type:t})} />}
          {tab==='notes'    && <NotesView onOpen={setOpenNoteId} openNew={(t)=>setEditNote({__new:true,type:t})} />}
          {tab==='tasks'    && <TasksView />}
          {tab==='timeline' && <TimelineView onOpen={setOpenNoteId} />}
          {tab==='people'   && <PeopleView onOpenPerson={setOpenPerson} />}
          {tab==='settings' && <SettingsView />}
        </>}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">🧠 Hivemind · Bombay Bioworks · {store.mode==='cloud'?'cloud-synced':'local — connect Supabase in Settings to share with the team'}</footer>

      {openPerson && <PersonDetail id={openPerson} onClose={()=>setOpenPerson(null)} onOpenNote={setOpenNoteId} />}
      {openNoteId && <NoteDetail id={openNoteId} onClose={()=>setOpenNoteId(null)} onEdit={n=>{setOpenNoteId(null);setEditNote(n);}} />}
      {editNote && <Modal wide open onClose={()=>setEditNote(null)} title={editNote.__new?'New note':'Edit note'}>
        <NoteForm note={editNote.__new?null:editNote} defaultType={editNote.type} onSave={saveNote} onClose={()=>setEditNote(null)} /></Modal>}
      {editTask && <Modal open onClose={()=>setEditTask(null)} title={editTask.__new?'New task':'Edit task'}>
        {!editTask.__new && <div className="flex justify-end mb-3"><Btn variant="danger" size="sm" onClick={()=>{if(confirm('Delete?')){removeTask(editTask.id);setEditTask(null);}}}>Delete task</Btn></div>}
        <TaskForm task={editTask.__new?null:editTask} defaults={editTask.__new?editTask:{}} onSave={async t=>{await saveTask(t);setEditTask(null);}} onClose={()=>setEditTask(null)} /></Modal>}
    </div>
  </AppCtx.Provider>;
}

const rootEl = document.getElementById('root');
rootEl.className = '';
ReactDOM.createRoot(rootEl).render(<App />);
