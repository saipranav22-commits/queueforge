import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonitoringPage } from '../pages/MonitoringPage';

describe('MonitoringPage', () => {
  it('renders observability header, latency KPIs, and telemetry integration', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MonitoringPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Observability & Distributed Metrics')).toBeInTheDocument();
    expect(screen.getByText('MICROMETER & ACTUATOR')).toBeInTheDocument();
    expect(screen.getByText('Median (p50) Latency')).toBeInTheDocument();
    expect(screen.getByText('p95 Execution Latency')).toBeInTheDocument();
    expect(screen.getByText('Completed Total')).toBeInTheDocument();
    expect(screen.getByText('Failed Total')).toBeInTheDocument();

    expect(screen.getByText('Execution & Queue Wait Latencies')).toBeInTheDocument();
    expect(screen.getByText('Failure Category Taxonomy')).toBeInTheDocument();
    expect(screen.getByText('External Observability & Telemetry Integration')).toBeInTheDocument();
    expect(screen.getByText('Prometheus Scrape Target')).toBeInTheDocument();
    expect(screen.getByText('Grafana Dashboard Template')).toBeInTheDocument();
  });
});
