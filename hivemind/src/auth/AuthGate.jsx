import { useState, useEffect } from 'react';
import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
} from '../firebase.js';
import BBLogo from '../components/BBLogo.jsx';
import { Btn } from '../components/ui.jsx';

const AUTO_APPROVED = ['connect@pratikagarwal.com', 'mukundkhetan@gmail.com', 'karan@mbplgroup.com'];

function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-10 max-w-sm w-full text-center">
        <div className="flex justify-center mb-5"><BBLogo size={56} /></div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Hivemind</h1>
        <p className="text-slate-400 text-sm mb-8">Bombay Bioworks · Internal tool</p>
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition text-sm shadow-sm disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.4l7.9 6.1C12.7 13.5 17.9 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.6 37.4 46.5 31.3 46.5 24.5z" />
            <path fill="#FBBC05" d="M10.8 28.5c-.5-1.5-.8-3.1-.8-4.5s.3-3 .8-4.5L2.9 13.4C1 17 0 20.9 0 25s1 8 2.9 11.6l7.9-6.1z" />
            <path fill="#34A853" d="M24 50c6.2 0 11.4-2 15.2-5.4l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.1 0-11.3-4-13.2-9.5l-7.9 6.1C6.8 44.6 14.7 50 24 50z" />
          </svg>
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {error && <p className="text-red-500 text-xs mt-4 text-left">{error}</p>}
        <p className="text-slate-400 text-xs mt-6">Access restricted to the Bombay Bioworks team.</p>
      </div>
    </div>
  );
}

function AccessPendingScreen({ user }) {
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!user || submitted) return;
    setDoc(doc(db, '_requests', user.uid), {
      uid: user.uid, email: user.email, name: user.displayName || '', requestedAt: new Date().toISOString(),
    }).then(() => setSubmitted(true)).catch(() => {});
  }, [user]);
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-10 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🔐</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Access pending</h1>
        <p className="text-slate-500 text-sm mb-3">You're signed in as <strong>{user.email}</strong>.</p>
        <p className="text-slate-400 text-sm mb-6">Your access request has been sent to the admin. Once approved, refresh this page.</p>
        <div className="bg-slate-50 rounded-lg p-3 mb-6 text-left">
          <p className="text-xs text-slate-400 mb-1">Your access code (share with admin if needed)</p>
          <code className="text-xs text-slate-700 break-all">{user.uid}</code>
        </div>
        <Btn variant="ghost" onClick={() => signOut(auth)}>Sign out</Btn>
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const [state, setState] = useState({ phase: 'loading', user: null });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { setState({ phase: 'login', user: null }); return; }
      if (AUTO_APPROVED.includes(user.email) || user.email?.endsWith('@bombaybioworks.com')) {
        setState({ phase: 'ready', user });
        return;
      }
      try {
        const snap = await getDoc(doc(db, '_access', user.uid));
        setState({ phase: snap.exists() ? 'ready' : 'pending', user });
      } catch {
        setState({ phase: 'pending', user });
      }
    });
  }, []);

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-forest-600 font-medium">Loading Hivemind…</span>
      </div>
    );
  }
  if (state.phase === 'login') return <LoginScreen />;
  if (state.phase === 'pending') return <AccessPendingScreen user={state.user} />;

  return children(state.user);
}
