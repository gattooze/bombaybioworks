import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthGate from './auth/AuthGate.jsx';
import { AppProvider } from './context/AppContext.jsx';
import Shell from './shell/Shell.jsx';
import Homepage from './shell/Homepage.jsx';

const NotesView    = lazy(() => import('./modules/notes/index.jsx'));
const TasksView    = lazy(() => import('./modules/tasks/index.jsx'));
const PeopleView   = lazy(() => import('./modules/crm/index.jsx'));
const OrgsView     = lazy(() => import('./modules/crm/Organisations.jsx'));
const DupsView     = lazy(() => import('./modules/crm/Duplicates.jsx'));
const PipesView     = lazy(() => import('./modules/crm/Pipelines.jsx'));
const SamplesView   = lazy(() => import('./modules/crm/Samples.jsx'));
const FollowView    = lazy(() => import('./modules/crm/FollowUps.jsx'));
const InboxView    = lazy(() => import('./modules/inbox/index.jsx'));
const TimelineView = lazy(() => import('./modules/timeline/index.jsx'));
const SettingsView = lazy(() => import('./modules/settings/index.jsx'));

function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-400">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      {(user) => (
        <AppProvider user={user}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Homepage />} />
              <Route path="notes" element={<Suspense fallback={<Loading />}><NotesView /></Suspense>} />
              <Route path="tasks" element={<Suspense fallback={<Loading />}><TasksView /></Suspense>} />
              <Route path="crm" element={<Suspense fallback={<Loading />}><PeopleView /></Suspense>} />
              <Route path="crm/orgs" element={<Suspense fallback={<Loading />}><OrgsView /></Suspense>} />
              <Route path="crm/duplicates" element={<Suspense fallback={<Loading />}><DupsView /></Suspense>} />
              <Route path="crm/pipelines" element={<Suspense fallback={<Loading />}><PipesView /></Suspense>} />
              <Route path="crm/samples" element={<Suspense fallback={<Loading />}><SamplesView /></Suspense>} />
              <Route path="crm/follow-ups" element={<Suspense fallback={<Loading />}><FollowView /></Suspense>} />
              <Route path="inbox" element={<Suspense fallback={<Loading />}><InboxView /></Suspense>} />
              <Route path="timeline" element={<Suspense fallback={<Loading />}><TimelineView /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<Loading />}><SettingsView /></Suspense>} />
            </Route>
          </Routes>
        </AppProvider>
      )}
    </AuthGate>
  );
}
