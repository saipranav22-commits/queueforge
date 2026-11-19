import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TenantQuotaProgress } from '../components/ui/TenantQuotaProgress';

describe('TenantQuotaProgress', () => {
  it('renders tenant name, id, weight, and quota values', () => {
    render(
      <TenantQuotaProgress
        tenantId="tenant-alpha"
        tenantName="Alpha Corp"
        weight={5}
        maxConcurrency={10}
        activeRunning={4}
        deficit={2.5}
      />
    );

    expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
    expect(screen.getByText('tenant-alpha')).toBeInTheDocument();
    expect(screen.getByText('5x')).toBeInTheDocument();
    expect(screen.getByText('4/10')).toBeInTheDocument();
    expect(screen.getByText(/Persisted Sweep Deficit \(Di\): 2.5/)).toBeInTheDocument();
    expect(screen.getByText(/40% active/)).toBeInTheDocument();
  });

  it('renders 0% active when activeRunning is 0', () => {
    render(
      <TenantQuotaProgress
        tenantId="tenant-beta"
        tenantName="Beta Inc"
        weight={1}
        maxConcurrency={5}
        activeRunning={0}
      />
    );

    expect(screen.getByText('0/5')).toBeInTheDocument();
    expect(screen.getByText(/0% active/)).toBeInTheDocument();
  });
});
