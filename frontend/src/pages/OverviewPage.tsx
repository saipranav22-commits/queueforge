import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  PlayCircle,
  CheckCircle2,
  Flame,
  PlusCircle,
  ArrowRight,
  Cpu,
  Layers,
  Activity,
  Scale,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import {
  useDashboardStats,
  useJobs,
  useCreateJob,
  useJobDetail,
  useWorkerFleet,
  useSystemHealth,
} from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { CopyableId } from '../components/ui/CopyableId';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { SystemTopology } from '../components/topology/SystemTopology';
import { OperatorIntelligence } from '../components/ui/OperatorIntelligence';
import { formatDate } from '../lib/formatters';
import type { JobStatus } from '../types/job';

interface SessionObservation {
  time: string;
  pending: number;
  running: number;
  completed: number;
}

export const OverviewPage: React.FC = () => {
  const { data: stats, dataUpdatedAt } = useDashboardStats();
  const { data: workerFleet } = useWorkerFleet();
  const { data: health } = useSystemHealth();
  const createJobMutation = useCreateJob();

  // Drawer & Filter State
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Bounded Client-Side Observation Ring Buffer (Task 13: strictly labeled "Observed in this browser session")
  const [observations, setObservations] = useState<SessionObservation[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!stats || !dataUpdatedAt) return;
    if (dataUpdatedAt === lastUpdateRef.current) return;
    lastUpdateRef.current = dataUpdatedAt;

    const newSample: SessionObservation = {
      time: new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      pending: stats.pendingJobs ?? 0,
      running: stats.runningJobs ?? 0,
      completed: stats.completedJobs ?? 0,
    };

    setObservations((prev) => {
      const updated = [...prev, newSample];
      return updated.length > 20 ? updated.slice(updated.length - 20) : updated;
    });
  }, [stats, dataUpdatedAt]);

  const { data: recentJobs, isLoading: jobsLoading } = useJobs({
    page: 0,
    size: 6,
    status: statusFilter || undefined,
  });

  const { data: drawerJob, isLoading: drawerLoading } = useJobDetail(selectedJobId || '');

  const handleCreateTestJob = async () => {
    try {
      const res = await createJobMutation.mutateAsync({
        jobType: 'PAYMENT_BATCH',
        tenantId: 'tenant-enterprise',
        priority: 1,
        payload: {
          batchId: `batch_${Date.now()}`,
          records: 125,
          timestamp: new Date().toISOString(),
          requestedBy: 'operator-console',
        },
      });

      setSubmitSuccess(`Job ${res.jobId.slice(0, 8)} queued successfully!`);
      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err: any) {
      alert(`Job submission failed: ${err.message}`);
    }
  };

  const activeWorkerCount = workerFleet ? workerFleet.filter(w => w.status === 'ONLINE').length : (stats?.activeWorkers ? Math.round(stats.activeWorkers) : 0);
  const workerCapacity = stats?.workerCapacity ?? (workerFleet ? workerFleet.length : 2);
  const isBackendOnline = Boolean(health);

  return (
    <div className="space-y-6">
      {/* SECTION A: CONFIDENT OPERATIONAL HEADER */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                Mission Control
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] font-medium">
                V2 ACTIVE
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] font-medium">
                ACID PROTECTED
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 max-w-2xl leading-relaxed">
              Distributed execution, scheduling and delivery intelligence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono">
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Cluster Connection</span>
              <span className={`font-semibold ${isBackendOnline ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
                {isBackendOnline ? 'Live 3s Telemetry' : 'Offline Preview Mode'}
              </span>
            </div>

            <button
              onClick={handleCreateTestJob}
              disabled={createJobMutation.isPending}
              className="inline-flex items-center gap-2 h-10 px-4 text-xs font-semibold rounded-lg bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)] transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{createJobMutation.isPending ? 'Ingesting...' : 'Submit Job'}</span>
            </button>
          </div>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-xs text-[var(--color-success)] flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitSuccess}</span>
          </div>
        )}
      </div>

      {/* SECTION B: CORE SYSTEM METRICS STRIP */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--color-text-muted)]" />
            <h2 className="text-xs font-semibold uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
              Cluster Queue Telemetry
            </h2>
          </div>
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            Total Completed: <strong className="text-[var(--color-text-primary)]">{stats?.completedTotal ?? stats?.completedJobs ?? 0} jobs</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Pending Queue"
            value={stats?.pendingJobs ?? 0}
            icon={Clock}
            subtitle="Waiting for DRR worker claim"
          />
          <MetricCard
            title="Active Running"
            value={stats?.runningJobs ?? 0}
            icon={PlayCircle}
            variant="amethyst"
            subtitle="Time-bounded 30s lease execution"
          />
          <MetricCard
            title="Completed Total"
            value={stats?.completedJobs ?? 0}
            icon={CheckCircle2}
            variant="emerald"
            subtitle="Successfully executed jobs"
          />
          <MetricCard
            title="Dead-Letter Queue"
            value={stats?.deadLetterJobs ?? 0}
            icon={Flame}
            variant={stats?.deadLetterJobs && stats.deadLetterJobs > 0 ? 'rose' : 'default'}
            subtitle="Exhausted poison jobs isolated"
          />
        </div>
      </div>

      {/* SECTION C: MAIN TOPOLOGY WORKSPACE (2/3 + 1/3) */}
      <SystemTopology />

      {/* SECTION D: OPERATOR INTELLIGENCE ENGINE */}
      <OperatorIntelligence />

      {/* SECTION E: OPERATIONAL SUBSYSTEMS & REAL TREND OBSERVATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Subsystems Navigation Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-xs font-semibold uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
            Core Distributed Subsystems
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Worker Fleet Card */}
            <Link
              to="/workers"
              className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-interactive)] transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                    {activeWorkerCount}/{workerCapacity} Active
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-accent)] transition">
                  Distributed Worker Fleet
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  PostgreSQL SKIP LOCKED concurrent claiming, 30-second lease fencing, and zombie crash recovery.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-medium text-[var(--color-text-primary)]">
                <span>Inspect Fleet</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* FairShare Card */}
            <Link
              to="/fairshare"
              className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-interactive)] transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-bg)] border border-[var(--color-accent-border)] flex items-center justify-center text-[var(--color-accent)]">
                    <Scale className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent-border)]">
                    DRR Engine
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-accent)] transition">
                  FairShare Scheduler
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Deficit Round Robin eliminates quiet-tenant head-of-line blocking under noisy-neighbor contention.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-medium text-[var(--color-accent)]">
                <span>Scheduler Lab</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Event Pipeline Card */}
            <Link
              to="/pipeline"
              className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-interactive)] transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)]">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                    At-Least-Once
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-accent)] transition">
                  Transactional Outbox
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Atomic domain + outbox table commits and durable SHA-256 idempotency deduplication.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-medium text-[var(--color-text-primary)]">
                <span>View Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Reliability & DLQ Card */}
            <Link
              to="/dlq"
              className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-interactive)] transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] flex items-center justify-center text-[var(--color-danger)]">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                    {stats?.deadLetterJobs ?? 0} Isolated
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-danger)] transition">
                  Reliability & DLQ
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Poison job quarantine, transient error classification, exponential backoff, and authenticated replay.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-medium text-[var(--color-danger)]">
                <span>Manage Recovery</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>

        {/* Real Session Trend Observations (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--color-text-muted)]" />
                <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
                  Session Observation Buffer
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                {observations.length} Samples
              </span>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Bounded client observations sampled from consecutive 3-second polls in this browser session.
            </p>

            {observations.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--color-text-muted)] font-mono">
                Accumulating session observations...
              </div>
            ) : (
              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border-subtle)] pb-1.5">
                  <span>SAMPLE TIME</span>
                  <div className="flex gap-4">
                    <span className="text-[var(--color-text-primary)]">PENDING</span>
                    <span className="text-[var(--color-accent)]">RUNNING</span>
                    <span className="text-[var(--color-success)]">DONE</span>
                  </div>
                </div>
                {observations.slice(-5).map((obs, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-[11px] py-1 border-b border-[var(--color-border-subtle)]/50 last:border-0"
                  >
                    <span className="text-[var(--color-text-muted)]">{obs.time}</span>
                    <div className="flex gap-4 tabular-nums font-semibold">
                      <span className="text-[var(--color-text-primary)] w-10 text-right">{obs.pending}</span>
                      <span className="text-[var(--color-accent)] w-10 text-right">{obs.running}</span>
                      <span className="text-[var(--color-success)] w-10 text-right">{obs.completed}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--color-text-muted)]">
            <span>Ring Capacity: 20 Samples</span>
            <span className="text-[var(--color-text-secondary)]">Client-Bounded Memory</span>
          </div>
        </div>
      </div>

      {/* SECTION F: RECENT EXECUTION LEDGER */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
              Recent Execution Ledger
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Live transactional records persisted in PostgreSQL queue store.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | '')}
              className="text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg px-2.5 py-1.5 text-[var(--color-text-secondary)] outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="RUNNING">RUNNING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="DEAD_LETTER">DEAD_LETTER</option>
            </select>

            <Link
              to="/jobs"
              className="text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition flex items-center gap-1 font-mono"
            >
              <span>Full Explorer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="py-2.5 px-4 font-semibold">Job ID</th>
                <th className="py-2.5 px-4 font-semibold">Job Type</th>
                <th className="py-2.5 px-4 font-semibold">Tenant</th>
                <th className="py-2.5 px-4 font-semibold">Priority</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Created At</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {jobsLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--color-text-muted)] font-mono">
                    Polling jobs ledger...
                  </td>
                </tr>
              ) : recentJobs?.content && recentJobs.content.length > 0 ? (
                recentJobs.content.map((job) => (
                  <tr
                    key={job.jobId}
                    onClick={() => setSelectedJobId(job.jobId)}
                    className="hover:bg-[var(--color-bg-interactive)] cursor-pointer transition"
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-[var(--color-text-primary)]">
                      <CopyableId id={job.jobId} prefixLen={8} />
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[var(--color-text-primary)]">
                      {job.jobType}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[var(--color-text-muted)]">
                      {job.tenantId}
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                        P{job.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-2.5 px-4 text-[var(--color-text-muted)] font-mono text-[11px]">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJobId(job.jobId);
                        }}
                        className="text-xs text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline font-mono cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--color-text-muted)] font-mono">
                    {isBackendOnline
                      ? 'No matching jobs in current execution slice. Click "Submit Job" to queue a task.'
                      : 'Backend Offline — Job queue telemetry unavailable in preview mode.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL INSPECTION DRAWER */}
      {selectedJobId && (
        <DetailDrawer
          isOpen={Boolean(selectedJobId)}
          onClose={() => setSelectedJobId(null)}
          title={`Job Inspector — #${selectedJobId.slice(0, 8)}`}
        >
          {drawerLoading || !drawerJob ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)] font-mono">
              Loading job detail and execution trace...
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Job Type:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">{drawerJob.jobType}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Status:</span>
                  <StatusBadge status={drawerJob.status} />
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Tenant ID:</span>
                  <span className="text-[var(--color-text-primary)]">{drawerJob.tenantId}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Retries:</span>
                  <span>{drawerJob.retryCount} / {drawerJob.maxRetries}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-text-muted)] mb-1">
                  Payload Preview (Redacted in Public Mode)
                </h4>
                <pre className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-[11px] overflow-x-auto text-[var(--color-text-secondary)]">
                  {JSON.stringify(drawerJob.payload, null, 2)}
                </pre>
              </div>

              {drawerJob.lastErrorMessage && (
                <div>
                  <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-danger)] mb-1">
                    Captured Error Diagnostic
                  </h4>
                  <pre className="p-3 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] font-mono text-[11px] overflow-x-auto text-[var(--color-danger)]">
                    {drawerJob.lastErrorMessage}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DetailDrawer>
      )}
    </div>
  );
};
