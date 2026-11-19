import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AdminUnlockModal } from '../components/common/AdminUnlockModal';
import { AuthProvider, useAuth } from '../context/AuthContext';

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
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens modal on trigger and permits entering key successfully', async () => {
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

    fireEvent.click(screen.getByText('Trigger Unlock'));

    expect(screen.getByText('Unlock Admin Actions')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Enter QF_ADMIN_API_KEY');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'qf_admin_dev_secret_2026' } });
    fireEvent.click(screen.getByText('Authenticate & Unlock'));

    await waitFor(() => {
      expect(screen.queryByText('Unlock Admin Actions')).not.toBeInTheDocument();
    });
  });

  it('validates empty submission', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ authenticated: false, csrfToken: null }),
      })
    );

    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Trigger Unlock'));
    fireEvent.click(screen.getByText('Authenticate & Unlock'));

    expect(screen.getByText('Please enter the administrative API key.')).toBeInTheDocument();
  });

  it('warns user if username:password pattern is entered', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ authenticated: false, csrfToken: null }),
      })
    );

    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Trigger Unlock'));
    const input = screen.getByPlaceholderText('Enter QF_ADMIN_API_KEY');
    fireEvent.change(input, { target: { value: 'admin:password123' } });
    fireEvent.click(screen.getByText('Authenticate & Unlock'));

    expect(
      screen.getByText(/QueueForge authenticates using an Administrator API Key \(not a username and password\)/i)
    ).toBeInTheDocument();
  });

  it('displays distinguished error message on 401 invalid key', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/session')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ authenticated: false, csrfToken: null }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Invalid administrative authentication key' }),
      });
    });

    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Trigger Unlock'));
    const input = screen.getByPlaceholderText('Enter QF_ADMIN_API_KEY');
    fireEvent.change(input, { target: { value: 'wrong-key' } });
    fireEvent.click(screen.getByText('Authenticate & Unlock'));

    await waitFor(() => {
      expect(
        screen.getByText(/Invalid administrative API key\. Please check your QF_ADMIN_API_KEY/i)
      ).toBeInTheDocument();
    });
  });

  it('displays distinguished error message on backend unavailable (status 0)', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/session')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ authenticated: false, csrfToken: null }),
        });
      }
      return Promise.reject(new TypeError('Failed to fetch'));
    });

    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Trigger Unlock'));
    const input = screen.getByPlaceholderText('Enter QF_ADMIN_API_KEY');
    fireEvent.change(input, { target: { value: 'any-key' } });
    fireEvent.click(screen.getByText('Authenticate & Unlock'));

    await waitFor(() => {
      expect(
        screen.getByText(/Backend service unavailable \(connection refused at http:\/\/127\.0\.0\.1:8085\)/i)
      ).toBeInTheDocument();
    });
  });

  it('toggles password visibility with show/hide button', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ authenticated: false, csrfToken: null }),
      })
    );

    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Trigger Unlock'));
    const input = screen.getByPlaceholderText('Enter QF_ADMIN_API_KEY') as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggleBtn = screen.getByLabelText('Show administrative key');
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('text');

    fireEvent.click(screen.getByLabelText('Hide administrative key'));
    expect(input.type).toBe('password');
  });

  it('closes on Escape key press', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ authenticated: false, csrfToken: null }),
      })
    );

    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Trigger Unlock'));
    expect(screen.getByText('Unlock Admin Actions')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Unlock Admin Actions')).not.toBeInTheDocument();
  });
});
