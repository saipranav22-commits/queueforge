import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OperatorIntelligence } from '../components/ui/OperatorIntelligence';

describe('OperatorIntelligence', () => {
  it('evaluates telemetry and renders operator intelligence diagnostic panel', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OperatorIntelligence />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Deterministic Operator Intelligence')).toBeInTheDocument();
    expect(screen.getByText('NOMINAL')).toBeInTheDocument();
    expect(screen.getByText('Cluster Operations')).toBeInTheDocument();
  });
});
