import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';

// Route-based code splitting for optimal production bundle performance
const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const JobExplorerPage = lazy(() =>
  import('./pages/JobExplorerPage').then((m) => ({ default: m.JobExplorerPage }))
);
const JobDetailPage = lazy(() =>
  import('./pages/JobDetailPage').then((m) => ({ default: m.JobDetailPage }))
);
const FairSharePage = lazy(() =>
  import('./pages/FairSharePage').then((m) => ({ default: m.FairSharePage }))
);
const EventPipelinePage = lazy(() =>
  import('./pages/EventPipelinePage').then((m) => ({ default: m.EventPipelinePage }))
);
const ReliabilityLabPage = lazy(() =>
  import('./pages/ReliabilityLabPage').then((m) => ({ default: m.ReliabilityLabPage }))
);
const DlqPage = lazy(() =>
  import('./pages/DlqPage').then((m) => ({ default: m.DlqPage }))
);
const WorkersPage = lazy(() =>
  import('./pages/WorkersPage').then((m) => ({ default: m.WorkersPage }))
);
const MonitoringPage = lazy(() =>
  import('./pages/MonitoringPage').then((m) => ({ default: m.MonitoringPage }))
);
const AdministrationPage = lazy(() =>
  import('./pages/AdministrationPage').then((m) => ({ default: m.AdministrationPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageSuspenseFallback: React.FC = () => (
  <div className="flex items-center justify-center py-24 text-[var(--color-text-muted)] font-mono text-xs">
    <div className="flex flex-col items-center gap-3">
      <div className="w-6 h-6 rounded-full border-2 border-[var(--color-amethyst)] border-t-transparent animate-spin" />
      <span>Loading Module...</span>
    </div>
  </div>
);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route
                  index
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <OverviewPage />
                    </Suspense>
                  }
                />
                <Route
                  path="jobs"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <JobExplorerPage />
                    </Suspense>
                  }
                />
                <Route
                  path="jobs/:jobId"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <JobDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="fairshare"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <FairSharePage />
                    </Suspense>
                  }
                />
                <Route
                  path="pipeline"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <EventPipelinePage />
                    </Suspense>
                  }
                />
                <Route
                  path="reliability"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <ReliabilityLabPage />
                    </Suspense>
                  }
                />
                <Route
                  path="dlq"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <DlqPage />
                    </Suspense>
                  }
                />
                <Route
                  path="workers"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <WorkersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="monitoring"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <MonitoringPage />
                    </Suspense>
                  }
                />
                <Route
                  path="admin"
                  element={
                    <Suspense fallback={<PageSuspenseFallback />}>
                      <AdministrationPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
