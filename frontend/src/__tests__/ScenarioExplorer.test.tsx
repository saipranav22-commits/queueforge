import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { ScenarioProvider, useScenario, SCENARIO_CATALOG } from '../context/ScenarioContext';
import { ScenarioBanner } from '../components/common/ScenarioBanner';
import { ScenarioSelectorMenu } from '../components/common/ScenarioSelectorMenu';
import { CompactTelemetryRail } from '../components/telemetry/CompactTelemetryRail';

// Test consumer to verify hook functionality
const ScenarioTestHarness: React.FC = () => {
  const {
    isScenarioMode,
    activeScenarioId,
    activeScenario,
    setScenario,
    exitScenario,
    scenarioStats,
    triggerSimulatedDispatch,
    triggerSimulatedReplay,
    triggerSimulatedDrrStep,
    simulatedActionCount,
  } = useScenario();

  return (
    <div>
      <ScenarioBanner />
      <ScenarioSelectorMenu />

      <div data-testid="mode-status">{isScenarioMode ? 'SIMULATION' : 'LIVE'}</div>
      <div data-testid="scenario-id">{activeScenarioId || 'NONE'}</div>
      <div data-testid="scenario-title">{activeScenario?.title || 'NONE'}</div>
      <div data-testid="pending-jobs">{scenarioStats.pendingJobs}</div>
      <div data-testid="action-count">{simulatedActionCount}</div>

      <button onClick={() => setScenario('HEALTHY_CLUSTER')}>Select Healthy</button>
      <button onClick={() => setScenario('WORKER_FAILURE')}>Select Worker Failure</button>
      <button onClick={() => setScenario('NOISY_NEIGHBOR')}>Select Noisy Neighbor</button>
      <button onClick={() => setScenario('OUTBOX_RETRY')}>Select Outbox Retry</button>
      <button onClick={() => setScenario('DLQ_POISON_RECOVERY')}>Select DLQ Poison</button>
      <button onClick={exitScenario}>Exit Scenario</button>

      <button onClick={() => triggerSimulatedDispatch()}>Simulate Dispatch</button>
      <button onClick={() => triggerSimulatedReplay('job-123')}>Simulate Replay</button>
      <button onClick={() => triggerSimulatedDrrStep()}>Simulate DRR Step</button>
    </div>
  );
};

const renderWithProviders = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ScenarioProvider>
            <MemoryRouter>{ui}</MemoryRouter>
          </ScenarioProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Scenario Engine & Explorer Integration', () => {
  it('initializes in Live Mode with zero active scenario', () => {
    renderWithProviders(<ScenarioTestHarness />);

    expect(screen.getByTestId('mode-status')).toHaveTextContent('LIVE');
    expect(screen.getByTestId('scenario-id')).toHaveTextContent('NONE');
    expect(screen.getByTestId('scenario-title')).toHaveTextContent('NONE');
  });

  it('activates WORKER_FAILURE scenario and renders correct metadata and banner', () => {
    renderWithProviders(<ScenarioTestHarness />);

    act(() => {
      fireEvent.click(screen.getByText('Select Worker Failure'));
    });

    expect(screen.getByTestId('mode-status')).toHaveTextContent('SIMULATION');
    expect(screen.getByTestId('scenario-id')).toHaveTextContent('WORKER_FAILURE');
    expect(screen.getByTestId('scenario-title')).toHaveTextContent(
      SCENARIO_CATALOG.WORKER_FAILURE.title
    );

    // Scenario banner should be rendered
    expect(screen.getByText(/SIMULATED SCENARIO/i)).toBeInTheDocument();
    expect(screen.getAllByText(/FAULT INJECTION/i).length).toBeGreaterThanOrEqual(1);
  });

  it('cycles across all 5 deterministic scenarios cleanly', () => {
    renderWithProviders(<ScenarioTestHarness />);

    // 1. HEALTHY_CLUSTER
    act(() => {
      fireEvent.click(screen.getByText('Select Healthy'));
    });
    expect(screen.getByTestId('scenario-id')).toHaveTextContent('HEALTHY_CLUSTER');

    // 2. NOISY_NEIGHBOR
    act(() => {
      fireEvent.click(screen.getByText('Select Noisy Neighbor'));
    });
    expect(screen.getByTestId('scenario-id')).toHaveTextContent('NOISY_NEIGHBOR');

    // 3. OUTBOX_RETRY
    act(() => {
      fireEvent.click(screen.getByText('Select Outbox Retry'));
    });
    expect(screen.getByTestId('scenario-id')).toHaveTextContent('OUTBOX_RETRY');

    // 4. DLQ_POISON_RECOVERY
    act(() => {
      fireEvent.click(screen.getByText('Select DLQ Poison'));
    });
    expect(screen.getByTestId('scenario-id')).toHaveTextContent('DLQ_POISON_RECOVERY');
  });

  it('executes safe client-side simulated mutations without network I/O', () => {
    renderWithProviders(<ScenarioTestHarness />);

    act(() => {
      fireEvent.click(screen.getByText('Select Outbox Retry'));
    });

    expect(screen.getByTestId('action-count')).toHaveTextContent('0');

    act(() => {
      fireEvent.click(screen.getByText('Simulate Dispatch'));
    });
    expect(screen.getByTestId('action-count')).toHaveTextContent('1');

    act(() => {
      fireEvent.click(screen.getByText('Simulate Replay'));
    });
    expect(screen.getByTestId('action-count')).toHaveTextContent('2');

    act(() => {
      fireEvent.click(screen.getByText('Simulate DRR Step'));
    });
    expect(screen.getByTestId('action-count')).toHaveTextContent('3');
  });

  it('exits scenario mode back to Live Mode upon exitScenario call', () => {
    renderWithProviders(<ScenarioTestHarness />);

    act(() => {
      fireEvent.click(screen.getByText('Select Healthy'));
    });
    expect(screen.getByTestId('mode-status')).toHaveTextContent('SIMULATION');

    act(() => {
      fireEvent.click(screen.getByText('Exit Scenario'));
    });
    expect(screen.getByTestId('mode-status')).toHaveTextContent('LIVE');
    expect(screen.getByTestId('scenario-id')).toHaveTextContent('NONE');
  });

  it('renders CompactTelemetryRail with honest provenance tags in simulated vs live offline', () => {
    const { rerender } = render(
      <CompactTelemetryRail
        provenance="SIMULATED_SCENARIO"
        scenarioName="Nominal Multi-Node Cluster"
        stats={{
          pendingJobs: 12,
          runningJobs: 8,
          completedJobs: 4800,
          deadLetterJobs: 0,
          archivedJobs: 10,
          totalJobs: 4820,
          activeWorkers: 2,
          workerCapacity: 20,
          workerStatus: 'ONLINE',
          submittedTotal: 4820,
          completedTotal: 4800,
          failedTotal: 0,
          retriedTotal: 0,
          recoveredTotal: 0,
        }}
      />
    );

    expect(screen.getByText(/Simulated Stream — Nominal Multi-Node Cluster/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();

    // Rerender as LIVE_OFFLINE
    rerender(
      <CompactTelemetryRail
        provenance="LIVE_OFFLINE"
      />
    );

    expect(screen.getByText(/PostgreSQL & Spring Daemons Disconnected/i)).toBeInTheDocument();
  });
});
