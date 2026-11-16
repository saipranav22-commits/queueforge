import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MetricCard } from '../components/common/MetricCard';
import { Layers } from 'lucide-react';

describe('MetricCard', () => {
  it('renders title, value, and subtitle', () => {
    render(
      <MetricCard
        title="Active Workers"
        value="4 / 8"
        subtitle="Current threads running"
        icon={Layers}
        variant="blue"
      />
    );

    expect(screen.getByText('Active Workers')).toBeInTheDocument();
    expect(screen.getByText('4 / 8')).toBeInTheDocument();
    expect(screen.getByText('Current threads running')).toBeInTheDocument();
  });
});
