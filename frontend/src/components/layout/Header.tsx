import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useScenario } from '../../context/ScenarioContext';
import { useSystemHealth, useWorkerFleet } from '../../hooks/useQueueForgeData';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { ScenarioSelectorMenu } from '../common/ScenarioSelectorMenu';
import {
  Lock,
  Unlock,
  Menu,
  Sun,
  Moon,
  Search,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenUnlockModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenCommandPalette,
  onOpenUnlockModal,
}) => {
  const { isAuthenticated, openUnlockModal, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isScenarioMode, activeScenario, scenarioHealth } = useScenario();
  const { data: health, isFetching, refetch } = useSystemHealth();
  const { data: workers } = useWorkerFleet();

  const handleUnlockClick = () => {
    onOpenUnlockModal?.();
    openUnlockModal();
  };

  // Dynamic status evaluation
  const effectiveHealth = isScenarioMode ? scenarioHealth : health;
  const dbUp = isScenarioMode ? true : effectiveHealth?.dbStatus === 'UP';
  const workerRunning = isScenarioMode ? true : effectiveHealth?.workerStatus === 'RUNNING';
  const hasStaleWorker = isScenarioMode
    ? false
    : workers?.some((w) => {
        if (!w.lastHeartbeat) return true;
        const diff = (Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000;
        return diff > 15;
      });

  const getSystemStatus = () => {
    if (isScenarioMode && activeScenario) {
      return { label: `SIM: ${activeScenario.badge}`, variant: 'warning' as const };
    }
    if (!health) return { label: 'CONNECTING', variant: 'muted' as const };
    if (!dbUp) return { label: 'DB OFFLINE', variant: 'critical' as const };
    if (!workerRunning || hasStaleWorker) return { label: 'DEGRADED', variant: 'warning' as const };
    return { label: 'NOMINAL', variant: 'success' as const };
  };

  const sysStatus = getSystemStatus();

  return (
    <header className="h-16 border-b border-[var(--color-border-standard)] bg-[var(--color-bg-deep)]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-colors z-20 select-none shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
      {/* LEFT SECTION: Menu Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] md:hidden transition cursor-pointer"
            title="Toggle Navigation Menu"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Dynamic Context Breadcrumbs */}
        <div className="hidden sm:block min-w-0">
          <Breadcrumbs />
        </div>

        <div className="h-4 w-px bg-[var(--color-border-subtle)] hidden lg:block" />

        {/* Consolidated System Health Status (Quiet & Intentional) */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-xs font-mono">
          <span className="relative flex h-2 w-2">
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                sysStatus.variant === 'success'
                  ? 'bg-[var(--color-success)]'
                  : sysStatus.variant === 'warning'
                  ? 'bg-[var(--color-warning)]'
                  : sysStatus.variant === 'critical'
                  ? 'bg-[var(--color-danger)]'
                  : 'bg-[var(--color-text-muted)]'
              }`}
            />
          </span>
          <span className="font-semibold text-[var(--color-text-primary)] tracking-wide">
            {sysStatus.label}
          </span>
          <span className="text-[var(--color-border-subtle)]">|</span>
          <span className="text-[var(--color-text-muted)]">
            DB: <strong className={dbUp ? 'text-[var(--color-success)] font-semibold' : 'text-[var(--color-text-secondary)]'}>{isScenarioMode ? 'SIMULATED (PG 16)' : health?.dbStatus || 'OFFLINE'}</strong>
          </span>
        </div>
      </div>

      {/* RIGHT SECTION: Operational Controls & Primary Auth Action */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Scenario Explorer Selector */}
        <ScenarioSelectorMenu />

        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:inline-flex items-center gap-2 h-10 px-3 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition cursor-pointer"
          title="Command Palette (Ctrl+K or Cmd+K)"
          aria-label="Open Command Palette"
        >
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span className="font-medium">Command</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded text-[var(--color-text-muted)]">
            Ctrl+K
          </kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] transition cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Color Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[var(--color-warning)]" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--color-accent)]" />
          )}
        </button>

        {/* Refresh Telemetry Button */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={`inline-flex items-center justify-center h-10 w-10 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] transition cursor-pointer ${
            isFetching ? 'animate-spin text-[var(--color-text-primary)]' : ''
          }`}
          title="Refresh Cluster Telemetry"
          aria-label="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-[var(--color-border-subtle)] mx-0.5" />

        {/* PRIMARY AUTHENTICATION CONTROL (Highest visual priority, minimum 44px practical target) */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
              <span className="font-mono text-xs font-semibold whitespace-nowrap">Operator Session</span>
            </div>
            <button
              onClick={() => logout()}
              title="Lock Operator session"
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] rounded-lg border border-[var(--color-border-subtle)] transition cursor-pointer"
              aria-label="Lock Session"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleUnlockClick}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 min-h-[44px] min-w-[44px] text-xs font-semibold rounded-lg bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] transition-all shadow-[0_2px_10px_rgba(230,107,53,0.3)] hover:shadow-[0_4px_16px_rgba(230,107,53,0.45)] active:scale-95 cursor-pointer select-none"
            title="Unlock Administrator Console"
            aria-label="Unlock Administrator Console"
            data-testid="header-unlock-button"
          >
            <Unlock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap font-medium tracking-wide">Unlock Console</span>
          </button>
        )}
      </div>
    </header>
  );
};
