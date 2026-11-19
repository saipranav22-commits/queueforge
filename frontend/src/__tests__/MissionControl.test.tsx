import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { OverviewPage } from '../pages/OverviewPage';

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Mission Control (OverviewPage)', () => {
  it('renders Mission Control banner and primary KPI cards', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter>
              <OverviewPage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Check title and sections
    expect(screen.getByText('Mission Control')).toBeInTheDocument();
    expect(screen.getByText('V2 ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Pending Queue')).toBeInTheDocument();
    expect(screen.getByText('Active Running')).toBeInTheDocument();
    expect(screen.getByText('Completed Total')).toBeInTheDocument();
    expect(screen.getByText('Dead-Letter Queue')).toBeInTheDocument();
    expect(screen.getByText('Distributed Worker Fleet')).toBeInTheDocument();
    expect(screen.getByText('worker-v2-node-1')).toBeInTheDocument();
    expect(screen.getByText('worker-v2-node-2')).toBeInTheDocument();
    expect(screen.getByText('Reliability & DLQ')).toBeInTheDocument();
    expect(screen.getByText('FairShare Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Transactional Outbox')).toBeInTheDocument();
  });
});
