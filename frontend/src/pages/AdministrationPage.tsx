import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Unlock,
  Server,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemHealth } from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';

export const AdministrationPage: React.FC = () => {
  const { isAuthenticated, openUnlockModal, logout } = useAuth();
  const { refetch, isFetching } = useSystemHealth();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Control Plane Administration
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]">
              SECURITY & OPERATIONS
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Access control, administrative session lifecycle, and distributed cluster security controls
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAuthenticated ? (
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition"
            >
              <Lock className="w-4 h-4 text-[var(--color-danger)]" />
              Lock Admin Session
            </button>
          ) : (
            <button
              onClick={() => openUnlockModal()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg transition shadow-md shadow-[var(--color-amethyst)]/20"
            >
              <Unlock className="w-4 h-4" />
              Unlock Admin Mode
            </button>
          )}
        </div>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Session Privilege"
          value={isAuthenticated ? 'ADMINISTRATOR' : 'READ-ONLY'}
          subtitle={isAuthenticated ? 'CSRF & Session tokens active' : 'State modifications locked'}
          icon={isAuthenticated ? ShieldCheck : ShieldAlert}
          variant={isAuthenticated ? 'emerald' : 'amber'}
        />
        <MetricCard
          title="Authentication Guard"
          value="CSRF PROTECTED"
          subtitle="All state-changing endpoints secured"
          icon={Key}
          variant="amethyst"
        />
        <MetricCard
          title="Cluster Mode"
          value="DISTRIBUTED V2"
          subtitle="Multi-worker lease-fenced topology"
          icon={Server}
          variant="cyan"
        />
      </div>

      {/* Session Management Box */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Administrative Session State
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              QueueForge enforces strict credential validation and anti-CSRF token verification on all mutation operations
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={`p-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition ${
              isFetching ? 'animate-spin text-[var(--color-cyan)]' : ''
            }`}
            title="Refresh Health"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
            <div className="text-[10px] uppercase text-[var(--color-text-muted)] mb-1">
              Authentication Method
            </div>
            <div className="text-[var(--color-text-primary)] font-semibold">
              Cookie Session + X-CSRF-Token
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 font-sans">
              Protects against cross-origin forgery and replay attacks.
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
            <div className="text-[10px] uppercase text-[var(--color-text-muted)] mb-1">
              Internal Service Authentication
            </div>
            <div className="text-[var(--color-text-primary)] font-semibold">
              X-Service-Key Header
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 font-sans">
              Inter-service boundary between Worker cluster and Payment Receiver.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
