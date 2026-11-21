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
  Shield,
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
} from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { CopyableId } from '../components/ui/CopyableId';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { SystemTopology } from '../components/topology/SystemTopology';
import { OperatorIntelligence } from '../components/ui/OperatorIntelligence';
import { formatDate } from '../lib/formatters';

interface SessionObservation {
  time: string;
  pending: number;
  running: number;
  completed: number;
}

export const OverviewPage: React.FC = () => {
  const { data: stats, dataUpdatedAt } = useDashboardStats();
  const { data: workerFleet } = useWorkerFleet();
  const createJobMutation = useCreateJob();

  // Drawer & Filter State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Bounded Client-Side Observation Ring Buffer (Task 13: strictly labeled "Observed in this browser session")
  const [observations, setObservations] = useState<SessionObservation[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (stats && dataUpdatedAt !== lastUpdateRef.current) {
      lastUpdateRef.current = dataUpdatedAt;
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setObservations((prev) => {
        const next = [...prev, {
          time: timeStr,
          pending: stats.pendingJobs ?? 0,
          running: stats.runningJobs ?? 0,
          completed: stats.completedJobs ?? 0,
        }];
        return next.slice(-12); // keep last 12 observation ticks
      });
    }
  }, [stats, dataUpdatedAt]);

  const { data: recentJobs, isLoading: jobsLoading } = useJobs({
    page: 0,
    size: 7,
    status: (statusFilter as any) || undefined,
    sortBy: 'createdAt',
    sortDirection: 'DESC',
  });

  const { data: drawerJob, isLoading: drawerLoading } = useJobDetail(
    selectedJobId || undefined
  );

  const handleCreateTestJob = async () => {
    try {
      const idempotencyKey = `cmd-${Date.now()}`;
      const res = await createJobMutation.mutateAsync({
        jobType: 'GENERATE_REPORT',
        payload: {
          reportName: 'command-center-dispatch',
          format: 'PDF',
          triggeredBy: 'QueueForge Command Mission Control',
          timestamp: new Date().toISOString(),
        },
        priority: 60,
        maxRetries: 3,
        idempotencyKey,
      });

      setSubmitSuccess(`Job ${res.jobId.slice(0, 8)} queued successfully!`);
      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err: any) {
      alert(`Job submission failed: ${err.message}`);
    }
  };

  const activeWorkerCount = workerFleet ? workerFleet.filter(w => w.status === 'ONLINE').length : (stats?.activeWorkers ? Math.round(stats.activeWorkers) : 0);
  const workerCapacity = stats?.workerCapacity ?? (workerFleet ? workerFleet.length : 2);

  return (
    <div className="space-y-6">
      {/* SECTION A: MISSION CONTROL STATUS BANNER */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[var(--color-cyan)] to-[var(--color-blue)] flex items-center justify-center shadow-lg shadow-[var(--color-cyan-glow)] flex-shrink-0">
              <Shield className="w-6 h-6 text-gray-950 font-bold" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
                  Mission Control
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)] font-semibold">
                  V2 ACTIVE
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                  ACID PROTECTED
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Real-time operational dashboard, multi-instance worker coordinator, and transactional outbox.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono">
              <span className="text-[var(--color-text-muted)] text-[11px] block">REFRESH INTERVAL</span>
              <span className="text-[var(--color-cyan)] font-semibold">3s TanStack Poll</span>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono">
              <span className="text-[var(--color-text-muted)] text-[11px] block">LAST HARVEST</span>
              <span className="text-[var(--color-text-secondary)]">
                {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : 'Connecting...'}
              </span>
            </div>

            <button
              onClick={handleCreateTestJob}
              disabled={createJobMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--color-cyan-hover)] text-gray-950 hover:brightness-110 shadow-md shadow-[var(--color-cyan-glow)] transition disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{createJobMutation.isPending ? 'Ingesting...' : 'Submit Job'}</span>
            </button>
          </div>
        </div>

        {submitSuccess && (
          <div className="mt-3 p-2.5 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-xs text-[var(--color-success)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitSuccess}</span>
          </div>
        )}
      </div>

      {/* SECTION B: INTERACTIVE SYSTEM TOPOLOGY */}
      <SystemTopology />

      {/* SECTION C: QUEUE OPERATIONS HUD */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--color-cyan)]" />
            <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
              Cluster Queue Telemetry
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Total Completed: <strong className="text-[var(--color-cyan)]">{stats?.completedTotal ?? stats?.completedJobs ?? 0} jobs</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Pending Queue"
            value={stats?.pendingJobs ?? 0}
            icon={Clock}
            variant="cyan"
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
            variant={stats?.deadLetterJobs && stats.deadLetterJobs > 0 ? 'rose' : 'cyan'}
            subtitle="Exhausted poison jobs isolated"
          />
        </div>
      </div>

      {/* SECTION D: OPERATOR INTELLIGENCE ENGINE */}
      <OperatorIntelligence />

      {/* SECTION E: OPERATIONAL SUBSYSTEMS & REAL TREND OBSERVATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Subsystems Navigation Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
            Core Distributed Subsystems
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Worker Fleet Card */}
            <Link
              to="/workers"
              className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-interactive)] transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)] flex items-center justify-center text-[var(--color-cyan)]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-cyan)] border border-[var(--color-border-subtle)]">
                    {activeWorkerCount}/{workerCapacity} Active
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-cyan)] transition">
                  Distributed Worker Fleet
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  PostgreSQL SKIP LOCKED concurrent claiming, 30-second lease fencing, and zombie crash recovery.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--color-cyan)]">
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
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-amethyst-bg)] border border-[var(--color-amethyst-border)] flex items-center justify-center text-[var(--color-amethyst)]">
                    <Scale className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-amethyst)] border border-[var(--color-border-subtle)]">
                    DRR Engine
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-amethyst)] transition">
                  FairShare Scheduler
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Deficit Round Robin eliminates quiet-tenant head-of-line blocking under noisy-neighbor contention.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--color-amethyst)]">
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
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] flex items-center justify-center text-[var(--color-success)]">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-success)] border border-[var(--color-border-subtle)]">
                    At-Least-Once
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-success)] transition">
                  Transactional Outbox
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Atomic domain + outbox table commits and durable SHA-256 idempotency deduplication.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--color-success)]">
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
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-danger)] border border-[var(--color-border-subtle)]">
                    {stats?.deadLetterJobs ?? 0} Isolated
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-3 group-hover:text-[var(--color-danger)] transition">
                  Reliability & DLQ
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Poison job quarantine, transient error classification, exponential backoff, and authenticated replay.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--color-danger)]">
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
                <Activity className="w-4 h-4 text-[var(--color-cyan)]" />
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
                  Session Observation Buffer
                </h4>
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
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-mono text-[var(--color-text-muted)] flex justify-between px-2">
                  <span>TIME</span>
                  <span>PENDING / RUNNING / COMPLETED</span>
                </div>
                <div className="space-y-1 font-mono text-xs max-h-[170px] overflow-y-auto">
                  {observations.slice(-5).map((obs, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex items-center justify-between text-[11px]"
                    >
                      <span className="text-[var(--color-text-muted)]">{obs.time}</span>
                      <div className="flex items-center gap-2 font-bold">
                        <span className="text-[var(--color-cyan)]">{obs.pending}</span>
                        <span className="text-[var(--color-text-muted)]">/</span>
                        <span className="text-[var(--color-amethyst)]">{obs.running}</span>
                        <span className="text-[var(--color-text-muted)]">/</span>
                        <span className="text-[var(--color-success)]">{obs.completed}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-dim)]">
            * Strictly client-sampled telemetry. Does not represent external persistent timeseries.
          </div>
        </div>
      </div>

      {/* SECTION F: RECENT OPERATOR ACTIVITY TABLE */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
              Recent Job Ingestion & Execution Activity
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Live task ledger showing priority, lease status, and tenant allocation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:border-[var(--color-cyan)] outline-none"
            >
              <option value="">All Execution Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="RUNNING">RUNNING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
              <option value="DEAD_LETTER">DEAD_LETTER</option>
            </select>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]/60 text-[10px] font-mono uppercase text-[var(--color-text-muted)] tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Job ID</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
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
                    <td className="py-2.5 px-4 font-mono font-medium text-[var(--color-cyan)]">
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
                        className="text-xs text-[var(--color-cyan)] hover:underline font-mono"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--color-text-muted)] font-mono">
                    No matching jobs in current execution slice. Click "Submit Job" to queue a task.
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
                  <span className="text-[var(--color-cyan)]">{drawerJob.tenantId}</span>
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
