import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { JobExplorerPage } from './pages/JobExplorerPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { DlqPage } from './pages/DlqPage';
import { WorkersPage } from './pages/WorkersPage';
import { MonitoringPage } from './pages/MonitoringPage';

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
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="jobs" element={<JobExplorerPage />} />
              <Route path="jobs/:jobId" element={<JobDetailPage />} />
              <Route path="dlq" element={<DlqPage />} />
              <Route path="workers" element={<WorkersPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
