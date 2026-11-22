import React from 'react';
import {
  Activity,
  PlusCircle,
  Radio,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Cpu,
  Scale,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import { SystemTopology } from '../topology/SystemTopology';
import { OperatorIntelligence } from '../ui/OperatorIntelligence';
import { Link } from 'react-router-dom';
import type { DashboardStats } from '../../types/stats';
import type { SystemHealth } from '../../types/health';
import type { WorkerInstance } from '../../types/worker';
import type { OutboxStats } from '../../types/outbox';

interface PrecisionCommandProps {
  stats?: DashboardStats;
  health?: SystemHealth;
  workers?: WorkerInstance[];
  outboxStats?: OutboxStats;
  provenance: 'LIVE_CONNECTED' | 'LIVE_OFFLINE' | 'SIMULATED_SCENARIO';
  isScenarioMode: boolean;
  activeScenario: string;
  observations: Array<{ time: string; pending: number; running: number; completed: number }>;
  onCreateTestJob: () => void;
  createJobPending: boolean;
  submitSuccess: string | null;
}

export const PrecisionCommandPrototype: React.FC<PrecisionCommandProps> = ({
  stats,
  workers,
  outboxStats,
  provenance,
  isScenarioMode,
  activeScenario,
  observations,
  onCreateTestJob,
  createJobPending,
  submitSuccess,
}) => {
  const isLiveOffline = provenance === 'LIVE_OFFLINE';
  const onlineWorkers = workers ? workers.filter((w) => w.status === 'ONLINE').length : 0;
  const totalWorkers = workers ? workers.length : 2;
  const pendingJobs = stats?.pendingJobs ?? 0;
  const runningJobs = stats?.runningJobs ?? 0;
  const dlqJobs = stats?.deadLetterJobs ?? 0;
  const outboxProcessed = outboxStats?.deliveredCount ?? stats?.completedJobs ?? 0;

  return (
    <div className="space-y-6">
      {/* DIRECTION A: PRECISION COMMAND HERO */}
      <div className="p-6 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] shadow-sm relative overflow-hidden">
        {/* Subtle Brass Corner Tick */}
        <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-[var(--qf-accent-brass)] opacity-40 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-5 border-b border-[var(--color-border-subtle)]">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono font-semibold tracking-widest uppercase text-[var(--qf-accent-brass)]">
                PRECISION COMMAND :: PROTOTYPE A
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-standard)] text-[var(--color-text-secondary)]">
                TITANIUM × EMBER
              </span>
              {isScenarioMode && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  SCENARIO: {activeScenario}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)] mt-2 font-mono">
              QUEUEFORGE / COMMAND 01
            </h1>

            <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-2xl leading-relaxed">
              Precision distributed job-processing cockpit. Deficit Round Robin concurrency management, 30-second advisory lease fencing, and transactional outbox atomic commits.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="px-3.5 py-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-standard)] font-mono text-xs">
              <span className="text-[9.5px] uppercase tracking-wider text-[var(--color-text-muted)] block">Telemetry Bus</span>
              <span className={`font-semibold flex items-center gap-1.5 ${isScenarioMode ? 'text-[var(--color-warning)]' : !isLiveOffline ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dim)]'}`}>
                <Radio className={`w-3 h-3 ${!isLiveOffline || isScenarioMode ? 'animate-pulse' : ''}`} />
                {isScenarioMode ? 'Deterministic Stream' : !isLiveOffline ? 'Live Cluster Polling' : 'Backend Disconnected'}
              </span>
            </div>

            <button
              onClick={onCreateTestJob}
              disabled={createJobPending}
              className="inline-flex items-center gap-2 h-11 px-5 text-xs font-semibold rounded bg-[var(--qf-action-primary)] text-[var(--qf-action-primary-text)] hover:bg-[var(--qf-action-primary-hover)] transition-all shadow-[0_2px_12px_rgba(230,107,53,0.35)] active:scale-95 disabled:opacity-50 cursor-pointer select-none"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{createJobPending ? 'Ingesting...' : 'Ingest Workload'}</span>
            </button>
          </div>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 rounded bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-xs text-[var(--color-success)] flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {/* INTEGRATED PRECISION TELEMETRY STRIP (Not boxed cards — unified calibrated ruler) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0 mt-5 pt-4 border-t border-[var(--color-border-subtle)] divide-y md:divide-y-0 md:divide-x divide-[var(--color-border-subtle)]">
          {/* Gauge 1: Backlog */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Queue Backlog
              </span>
              <span className="text-[9px] font-mono text-[var(--qf-accent-brass)]">DRR</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : pendingJobs}
            </div>
            <div className="w-full bg-[var(--color-bg-base)] h-1 rounded mt-2 overflow-hidden border border-[var(--color-border-subtle)]">
              <div
                className="bg-[var(--qf-accent-brass)] h-full transition-all duration-300"
                style={{ width: `${isLiveOffline ? 0 : Math.min(100, pendingJobs * 5)}%` }}
              />
            </div>
          </div>

          {/* Gauge 2: Active Leases */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Active Leases
              </span>
              <span className="text-[9px] font-mono text-[var(--qf-accent-ember)]">30s Fenced</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : runningJobs}
            </div>
            <div className="w-full bg-[var(--color-bg-base)] h-1 rounded mt-2 overflow-hidden border border-[var(--color-border-subtle)]">
              <div
                className="bg-[var(--qf-accent-ember)] h-full transition-all duration-300"
                style={{ width: `${isLiveOffline ? 0 : Math.min(100, runningJobs * 25)}%` }}
              />
            </div>
          </div>

          {/* Gauge 3: Worker Fleet */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Cluster Fleet
              </span>
              <span className="text-[9px] font-mono text-[var(--color-success)]">Heartbeats</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : `${onlineWorkers}/${totalWorkers}`}
            </div>
            <div className="w-full bg-[var(--color-bg-base)] h-1 rounded mt-2 overflow-hidden border border-[var(--color-border-subtle)]">
              <div
                className="bg-[var(--color-success)] h-full transition-all duration-300"
                style={{ width: `${isLiveOffline ? 0 : (onlineWorkers / Math.max(1, totalWorkers)) * 100}%` }}
              />
            </div>
          </div>

          {/* Gauge 4: Outbox Delivery */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Outbox Delivery
              </span>
              <span className="text-[9px] font-mono text-[var(--qf-accent-brass)]">2PC Atomic</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : outboxProcessed}
            </div>
            <div className="w-full bg-[var(--color-bg-base)] h-1 rounded mt-2 overflow-hidden border border-[var(--color-border-subtle)]">
              <div
                className="bg-[var(--qf-accent-brass)] h-full transition-all duration-300"
                style={{ width: `${isLiveOffline ? 0 : 85}%` }}
              />
            </div>
          </div>

          {/* Gauge 5: Poison DLQ */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Poison Isolation
              </span>
              <span className={`text-[9px] font-mono ${dlqJobs > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                {dlqJobs > 0 ? 'Quarantine' : 'Clear'}
              </span>
            </div>
            <div className={`text-2xl font-bold font-mono mt-1 ${dlqJobs > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
              {isLiveOffline ? '—' : dlqJobs}
            </div>
            <div className="w-full bg-[var(--color-bg-base)] h-1 rounded mt-2 overflow-hidden border border-[var(--color-border-subtle)]">
              <div
                className={`h-full transition-all duration-300 ${dlqJobs > 0 ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'}`}
                style={{ width: `${isLiveOffline ? 0 : 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TOPOLOGY WORKSPACE */}
      <SystemTopology />

      {/* OPERATOR INTELLIGENCE */}
      <OperatorIntelligence />

      {/* ASYMMETRIC DEEP DRILL-DOWN PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Core Subsystem Links (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--color-border-subtle)]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] font-semibold">
              ENGINEERING SUBSYSTEM DIRECTORY
            </span>
            <span className="text-[9.5px] font-mono text-[var(--qf-accent-brass)]">4 Active Contracts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/workers"
              className="p-4 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] hover:border-[var(--color-border-interactive)] transition group"
            >
              <div className="flex items-center justify-between">
                <Cpu className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--qf-accent-ember)] transition" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>
              <h3 className="text-sm font-semibold font-mono text-[var(--color-text-primary)] mt-2">
                Worker Fleet
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                PostgreSQL SKIP LOCKED lease concurrency and heartbeat crash recovery.
              </p>
            </Link>

            <Link
              to="/fairshare"
              className="p-4 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] hover:border-[var(--color-border-interactive)] transition group"
            >
              <div className="flex items-center justify-between">
                <Scale className="w-4 h-4 text-[var(--qf-accent-brass)] transition" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>
              <h3 className="text-sm font-semibold font-mono text-[var(--color-text-primary)] mt-2">
                FairShare DRR
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Deficit Round Robin queueing eliminates noisy-neighbor tenant starvation.
              </p>
            </Link>

            <Link
              to="/pipeline"
              className="p-4 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] hover:border-[var(--color-border-interactive)] transition group"
            >
              <div className="flex items-center justify-between">
                <GitBranch className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--qf-accent-ember)] transition" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>
              <h3 className="text-sm font-semibold font-mono text-[var(--color-text-primary)] mt-2">
                Transactional Outbox
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Atomic local commit and guaranteed SHA-256 idempotency verification.
              </p>
            </Link>

            <Link
              to="/dlq"
              className="p-4 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] hover:border-[var(--color-border-interactive)] transition group"
            >
              <div className="flex items-center justify-between">
                <ShieldAlert className="w-4 h-4 text-[var(--color-danger)] transition" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>
              <h3 className="text-sm font-semibold font-mono text-[var(--color-text-primary)] mt-2">
                Reliability & DLQ
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Quarantine isolation, exponential backoff, and signed replay authorization.
              </p>
            </Link>
          </div>
        </div>

        {/* Real Session Observation Ledger (5 cols) */}
        <div className="lg:col-span-5 p-4 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[var(--qf-accent-brass)]" />
                SESSION TELEMETRY LOG
              </span>
              <span className="text-[9.5px] font-mono text-[var(--color-text-muted)]">
                {observations.length} SAMPLES
              </span>
            </div>

            <div className="mt-3 space-y-2 font-mono text-xs">
              {observations.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                  Connecting to cluster poll telemetry...
                </div>
              ) : (
                observations.slice(-5).map((obs, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]"
                  >
                    <span className="text-[10px] text-[var(--color-text-dim)]">{obs.time}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--color-text-muted)]">
                        P: <strong className="text-[var(--color-text-primary)]">{obs.pending}</strong>
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        R: <strong className="text-[var(--qf-accent-ember)]">{obs.running}</strong>
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        C: <strong className="text-[var(--color-success)]">{obs.completed}</strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" />
              ACID Fenced
            </span>
            <span>O(1) Deficit Scheduling</span>
          </div>
        </div>
      </div>
    </div>
  );
};
