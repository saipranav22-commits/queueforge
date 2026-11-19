import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { EventPipelinePage } from '../pages/EventPipelinePage';

describe('EventPipelinePage', () => {
  it('renders pipeline header, outbox KPI counters, and 7-step architecture', () => {
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
              <EventPipelinePage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Header & Guarantees
    expect(screen.getByText('Transactional Outbox Event Pipeline')).toBeInTheDocument();
    expect(screen.getByText('AT-LEAST-ONCE')).toBeInTheDocument();
    expect(screen.getByText('Trigger Dispatch')).toBeInTheDocument();

    // Outbox KPI Counters
    expect(screen.getByText('Pending Events')).toBeInTheDocument();
    expect(screen.getByText('In-Flight Dispatching')).toBeInTheDocument();
    expect(screen.getByText('Acknowledged Delivered')).toBeInTheDocument();
    expect(screen.getByText('Dead Letter Events')).toBeInTheDocument();

    // 7 Pipeline Stages
    expect(screen.getByText('Order Created')).toBeInTheDocument();
    expect(screen.getByText('Outbox Event Persisted')).toBeInTheDocument();
    expect(screen.getByText('Dispatcher Claims Event')).toBeInTheDocument();
    expect(screen.getByText('HTTP Dispatch to Receiver')).toBeInTheDocument();
    expect(screen.getByText('Receiver Idempotency Check')).toBeInTheDocument();
    expect(screen.getByText('Business Effect Recorded')).toBeInTheDocument();
    expect(screen.getByText('Delivery Acknowledged')).toBeInTheDocument();

    // Event Explorer Table
    expect(screen.getByText('Transactional Outbox Event Explorer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search aggregate ID/i)).toBeInTheDocument();

    // Idempotency Architecture
    expect(screen.getByText(/Durable Idempotency Architecture/i)).toBeInTheDocument();
  });

  it('selects valid batch sizes within backend bounds', () => {
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
              <EventPipelinePage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument(); // 100 exceeds MAX_BATCH_SIZE (50)
  });
});
