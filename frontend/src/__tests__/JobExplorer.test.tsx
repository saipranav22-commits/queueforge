import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { JobExplorerPage } from '../pages/JobExplorerPage';

describe('JobExplorerPage', () => {
  it('renders toolbar, search controls, status pills, and empty state', () => {
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
              <JobExplorerPage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Job Explorer')).toBeInTheDocument();
    expect(screen.getByText('SERVER PAGINATED')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search UUID or idempotency key.../i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Filter by Job Type/i)).toBeInTheDocument();
    expect(screen.getByText('All Tenants (Global)')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('DEAD_LETTER')).toBeInTheDocument();
    expect(screen.getByText('High (80+)')).toBeInTheDocument();
    expect(screen.getByText('Med (50)')).toBeInTheDocument();
    expect(screen.getByText('Low (20)')).toBeInTheDocument();
  });
});
