import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConfirmModal } from '../components/common/ConfirmModal';

describe('ConfirmModal', () => {
  it('renders title, message, and executes confirmation callback', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="Discard Job Confirmation"
        message="Are you sure you want to discard this dead-letter job?"
        confirmLabel="Discard Job"
        variant="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Discard Job Confirmation')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to discard this dead-letter job\?/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    const confirmBtn = screen.getByRole('button', { name: /Discard Job/i });
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press when open', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="Replay Job"
        message="Replay job message"
        confirmLabel="Replay"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal
        isOpen={false}
        title="Replay Job"
        message="Replay job message"
        confirmLabel="Replay"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
