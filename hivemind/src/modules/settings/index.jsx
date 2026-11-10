import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { auth, signOut } from '../../firebase.js';
import { Btn } from '../../components/ui.jsx';
import Avatar from '../../components/Avatar.jsx';
import BBLogo from '../../components/BBLogo.jsx';

export default function SettingsView() {
  const { me, user, data } = useApp();
  const [copied, setCopied] = useState(false);

  const copyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
    }
  };

  const stats = [
    { label: 'Notes', value: data.notes.length },
    { label: 'People', value: data.people.length },
    { label: 'Open tasks', value: (data.tasks || []).filter(t => t.status !== 'done').length },
    { label: 'Done tasks', value: (data.tasks || []).filter(t => t.status === 'done').length },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Settings</h1>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          <Avatar name={me} size={48} />
          <div>
            <div className="font-semibold text-slate-800">{me}</div>
            {user?.email && <div className="text-sm text-slate-400">{user.email}</div>}
          </div>
        </div>
        {user?.uid && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">User ID</div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-slate-600 flex-1 break-all">{user.uid}</code>
              <button onClick={copyUid} className="text-xs text-forest-600 hover:underline shrink-0">{copied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
        )}
        <div className="mt-4">
          <Btn variant="ghost" onClick={() => signOut(auth)}>Sign out</Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Your data</h2>
        <div className="grid grid-cols-2 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-forest-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-forest-700">{s.value}</div>
              <div className="text-xs text-forest-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">About</h2>
        <div className="flex items-center gap-3 mb-3">
          <BBLogo size={32} />
          <div>
            <div className="font-semibold text-slate-800">Hivemind v2.0</div>
            <div className="text-xs text-slate-400">Bombay Bioworks · Internal tool</div>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          The operating system of the company — notes, relationships, tasks, and eventually the full plant.
        </p>
      </div>
    </div>
  );
}
