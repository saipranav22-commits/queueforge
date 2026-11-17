import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  PlayCircle,
  CheckCircle2,
  Flame,
  Gauge,
  PlusCircle,
  ArrowRight,
} from 'lucide-react';
import { useDashboardStats, useJobs } from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate } from '../lib/formatters';
import { apiRequest } from '../lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export const OverviewPage: React.FC = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentJobs, isLoading: jobsLoading } = useJobs({
    page: 0,
    size: 5,
    sortBy: 'createdAt',
    sortDirection: 'DESC',
  });

  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const handleCreateTestJob = async () => {
    setIsSubmitting(true);
    setSubmitSuccess(null);
    try {
      const idempotencyKey = `manual-${Date.now()}`;
      const payload = {
        jobType: 'GENERATE_REPORT',
        payload: {
          reportName: 'manual-dispatch-report',
          format: 'PDF',
          triggeredBy: 'React Admin Console',
          timestamp: new Date().toISOString(),
        },
        maxRetries: 3,
        priority: 50,
      };

      const res = await apiRequest<{ jobId: string }>('/jobs', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      setSubmitSuccess(`Job ${res.jobId.slice(0, 8)}... created!`);
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err: any) {
      alert(`Failed to create job: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pie chart data
  const chartData = [
    { name: 'Pending', value: stats?.pendingJobs || 0, color: '#f59e0b' },
    { name: 'Running', value: stats?.runningJobs || 0, color: '#3b82f6' },
    { name: 'Completed', value: stats?.completedJobs || 0, color: '#10b981' },
    { name: 'Dead-Letter', value: stats?.deadLetterJobs || 0, color: '#a855f7' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Queue Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of PostgreSQL-backed durable worker queue and lease coordinator
          </p>
        </div>
        <div className="flex items-center gap-3">
          {submitSuccess && (
            <span className="text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg animate-in fade-in">
              {submitSuccess}
            </span>
          )}
          <button
            onClick={handleCreateTestJob}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" />
            Submit Test Job
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pending Queue"
          value={statsLoading ? '...' : (stats?.pendingJobs ?? 0)}
          subtitle="Awaiting worker pickup"
          icon={Clock}
          variant="amber"
        />
        <MetricCard
          title="Active Processing"
          value={statsLoading ? '...' : (stats?.runningJobs ?? 0)}
          subtitle={`${Math.round(stats?.activeWorkers ?? 0)} worker threads active`}
          icon={PlayCircle}
          variant="blue"
        />
        <MetricCard
          title="Completed Total"
          value={statsLoading ? '...' : (stats?.completedJobs ?? 0)}
          subtitle="Processed successfully"
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

      {/* Secondary Row: Throughput + Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Throughput Card */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Lifetime Submissions
              </span>
              <Gauge className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-white">
                {Math.round(stats?.submittedTotal ?? 0)}
              </span>
              <span className="text-xs text-slate-400 font-medium">total jobs submitted</span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Worker Pool Utilization</span>
                <span className="font-mono text-slate-200">
                  {Math.round(stats?.activeWorkers ?? 0)} / {stats?.workerCapacity ?? 4} threads
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((stats?.activeWorkers ?? 0) / Math.max(1, stats?.workerCapacity ?? 4)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Concurrency Model</span>
            <span className="font-mono text-slate-300">SKIP LOCKED</span>
          </div>
        </div>

        {/* State Distribution Pie Chart */}
        <div className="lg:col-span-2 rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Queue State Distribution
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Total: {stats?.totalJobs ?? 0}
            </span>
          </div>
          {chartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-10">
              No jobs registered in the queue database yet.
            </div>
          ) : (
            <div className="h-44 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 pr-6 text-xs">
                {chartData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-400">{d.name}:</span>
                    <span className="font-mono font-medium text-slate-200">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Jobs Activity Feed */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
            <p className="text-xs text-slate-400">Latest job submissions and lifecycle transitions</p>
          </div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
          >
            View all jobs
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/40 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800/80">
              <tr>
                <th className="px-6 py-3">Job ID</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Retries</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {jobsLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading jobs...
                  </td>
                </tr>
              ) : recentJobs?.content && recentJobs.content.length > 0 ? (
                recentJobs.content.map((job) => (
                  <tr key={job.jobId} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3 text-slate-200 font-semibold">
                      <Link
                        to={`/jobs/${job.jobId}`}
                        className="hover:text-blue-400 transition"
                      >
                        {job.jobId.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-slate-300">{job.jobType}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={job.status} size="sm" />
                    </td>
                    <td className="px-6 py-3 text-slate-400">
                      {job.retryCount} / {job.maxRetries}
                    </td>
                    <td className="px-6 py-3 text-slate-400 font-sans">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-right font-sans">
                      <Link
                        to={`/jobs/${job.jobId}`}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-sans">
                    No recent jobs found. Click "Submit Test Job" above to queue one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
