import { useEffect, useRef } from 'react';
import Quill from 'quill';

export function RichEditor({ value, onChange, placeholder }) {
  const elRef = useRef();
  const qRef = useRef();
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const q = new Quill(elRef.current, {
      theme: 'snow',
      placeholder: placeholder || 'Start typing your notes…',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ align: [] }],
          ['blockquote', 'code-block'],
          ['link'],
          ['clean'],
        ],
      },
    });
    qRef.current = q;
    if (value) q.clipboard.dangerouslyPasteHTML(value);
    q.on('text-change', () => {
      const html = q.root.innerHTML;
      cbRef.current(html === '<p><br></p>' ? '' : html);
    });
    return () => { qRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="bg-white rounded-lg"><div ref={elRef} /></div>;
}

export function NoteContent({ html }) {
  if (!html) return null;
  return (
    <div className="note-render ql-snow">
      <div className="ql-editor" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
