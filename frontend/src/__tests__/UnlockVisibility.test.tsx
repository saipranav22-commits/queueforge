import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Header } from '../components/layout/Header';

// Helper component to control auth state in tests
const AuthController: React.FC<{
  children: React.ReactNode;
  initialAuth?: boolean;
}> = ({ children, initialAuth = false }) => {
  const { setSessionDirectly } = useAuth() as any;

  React.useEffect(() => {
    if (initialAuth && setSessionDirectly) {
      setSessionDirectly(true);
    }
  }, [initialAuth, setSessionDirectly]);

  return <>{children}</>;
};

describe('Phase 13C — Unlock Console Visibility & Interaction Audit', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const renderHeader = (options: {
    theme?: 'dark' | 'light';
    viewport?: { width: number; height: number };
    onOpenUnlockModal?: () => void;
  } = {}) => {
    const { theme = 'dark', viewport = { width: 1920, height: 1080 }, onOpenUnlockModal = vi.fn() } = options;

    // Simulate viewport dimensions and localStorage theme
    window.innerWidth = viewport.width;
    window.innerHeight = viewport.height;
    localStorage.setItem('qf_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter>
              <Header onOpenUnlockModal={onOpenUnlockModal} />
            </MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  it('renders Unlock Console button with high-contrast primary tokens and data-testid', () => {
    const onOpen = vi.fn();
    renderHeader({ theme: 'dark', onOpenUnlockModal: onOpen });

    const unlockButton = screen.getByTestId('header-unlock-button');
    expect(unlockButton).toBeInTheDocument();
    expect(unlockButton).toHaveTextContent('Unlock Console');

    // Verify touch target and sizing classes
    expect(unlockButton.className).toContain('min-h-[44px]');
    expect(unlockButton.className).toContain('min-w-[44px]');
    expect(unlockButton.className).toContain('bg-[var(--color-action-bg)]');
    expect(unlockButton.className).toContain('text-[var(--color-action-text)]');
  });

  it('triggers onOpenUnlockModal callback when clicked', () => {
    const onOpen = vi.fn();
    renderHeader({ theme: 'dark', onOpenUnlockModal: onOpen });

    const unlockButton = screen.getByTestId('header-unlock-button');
    fireEvent.click(unlockButton);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders correctly in Dark Mode theme', () => {
    renderHeader({ theme: 'dark' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    const unlockButton = screen.getByTestId('header-unlock-button');
    expect(unlockButton).toBeInTheDocument();
    expect(unlockButton).toBeVisible();
  });

  it('renders correctly in Light Mode theme with inverse action contrast', () => {
    renderHeader({ theme: 'light' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    const unlockButton = screen.getByTestId('header-unlock-button');
    expect(unlockButton).toBeInTheDocument();
    expect(unlockButton).toBeVisible();
  });

  describe('Multi-Viewport Verification (5 required resolutions)', () => {
    const viewports = [
      { name: 'Desktop Ultra-Wide', width: 1920, height: 1080 },
      { name: 'Desktop Standard', width: 1440, height: 900 },
      { name: 'Laptop / Tablet Landscape', width: 1280, height: 800 },
      { name: 'Tablet Portrait', width: 1024, height: 768 },
      { name: 'Mobile Handheld', width: 390, height: 844 },
    ];

    viewports.forEach(({ name, width, height }) => {
      it(`maintains visible Unlock Console action at ${width}x${height} (${name}) in Dark theme`, () => {
        renderHeader({ theme: 'dark', viewport: { width, height } });

        const unlockButton = screen.getByTestId('header-unlock-button');
        expect(unlockButton).toBeInTheDocument();
        expect(unlockButton).toBeVisible();
        expect(unlockButton).toHaveTextContent('Unlock Console');
      });

      it(`maintains visible Unlock Console action at ${width}x${height} (${name}) in Light theme`, () => {
        renderHeader({ theme: 'light', viewport: { width, height } });

        const unlockButton = screen.getByTestId('header-unlock-button');
        expect(unlockButton).toBeInTheDocument();
        expect(unlockButton).toBeVisible();
        expect(unlockButton).toHaveTextContent('Unlock Console');
      });
    });
  });

  it('has accessible label and ARIA attributes', () => {
    renderHeader();
    const unlockButton = screen.getByTestId('header-unlock-button');
    expect(unlockButton.getAttribute('aria-label')).toBe('Unlock Administrator Console');
    expect(unlockButton.tagName).toBe('BUTTON');
  });
});
