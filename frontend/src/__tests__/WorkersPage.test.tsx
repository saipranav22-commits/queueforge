import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { ScenarioProvider, useScenario } from '../context/ScenarioContext';
import { WorkersPage } from '../pages/WorkersPage';
import type { WorkerInstance } from '../types/worker';

const ScenarioTestWrapper: React.FC<{ initialScenario?: any; children: React.ReactNode }> = ({ initialScenario, children }) => {
  const { setScenario } = useScenario();

  React.useEffect(() => {
    if (initialScenario) {
      setScenario(initialScenario);
    }
  }, [initialScenario, setScenario]);

  return <>{children}</>;
};

const renderWorkersPage = (initialScenario?: any, mockQueryData?: { fleet?: WorkerInstance[] }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (mockQueryData?.fleet !== undefined) {
    queryClient.setQueryData(['system-workers'], mockQueryData.fleet);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ScenarioProvider>
          <MemoryRouter>
            <ScenarioTestWrapper initialScenario={initialScenario}>
              <WorkersPage />
            </ScenarioTestWrapper>
          </MemoryRouter>
        </ScenarioProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('WorkersPage (Distributed Worker Fleet)', () => {
  it('renders Worker Fleet header, KPI metric cards, and architecture sections', () => {
    renderWorkersPage();

    expect(screen.getByText('Distributed Worker Fleet')).toBeInTheDocument();
    expect(screen.getByText('MULTI-NODE CLUSTER')).toBeInTheDocument();
    expect(screen.getByText('Online Nodes')).toBeInTheDocument();
    expect(screen.getByText('Cluster Concurrency')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL Lease Store')).toBeInTheDocument();
    expect(screen.getByText('Discovered Worker Instances')).toBeInTheDocument();
    expect(screen.getByText('Worker Coordinator Fencing Architecture')).toBeInTheDocument();
    expect(screen.getByText('Fault Tolerance & Crash Recovery')).toBeInTheDocument();
  });

  it('regression: displays "1 of 2" (NOT "1 of 0") in WORKER_FAILURE scenario', async () => {
    renderWorkersPage('WORKER_FAILURE');

    // Numerator (online) and denominator (total) are both derived from effectiveFleet
    expect(await screen.findByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('0 stale • 1 offline')).toBeInTheDocument();
    expect(screen.getByText('qf-worker-1')).toBeInTheDocument();
    expect(screen.getByText('qf-worker-2')).toBeInTheDocument();
  });

  it('displays "2 of 2" in HEALTHY_CLUSTER scenario', async () => {
    renderWorkersPage('HEALTHY_CLUSTER');

    expect(await screen.findByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByText('0 stale • 0 offline')).toBeInTheDocument();
  });

  it('displays aligned live counts when live API returns active workers', async () => {
    const mockFleet: WorkerInstance[] = [
      {
        instanceId: 'live-worker-1',
        mode: 'DISTRIBUTED_ACTIVE',
        status: 'ONLINE',
        concurrency: 8,
        activeJobs: 2,
        heldLeasesCount: 2,
        completedJobsCount: 100,
        failedJobsCount: 0,
        lastHeartbeat: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        heartbeatAgeSeconds: 1.0,
      },
      {
        instanceId: 'live-worker-2',
        mode: 'DISTRIBUTED_ACTIVE',
        status: 'ONLINE',
        concurrency: 8,
        activeJobs: 3,
        heldLeasesCount: 3,
        completedJobsCount: 95,
        failedJobsCount: 0,
        lastHeartbeat: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        heartbeatAgeSeconds: 1.2,
      },
    ];

    renderWorkersPage(undefined, { fleet: mockFleet });

    expect(await screen.findByText('2 of 2')).toBeInTheDocument();
  });

  it('displays "0 of 0" gracefully when live fleet is empty', async () => {
    renderWorkersPage(undefined, { fleet: [] });

    expect(await screen.findByText('0 of 0')).toBeInTheDocument();
    expect(screen.getByText('0 stale • 0 offline')).toBeInTheDocument();
  });
});
