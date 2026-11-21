import React from 'react';
import {
  Clock,
  PlayCircle,
  Cpu,
  GitBranch,
  ShieldAlert,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import type { DashboardStats } from '../../types/stats';
import type { SystemHealth } from '../../types/health';
import type { WorkerInstance } from '../../types/worker';
import type { OutboxStats } from '../../types/outbox';

interface CompactTelemetryRailProps {
  stats?: DashboardStats;
  health?: SystemHealth;
  workers?: WorkerInstance[];
  outboxStats?: OutboxStats;
  provenance: 'LIVE_CONNECTED' | 'LIVE_OFFLINE' | 'SIMULATED_SCENARIO';
  scenarioName?: string;
}

export const CompactTelemetryRail: React.FC<CompactTelemetryRailProps> = ({
  stats,
  health: _health,
  workers,
  outboxStats,
  provenance,
  scenarioName,
}) => {
  const isLiveOffline = provenance === 'LIVE_OFFLINE';
  const isSimulated = provenance === 'SIMULATED_SCENARIO';

  const onlineWorkers = workers ? workers.filter((w) => w.status === 'ONLINE').length : 0;
  const totalWorkers = workers ? workers.length : 2;
  const pendingJobs = stats?.pendingJobs ?? 0;
  const runningJobs = stats?.runningJobs ?? 0;
  const dlqJobs = stats?.deadLetterJobs ?? 0;
  const outboxPending = outboxStats?.pendingCount ?? 0;
  const outboxProcessed = outboxStats?.deliveredCount ?? stats?.completedJobs ?? 0;

  // Calculate capacity utilization percentage
  const totalWorkerSlots = totalWorkers * 4; // 4 threads per worker daemon
  const threadOccupancyPct = totalWorkerSlots > 0 ? Math.min(100, Math.round((runningJobs / totalWorkerSlots) * 100)) : 0;

  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-3.5 shadow-sm">
      <div className="flex flex-col md:flex-row items-stretch justify-between gap-3">
        {/* Metric 1: Backlog Queue */}
        <div className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-[var(--color-bg-deep)]/60 border border-[var(--color-border-subtle)]/70">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
              Backlog Queue
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
              DRR Queued
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {isLiveOffline ? '—' : pendingJobs}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {isLiveOffline ? 'offline' : 'waiting claim'}
            </span>
          </div>
          <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[var(--color-accent)] h-full rounded-full transition-all duration-500"
              style={{ width: `${isLiveOffline ? 0 : Math.min(100, pendingJobs * 5)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Active Leases */}
        <div className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-[var(--color-bg-deep)]/60 border border-[var(--color-border-subtle)]/70">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <PlayCircle className="w-3.5 h-3.5 text-[var(--color-amethyst)]" />
              Active Leases
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]">
              30s Fenced
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {isLiveOffline ? '—' : runningJobs}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {isLiveOffline ? 'offline' : `${threadOccupancyPct}% load`}
            </span>
          </div>
          <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[var(--color-amethyst)] h-full rounded-full transition-all duration-500"
              style={{ width: `${isLiveOffline ? 0 : threadOccupancyPct}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Fleet Health */}
        <div className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-[var(--color-bg-deep)]/60 border border-[var(--color-border-subtle)]/70">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[var(--color-emerald)]" />
              Fleet Health
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-emerald-bg)] text-[var(--color-emerald)] border border-[var(--color-emerald-border)]">
              Heartbeats
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {isLiveOffline ? '—' : `${onlineWorkers}/${totalWorkers}`}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {isLiveOffline ? 'offline' : 'daemons up'}
            </span>
          </div>
          <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[var(--color-emerald)] h-full rounded-full transition-all duration-500"
              style={{ width: `${isLiveOffline ? 0 : (onlineWorkers / Math.max(1, totalWorkers)) * 100}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Outbox Delivery */}
        <div className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-[var(--color-bg-deep)]/60 border border-[var(--color-border-subtle)]/70">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              Outbox Delivery
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
              2PC Atomic
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {isLiveOffline ? '—' : outboxProcessed}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {isLiveOffline ? 'offline' : `${outboxPending} in-flight`}
            </span>
          </div>
          <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[var(--color-accent)] h-full rounded-full transition-all duration-500"
              style={{ width: `${isLiveOffline ? 0 : Math.min(100, (outboxProcessed / Math.max(1, outboxProcessed + outboxPending)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 5: Dead-Letter Queue */}
        <div className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-[var(--color-bg-deep)]/60 border border-[var(--color-border-subtle)]/70">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--color-danger)]" />
              Poison DLQ
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]">
              Quarantine
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className={`text-xl font-bold font-mono ${dlqJobs > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
              {isLiveOffline ? '—' : dlqJobs}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {isLiveOffline ? 'offline' : dlqJobs === 0 ? 'all clear' : 'poison isolated'}
            </span>
          </div>
          <div className="w-full bg-[var(--color-border-subtle)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${dlqJobs > 0 ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-emerald)]'}`}
              style={{ width: `${isLiveOffline ? 0 : dlqJobs > 0 ? 100 : 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Telemetry Sub-Strip: Status / Provenance Line */}
      <div className="mt-3 pt-2.5 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <Radio className={`w-3.5 h-3.5 ${isLiveOffline ? 'text-[var(--color-text-dim)]' : isSimulated ? 'text-[var(--color-warning)] animate-pulse' : 'text-[var(--color-emerald)] animate-pulse'}`} />
          <span className="text-[var(--color-text-secondary)]">Telemetry Stream:</span>
          {isLiveOffline && (
            <span className="text-[var(--color-text-muted)]">PostgreSQL & Spring Daemons Disconnected (Offline Preview)</span>
          )}
          {isSimulated && (
            <span className="text-[var(--color-warning)] font-semibold">Simulated Stream — {scenarioName}</span>
          )}
          {provenance === 'LIVE_CONNECTED' && (
            <span className="text-[var(--color-emerald)] font-semibold">Live 3000ms Polling Verified</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[var(--color-emerald)]" />
            SKIP LOCKED ACID
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[var(--color-emerald)]" />
            30s Fencing Lease
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[var(--color-emerald)]" />
            SHA-256 Idempotency
          </span>
        </div>
      </div>
    </div>
  );
};
