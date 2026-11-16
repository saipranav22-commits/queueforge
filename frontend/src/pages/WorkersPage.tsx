import React from 'react';
import {
  Cpu,
  Database,
  Shield,
  Activity,
  Server,
  Lock,
  Layers,
  Heart,
} from 'lucide-react';
import { useSystemHealth, useDashboardStats } from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';
import { formatUptime } from '../lib/formatters';

export const WorkersPage: React.FC = () => {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: stats } = useDashboardStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Workers & System Health
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Inspection of background worker coordinator, thread pools, and PostgreSQL connection durability
        </p>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Coordinator Status"
          value={healthLoading ? '...' : (health?.workerStatus ?? 'UNKNOWN')}
          subtitle="Autonomous claim loop"
          icon={Cpu}
          variant="blue"
        />
        <MetricCard
          title="Worker Pool"
          value={
            healthLoading
              ? '...'
              : `${Math.round(health?.activeWorkers ?? 0)} / ${health?.workerCapacity ?? 4}`
          }
          subtitle="Active / Bounded Threads"
          icon={Layers}
          variant="cyan"
        />
        <MetricCard
          title="PostgreSQL Pool"
          value={
            healthLoading
              ? '...'
              : `${health?.databasePoolActive ?? 0} / ${health?.databasePoolTotal ?? 10}`
          }
          subtitle="HikariCP Active / Max"
          icon={Database}
          variant="emerald"
        />
        <MetricCard
          title="System Uptime"
          value={healthLoading ? '...' : formatUptime(health?.uptimeSeconds)}
          subtitle="Continuous backend service"
          icon={Activity}
          variant="purple"
        />
      </div>

      {/* Concurrency & Safety Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worker Coordinator Architecture Card */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">
              Worker Coordinator Engine
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Claim Query Mechanism</span>
              <span className="text-emerald-400 font-semibold">
                SELECT FOR UPDATE SKIP LOCKED
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Concurrency Pool</span>
              <span className="text-slate-200">2 Threads (Bounded Executor)</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Lease Duration</span>
              <span className="text-slate-200">10 Seconds</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Poll Interval</span>
              <span className="text-slate-200">100 ms</span>
            </div>
            <div className="flex justify-between items-center py-1 font-mono">
              <span className="text-slate-400">Lease Heartbeat</span>
              <span className="text-slate-200">Background 3s Interval</span>
            </div>
          </div>
        </div>

        {/* Database & Fencing Protection */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Fencing Tokens & Crash Recovery
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Fencing Mechanism</span>
              <span className="text-cyan-400 font-semibold">
                Monotonic Fencing Tokens (UUID/Token)
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Zombified Worker Rejection</span>
              <span className="text-emerald-400 font-semibold">Zero Split-Brain Writes</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Idempotency Fingerprint</span>
              <span className="text-slate-200">SHA-256 Payload Hash</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400">Database Engine</span>
              <span className="text-slate-200">PostgreSQL 16.8 (Docker on D:)</span>
            </div>
            <div className="flex justify-between items-center py-1 font-mono">
              <span className="text-slate-400">HikariCP Pool Status</span>
              <span className="text-emerald-400 font-semibold">
                {health?.dbStatus === 'UP' ? 'Healthy & Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
