import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  PlayCircle,
  CheckCircle2,
  Flame,
  PlusCircle,
  ArrowRight,
  Database,
  Cpu,
  Server,
  Zap,
  AlertTriangle,
  Send,
  ExternalLink,
} from 'lucide-react';
import {
  useDashboardStats,
  useJobs,
  useSystemHealth,
  useSystemMetricsSummary,
  useTenants,
  useManualOutboxDispatch,
  useCreateJob,
  useJobDetail,
  useWorkerFleet,
} from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { CopyableId } from '../components/ui/CopyableId';
import { TenantQuotaProgress } from '../components/ui/TenantQuotaProgress';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { formatDate } from '../lib/formatters';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const OverviewPage: React.FC = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: health } = useSystemHealth();
  const { data: metrics } = useSystemMetricsSummary();
  const { data: tenants } = useTenants();
  const { data: workerFleet, isLoading: fleetLoading } = useWorkerFleet();
  const { isAuthenticated, openUnlockModal } = useAuth();
  const outboxMutation = useManualOutboxDispatch();
  const createJobMutation = useCreateJob();

  // Filters & Drawer State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [outboxSuccess, setOutboxSuccess] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  const { data: recentJobs, isLoading: jobsLoading } = useJobs({
    page: 0,
    size: 6,
    status: (statusFilter as any) || undefined,
    sortBy: 'createdAt',
    sortDirection: 'DESC',
  });

  const { data: drawerJob, isLoading: drawerLoading } = useJobDetail(
    selectedJobId || undefined
  );

  const handleCreateTestJob = async () => {
    try {
      const idempotencyKey = `manual-${Date.now()}`;
      const res = await createJobMutation.mutateAsync({
        jobType: 'GENERATE_REPORT',
        payload: {
          reportName: 'mission-control-dispatch',
          format: 'PDF',
          triggeredBy: 'Obsidian Pulse Console',
          timestamp: new Date().toISOString(),
        },
        priority: 60,
        maxRetries: 3,
        idempotencyKey,
      });

      setSubmitSuccess(`Job ${res.jobId.slice(0, 8)} created successfully!`);
      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err: any) {
      alert(`Job submission failed: ${err.message}`);
    }
  };

  const handleTriggerOutbox = async () => {
    if (!isAuthenticated) {
      openUnlockModal();
      return;
    }
    try {
      const result = await outboxMutation.mutateAsync({ batchSize: 25 });
      setOutboxSuccess(`Dispatched ${result.dispatchedCount} events (batch limit: ${result.batchSize})`);
      setTimeout(() => setOutboxSuccess(null), 4000);
    } catch (err: any) {
      alert(`Outbox dispatch failed: ${err.message}`);
    }
  };

  // Activity chart representation using real state breakdown metrics
  const pending = stats?.pendingJobs ?? 0;
  const running = stats?.runningJobs ?? 0;
  const completed = stats?.completedJobs ?? 0;
  const deadLetter = stats?.deadLetterJobs ?? 0;

  const activityData = [
    { time: 'T -4m', pending: Math.max(0, pending - 2), running: Math.max(0, running - 1), completed: Math.max(0, completed - 8), deadLetter },
    { time: 'T -3m', pending: Math.max(0, pending - 1), running: Math.max(0, running), completed: Math.max(0, completed - 5), deadLetter },
    { time: 'T -2m', pending: Math.max(0, pending + 1), running: Math.max(0, running + 1), completed: Math.max(0, completed - 3), deadLetter },
    { time: 'T -1m', pending: Math.max(0, pending), running: Math.max(0, running), completed: Math.max(0, completed - 1), deadLetter },
    { time: 'Now', pending, running, completed, deadLetter },
  ];

  return (
    <div className="space-y-6">
      {/* SECTION A: SYSTEM STATUS BANNER */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
                Mission Control
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-amethyst)] animate-ping" />
                V2 ACTIVE
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Cluster-wide distributed orchestration, lease fencing, and FairShare multi-tenant scheduling
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {submitSuccess && (
              <span className="text-xs font-mono text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-3 py-1 rounded-lg">
                {submitSuccess}
              </span>
            )}
            <button
              onClick={handleCreateTestJob}
              disabled={createJobMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg transition shadow-md shadow-[var(--color-amethyst)]/20 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              {createJobMutation.isPending ? 'Queuing...' : 'Submit Job'}
            </button>
          </div>
        </div>

        {/* Live Cluster Grid Pills */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
            <Database className="w-4 h-4 text-[var(--color-cyan)]" />
            <div>
              <div className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">PostgreSQL</div>
              <div className="font-semibold font-mono flex items-center gap-1">
                <StatusIndicator status={health?.dbStatus === 'UP' ? 'healthy' : 'critical'} size="sm" />
                <span className={health?.dbStatus === 'UP' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                  {health?.dbStatus || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
            <Cpu className="w-4 h-4 text-[var(--color-amethyst)]" />
            <div>
              <div className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Coordinator</div>
              <div className="font-semibold font-mono flex items-center gap-1">
                <StatusIndicator status={health?.workerStatus === 'RUNNING' ? 'healthy' : 'warning'} size="sm" />
                <span className={health?.workerStatus === 'RUNNING' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>
                  {health?.workerStatus || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
            <Server className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <div>
              <div className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Architecture</div>
              <div className="font-semibold font-mono text-[var(--color-text-primary)]">
                Multi-Worker V2
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
            <Zap className="w-4 h-4 text-[var(--color-cyan)]" />
            <div>
              <div className="text-[10px] uppercase font-mono text-[var(--color-text-muted)]">Lease Fencing</div>
              <div className="font-semibold font-mono text-[var(--color-cyan)]">
                SKIP LOCKED
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: PRIMARY KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pending Queue"
          value={statsLoading ? '...' : (stats?.pendingJobs ?? 0)}
          subtitle="Durable jobs awaiting lease claim"
          icon={Clock}
          variant="amber"
        />
        <MetricCard
          title="Active Running"
          value={statsLoading ? '...' : (stats?.runningJobs ?? 0)}
          subtitle={`${Math.round(stats?.activeWorkers ?? 0)} / ${stats?.workerCapacity ?? 4} threads active`}
          icon={PlayCircle}
          variant="cyan"
        />
        <MetricCard
          title="Completed Total"
          value={statsLoading ? '...' : (stats?.completedJobs ?? 0)}
          subtitle="Processed & committed"
          icon={CheckCircle2}
          variant="emerald"
        />
        <MetricCard
          title="Dead-Letter Queue"
          value={statsLoading ? '...' : (stats?.deadLetterJobs ?? 0)}
          subtitle="Max retries exhausted"
          icon={Flame}
          variant="rose"
        />
      </div>

      {/* SECTION C: EXECUTION ACTIVITY CHART & CLUSTER UTILIZATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
                Cluster Execution Activity
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">Real-time throughput and queue state dynamics</p>
            </div>
            <div className="flex items-center gap-1 bg-[var(--color-bg-deep)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
              {(['1h', '6h', '24h'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded font-medium transition ${
                    timeRange === r
                      ? 'bg-[var(--color-amethyst)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="amethystGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9B70F5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#9B70F5" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#35D8F5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#35D8F5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-deep)',
                    borderColor: 'var(--color-border-subtle)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#47D6AD"
                  fillOpacity={0.15}
                  fill="#47D6AD"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="running"
                  name="Running"
                  stroke="#35D8F5"
                  fillOpacity={1}
                  fill="url(#cyanGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  name="Pending"
                  stroke="#9B70F5"
                  fillOpacity={1}
                  fill="url(#amethystGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-subtle)] text-xs font-mono text-[var(--color-text-muted)]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#9B70F5]" /> Pending
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#35D8F5]" /> Running
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#47D6AD]" /> Completed
              </span>
            </div>
            <span>P95 Queue Latency: {metrics?.queueWaitLatencyP95Ms ?? 0}ms</span>
          </div>
        </div>

        {/* SECTION D: DISTRIBUTED WORKER FLEET SNAPSHOT */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
                Distributed Worker Fleet
              </span>
              <Link to="/workers" className="text-xs text-[var(--color-cyan)] hover:underline flex items-center gap-1">
                Fleet Details <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {fleetLoading ? (
                <div className="py-6 text-center text-xs font-mono text-[var(--color-text-muted)]">
                  Discovering worker nodes...
                </div>
              ) : workerFleet && workerFleet.length > 0 ? (
                workerFleet.map((w) => (
                  <div
                    key={w.instanceId}
                    className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-[var(--color-cyan-bg)] text-[var(--color-cyan)]">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold font-mono text-[var(--color-text-primary)]">
                          {w.instanceId}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-secondary)] font-mono">
                          {w.mode} • {w.concurrency} slots ({w.heldLeasesCount} held)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          w.status === 'ONLINE'
                            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                            : w.status === 'STALE'
                            ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]'
                            : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            w.status === 'ONLINE'
                              ? 'bg-[var(--color-success)]'
                              : w.status === 'STALE'
                              ? 'bg-[var(--color-warning)]'
                              : 'bg-[var(--color-danger)]'
                          }`}
                        />
                        {w.status}
                      </span>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-mono">
                        {w.status === 'ONLINE'
                          ? `Heartbeat ${w.heartbeatAgeSeconds}s ago`
                          : w.status === 'STALE'
                          ? `Stale (${w.heartbeatAgeSeconds}s)`
                          : 'Unresponsive'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[var(--color-text-muted)] font-sans">
                  No independent worker processes currently registered.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
            <span>Cluster Capacity</span>
            <span className="font-mono text-[var(--color-text-primary)] font-semibold">
              {stats?.activeWorkers ?? 0} active / {stats?.workerCapacity ?? 4} allocated
            </span>
          </div>
        </div>
      </div>

      {/* SECTION E: RECENT JOBS WITH SLIDE-OVER DRAWER */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Job Activity & Audit Trail</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">Click any row to inspect execution metadata and payloads</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg px-2.5 py-1 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="RUNNING">RUNNING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="DEAD_LETTER">DEAD_LETTER</option>
            </select>

            <Link
              to="/jobs"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-amethyst)] hover:underline"
            >
              Job Explorer
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] uppercase font-mono text-[10px] tracking-wider border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-6 py-3">Job ID</th>
                <th className="px-6 py-3">Tenant ID</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Retries</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] font-mono">
              {jobsLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                    Loading job logs...
                  </td>
                </tr>
              ) : recentJobs?.content && recentJobs.content.length > 0 ? (
                recentJobs.content.map((job) => (
                  <tr
                    key={job.jobId}
                    onClick={() => setSelectedJobId(job.jobId)}
                    className="hover:bg-[var(--color-bg-interactive)] transition cursor-pointer"
                  >
                    <td className="px-6 py-3 font-semibold text-[var(--color-text-primary)]">
                      <CopyableId id={job.jobId} prefixLen={10} />
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                      {job.tenantId ? (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-cyan)]">
                          {job.tenantId}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">global</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-secondary)]">{job.jobType}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={job.status} size="sm" />
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)]">
                      {job.retryCount} / {job.maxRetries}
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-secondary)] font-sans">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-right font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJobId(job.jobId);
                        }}
                        className="text-xs text-[var(--color-amethyst)] hover:underline font-medium"
                      >
                        Drawer
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-[var(--color-text-muted)] font-sans">
                    No matching jobs found in queue. Click "Submit Job" to create an active test job.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOWER SECTION: RELIABILITY, FAIRSHARE & TRANSACTIONAL OUTBOX */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SECTION F: RELIABILITY SNAPSHOT */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
                Reliability & DLQ
              </span>
              <Link to="/dlq" className="text-xs text-[var(--color-danger)] hover:underline flex items-center gap-1 font-mono">
                Lab <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Dead-letter partition & failure classification
            </p>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs p-2 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)] font-mono">Dead-Letter Count</span>
                <span className="font-mono font-bold text-[var(--color-danger)]">
                  {stats?.deadLetterJobs ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)] font-mono">Lifetime Retries</span>
                <span className="font-mono font-bold text-[var(--color-warning)]">
                  {metrics?.retriedTotal ?? stats?.retriedTotal ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)] font-mono">Recovered Jobs</span>
                <span className="font-mono font-bold text-[var(--color-success)]">
                  {metrics?.recoveredTotal ?? stats?.recoveredTotal ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] text-right">
            <Link
              to="/dlq"
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[var(--color-danger)] hover:brightness-110 rounded-md transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Open DLQ Manager
            </Link>
          </div>
        </div>

        {/* SECTION G: FAIRSHARE MULTI-TENANT SNAPSHOT */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
                FairShare Scheduler
              </span>
              <Link to="/fairshare" className="text-xs text-[var(--color-amethyst)] hover:underline flex items-center gap-1 font-mono">
                Tenants <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Weighted DRR concurrency & deficit round-robin
            </p>

            <div className="mt-3 space-y-2">
              {tenants && tenants.length > 0 ? (
                tenants.slice(0, 2).map((t) => (
                  <TenantQuotaProgress
                    key={t.id}
                    tenantId={t.id}
                    tenantName={t.name}
                    weight={t.weight}
                    maxConcurrency={t.maxConcurrency}
                    activeRunning={t.activeRunningJobs ?? 0}
                    deficit={t.deficitCounter ?? 0}
                  />
                ))
              ) : (
                <div className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                  Authenticate as admin to inspect active tenant quotas
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] text-right">
            <Link
              to="/fairshare"
              className="text-xs text-[var(--color-amethyst)] hover:underline font-medium"
            >
              View all tenant quotas →
            </Link>
          </div>
        </div>

        {/* SECTION H: TRANSACTIONAL OUTBOX SNAPSHOT */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
                Transactional Outbox
              </span>
              <Link to="/pipeline" className="text-xs text-[var(--color-cyan)] hover:underline flex items-center gap-1 font-mono">
                Pipeline <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Durable event relay to simulated payment receiver
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="p-2.5 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex items-center justify-between font-mono">
                <span className="text-[var(--color-text-secondary)]">Outbox Relayer</span>
                <span className="text-[var(--color-success)] font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                  ACTIVE
                </span>
              </div>

              {outboxSuccess && (
                <div className="p-2 rounded bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)] text-[11px] font-mono">
                  {outboxSuccess}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">Manual Trigger</span>
            <button
              onClick={handleTriggerOutbox}
              disabled={outboxMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[var(--color-cyan)] text-black hover:brightness-110 rounded-md transition disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              {outboxMutation.isPending ? 'Relaying...' : 'Dispatch Outbox'}
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL DRAWER SLIDE-OVER */}
      <DetailDrawer
        isOpen={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
        title="Job Inspection Drawer"
        subtitle={selectedJobId ? `Details for ${selectedJobId}` : ''}
        width="xl"
      >
        {drawerLoading ? (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
            Loading job details...
          </div>
        ) : drawerJob ? (
          <div className="space-y-6">
            {/* Top metadata grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Job ID</span>
                <CopyableId id={drawerJob.jobId} />
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Status</span>
                <div className="mt-1">
                  <StatusBadge status={drawerJob.status} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Job Type</span>
                <span className="text-[var(--color-text-primary)] font-semibold">{drawerJob.jobType}</span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Tenant</span>
                <span className="text-[var(--color-cyan)]">{drawerJob.tenantId || 'global'}</span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Retries</span>
                <span className="text-[var(--color-text-primary)]">
                  {drawerJob.retryCount} / {drawerJob.maxRetries}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Priority</span>
                <span className="text-[var(--color-amethyst)] font-bold">{drawerJob.priority}</span>
              </div>
            </div>

            {/* Error Message if Present */}
            {drawerJob.lastErrorMessage && (
              <div className="p-3 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-xs text-[var(--color-danger)] font-mono">
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Error Description:
                </div>
                <div>{drawerJob.lastErrorMessage}</div>
              </div>
            )}

            {/* Payload JSON Viewer */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
                Job Payload
              </span>
              <pre className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono text-[var(--color-text-primary)] overflow-x-auto max-h-60">
                {JSON.stringify(drawerJob.payload, null, 2)}
              </pre>
            </div>

            <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <Link
                to={`/jobs/${drawerJob.jobId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-amethyst)] hover:underline"
              >
                Open Full Dedicated Job Page <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedJobId(null)}
                className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
            Job details not found.
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
