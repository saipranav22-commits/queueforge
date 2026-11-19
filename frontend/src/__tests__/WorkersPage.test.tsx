import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { WorkersPage } from '../pages/WorkersPage';

describe('WorkersPage (Distributed Worker Fleet)', () => {
  it('renders Worker Fleet header, KPI metric cards, and architecture sections', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter>
            <WorkersPage />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Distributed Worker Fleet')).toBeInTheDocument();
    expect(screen.getByText('MULTI-NODE CLUSTER')).toBeInTheDocument();
    expect(screen.getByText('Online Nodes')).toBeInTheDocument();
    expect(screen.getByText('Cluster Concurrency')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL Lease Store')).toBeInTheDocument();
    expect(screen.getByText('Discovered Worker Instances')).toBeInTheDocument();
    expect(screen.getByText('Worker Coordinator Fencing Architecture')).toBeInTheDocument();
    expect(screen.getByText('Fault Tolerance & Crash Recovery')).toBeInTheDocument();
  });
});
