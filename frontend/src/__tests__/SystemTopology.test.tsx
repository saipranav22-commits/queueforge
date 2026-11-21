import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SystemTopology } from '../components/topology/SystemTopology';

describe('SystemTopology', () => {
  it('renders interactive 7-service distributed topology and container specifications', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SystemTopology />
      </QueryClientProvider>
    );

    expect(screen.getByText('Interactive 7-Service Distributed Topology')).toBeInTheDocument();
    expect(screen.getByText('ACID CLUSTER')).toBeInTheDocument();
    expect(screen.getByText('CONTAINER INSPECTOR')).toBeInTheDocument();
    expect(screen.getByText('Job Ingestion & Admin Gateway')).toBeInTheDocument();
    expect(screen.getByText('PORT BINDING & EXPOSURE')).toBeInTheDocument();
  });
});
