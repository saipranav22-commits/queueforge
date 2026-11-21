import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSystemHealth, useWorkerFleet } from '../../hooks/useQueueForgeData';
import { Breadcrumbs } from '../ui/Breadcrumbs';
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
  RefreshCw,
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
  const { data: workers } = useWorkerFleet();

  // Dynamic status evaluation
  const dbUp = health?.dbStatus === 'UP';
  const workerRunning = health?.workerStatus === 'RUNNING';
  const hasStaleWorker = workers?.some((w) => {
    if (!w.lastHeartbeat) return true;
    const diff = (Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000;
    return diff > 15;
  });

  const getSystemStatus = () => {
    if (!health) return { label: 'CONNECTING', variant: 'muted' };
    if (!dbUp) return { label: 'DB DOWN', variant: 'critical' };
    if (!workerRunning || hasStaleWorker) return { label: 'DEGRADED', variant: 'warning' };
    return { label: 'NOMINAL', variant: 'success' };
  };

  const sysStatus = getSystemStatus();

  return (
    <header className="h-16 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-colors z-20 select-none">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] md:hidden transition"
            title="Toggle Navigation Menu"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Dynamic Context Breadcrumbs */}
        <div className="min-w-0">
          <Breadcrumbs />
        </div>

        <div className="h-4 w-px bg-[var(--color-border-subtle)] hidden lg:block" />

        {/* Cluster Operational Health Telemetry Pill */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-secondary)]">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  sysStatus.variant === 'success'
                    ? 'bg-[var(--color-success)]'
                    : sysStatus.variant === 'warning'
                    ? 'bg-[var(--color-warning)]'
                    : sysStatus.variant === 'critical'
                    ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-cyan)]'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  sysStatus.variant === 'success'
                    ? 'bg-[var(--color-success)]'
                    : sysStatus.variant === 'warning'
                    ? 'bg-[var(--color-warning)]'
                    : sysStatus.variant === 'critical'
                    ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-cyan)]'
                }`}
              />
            </span>
            <span className="font-semibold">{sysStatus.label}</span>
          </div>

          {/* Database Health Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-secondary)]">
            <Database className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="hidden xl:inline text-[var(--color-text-muted)]">DB:</span>
            <span
              className={`font-semibold ${
                dbUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              }`}
            >
              {health?.dbStatus || 'UNKNOWN'}
            </span>
          </div>

          {/* Coordinator Node Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-secondary)]">
            <Cpu className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="hidden xl:inline text-[var(--color-text-muted)]">Coordinator:</span>
            <span
              className={`font-semibold ${
                workerRunning
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-warning)]'
              }`}
            >
              {health?.workerStatus || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition"
          title="Command Palette (Ctrl+K or Cmd+K)"
          aria-label="Open Command Palette"
        >
          <Search className="w-3.5 h-3.5 text-[var(--color-cyan)]" />
          <span className="hidden sm:inline font-medium">Command</span>
          <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded text-[var(--color-text-muted)]">
            Ctrl+K
          </kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] transition"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Color Theme"
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
          title="Refresh Cluster Telemetry"
          aria-label="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
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
              aria-label="Lock Session"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] text-xs font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              Demo View
            </span>
            <button
              onClick={() => openUnlockModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[var(--color-cyan-hover)] hover:brightness-110 rounded-md transition shadow-md shadow-[var(--color-cyan-glow)]"
              style={{ color: '#030712' }}
              aria-label="Unlock Administrator Actions"
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
