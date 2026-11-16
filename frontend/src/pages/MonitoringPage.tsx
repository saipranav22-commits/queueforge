import React from 'react';
import {
  Activity,
  BarChart2,
  Clock,
  ExternalLink,
  Flame,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { useSystemMetricsSummary } from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';
import { formatDurationMs } from '../lib/formatters';

export const MonitoringPage: React.FC = () => {
  const { data: metrics, isLoading } = useSystemMetricsSummary();

  const failureCategories = metrics?.failuresByCategory
    ? Object.entries(metrics.failuresByCategory)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Monitoring & Reliability Metrics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated latency percentiles, error taxonomy, and links to Prometheus & Grafana
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="http://127.0.0.1:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition shadow-lg shadow-orange-600/20"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Open Grafana Dashboard
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      </div>

      {/* Latency & Throughput KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Median (p50) Latency"
          value={isLoading ? '...' : formatDurationMs(metrics?.executionLatencyP50Ms)}
          subtitle="p50 handler runtime"
          icon={Clock}
          variant="blue"
        />
        <MetricCard
          title="p95 Execution Latency"
          value={isLoading ? '...' : formatDurationMs(metrics?.executionLatencyP95Ms)}
          subtitle="95th percentile execution"
          icon={TrendingUp}
          variant="purple"
        />
        <MetricCard
          title="Completed Total"
          value={isLoading ? '...' : Math.round(metrics?.completedTotal ?? 0)}
          subtitle="Successful executions"
          icon={CheckCircle}
          variant="emerald"
        />
        <MetricCard
          title="Failed Total"
          value={isLoading ? '...' : Math.round(metrics?.failedTotal ?? 0)}
          subtitle="Total failed attempts"
          icon={Flame}
          variant="rose"
        />
      </div>

      {/* Latency Percentiles & Failure Taxonomy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Distribution Table */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Execution & Queue Latencies</h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
              <span className="text-slate-400">p50 Execution Duration</span>
              <span className="text-slate-200">
                {formatDurationMs(metrics?.executionLatencyP50Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
              <span className="text-slate-400">p95 Execution Duration</span>
              <span className="text-slate-200">
                {formatDurationMs(metrics?.executionLatencyP95Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
              <span className="text-slate-400">p99 Execution Duration</span>
              <span className="text-slate-200">
                {formatDurationMs(metrics?.executionLatencyP99Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
              <span className="text-slate-400">p50 Queue Wait Latency</span>
              <span className="text-slate-200">
                {formatDurationMs(metrics?.queueWaitLatencyP50Ms)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">p95 Queue Wait Latency</span>
              <span className="text-slate-200">
                {formatDurationMs(metrics?.queueWaitLatencyP95Ms)}
              </span>
            </div>
          </div>
        </div>

        {/* Error Taxonomy / Failure Categories */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Flame className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">Failure Category Taxonomy</h3>
          </div>

          {failureCategories.length > 0 ? (
            <div className="space-y-3 text-xs">
              {failureCategories.map(([category, count]) => (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between font-mono text-slate-300">
                    <span className="font-semibold text-rose-400">{category}</span>
                    <span className="text-slate-400">{count} occurrences</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-rose-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (count / Math.max(1, metrics?.deadLetterTotal ?? 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No failure categories recorded in current operational window.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
