import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ReliabilityLabPage } from '../pages/ReliabilityLabPage';

describe('ReliabilityLabPage', () => {
  it('renders reliability header, badges, and primary metric cards', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter>
              <ReliabilityLabPage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Header & Badges
    expect(screen.getByText('Reliability Lab & Distributed Verification')).toBeInTheDocument();
    expect(screen.getByText('CHAOS TESTED')).toBeInTheDocument();
    expect(screen.getByText('9/9 INVARIANTS PASS')).toBeInTheDocument();

    // Metric Cards
    expect(screen.getByText('DLQ Poison Jobs')).toBeInTheDocument();
    expect(screen.getByText('Total System Failures')).toBeInTheDocument();
    expect(screen.getByText('Successful Executions')).toBeInTheDocument();
    expect(screen.getByText('Outbox DLQ Events')).toBeInTheDocument();
    expect(screen.getByText('Worker Fleet Resilience')).toBeInTheDocument();

    // Core Distributed Resilience Mechanisms
    expect(screen.getByText('Core Distributed Resilience Mechanisms')).toBeInTheDocument();
    expect(screen.getAllByText('Lease Fencing & Stale Worker Rejection')[0]).toBeInTheDocument();
    expect(screen.getByText('Orphaned Lease Sweeper & Auto-Recovery')).toBeInTheDocument();
    expect(screen.getByText('Exponential Retry Backoff with Full Jitter')).toBeInTheDocument();
    expect(screen.getByText('Dead-Letter Queue Poison Isolation')).toBeInTheDocument();
    expect(screen.getByText('Transactional Outbox Pattern (SKIP LOCKED)')).toBeInTheDocument();
    expect(screen.getByText('Consumer-Side Durable Idempotency')).toBeInTheDocument();
    expect(screen.getByText('FairShare DRR Scheduling & Concurrency Quotas')).toBeInTheDocument();
    expect(screen.getByText('Worker SmartLifecycle & Thread Pool Draining')).toBeInTheDocument();

    // ChaosLab Fault Scenarios
    expect(screen.getByText('ChaosLab Distributed Fault Experiments')).toBeInTheDocument();
    expect(screen.getByText('Experiment A: Hard Worker Crash Mid-Execution')).toBeInTheDocument();
    expect(screen.getByText('Experiment B: Zombie Worker & Fencing Token Protection')).toBeInTheDocument();
    expect(screen.getByText('Experiment C: Split-Brain Network Partition')).toBeInTheDocument();

    // 9 Invariant Matrix
    expect(screen.getByText('Formal Distributed Correctness Invariants (9 Matrix)')).toBeInTheDocument();
    expect(screen.getByText('SAFETY-1')).toBeInTheDocument();
    expect(screen.getByText('SAFETY-2')).toBeInTheDocument();
    expect(screen.getByText('SAFETY-3')).toBeInTheDocument();
    expect(screen.getByText('SAFETY-4')).toBeInTheDocument();
    expect(screen.getByText('SAFETY-5')).toBeInTheDocument();
    expect(screen.getByText('SAFETY-6')).toBeInTheDocument();
    expect(screen.getByText('LIVENESS-1')).toBeInTheDocument();
    expect(screen.getByText('LIVENESS-2')).toBeInTheDocument();
    expect(screen.getByText('LIVENESS-3')).toBeInTheDocument();
  });

  it('switches resilience mechanism detail tabs when clicked', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter>
              <ReliabilityLabPage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    const idempotencyButton = screen.getByRole('button', { name: /Consumer-Side Durable Idempotency/i });
    fireEvent.click(idempotencyButton);

    expect(screen.getByText(/Guarantees exactly-once business effects despite network replay/i)).toBeInTheDocument();
    expect(screen.getByText(/UNIQUE\(idempotency_key\)/i)).toBeInTheDocument();
  });
});
