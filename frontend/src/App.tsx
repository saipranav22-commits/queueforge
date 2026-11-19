import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { JobExplorerPage } from './pages/JobExplorerPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { DlqPage } from './pages/DlqPage';
import { WorkersPage } from './pages/WorkersPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { FairSharePage } from './pages/FairSharePage';
import { EventPipelinePage } from './pages/EventPipelinePage';
import { AdministrationPage } from './pages/AdministrationPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="jobs" element={<JobExplorerPage />} />
                <Route path="jobs/:jobId" element={<JobDetailPage />} />
                <Route path="fairshare" element={<FairSharePage />} />
                <Route path="pipeline" element={<EventPipelinePage />} />
                <Route path="dlq" element={<DlqPage />} />
                <Route path="workers" element={<WorkersPage />} />
                <Route path="monitoring" element={<MonitoringPage />} />
                <Route path="admin" element={<AdministrationPage />} />
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
