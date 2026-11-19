import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusIndicator } from '../components/ui/StatusIndicator';

describe('StatusIndicator', () => {
  it('renders healthy status with pulse and label', () => {
    render(<StatusIndicator status="healthy" label="System Healthy" />);

    expect(screen.getByText('System Healthy')).toBeInTheDocument();
  });

  it('renders warning status', () => {
    render(<StatusIndicator status="warning" label="Degraded" />);

    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('renders critical status', () => {
    render(<StatusIndicator status="critical" label="Offline" />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
