import React from 'react';
import {
  Terminal,
  Radio,
  Sliders,
  CheckCircle2,
  Sparkles,
  Zap,
  Gauge,
  Activity,
  Layers,
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

interface IndustrialCockpitProps {
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

export const IndustrialCockpitPrototype: React.FC<IndustrialCockpitProps> = ({
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
  const onlineWorkers = Array.isArray(workers) ? workers.filter((w) => w.status === 'ONLINE').length : 0;
  const totalWorkers = Array.isArray(workers) ? workers.length : 2;
  const pendingJobs = stats?.pendingJobs ?? 0;
  const runningJobs = stats?.runningJobs ?? 0;
  const dlqJobs = stats?.deadLetterJobs ?? 0;
  const outboxProcessed = outboxStats?.deliveredCount ?? stats?.completedJobs ?? 0;

  return (
    <div className="space-y-6">
      {/* DIRECTION B: INDUSTRIAL COCKPIT CONSOLE CHASSIS */}
      <div className="p-6 rounded-lg bg-[var(--color-bg-deep)] border-2 border-[var(--color-border-standard)] shadow-md relative">
        {/* Milled Corner Fastener Accents */}
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full border border-[var(--color-border-interactive)] bg-[var(--color-bg-base)]" />
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full border border-[var(--color-border-interactive)] bg-[var(--color-bg-base)]" />
        <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full border border-[var(--color-border-interactive)] bg-[var(--color-bg-base)]" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full border border-[var(--color-border-interactive)] bg-[var(--color-bg-base)]" />

        {/* Chassis Top Bar: Annunciator Status Bank */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border-standard)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] flex items-center justify-center text-[var(--qf-accent-ember)] shadow-inner">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-dim)]">CHASSIS BAY 01</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--qf-accent-ember-subtle)] text-[var(--qf-accent-ember)] border border-[var(--qf-accent-ember-border)] font-semibold">
                  PROTOTYPE B :: INDUSTRIAL COCKPIT
                </span>
              </div>
              <h1 className="text-2xl font-bold font-mono tracking-tight text-[var(--color-text-primary)]">
                PRIMARY INSTRUMENT CONSOLE
              </h1>
            </div>
          </div>

          {/* Annunciator Panel (Segmented Indicator Banks) */}
          <div className="flex items-center gap-2 p-1 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-standard)] text-[10px] font-mono">
            <span className="px-2 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-success)] flex items-center gap-1 border border-[var(--color-border-subtle)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
              ACID LOCKED
            </span>
            <span className="px-2 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--qf-accent-brass)] flex items-center gap-1 border border-[var(--color-border-subtle)]">
              DRR BALANCED
            </span>
            <span className="px-2 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              OUTBOX 2PC
            </span>
            <span className="px-2 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--qf-accent-ember)] font-semibold border border-[var(--color-border-subtle)]">
              30s LEASE
            </span>
          </div>
        </div>

        {/* Tactical Cockpit Gauges (Segmented Bar Instrument Readouts) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          {/* Meter 1: Backlog Pressure */}
          <div className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] shadow-inner">
            <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>QUEUE BACKLOG</span>
              <span className="text-[var(--qf-accent-brass)]">METER 01</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : pendingJobs}
            </div>
            {/* Segmented LED Bar */}
            <div className="grid grid-cols-8 gap-0.5 mt-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-xs transition-colors ${
                    !isLiveOffline && i < Math.min(8, pendingJobs)
                      ? 'bg-[var(--qf-accent-brass)]'
                      : 'bg-[var(--color-border-subtle)]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Meter 2: Concurrency Load */}
          <div className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] shadow-inner">
            <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>ACTIVE LEASES</span>
              <span className="text-[var(--qf-accent-ember)]">METER 02</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : runningJobs}
            </div>
            <div className="grid grid-cols-8 gap-0.5 mt-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-xs transition-colors ${
                    !isLiveOffline && i < Math.min(8, runningJobs * 2)
                      ? 'bg-[var(--qf-accent-ember)]'
                      : 'bg-[var(--color-border-subtle)]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Meter 3: Daemon Fleet */}
          <div className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] shadow-inner">
            <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>WORKER FLEET</span>
              <span className="text-[var(--color-success)]">ONLINE</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : `${onlineWorkers}/${totalWorkers}`}
            </div>
            <div className="grid grid-cols-8 gap-0.5 mt-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-xs transition-colors ${
                    !isLiveOffline && i < (onlineWorkers > 0 ? 8 : 0)
                      ? 'bg-[var(--color-success)]'
                      : 'bg-[var(--color-border-subtle)]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Meter 4: Transactional Outbox */}
          <div className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] shadow-inner">
            <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>2PC OUTBOX</span>
              <span className="text-[var(--qf-accent-brass)]">ATOMIC</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-[var(--color-text-primary)] mt-1">
              {isLiveOffline ? '—' : outboxProcessed}
            </div>
            <div className="grid grid-cols-8 gap-0.5 mt-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-xs transition-colors ${
                    !isLiveOffline && i < 6
                      ? 'bg-[var(--qf-accent-brass)]'
                      : 'bg-[var(--color-border-subtle)]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Meter 5: Dead Letter Faults */}
          <div className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] shadow-inner">
            <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>POISON DLQ</span>
              <span className={dlqJobs > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
                {dlqJobs > 0 ? 'FAULT' : 'ISOLATED'}
              </span>
            </div>
            <div className={`text-3xl font-extrabold font-mono mt-1 ${dlqJobs > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
              {isLiveOffline ? '—' : dlqJobs}
            </div>
            <div className="grid grid-cols-8 gap-0.5 mt-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-xs transition-colors ${
                    dlqJobs > 0
                      ? 'bg-[var(--color-danger)]'
                      : !isLiveOffline
                      ? 'bg-[var(--color-success)]'
                      : 'bg-[var(--color-border-subtle)]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Operator Controls Bar */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[var(--qf-accent-ember)] animate-pulse" />
              Runtime Stream:
            </span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {isScenarioMode ? activeScenario : isLiveOffline ? 'Offline Standby' : 'Live Poller Connected'}
            </span>
          </div>

          <button
            onClick={onCreateTestJob}
            disabled={createJobPending}
            className="inline-flex items-center gap-2 h-10 px-5 text-xs font-semibold rounded bg-[var(--qf-action-primary)] text-[var(--qf-action-primary-text)] hover:bg-[var(--qf-action-primary-hover)] transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>{createJobPending ? 'Ingesting...' : 'Ingest Workload'}</span>
          </button>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 rounded bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-xs text-[var(--color-success)] flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}
      </div>

      {/* TOPOLOGY CHASSIS INTEGRATION */}
      <SystemTopology />

      {/* OPERATOR INTELLIGENCE */}
      <OperatorIntelligence />

      {/* NAVIGATION BAY */}
      <div className="p-5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)]">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] font-semibold pb-2 border-b border-[var(--color-border-subtle)]">
          DISTRIBUTED OPERATIONAL PANELS
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Link
            to="/workers"
            className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] hover:border-[var(--qf-accent-ember)] transition group"
          >
            <Cpu className="w-4 h-4 text-[var(--qf-accent-ember)]" />
            <div className="font-mono text-xs font-bold text-[var(--color-text-primary)] mt-2">Worker Fleet</div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">SKIP LOCKED & Fencing</div>
          </Link>
          <Link
            to="/fairshare"
            className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] hover:border-[var(--qf-accent-brass)] transition group"
          >
            <Scale className="w-4 h-4 text-[var(--qf-accent-brass)]" />
            <div className="font-mono text-xs font-bold text-[var(--color-text-primary)] mt-2">FairShare DRR</div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Deficit Scheduling</div>
          </Link>
          <Link
            to="/pipeline"
            className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] hover:border-[var(--qf-accent-ember)] transition group"
          >
            <GitBranch className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <div className="font-mono text-xs font-bold text-[var(--color-text-primary)] mt-2">Event Pipeline</div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Transactional Outbox</div>
          </Link>
          <Link
            to="/dlq"
            className="p-3 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-interactive)] hover:border-[var(--color-danger)] transition group"
          >
            <ShieldAlert className="w-4 h-4 text-[var(--color-danger)]" />
            <div className="font-mono text-xs font-bold text-[var(--color-text-primary)] mt-2">Reliability & DLQ</div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Poison Isolation</div>
          </Link>
        </div>
      </div>
    </div>
  );
};
