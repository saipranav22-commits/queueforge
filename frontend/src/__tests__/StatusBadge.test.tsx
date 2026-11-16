import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusBadge } from '../components/common/StatusBadge';

describe('StatusBadge', () => {
  it('renders PENDING status correctly', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('renders RUNNING status correctly', () => {
    render(<StatusBadge status="RUNNING" />);
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  it('renders COMPLETED status correctly', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('renders DEAD_LETTER status correctly', () => {
    render(<StatusBadge status="DEAD_LETTER" />);
    expect(screen.getByText('DEAD_LETTER')).toBeInTheDocument();
  });
});
