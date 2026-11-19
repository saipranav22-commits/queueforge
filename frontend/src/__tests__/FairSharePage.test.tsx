import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { FairSharePage } from '../pages/FairSharePage';

describe('FairSharePage', () => {
  it('renders FairShare header, DRR engine badges, and benchmark evidence', () => {
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
              <FairSharePage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Header & Badges
    expect(screen.getByText('FairShare Multi-Tenant Scheduler')).toBeInTheDocument();
    expect(screen.getByText('DRR ENGINE')).toBeInTheDocument();
    expect(screen.getByText('Provision Tenant')).toBeInTheDocument();

    // KPI Cards
    expect(screen.getByText('Active Tenants')).toBeInTheDocument();
    expect(screen.getByText('Total Configured Weight')).toBeInTheDocument();
    expect(screen.getByText('Cluster Concurrency Cap')).toBeInTheDocument();

    // Registry Table
    expect(screen.getByText('Configured Tenant Registry')).toBeInTheDocument();

    // Educational Simulator
    expect(screen.getByText(/Educational Simulator: Deficit Round-Robin/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulate Sweep/i)).toBeInTheDocument();

    // Empirical Benchmark Panel
    expect(screen.getByText(/Empirical Benchmark Evidence/i)).toBeInTheDocument();
    expect(screen.getByText('11,868 ms')).toBeInTheDocument();
    expect(screen.getByText(/1,210 ms/)).toBeInTheDocument();
  });

  it('allows stepping the educational simulator round', () => {
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
              <FairSharePage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    const stepBtn = screen.getByText(/Simulate Sweep/i);
    expect(stepBtn).toBeInTheDocument();
    fireEvent.click(stepBtn);

    // After step, round log appears
    expect(screen.getByText(/Recent Sweep Execution Traces/i)).toBeInTheDocument();
  });
});
