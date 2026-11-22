import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Database,
  Shield,
  Activity,
  Layers,
  Server,
  RefreshCw,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { useSystemHealth, useWorkerFleet } from '../hooks/useQueueForgeData';
import { useScenario } from '../context/ScenarioContext';
import { MetricCard } from '../components/common/MetricCard';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { formatDate, formatUptime } from '../lib/formatters';
import type { WorkerInstance } from '../types/worker';

export const WorkersPage: React.FC = () => {
  const { isScenarioMode, activeScenarioId, scenarioWorkers, scenarioHealth } = useScenario();
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useSystemHealth();
  const { data: fleet, isLoading: fleetLoading, refetch: refetchFleet, isFetching } = useWorkerFleet();

  const [selectedWorker, setSelectedWorker] = useState<WorkerInstance | null>(null);

  const effectiveFleet = isScenarioMode ? scenarioWorkers : fleet;
  const effectiveHealth = isScenarioMode ? scenarioHealth : health;
  const effectiveFleetLoading = isScenarioMode ? false : fleetLoading;
  const effectiveHealthLoading = isScenarioMode ? false : healthLoading;

  const handleRefresh = () => {
    refetchHealth();
    refetchFleet();
  };

  const isFleetArray = Array.isArray(effectiveFleet);
  const totalWorkers = isFleetArray ? effectiveFleet.length : 0;
  const onlineWorkers = isFleetArray ? effectiveFleet.filter((w) => w.status === 'ONLINE').length : 0;
  const staleWorkers = isFleetArray ? effectiveFleet.filter((w) => w.status === 'STALE').length : 0;
  const offlineWorkers = isFleetArray ? effectiveFleet.filter((w) => w.status === 'OFFLINE').length : 0;
  const totalConcurrency = isFleetArray ? effectiveFleet.reduce((acc, w) => acc + w.concurrency, 0) : (effectiveHealth?.workerCapacity ?? 4);
  const totalHeldLeases = isFleetArray ? effectiveFleet.reduce((acc, w) => acc + w.heldLeasesCount, 0) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Distributed Worker Fleet
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              MULTI-NODE CLUSTER
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Real-time server discovery, heartbeat freshness tracking, and distributed lease attribution
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
            Refresh Fleet
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Online Nodes"
          value={effectiveFleetLoading ? '...' : `${onlineWorkers} of ${totalWorkers}`}
          subtitle={`${staleWorkers} stale • ${offlineWorkers} offline`}
          icon={Radio}
          variant="emerald"
        />
        <MetricCard
          title="Cluster Concurrency"
          value={effectiveFleetLoading ? '...' : `${totalHeldLeases} / ${totalConcurrency}`}
          subtitle="Held leases / Capacity slots"
          icon={Layers}
          variant="default"
        />
        <MetricCard
          title="PostgreSQL Lease Store"
          value={effectiveHealthLoading ? '...' : (effectiveHealth?.dbStatus === 'UP' ? 'CONNECTED' : 'DISCONNECTED')}
          subtitle={`HikariCP ${effectiveHealth?.databasePoolActive ?? 0}/${effectiveHealth?.databasePoolTotal ?? 10} active connections`}
          icon={Database}
          variant={effectiveHealth?.dbStatus === 'UP' ? 'emerald' : 'rose'}
        />
        <MetricCard
          title="Coordinator Uptime"
          value={effectiveHealthLoading ? '...' : formatUptime(effectiveHealth?.uptimeSeconds)}
          subtitle="Continuous backend service"
          icon={Activity}
          variant="amethyst"
        />
      </div>

      {/* Discovered Worker Nodes Section */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Discovered Worker Instances
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Live heartbeat telemetry received by PostgreSQL cluster registry
            </p>
          </div>
          <div className="text-xs font-mono text-[var(--color-text-muted)]">
            Heartbeat timeout: &lt;15s (Fresh) • 15–45s (Stale) • &gt;45s (Offline)
          </div>
        </div>

        {effectiveFleetLoading ? (
          <div className="p-12 text-center text-xs font-mono text-[var(--color-text-muted)] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[var(--color-amethyst)]" />
            <div>Querying worker instance heartbeats...</div>
          </div>
        ) : effectiveFleet && effectiveFleet.length > 0 ? (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {effectiveFleet.map((worker) => {
              const isOnline = worker.status === 'ONLINE';
              const isStale = worker.status === 'STALE';

              return (
                <div
                  key={worker.instanceId}
                  onClick={() => setSelectedWorker(worker)}
                  className="p-5 hover:bg-[var(--color-bg-interactive)] transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                      <Server className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[var(--color-text-primary)]">
                          {worker.instanceId}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isOnline
                              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                              : isStale
                              ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]'
                              : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline
                                ? 'bg-[var(--color-success)] animate-pulse'
                                : isStale
                                ? 'bg-[var(--color-warning)]'
                                : 'bg-[var(--color-danger)]'
                            }`}
                          />
                          {worker.status}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-muted)]">
                          {worker.mode}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-[var(--color-text-secondary)] flex flex-wrap items-center gap-3">
                        <span>
                          Heartbeat:{' '}
                          <span
                            className={
                              isOnline
                                ? 'text-[var(--color-success)]'
                                : isStale
                                ? 'text-[var(--color-warning)]'
                                : 'text-[var(--color-danger)]'
                            }
                          >
                            {worker.heartbeatAgeSeconds}s ago
                          </span>
                        </span>
                        <span>•</span>
                        <span>Started: {formatDate(worker.startedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs font-mono">
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Active Leases</div>
                      <div className="font-bold text-[var(--color-text-primary)] text-sm">
                        {worker.heldLeasesCount} / {worker.concurrency} slots
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Completed</div>
                      <div className="font-bold text-[var(--color-success)] text-sm">
                        {worker.completedJobsCount}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Failures</div>
                      <div className="font-bold text-[var(--color-danger)] text-sm">
                        {worker.failedJobsCount}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorker(worker);
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold text-[var(--color-amethyst)] bg-[var(--color-amethyst-bg)] border border-[var(--color-amethyst-border)] hover:brightness-110 transition"
                    >
                      Inspect Node
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center space-y-3 font-sans">
            <Server className="w-8 h-8 text-[var(--color-text-muted)] mx-auto opacity-50" />
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              No Worker Nodes Currently Registered
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">
              No worker processes have published recent heartbeats to the cluster database. When worker instances boot up, they automatically register their identity and publish heartbeats every 5 seconds.
            </p>
          </div>
        )}
      </div>

      {/* Concurrency & Safety Architecture Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
            <Cpu className="w-4 h-4 text-[var(--color-amethyst)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Worker Coordinator Fencing Architecture
            </h3>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">Claim Strategy</span>
              <span className="text-[var(--color-success)] font-semibold">
                SELECT FOR UPDATE SKIP LOCKED
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">Lease Duration</span>
              <span className="text-[var(--color-text-primary)]">
                {effectiveHealth?.leaseDurationSeconds ?? 10} Seconds
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">Poll Interval</span>
              <span className="text-[var(--color-text-primary)]">
                {effectiveHealth?.pollIntervalMs ?? 200} ms
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[var(--color-text-secondary)]">Heartbeat Extension</span>
              <span className="text-[var(--color-accent)] font-semibold">
                Dynamic 3s In-Flight Renewal
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
            <Shield className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Fault Tolerance & Crash Recovery
            </h3>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">Split-Brain Prevention</span>
              <span className="text-[var(--color-accent)] font-semibold">
                Claim Fencing Token (UUID)
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">Zombified Worker Protection</span>
              <span className="text-[var(--color-success)] font-semibold">
                Atomic Lease Expiry Sweeper
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">Database Engine</span>
              <span className="text-[var(--color-text-primary)]">
                PostgreSQL 16.8 (Lease-Fenced)
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[var(--color-text-secondary)]">FairShare Multi-Tenant</span>
              <span className="text-[var(--color-amethyst)] font-semibold">
                Weighted DRR Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WORKER INSPECTOR DRAWER */}
      <DetailDrawer
        isOpen={!!selectedWorker}
        onClose={() => setSelectedWorker(null)}
        title="Worker Node Inspector"
        subtitle={selectedWorker ? `Instance: ${selectedWorker.instanceId}` : ''}
        width="lg"
      >
        {selectedWorker && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                  <Server className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <div>
                  <div className="font-mono font-bold text-sm text-[var(--color-text-primary)]">
                    {selectedWorker.instanceId}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] font-mono">
                    Mode: {selectedWorker.mode}
                  </div>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold ${
                  selectedWorker.status === 'ONLINE'
                    ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                    : selectedWorker.status === 'STALE'
                    ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]'
                    : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    selectedWorker.status === 'ONLINE'
                      ? 'bg-[var(--color-success)] animate-pulse'
                      : selectedWorker.status === 'STALE'
                      ? 'bg-[var(--color-warning)]'
                      : 'bg-[var(--color-danger)]'
                  }`}
                />
                {selectedWorker.status}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Capacity</span>
                <span className="text-base font-bold text-[var(--color-text-primary)]">
                  {selectedWorker.concurrency} concurrent threads
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Held Leases</span>
                <span className="text-base font-bold text-[var(--color-text-primary)]">
                  {selectedWorker.heldLeasesCount} active
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Completed Tasks</span>
                <span className="text-base font-bold text-[var(--color-success)]">
                  {selectedWorker.completedJobsCount}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Failed Tasks</span>
                <span className="text-base font-bold text-[var(--color-danger)]">
                  {selectedWorker.failedJobsCount}
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Last Heartbeat:</span>
                <span className="text-[var(--color-text-primary)]">
                  {formatDate(selectedWorker.lastHeartbeat)} ({selectedWorker.heartbeatAgeSeconds}s ago)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Instance Started:</span>
                <span className="text-[var(--color-text-secondary)]">
                  {formatDate(selectedWorker.startedAt)}
                </span>
              </div>
            </div>

            {/* Drill-Down Action */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <Link
                to={`/jobs?search=${encodeURIComponent(selectedWorker.instanceId)}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-amethyst)] hover:underline"
              >
                Inspect Jobs Handled by this Node <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedWorker(null)}
                className="px-3.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
