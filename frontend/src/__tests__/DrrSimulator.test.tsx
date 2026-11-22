import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DrrSimulator } from '../components/ui/DrrSimulator';

describe('DrrSimulator', () => {
  it('renders simulator title, tenant deficit counters, and controls', () => {
    render(<DrrSimulator />);

    expect(screen.getByText(/Educational Simulator: Deficit Round-Robin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simulate Sweep/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    expect(screen.getByText('Batch Flood (Heavy)')).toBeInTheDocument();
    expect(screen.getByText('Interactive User A (Quiet)')).toBeInTheDocument();
    expect(screen.getByText('Interactive User B (Quiet)')).toBeInTheDocument();
  });

  it('steps through DRR sweep and updates round counter', () => {
    render(<DrrSimulator />);

    const sweepBtn = screen.getByRole('button', { name: /Simulate Sweep/i });
    fireEvent.click(sweepBtn);

    expect(screen.getByRole('button', { name: /Simulate Sweep \(Round 2\)/i })).toBeInTheDocument();
  });

  it('resets simulator state back to initial round', () => {
    render(<DrrSimulator />);

    const sweepBtn = screen.getByRole('button', { name: /Simulate Sweep/i });
    fireEvent.click(sweepBtn);
    expect(screen.getByRole('button', { name: /Simulate Sweep \(Round 2\)/i })).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);
    expect(screen.getByRole('button', { name: /Simulate Sweep \(Round 1\)/i })).toBeInTheDocument();
  });
});
