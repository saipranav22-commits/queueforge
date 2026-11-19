import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSystemHealth } from '../../hooks/useQueueForgeData';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Database,
  Cpu,
  Menu,
  Sun,
  Moon,
  Search,
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenCommandPalette,
}) => {
  const { isAuthenticated, openUnlockModal, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: health, isFetching, refetch } = useSystemHealth();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Mission Control';
    if (path.startsWith('/jobs')) return 'Job Explorer';
    if (path.startsWith('/workers')) return 'Worker Fleet';
    if (path.startsWith('/fairshare')) return 'FairShare Multi-Tenant';
    if (path.startsWith('/pipeline')) return 'Event Pipeline';
    if (path.startsWith('/reliability')) return 'Reliability Lab';
    if (path.startsWith('/dlq')) return 'Dead-Letter Queue';
    if (path.startsWith('/monitoring')) return 'Observability';
    if (path.startsWith('/admin')) return 'Administration';
    return 'Console';
  };

  return (
    <header className="h-16 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-colors z-20">
      <div className="flex items-center gap-3 sm:gap-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] md:hidden transition"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Breadcrumb / Page Title */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] hidden sm:inline">
            QueueForge /
          </span>
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {getPageTitle()}
          </h1>
        </div>

        <div className="h-4 w-px bg-[var(--color-border-subtle)] hidden lg:block" />

        {/* Cluster / Architecture Status Pill */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-secondary)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-cyan)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-cyan)]"></span>
            </span>
            <span>V2 CLUSTER</span>
          </div>

          {/* DB Health Pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-secondary)]">
            <Database className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="hidden xl:inline">DB:</span>
            <span
              className={`font-semibold ${
                health?.dbStatus === 'UP' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              }`}
            >
              {health?.dbStatus || 'UNKNOWN'}
            </span>
          </div>

          {/* Coordinator Pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-secondary)]">
            <Cpu className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="hidden xl:inline">Coordinator:</span>
            <span
              className={`font-semibold ${
                health?.workerStatus === 'RUNNING'
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-warning)]'
              }`}
            >
              {health?.workerStatus || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition"
          title="Command Palette (Ctrl+K or Cmd+K)"
        >
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded text-[var(--color-text-muted)]">
            ⌘K
          </kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] transition"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[var(--color-warning)]" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--color-amethyst)]" />
          )}
        </button>

        {/* Refresh Indicator */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={`p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] transition ${
            isFetching ? 'animate-spin text-[var(--color-cyan)]' : ''
          }`}
          title="Refresh Data"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        <div className="h-4 w-px bg-[var(--color-border-subtle)]" />

        {/* Admin Authentication Status */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success)] text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin Mode</span>
            </span>
            <button
              onClick={() => logout()}
              title="Lock Admin session"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] rounded-md border border-[var(--color-border-subtle)] transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] text-xs font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              Read-Only
            </span>
            <button
              onClick={() => openUnlockModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-md transition shadow-md shadow-[var(--color-amethyst)]/20"
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
