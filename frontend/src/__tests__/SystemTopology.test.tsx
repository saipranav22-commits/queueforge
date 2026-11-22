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

    expect(screen.getByText('Signature Distributed Topology & Boundary Canvas')).toBeInTheDocument();
    expect(screen.getByText('7 CONTAINERS + 2 ENGINES')).toBeInTheDocument();
    expect(screen.getByText('CONTAINER INSPECTOR')).toBeInTheDocument();
    expect(screen.getByText('Job Ingestion & Admin Gateway')).toBeInTheDocument();
    expect(screen.getByText('ZONE 1: EDGE & INGRESS')).toBeInTheDocument();
  });
});
