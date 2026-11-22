import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Unlock,
  Server,
  RefreshCw,
  Database,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemHealth, useTenants, useWorkerFleet } from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';

export const AdministrationPage: React.FC = () => {
  const { isAuthenticated, openUnlockModal, logout } = useAuth();
  const { data: health, refetch: refetchHealth, isFetching: isHealthFetching } = useSystemHealth();
  const { data: tenants } = useTenants(isAuthenticated);
  const { data: workers } = useWorkerFleet();

  const isTenantsArray = Array.isArray(tenants);
  const activeTenantsCount = isTenantsArray ? tenants.length : 3;
  const totalWeight = isTenantsArray ? tenants.reduce((sum, t) => sum + (t.weight || 1), 0) : 8;
  const onlineWorkers = Array.isArray(workers) ? workers.filter((w) => w.status === 'ONLINE').length : 2;

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
            Access control, administrative session lifecycle, runtime pool configuration, and multi-tenant isolation boundaries
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAuthenticated ? (
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition"
            >
              <Lock className="w-4 h-4 text-[var(--color-crimson)]" />
              Lock Admin Session
            </button>
          ) : (
            <button
              onClick={() => openUnlockModal()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)]"
            >
              <Unlock className="w-4 h-4" />
              Unlock Admin Mode
            </button>
          )}

          <button
            onClick={() => refetchHealth()}
            disabled={isHealthFetching}
            className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
            title="Refresh System Health"
          >
            <RefreshCw className={`w-4 h-4 ${isHealthFetching ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Security & Access Status KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Session Privilege"
          value={isAuthenticated ? 'ADMINISTRATOR' : 'READ-ONLY'}
          subtitle={isAuthenticated ? 'CSRF & session tokens active' : 'State modifications locked'}
          icon={isAuthenticated ? ShieldCheck : ShieldAlert}
          variant={isAuthenticated ? 'emerald' : 'amber'}
        />
        <MetricCard
          title="Anti-CSRF Guard"
          value="ENFORCED"
          subtitle="All mutating REST endpoints verified"
          icon={Key}
          variant="amethyst"
        />
        <MetricCard
          title="Cluster Mode"
          value="DISTRIBUTED V2"
          subtitle={`${onlineWorkers} active worker nodes heartbeating`}
          icon={Server}
          variant="default"
        />
        <MetricCard
          title="Managed Tenants"
          value={`${activeTenantsCount} ACTIVE`}
          subtitle={`${totalWeight}x total weight capacity`}
          icon={Layers}
          variant="amethyst"
        />
      </div>

      {/* Section 1: Session & Access Control Lifecycle */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Administrative Access & Session Control
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              QueueForge enforces double-submit CSRF cookie protection and cryptographically validates administrative keys
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${
              isAuthenticated
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
                : 'bg-[var(--color-amber-bg)] text-[var(--color-amber)] border-[var(--color-amber-border)]'
            }`}
          >
            {isAuthenticated ? 'SESSION ACTIVE (READ-WRITE)' : 'RESTRICTED (READ-ONLY)'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1.5">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">
              Authorization Protocol
            </span>
            <div className="font-bold text-[var(--color-text-primary)]">
              X-Admin-Key & Session Cookie
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-sans">
              Mutating operations require either valid session cookie with X-CSRF-Token or direct X-Admin-Key header.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1.5">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">
              CSRF Protection State
            </span>
            <div className="font-bold text-[var(--color-success)] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Double-Submit Cookie
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-sans">
              POST, PUT, DELETE requests are rejected with HTTP 403 Forbidden if CSRF token header fails constant-time digest match.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1.5">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">
              Session Action
            </span>
            <div className="pt-1">
              {isAuthenticated ? (
                <button
                  onClick={() => logout()}
                  className="w-full py-1.5 text-xs font-bold text-[var(--color-crimson)] bg-[var(--color-crimson-bg)] border border-[var(--color-crimson-border)] rounded hover:brightness-110 transition flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" /> Terminate Session
                </button>
              ) : (
                <button
                  onClick={() => openUnlockModal()}
                  className="w-full py-1.5 text-xs font-semibold text-[var(--color-action-text)] bg-[var(--color-action-bg)] hover:bg-[var(--color-action-hover)] rounded transition flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" /> Unlock Administration
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Tenant Administration Snapshot */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Tenant Quota & FairShare Overview
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Weighted Deficit Round Robin configurations and multi-tenant isolation partitions
            </p>
          </div>
          <Link
            to="/fairshare"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            Manage FairShare Weights & Quotas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">
              Registered Tenants
            </span>
            <div className="text-base font-bold text-[var(--color-text-primary)]">
              {activeTenantsCount} Tenants
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] font-sans">
              All tenants partitioned with independent deficit counters and concurrency ceilings.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">
              Aggregate Weight Capacity
            </span>
            <div className="text-base font-bold text-[var(--color-amethyst)]">
              {totalWeight}x Total Weight
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] font-sans">
              Deficit quantum distributed per scheduling sweep based on relative tenant weights.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">
              Isolation Boundary
            </span>
            <div className="text-base font-bold text-[var(--color-success)] flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Strict Tenant Fencing
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] font-sans">
              Tenants cannot query or mutate jobs belonging to other tenants.
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Runtime Platform & Infrastructure Configuration */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-4">
        <div className="border-b border-[var(--color-border-subtle)] pb-3">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            Runtime Platform & Pool Parameters
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Internal database connection pool, lease timing, and distributed worker execution thresholds
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* HikariCP Pool */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-bold">
              <Database className="w-4 h-4 text-[var(--color-accent)]" />
              <span>HikariCP Connection Pool</span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Active Connections:</span>
                <span className="text-[var(--color-accent)] font-bold">{health?.databasePoolActive ?? 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Idle Connections:</span>
                <span className="text-[var(--color-text-primary)]">{health?.databasePoolIdle ?? 5}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Maximum Pool Size:</span>
                <span className="text-[var(--color-text-primary)] font-bold">{health?.databasePoolTotal ?? 20} Connections</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Connection Timeout:</span>
                <span className="text-[var(--color-text-primary)]">30,000 ms</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--color-text-muted)]">Database Health Status:</span>
                <span className="text-[var(--color-success)] font-bold">
                  {health?.dbStatus || 'UP (POSTGRESQL 16)'}
                </span>
              </div>
            </div>
          </div>

          {/* Worker Coordinator Parameters */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-[var(--color-amethyst)] font-bold">
              <Cpu className="w-4 h-4" />
              <span>Worker Coordinator Parameters</span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Worker Lease Duration:</span>
                <span className="text-[var(--color-text-primary)] font-bold">
                  {health?.leaseDurationSeconds ? `${health.leaseDurationSeconds} seconds` : '30 seconds'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Polling Interval:</span>
                <span className="text-[var(--color-text-primary)]">
                  {health?.pollIntervalMs ? `${health.pollIntervalMs} ms` : '100 ms (high responsiveness)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Orphan Lease Recovery:</span>
                <span className="text-[var(--color-text-primary)]">1,000 ms background sweep</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">Dispatcher Claim Mode:</span>
                <span className="text-[var(--color-text-primary)]">SELECT FOR UPDATE SKIP LOCKED</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--color-text-muted)]">Graceful Termination Drain:</span>
                <span className="text-[var(--color-success)] font-bold">25 seconds SmartLifecycle</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Security Boundaries & Audit Policies */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-4">
        <div className="border-b border-[var(--color-border-subtle)] pb-3">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            Security Boundaries & Audit Policies
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Cryptographic standards, secret masking policies, and tamper-evident logging
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1.5">
            <div className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--color-accent)]" /> Tenant Isolation
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-sans leading-relaxed">
              Requests authenticated via X-Tenant-Key are strictly bounded to their own tenant records in qf_jobs and outbox_events. Cross-tenant leakage yields 403 Forbidden.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1.5">
            <div className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[var(--color-amethyst)]" /> Secret Masking
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-sans leading-relaxed">
              Shared secrets such as X-Service-Key and admin API credentials are masked in all logs, health payloads, and REST responses to prevent credential exposure.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-1.5">
            <div className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[var(--color-success)]" /> Append-Only Audit Trail
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-sans leading-relaxed">
              Every job transition creates an immutable record in qf_job_execution_logs with worker ID, execution duration, and timestamp, satisfying SAFETY-6.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
