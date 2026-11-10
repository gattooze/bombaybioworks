import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { cx } from '../lib/utils.js';

const MODULES = [
  // Phase 1 — live
  {
    id: 'notes',    icon: '📝', label: 'Notes',
    desc: 'Log conversations, meetings, calls and thoughts.',
    path: '/notes', phase: 1, live: true,
  },
  {
    id: 'crm',      icon: '👥', label: 'People',
    desc: 'Contacts, relationships and interaction history.',
    path: '/crm', phase: 1, live: true,
  },
  {
    id: 'tasks',    icon: '✅', label: 'Tasks',
    desc: 'Who is doing what, assigned and tracked.',
    path: '/tasks', phase: 1, live: true,
  },
  {
    id: 'timeline', icon: '🕸️', label: 'Timeline',
    desc: 'Relationship history of the whole company.',
    path: '/timeline', phase: 1, live: true,
  },
  // Phase 2 — coming soon
  {
    id: 'manufacturing', icon: '🏭', label: 'Manufacturing',
    desc: 'Production runs, batch tracking, OEE.',
    phase: 2, live: false,
  },
  {
    id: 'quality', icon: '🧪', label: 'Quality',
    desc: 'Defect logging, iodine value, batch traceability.',
    phase: 2, live: false,
  },
  {
    id: 'rnd', icon: '🔬', label: 'R&D',
    desc: 'Experiment logs, formulations, process records.',
    phase: 2, live: false,
  },
  {
    id: 'procurement', icon: '📦', label: 'Procurement',
    desc: 'Suppliers, PO tracking, raw material inventory.',
    phase: 2, live: false,
  },
  // Phase 3 — coming soon
  {
    id: 'machine', icon: '📡', label: 'Machine Data',
    desc: 'Real-time sensor feeds from the plant floor.',
    phase: 3, live: false,
  },
  {
    id: 'simulator', icon: '⚡', label: 'Simulator',
    desc: 'Process modelling and yield optimisation.',
    phase: 3, live: false,
  },
  {
    id: 'maintenance', icon: '🔧', label: 'Maintenance',
    desc: 'Equipment history and PM schedules.',
    phase: 3, live: false,
  },
  // Phase 4
  {
    id: 'analytics', icon: '📊', label: 'Analytics',
    desc: 'Cross-module reporting and executive dashboards.',
    phase: 4, live: false,
  },
];

function ModuleCard({ mod }) {
  const navigate = useNavigate();
  if (mod.live) {
    return (
      <button
        onClick={() => navigate(mod.path)}
        className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-forest-300 transition group cursor-pointer"
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl">{mod.icon}</span>
          <span className="text-[10px] font-bold tracking-wider uppercase text-forest-600 bg-forest-50 px-2 py-0.5 rounded-full">Live</span>
        </div>
        <h3 className="font-bold text-slate-800 mb-1 group-hover:text-forest-700 transition">{mod.label}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{mod.desc}</p>
      </button>
    );
  }
  return (
    <div className="bg-white/60 rounded-2xl border border-slate-200 border-dashed p-5 opacity-70">
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl grayscale">{mod.icon}</span>
        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          Phase {mod.phase}
        </span>
      </div>
      <h3 className="font-bold text-slate-500 mb-1">{mod.label}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{mod.desc}</p>
    </div>
  );
}

export default function Homepage() {
  const { data, me, openNewNote, openNewTask } = useApp();
  const navigate = useNavigate();
  const openCount = (data.tasks || []).filter(t => t.status !== 'done').length;
  const thisWeek = data.notes.filter(n => (Date.now() - new Date(n.datetime).getTime()) < 7 * 864e5).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-forest-400 to-forest-600 text-white p-7 shadow-lg">
        <div className="text-sm font-medium text-forest-100">Welcome back, {me} 🧠</div>
        <h1 className="text-2xl font-extrabold mt-1">Hivemind · Bombay Bioworks</h1>
        <p className="text-forest-50/90 text-sm mt-2 max-w-xl">
          The operating system of the company — notes, relationships, tasks, and eventually the full plant.
        </p>
        <div className="flex gap-2 mt-5 flex-wrap">
          <button
            onClick={() => openNewNote()}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition"
          >
            ＋ New note
          </button>
          <button
            onClick={() => openNewTask()}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition border border-white/20"
          >
            ＋ New task
          </button>
        </div>
        <div className="flex gap-6 mt-5 text-sm">
          <div><span className="font-bold text-white text-xl">{data.notes.length}</span><span className="text-forest-100 ml-1.5">notes</span></div>
          <div><span className="font-bold text-white text-xl">{data.people.length}</span><span className="text-forest-100 ml-1.5">people</span></div>
          <div><span className="font-bold text-white text-xl">{openCount}</span><span className="text-forest-100 ml-1.5">open tasks</span></div>
          <div><span className="font-bold text-white text-xl">{thisWeek}</span><span className="text-forest-100 ml-1.5">this week</span></div>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modules</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {MODULES.map(mod => <ModuleCard key={mod.id} mod={mod} />)}
        </div>
      </div>
    </div>
  );
}
