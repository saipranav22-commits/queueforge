import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  Cpu,
  Activity,
  Scale,
  GitBranch,
  ShieldAlert,
  Radio,
  Sparkles,
} from 'lucide-react';
import {
  useCreateJob,
  useJobDetail,
} from '../hooks/useQueueForgeData';
import { useScenarioAwareCluster } from '../hooks/useScenarioAwareData';
import { useScenario } from '../context/ScenarioContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { CopyableId } from '../components/ui/CopyableId';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { SystemTopology } from '../components/topology/SystemTopology';
import { CompactTelemetryRail } from '../components/telemetry/CompactTelemetryRail';
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
  const {
    provenance,
    isScenarioMode,
    activeScenarioId,
    scenarioMeta,
    stats,
    health,
    workers,
    outboxStats,
    jobs,
    dataUpdatedAt,
  } = useScenarioAwareCluster();

  const isSimulated = isScenarioMode;
  const activeScenario = scenarioMeta?.title || activeScenarioId || '';

  const { triggerSimulatedDispatch } = useScenario();
  const createJobMutation = useCreateJob();

  // Drawer & Filter State
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Bounded Client-Side Observation Ring Buffer
  const [observations, setObservations] = useState<SessionObservation[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!stats) return;
    const now = dataUpdatedAt || Date.now();
    if (now === lastUpdateRef.current) return;
    lastUpdateRef.current = now;

    const newSample: SessionObservation = {
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      pending: stats.pendingJobs ?? 0,
      running: stats.runningJobs ?? 0,
      completed: stats.completedJobs ?? 0,
    };

    setObservations((prev) => {
      const updated = [...prev, newSample];
      return updated.length > 20 ? updated.slice(updated.length - 20) : updated;
    });
  }, [stats, dataUpdatedAt]);

  const { data: drawerJob, isLoading: drawerLoading } = useJobDetail(selectedJobId || '');

  const handleCreateTestJob = async () => {
    if (isSimulated) {
      triggerSimulatedDispatch();
      setSubmitSuccess(`Simulated job queued into ${activeScenario} scenario stream! (Zero Network I/O)`);
      setTimeout(() => setSubmitSuccess(null), 4000);
      return;
    }

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

  const activeWorkerCount = workers
    ? workers.filter((w) => w.status === 'ONLINE').length
    : stats?.activeWorkers
    ? Math.round(stats.activeWorkers)
    : 0;
  const workerCapacity = stats?.workerCapacity ?? (workers ? workers.length : 2);
  const isBackendOnline = provenance === 'LIVE_CONNECTED';

  // Filter jobs by status
  const displayedJobs = jobs?.content
    ? jobs.content.filter((j: any) => (statusFilter ? j.status === statusFilter : true))
    : [];

  return (
    <div className="space-y-6">
      {/* SECTION 1: QUEUEFORGE COMMAND UNIFIED HEADER */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                QUEUEFORGE COMMAND
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] font-semibold">
                V2 DISTRIBUTED INTELLIGENCE
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] font-medium">
                ACID FENCED
              </span>
              {isSimulated && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  SIMULATION ACTIVE: {activeScenario}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 max-w-2xl leading-relaxed">
              Real-time multi-tenant execution cockpit, Deficit Round Robin scheduling, and transactional outbox verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono">
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Execution Mode</span>
              <span
                className={`font-semibold flex items-center gap-1.5 ${
                  isSimulated
                    ? 'text-[var(--color-warning)]'
                    : isBackendOnline
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                <Radio
                  className={`w-3 h-3 ${
                    isSimulated || isBackendOnline ? 'animate-pulse' : ''
                  }`}
                />
                {isSimulated
                  ? 'Deterministic Scenario'
                  : isBackendOnline
                  ? 'Live Cluster (3s Poll)'
                  : 'Live Cluster (Offline)'}
              </span>
            </div>

            <button
              onClick={handleCreateTestJob}
              disabled={!isSimulated && createJobMutation.isPending}
              className="inline-flex items-center gap-2 h-10 px-4 text-xs font-semibold rounded-lg bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)] transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{createJobMutation.isPending ? 'Ingesting...' : 'Submit Job'}</span>
            </button>
          </div>
        </div>

        {submitSuccess && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-xs text-[var(--color-success)] flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}
      </div>

      {/* SECTION 2: COMPACT HIGH-DENSITY TELEMETRY RAIL */}
      <CompactTelemetryRail
        stats={stats}
        health={health}
        workers={workers}
        outboxStats={outboxStats}
        provenance={provenance}
        scenarioName={activeScenario}
      />

      {/* SECTION 3: SIGNATURE SYSTEM TOPOLOGY WORKSPACE */}
      <SystemTopology />

      {/* SECTION 4: OPERATOR INTELLIGENCE ENGINE */}
      <OperatorIntelligence />

      {/* SECTION 5: OPERATIONAL SUBSYSTEMS & REAL OBSERVATION LEDGER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Core Subsystem Deep Links (7 cols) */}
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
                <span>Scheduler Studio</span>
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
              Bounded client observations sampled from consecutive polls in this browser session.
            </p>

            {observations.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--color-text-muted)] font-mono">
                Accumulating session observations...
              </div>
            ) : (
              <div className="mt-4 space-y-3 font-mono text-xs">
                {observations.slice(-5).map((obs, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-deep)]/70 border border-[var(--color-border-subtle)]"
                  >
                    <span className="text-[10px] text-[var(--color-text-dim)]">{obs.time}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--color-text-muted)]">
                        P: <strong className="text-[var(--color-text-primary)]">{obs.pending}</strong>
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        R: <strong className="text-[var(--color-amethyst)]">{obs.running}</strong>
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        C: <strong className="text-[var(--color-emerald)]">{obs.completed}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--color-text-muted)]">
            <span>Ring Buffer: 20 Slots Max</span>
            <span className="text-[10px] text-[var(--color-text-dim)]">Zero Memory Accumulation</span>
          </div>
        </div>
      </div>

      {/* SECTION 6: EVIDENCE-DRIVEN OPERATIONAL ACTIVITY STREAM */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                Operational Activity Stream
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                {isSimulated ? 'SCENARIO FIXTURE' : isBackendOnline ? 'LIVE TELEMETRY' : 'SCHEMA PREVIEW'}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Chronological log of job state transitions, worker lease acquisitions, and delivery confirmations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | '')}
              className="text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-lg px-2.5 py-1.5 focus:outline-none"
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
              {displayedJobs.length > 0 ? (
                displayedJobs.map((job: any) => (
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
                    {isSimulated
                      ? 'No jobs match the selected filter in this scenario fixture.'
                      : isBackendOnline
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
          {drawerLoading && !isSimulated ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)] font-mono">
              Loading job detail and execution trace...
            </div>
          ) : drawerJob || isSimulated ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Job Type:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {drawerJob?.jobType || 'PAYMENT_BATCH'}
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Status:</span>
                  <StatusBadge status={drawerJob?.status || 'RUNNING'} />
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Tenant ID:</span>
                  <span className="text-[var(--color-text-primary)]">
                    {drawerJob?.tenantId || 'tenant-enterprise'}
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Retries:</span>
                  <span>{drawerJob?.retryCount ?? 0} / {drawerJob?.maxRetries ?? 3}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-text-muted)] mb-1">
                  Payload Preview (Redacted in Public Mode)
                </h4>
                <pre className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-[11px] overflow-x-auto text-[var(--color-text-secondary)]">
                  {JSON.stringify(drawerJob?.payload || { sample: 'scenario-data', batchSize: 100 }, null, 2)}
                </pre>
              </div>

              {drawerJob?.lastErrorMessage && (
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
          ) : (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)] font-mono">
              Job record not found.
            </div>
          )}
        </DetailDrawer>
      )}
    </div>
  );
};
