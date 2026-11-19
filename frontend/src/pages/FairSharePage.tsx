import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Users,
  Sliders,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useTenants } from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { TenantQuotaProgress } from '../components/ui/TenantQuotaProgress';
import { MetricCard } from '../components/common/MetricCard';
import { CopyableId } from '../components/ui/CopyableId';
import { apiRequest } from '../lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import type { TenantSummary, CreateTenantRequest } from '../types/tenant';

export const FairSharePage: React.FC = () => {
  const { data: tenants, isLoading } = useTenants();
  const { isAuthenticated, openUnlockModal } = useAuth();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantRequest>({
    id: '',
    name: '',
    weight: 1,
    maxConcurrency: 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const totalWeight = tenants?.reduce((sum, t) => sum + t.weight, 0) ?? 0;
  const totalConcurrency = tenants?.reduce((sum, t) => sum + t.maxConcurrency, 0) ?? 0;

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
    } catch (err: any) {
      alert(`Tenant registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              FairShare Multi-Tenant Scheduler
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]">
              DRR ENGINE
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Weighted deficit round-robin queue fair-sharing and cluster-wide tenant concurrency enforcement
          </p>
        </div>

        <div>
          <button
            onClick={() => {
              if (!isAuthenticated) openUnlockModal();
              else setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg transition shadow-md shadow-[var(--color-amethyst)]/20"
          >
            <Plus className="w-4 h-4" />
            Provision Tenant
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Active Tenants"
          value={isLoading ? '...' : (tenants?.length ?? 0)}
          subtitle="Provisioned multi-tenant partitions"
          icon={Users}
          variant="amethyst"
        />
        <MetricCard
          title="Total Configured Weight"
          value={isLoading ? '...' : `${totalWeight}x`}
          subtitle="Combined DRR quantum allocation"
          icon={Sliders}
          variant="cyan"
        />
        <MetricCard
          title="Cluster Concurrency Allocation"
          value={isLoading ? '...' : totalConcurrency}
          subtitle="Total tenant concurrency quota slots"
          icon={Scale}
          variant="emerald"
        />
      </div>

      {/* Active Quota Utilization Cards */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          Tenant Concurrency & Quota Real-Time Distribution
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          Visualized active concurrency against hard tenant quota limits and relative DRR weight multipliers
        </p>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)] font-mono">
            Loading FairShare multi-tenant state...
          </div>
        ) : !isAuthenticated ? (
          <div className="py-10 text-center space-y-3">
            <Lock className="w-8 h-8 text-[var(--color-amethyst)] mx-auto opacity-75" />
            <div className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
              FairShare multi-tenant admin telemetry requires authenticated administrative privileges.
            </div>
            <button
              onClick={() => openUnlockModal()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--color-amethyst)] rounded-lg hover:brightness-110 transition"
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
                activeRunning={t.activeRunningJobs ?? 0}
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

      {/* Tenant Directory Table */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Configured Tenant Registry</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">Secure tenant identifiers, DRR weights, and concurrency quotas</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] uppercase text-[10px] tracking-wider border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-6 py-3">Tenant ID</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">DRR Weight</th>
                <th className="px-6 py-3">Max Concurrency</th>
                <th className="px-6 py-3">Key Prefix</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                    Loading tenants...
                  </td>
                </tr>
              ) : tenants && tenants.length > 0 ? (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--color-bg-interactive)] transition">
                    <td className="px-6 py-3 font-semibold text-[var(--color-text-primary)]">
                      <CopyableId id={t.id} prefixLen={12} />
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-secondary)] font-sans font-medium">
                      {t.name}
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 rounded bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)] font-bold">
                        {t.weight}x
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[var(--color-cyan)] font-bold">
                      {t.maxConcurrency} slots
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)]">
                      {t.apiKeyPrefix ? `${t.apiKeyPrefix}...` : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--color-text-muted)] font-sans">
                    {isAuthenticated ? 'No tenants currently registered.' : 'Please unlock Admin Mode to view registered tenants.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setCreatedKey(null);
                      setCreateModalOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[var(--color-amethyst)] rounded-lg hover:brightness-110"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateTenant} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                    Tenant ID (Slug)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. tenant-alpha"
                    value={newTenant.id}
                    onChange={(e) => setNewTenant({ ...newTenant, id: e.target.value })}
                    className="w-full text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg p-2.5 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alpha Enterprise"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                    className="w-full text-xs font-sans bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg p-2.5 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                      DRR Weight (1 - 100)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={newTenant.weight}
                      onChange={(e) => setNewTenant({ ...newTenant, weight: parseInt(e.target.value) || 1 })}
                      className="w-full text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg p-2.5 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                      Max Concurrency
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={newTenant.maxConcurrency}
                      onChange={(e) => setNewTenant({ ...newTenant, maxConcurrency: parseInt(e.target.value) || 1 })}
                      className="w-full text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg p-2.5 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg shadow-md shadow-[var(--color-amethyst)]/20 disabled:opacity-50"
                  >
                    {submitting ? 'Provisioning...' : 'Provision'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
