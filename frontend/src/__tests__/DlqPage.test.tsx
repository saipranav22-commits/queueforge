import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { DlqPage } from '../pages/DlqPage';

describe('DlqPage', () => {
  it('renders DLQ header, search toolbar, and poison isolation status', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter>
              <DlqPage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Dead-Letter Queue Operations')).toBeInTheDocument();
    expect(screen.getByText('POISON ISOLATION')).toBeInTheDocument();
    expect(screen.getByText('Reliability Lab')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by job ID, type, or error snippet/i)).toBeInTheDocument();
    expect(screen.getByText('All Failure Categories')).toBeInTheDocument();
  });

  it('filters failure categories in dropdown', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter>
              <DlqPage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'TRANSIENT_FAILURE' } });
    expect(select).toHaveValue('TRANSIENT_FAILURE');
  });
});
