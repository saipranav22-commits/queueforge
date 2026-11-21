import React from 'react';
import {
  Clock,
  Flame,
  CheckCircle,
  TrendingUp,
  Activity,
  BarChart2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useSystemMetricsSummary } from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';
import { formatDurationMs } from '../lib/formatters';

export const MonitoringPage: React.FC = () => {
  const { data: metrics, isLoading, refetch, isFetching } = useSystemMetricsSummary();

  const failureCategories = metrics?.failuresByCategory
    ? Object.entries(metrics.failuresByCategory)
    : [];

  const totalFailures = Math.max(1, metrics?.failedTotal ?? 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Observability & Distributed Metrics
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              MICROMETER & ACTUATOR
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Aggregated latency percentiles, queue wait times, error category taxonomy, and Prometheus metrics telemetry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] rounded-lg border border-[var(--color-border-subtle)] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Latency & Throughput KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Median (p50) Latency"
          value={isLoading ? '...' : formatDurationMs(metrics?.executionLatencyP50Ms)}
          subtitle="p50 handler execution runtime"
          icon={Clock}
          variant="cyan"
        />
        <MetricCard
          title="p95 Execution Latency"
          value={isLoading ? '...' : formatDurationMs(metrics?.executionLatencyP95Ms)}
          subtitle="95th percentile execution runtime"
          icon={TrendingUp}
          variant="amethyst"
        />
        <MetricCard
          title="Completed Total"
          value={isLoading ? '...' : Math.round(metrics?.completedTotal ?? 0)}
          subtitle="Successful terminal jobs"
          icon={CheckCircle}
          variant="emerald"
        />
        <MetricCard
          title="Failed Total"
          value={isLoading ? '...' : Math.round(metrics?.failedTotal ?? 0)}
          subtitle="Total failed execution attempts"
          icon={Flame}
          variant="rose"
        />
      </div>

      {/* Latency Percentiles & Failure Taxonomy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Distribution Table */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
            <Clock className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Execution & Queue Wait Latencies
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">p50 Execution Duration</span>
              <span className="text-[var(--color-text-primary)] font-bold">
                {formatDurationMs(metrics?.executionLatencyP50Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">p95 Execution Duration</span>
              <span className="text-[var(--color-text-primary)] font-bold">
                {formatDurationMs(metrics?.executionLatencyP95Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">p99 Execution Duration</span>
              <span className="text-[var(--color-amethyst)] font-bold">
                {formatDurationMs(metrics?.executionLatencyP99Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-secondary)]">p50 Queue Wait Latency</span>
              <span className="text-[var(--color-text-primary)]">
                {formatDurationMs(metrics?.queueWaitLatencyP50Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[var(--color-text-secondary)]">p95 Queue Wait Latency</span>
              <span className="text-[var(--color-amber)] font-bold">
                {formatDurationMs(metrics?.queueWaitLatencyP95Ms)}
              </span>
            </div>
          </div>
        </div>

        {/* Error Taxonomy / Failure Categories */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
            <Flame className="w-4 h-4 text-[var(--color-crimson)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Failure Category Taxonomy
            </h3>
          </div>

          {failureCategories.length > 0 ? (
            <div className="space-y-3.5 text-xs">
              {failureCategories.map(([category, count]) => {
                const percentage = Math.min(100, Math.round((count / totalFailures) * 100));
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex justify-between font-mono">
                      <span className="font-semibold text-[var(--color-crimson)]">{category}</span>
                      <span className="text-[var(--color-text-muted)]">
                        {count} occurrences ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[var(--color-bg-deep)] rounded-full h-2 overflow-hidden border border-[var(--color-border-subtle)]">
                      <div
                        className="bg-[var(--color-crimson)] h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[var(--color-success)] opacity-70" />
              No failure categories recorded in the current operational metrics window.
            </div>
          )}
        </div>
      </div>

      {/* External Observability Telemetry Strip */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              External Observability & Telemetry Integration
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Production telemetry scrape targets and standalone Grafana dashboard specifications
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
            METRICS SCRAPABLE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[var(--color-accent)]" /> Prometheus Scrape Target
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] font-bold">
                PORT 8080 / 8088
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-sans">
              Micrometer exposes standard OpenMetrics at <code className="text-[var(--color-accent)] font-mono">/actuator/prometheus</code>, including <code className="text-[var(--color-accent)] font-mono">queueforge_jobs_claimed_total</code>, <code className="text-[var(--color-accent)] font-mono">queueforge_jobs_completed_total</code>, and <code className="text-[var(--color-accent)] font-mono">queueforge_jobs_failed_total</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-[var(--color-amber)]" /> Grafana Dashboard Template
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] bg-[var(--color-amber-bg)] text-[var(--color-amber)] border border-[var(--color-amber-border)] font-bold">
                DOCKER COMPOSE :3000
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-sans">
              Pre-provisioned dashboard definitions are located in <code className="text-[var(--color-amber)]">deploy/grafana/dashboards/queueforge.json</code> for live cluster visualization when running the full multi-service Docker stack.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
