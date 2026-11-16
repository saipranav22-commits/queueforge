import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AdminUnlockModal } from '../components/common/AdminUnlockModal';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Helper component to trigger open modal
const TestWrapper: React.FC = () => {
  const { openUnlockModal } = useAuth();
  return (
    <div>
      <button onClick={() => openUnlockModal()}>Trigger Unlock</button>
      <AdminUnlockModal />
    </div>
  );
};

describe('AdminUnlockModal', () => {
  it('opens modal on trigger and permits entering key', async () => {
    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/session')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ authenticated: false, csrfToken: null }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ authenticated: true, csrfToken: 'mock-csrf' }),
      });
    });

    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );

    // Click trigger
    fireEvent.click(screen.getByText('Trigger Unlock'));

    expect(screen.getByText('Unlock Admin Actions')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Enter QF_ADMIN_API_KEY');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'test-admin-secret-key' } });
    fireEvent.click(screen.getByText('Authenticate & Unlock'));

    await waitFor(() => {
      expect(screen.queryByText('Unlock Admin Actions')).not.toBeInTheDocument();
    });
  });
});
