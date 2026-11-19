import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AdministrationPage } from '../pages/AdministrationPage';

describe('AdministrationPage', () => {
  it('renders administration header, privilege status, and security sections', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter>
              <AdministrationPage />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Control Plane Administration')).toBeInTheDocument();
    expect(screen.getByText('SECURITY & OPERATIONS')).toBeInTheDocument();
    expect(screen.getByText('Session Privilege')).toBeInTheDocument();
    expect(screen.getByText('Anti-CSRF Guard')).toBeInTheDocument();
    expect(screen.getByText('Cluster Mode')).toBeInTheDocument();
    expect(screen.getByText('Managed Tenants')).toBeInTheDocument();

    // Section 1: Session & Access Control
    expect(screen.getByText('Administrative Access & Session Control')).toBeInTheDocument();
    expect(screen.getByText('Authorization Protocol')).toBeInTheDocument();

    // Section 2: Tenant Administration Snapshot
    expect(screen.getByText('Tenant Quota & FairShare Overview')).toBeInTheDocument();
    expect(screen.getByText(/Manage FairShare Weights & Quotas/i)).toBeInTheDocument();

    // Section 3: Runtime Platform Configuration
    expect(screen.getByText('Runtime Platform & Pool Parameters')).toBeInTheDocument();
    expect(screen.getByText('HikariCP Connection Pool')).toBeInTheDocument();
    expect(screen.getByText('Worker Coordinator Parameters')).toBeInTheDocument();

    // Section 4: Security Boundaries
    expect(screen.getByText('Security Boundaries & Audit Policies')).toBeInTheDocument();
    expect(screen.getByText('Tenant Isolation')).toBeInTheDocument();
    expect(screen.getByText('Secret Masking')).toBeInTheDocument();
    expect(screen.getByText('Append-Only Audit Trail')).toBeInTheDocument();
  });
});
