import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Users,
  Sliders,
  CheckCircle2,
  Lock,
  TrendingUp,
  Clock,
  Play,
  RotateCcw,
  Edit2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenants, useSchedulerConfig, useUpdateTenant } from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { TenantQuotaProgress } from '../components/ui/TenantQuotaProgress';
import { MetricCard } from '../components/common/MetricCard';
import { CopyableId } from '../components/ui/CopyableId';
import { apiRequest } from '../lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import type { TenantSummary, CreateTenantRequest, TenantStatus } from '../types/tenant';

interface SimTenant {
  id: string;
  name: string;
  weight: number;
  maxConcurrency: number;
  initialQueue: number;
  remainingQueue: number;
  deficit: number;
  running: number;
  completed: number;
  color: string;
}

interface SimRoundLog {
  round: number;
  tenantId: string;
  addedQuantum: number;
  deficitBeforeClaim: number;
  claimed: number;
  deficitAfter: number;
  resetToZero: boolean;
  reason: string;
}

export const FairSharePage: React.FC = () => {
  const { data: tenants, isLoading } = useTenants();
  const { data: schedulerConfig } = useSchedulerConfig();
  const { isAuthenticated, openUnlockModal } = useAuth();
  const queryClient = useQueryClient();
  const updateTenantMutation = useUpdateTenant();

  // Create Tenant Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantRequest>({
    id: '',
    name: '',
    weight: 1,
    maxConcurrency: 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Edit Tenant Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<{
    id: string;
    name: string;
    weight: number;
    maxConcurrency: number;
    status: TenantStatus;
  } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Educational Simulator State
  const initialSimTenants: SimTenant[] = [
    {
      id: 'tenant-noisy-batch',
      name: 'Noisy Batch Tenant',
      weight: 1,
      maxConcurrency: 4,
      initialQueue: 40,
      remainingQueue: 40,
      deficit: 0,
      running: 0,
      completed: 0,
      color: 'var(--color-crimson)',
    },
    {
      id: 'tenant-quiet-interactive',
      name: 'Quiet Interactive Tenant',
      weight: 2,
      maxConcurrency: 2,
      initialQueue: 4,
      remainingQueue: 4,
      deficit: 0,
      running: 0,
      completed: 0,
      color: 'var(--color-cyan)',
    },
    {
      id: 'tenant-standard-api',
      name: 'Standard API Tenant',
      weight: 1,
      maxConcurrency: 2,
      initialQueue: 10,
      remainingQueue: 10,
      deficit: 0,
      running: 0,
      completed: 0,
      color: 'var(--color-amethyst)',
    },
  ];

  const [simTenants, setSimTenants] = useState<SimTenant[]>(initialSimTenants);
  const [simRound, setSimRound] = useState(0);
  const [simLogs, setSimLogs] = useState<SimRoundLog[]>([]);

  const handleSimStep = () => {
    const nextRound = simRound + 1;
    let roundLogs: SimRoundLog[] = [];
    let updated = simTenants.map((t) => ({ ...t }));

    // Simulate 1 round of DRR sweep
    const baseQuantum = 1;
    const batchSize = 6;
    let remainingBatch = batchSize;

    for (let t of updated) {
      if (remainingBatch <= 0) break;
      if (t.remainingQueue <= 0) {
        // Queue empty: deficit must remain 0 to prevent hoarding
        if (t.deficit > 0) {
          roundLogs.push({
            round: nextRound,
            tenantId: t.id,
            addedQuantum: 0,
            deficitBeforeClaim: t.deficit,
            claimed: 0,
            deficitAfter: 0,
            resetToZero: true,
            reason: 'Queue empty — deficit reset to zero (anti-hoarding invariant)',
          });
          t.deficit = 0;
        }
        continue;
      }

      // 1. Quantum accumulation: D = D + (w * Q_base)
      const added = t.weight * baseQuantum;
      t.deficit += added;

      // 2. Concurrency quota check
      const availableQuota = Math.max(0, t.maxConcurrency - t.running);
      if (availableQuota <= 0) {
        roundLogs.push({
          round: nextRound,
          tenantId: t.id,
          addedQuantum: added,
          deficitBeforeClaim: t.deficit,
          claimed: 0,
          deficitAfter: t.deficit,
          resetToZero: false,
          reason: 'Concurrency quota exhausted — skipped this round',
        });
        continue;
      }

      // 3. Claim calculation: K = min(remainingBatch, deficit, availableQuota, remainingQueue)
      const claimLimit = Math.min(remainingBatch, t.deficit, availableQuota, t.remainingQueue);
      if (claimLimit > 0) {
        t.remainingQueue -= claimLimit;
        t.completed += claimLimit;
        t.deficit -= claimLimit;
        remainingBatch -= claimLimit;

        // Anti-hoarding reset if queue drained
        const reset = t.remainingQueue === 0;
        if (reset) {
          t.deficit = 0;
        }

        roundLogs.push({
          round: nextRound,
          tenantId: t.id,
          addedQuantum: added,
          deficitBeforeClaim: t.deficit + claimLimit,
          claimed: claimLimit,
          deficitAfter: t.deficit,
          resetToZero: reset,
          reason: reset
            ? `Claimed ${claimLimit} jobs; queue drained -> deficit reset to 0`
            : `Claimed ${claimLimit} jobs (deficit decreased)`,
        });
      }
    }

    setSimRound(nextRound);
    setSimTenants(updated);
    setSimLogs((prev) => [...roundLogs, ...prev].slice(0, 20));
  };

  const handleSimReset = () => {
    setSimTenants(initialSimTenants);
    setSimRound(0);
    setSimLogs([]);
  };

  // Calculations
  const totalWeight = schedulerConfig?.totalConfiguredWeight ?? (tenants?.reduce((sum, t) => sum + t.weight, 0) ?? 0);
  const totalConcurrency = schedulerConfig?.totalMaxConcurrency ?? (tenants?.reduce((sum, t) => sum + t.maxConcurrency, 0) ?? 0);
  const activeTenantsCount = schedulerConfig?.activeTenantsCount ?? (tenants?.filter((t) => t.status === 'ACTIVE').length ?? 0);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openUnlockModal();
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ tenant: TenantSummary; apiKey: string }>('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(newTenant),
      });
      setCreatedKey(res.apiKey);
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-scheduler-config'] });
    } catch (err: any) {
      alert(`Tenant registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (t: TenantSummary) => {
    if (!isAuthenticated) {
      openUnlockModal();
      return;
    }
    setEditingTenant({
      id: t.id,
      name: t.name,
      weight: t.weight,
      maxConcurrency: t.maxConcurrency,
      status: t.status,
    });
    setEditModalOpen(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setEditSubmitting(true);
    try {
      await updateTenantMutation.mutateAsync({
        id: editingTenant.id,
        data: {
          name: editingTenant.name,
          weight: Number(editingTenant.weight),
          maxConcurrency: Number(editingTenant.maxConcurrency),
          status: editingTenant.status,
        },
      });
      setEditModalOpen(false);
      setEditingTenant(null);
    } catch (err: any) {
      alert(`Tenant update failed: ${err.message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              FairShare Multi-Tenant Scheduler
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]">
              DRR ENGINE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
              ACTIVE
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Weighted Deficit Round Robin (DRR) scheduling and cluster-wide tenant concurrency quota enforcement
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!isAuthenticated) openUnlockModal();
              else {
                setCreatedKey(null);
                setCreateModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg transition shadow-md shadow-[var(--color-amethyst)]/20"
          >
            <Plus className="w-4 h-4" />
            Provision Tenant
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Tenants"
          value={isLoading ? '...' : activeTenantsCount}
          subtitle="Partitions in status ACTIVE"
          icon={Users}
          variant="amethyst"
        />
        <MetricCard
          title="Total Configured Weight"
          value={isLoading ? '...' : `${totalWeight}x`}
          subtitle="Relative quantum sum across tenants"
          icon={Sliders}
          variant="cyan"
        />
        <MetricCard
          title="Cluster Concurrency Cap"
          value={isLoading ? '...' : `${totalConcurrency} slots`}
          subtitle="Combined tenant worker ceilings"
          icon={Scale}
          variant="emerald"
        />
        <MetricCard
          title="Base Quantum"
          value={schedulerConfig ? `${schedulerConfig.baseQuantum} job/sweep` : '1 job/sweep'}
          subtitle={`Max sweep: ${schedulerConfig?.maxTenantsPerSweep ?? 10} tenants`}
          icon={Clock}
          variant="amber"
        />
      </div>

      {/* Distinction Notice Strip */}
      <div className="p-3.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)] flex items-start gap-3">
        <Sliders className="w-4 h-4 text-[var(--color-cyan)] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Algorithmic Service Share Semantics:
          </span>{' '}
          Configured weights determine relative DRR quantum credit accumulation (Qi = wi × Q_base) during round-robin sweeps.
          They govern priority of opportunity under contention, <em>not</em> mathematically fixed percentage throughput guarantees when queues are idle or unequally saturated.
        </div>
      </div>

      {/* Section 1: Real-Time Tenant Concurrency & Quota Distribution */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Tenant Concurrency & Quota Real-Time Utilization
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Active running jobs against hard cluster concurrency ceilings and persisted sweep deficit counters (Di)
            </p>
          </div>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Live refresh: 5s
          </span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)] font-mono">
            Loading FairShare multi-tenant state...
          </div>
        ) : !isAuthenticated ? (
          <div className="py-10 text-center space-y-3">
            <Lock className="w-8 h-8 text-[var(--color-amethyst)] mx-auto opacity-75" />
            <div className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
              FairShare multi-tenant operational telemetry requires authenticated administrator privileges.
            </div>
            <button
              onClick={() => openUnlockModal()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--color-amethyst)] rounded-lg hover:brightness-110 transition shadow-md shadow-[var(--color-amethyst)]/20"
            >
              Unlock Admin Mode
            </button>
          </div>
        ) : tenants && tenants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((t) => (
              <TenantQuotaProgress
                key={t.id}
                tenantId={t.id}
                tenantName={t.name}
                weight={t.weight}
                maxConcurrency={t.maxConcurrency}
                activeRunning={t.runningCount ?? t.activeRunningJobs ?? 0}
                deficit={t.deficitCounter ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
            No tenants configured yet. Click "Provision Tenant" to configure your first isolated tenant.
          </div>
        )}
      </div>

      {/* Section 2: Configured Tenant Registry (Interactive Table) */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Configured Tenant Registry
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Secure tenant identifiers, DRR weights, running/pending tallies, and configuration controls
            </p>
          </div>
          {isAuthenticated && (
            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
              {tenants?.length ?? 0} registered partitions
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] uppercase text-[10px] tracking-wider border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-5 py-3">Tenant ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3">Quota (Max)</th>
                <th className="px-5 py-3">Running / Pending</th>
                <th className="px-5 py-3" title="Persisted Deficit Counter from qf_tenants.deficit_counter (updated each DRR scheduling sweep)">Sweep Deficit (Di)</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                    Loading tenants...
                  </td>
                </tr>
              ) : tenants && tenants.length > 0 ? (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--color-bg-interactive)] transition">
                    <td className="px-5 py-3 font-semibold text-[var(--color-text-primary)]">
                      <CopyableId id={t.id} prefixLen={14} />
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-secondary)] font-sans font-medium">
                      {t.name}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)] font-bold">
                        {t.weight}x
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-cyan)] font-bold">
                      {t.maxConcurrency} slots
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-secondary)] font-mono">
                      <span className="text-[var(--color-success)] font-bold">{t.runningCount ?? t.activeRunningJobs ?? 0}</span>
                      <span className="text-[var(--color-text-muted)]"> / </span>
                      <span className="text-[var(--color-amber)] font-bold">{t.pendingCount ?? 0}</span>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-primary)] font-bold">
                      {t.deficitCounter ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          t.status === 'ACTIVE'
                            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
                            : 'bg-[var(--color-crimson-bg)] text-[var(--color-crimson)] border-[var(--color-crimson-border)]'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/jobs?tenantId=${encodeURIComponent(t.id)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[var(--color-cyan)] hover:bg-[var(--color-cyan-bg)] rounded transition"
                          title="View jobs for this tenant in Job Explorer"
                        >
                          Jobs <ExternalLink className="w-3 h-3" />
                        </Link>
                        {isAuthenticated && (
                          <button
                            onClick={() => handleOpenEdit(t)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-deep)] rounded transition"
                            title="Edit Tenant"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--color-text-muted)] font-sans">
                    {isAuthenticated
                      ? 'No tenants currently registered.'
                      : 'Please unlock Admin Mode to view registered tenants.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Interactive Educational Simulator */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Educational Simulator: Deficit Round-Robin (DRR) Mechanics
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-amber-bg)] text-[var(--color-amber)] border border-[var(--color-amber-border)]">
                SIMULATION
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Interactive demonstration of QueueForge's scheduling mathematics and anti-hoarding rules under simulated contention
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimStep}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--color-cyan)] text-black rounded-lg hover:brightness-110 transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              Simulate Sweep (Round {simRound + 1})
            </button>
            <button
              onClick={handleSimReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Notice */}
        <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-secondary)] mb-5">
          <strong className="text-[var(--color-text-primary)]">Mathematical Model:</strong> At each round, each candidate tenant receives deficit quantum Qi = wi × Q_base. Claim capacity is bounded by Ki = min(B, Di, Hi). If a tenant's queue becomes empty, its deficit is immediately reset to 0 to prevent hoarding credits while idle.
        </div>

        {/* Sim Tenant Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {simTenants.map((t) => {
            const pctCompleted = Math.round((t.completed / t.initialQueue) * 100);
            return (
              <div
                key={t.id}
                className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">
                    {t.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)]">
                    Weight {t.weight}x
                  </span>
                </div>

                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Deficit Credit:</span>
                    <span className="text-[var(--color-cyan)] font-bold">{t.deficit}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Remaining Queue:</span>
                    <span className="text-[var(--color-amber)] font-bold">{t.remainingQueue} jobs</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Completed:</span>
                    <span className="text-[var(--color-success)] font-bold">{t.completed} / {t.initialQueue}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-cyan)] transition-all duration-300"
                      style={{ width: `${pctCompleted}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-right font-mono text-[var(--color-text-muted)]">
                    {pctCompleted}% serviced
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step-by-Step Sim Trace Log */}
        {simLogs.length > 0 && (
          <div className="rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] p-3 font-mono text-xs">
            <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-2">
              Recent Sweep Execution Traces (Round {simRound}):
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {simLogs.map((log, i) => (
                <div key={i} className="text-[11px] flex items-center gap-2 py-0.5 border-b border-[var(--color-border-subtle)] last:border-0">
                  <span className="text-[var(--color-text-muted)] font-bold">R{log.round}</span>
                  <span className="text-[var(--color-cyan)] font-semibold">{log.tenantId}:</span>
                  <span className="text-[var(--color-text-secondary)]">{log.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Empirical Benchmark Evidence Panel */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Empirical Benchmark Evidence: Contention & Starvation Prevention
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)]">
                VERIFIED LOCAL RUN
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Empirical data from Profile 3 (Noisy Neighbor experiment: 1,000 batch jobs vs 4 quiet tenants with 20 jobs each = 1,080 total jobs)
            </p>
          </div>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Source: docs/benchmark/benchmark-results-fairshare.json
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Baseline FIFO Card */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-crimson-border)]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-crimson)] uppercase tracking-wider">
                Baseline (FIFO / Static Priority)
              </span>
              <ShieldAlert className="w-4 h-4 text-[var(--color-crimson)]" />
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)]">Quiet-Tenant p50 Wait:</span>
                <span className="text-[var(--color-crimson)] font-bold">11,868 ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)]">Quiet-Tenant p95 Wait:</span>
                <span className="text-[var(--color-crimson)] font-bold">12,219 ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)]">Max Tail Starvation:</span>
                <span className="text-[var(--color-crimson)] font-bold">12,219 ms</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--color-text-secondary)]">Throughput:</span>
                <span className="text-[var(--color-text-primary)] font-bold">89.6 jobs/s</span>
              </div>
            </div>

            <p className="text-[11px] text-[var(--color-text-muted)]">
              Interactive quiet tenants were starved for over 11.8 seconds behind the 1,000-job batch flood.
            </p>
          </div>

          {/* FairShare DRR Card */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-success-border)]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-success)] uppercase tracking-wider">
                FairShare (Deficit Round Robin)
              </span>
              <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)]">Quiet-Tenant p50 Wait:</span>
                <span className="text-[var(--color-success)] font-bold">1,210 ms (-89.8%)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)]">Quiet-Tenant p95 Wait:</span>
                <span className="text-[var(--color-success)] font-bold">1,990 ms (-83.7%)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-secondary)]">Max Tail Starvation:</span>
                <span className="text-[var(--color-success)] font-bold">1,990 ms</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--color-text-secondary)]">Throughput:</span>
                <span className="text-[var(--color-text-primary)] font-bold">70.6 jobs/s</span>
              </div>
            </div>

            <p className="text-[11px] text-[var(--color-text-muted)]">
              Quiet tenants were serviced immediately in round-robin turns, cutting latency by ~90% at a modest ~21% throughput trade-off.
            </p>
          </div>
        </div>
      </div>

      {/* Provision Tenant Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
              Provision New Tenant
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Create an isolated tenant with custom FairShare scheduling weight and concurrency quota
            </p>

            {createdKey ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-xs text-[var(--color-success)]">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-4 h-4" /> Tenant Created Successfully!
                  </div>
                  <p className="text-[11px] mb-2">
                    Copy the raw API key now. It will never be shown again:
                  </p>
                  <pre className="p-2 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-xs select-all text-[var(--color-text-primary)]">
                    {createdKey}
                  </pre>
                </div>
                <button
                  onClick={() => {
                    setCreatedKey(null);
                    setCreateModalOpen(false);
                  }}
                  className="w-full py-2 text-xs font-semibold text-white bg-[var(--color-amethyst)] rounded-lg hover:brightness-110 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateTenant} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                    Tenant ID (lowercase slug)
                  </label>
                  <input
                    type="text"
                    required
                    pattern="[a-z0-9-_]{3,64}"
                    placeholder="e.g. enterprise-tenant-c"
                    value={newTenant.id}
                    onChange={(e) => setNewTenant({ ...newTenant, id: e.target.value.toLowerCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-amethyst)]"
                  />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                    Organization / Tenant Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise Solutions Corp"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                      DRR Weight Multiplier
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={newTenant.weight}
                      onChange={(e) => setNewTenant({ ...newTenant, weight: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-amethyst)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                      Max Concurrency Quota
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={newTenant.maxConcurrency}
                      onChange={(e) =>
                        setNewTenant({ ...newTenant, maxConcurrency: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-amethyst)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg transition disabled:opacity-50"
                  >
                    {submitting ? 'Provisioning...' : 'Provision'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {editModalOpen && editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
              Edit Tenant Configuration
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4 font-mono">
              {editingTenant.id}
            </p>

            <form onSubmit={handleUpdateTenant} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                  Tenant Name
                </label>
                <input
                  type="text"
                  required
                  value={editingTenant.name}
                  onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                    DRR Weight Multiplier
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={editingTenant.weight}
                    onChange={(e) => setEditingTenant({ ...editingTenant, weight: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-amethyst)]"
                  />
                </div>

                <div>
                  <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                    Max Concurrency Quota
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={50}
                    value={editingTenant.maxConcurrency}
                    onChange={(e) =>
                      setEditingTenant({ ...editingTenant, maxConcurrency: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-amethyst)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--color-text-secondary)] font-medium mb-1">
                  Status
                </label>
                <select
                  value={editingTenant.status}
                  onChange={(e) => setEditingTenant({ ...editingTenant, status: e.target.value as TenantStatus })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-amethyst)]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingTenant(null);
                  }}
                  className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg transition disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
