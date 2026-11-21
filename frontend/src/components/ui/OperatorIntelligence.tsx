import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import {
  useSystemHealth,
  useWorkerFleet,
  useDashboardStats,
  useOutboxStats,
} from '../../hooks/useQueueForgeData';

export interface OperationalInsight {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL';
  subsystem: string;
  metric: string;
  value: string | number;
  reason: string;
  recommendation: string;
  link: string;
  actionText: string;
}

export const OperatorIntelligence: React.FC = () => {
  const { data: health } = useSystemHealth();
  const { data: workers } = useWorkerFleet();
  const { data: stats } = useDashboardStats();
  const { data: outboxStats } = useOutboxStats();

  const insights: OperationalInsight[] = [];

  // Rule 1: Database Connectivity Check
  if (health && health.dbStatus !== 'UP') {
    insights.push({
      id: 'db-down',
      severity: 'CRITICAL',
      subsystem: 'sender-db',
      metric: 'Database Status',
      value: health.dbStatus || 'UNKNOWN',
      reason: 'PostgreSQL primary connection is unreachable. Task ingestion and lease renewals are paused.',
      recommendation: 'Check docker network routing and PostgreSQL container logs.',
      link: '/monitoring',
      actionText: 'Inspect Connectivity',
    });
  }

  // Rule 2: Dead-Letter Queue Backlog
  const dlqCount = stats?.deadLetterJobs ?? 0;
  if (dlqCount > 0) {
    insights.push({
      id: 'dlq-backlog',
      severity: 'CRITICAL',
      subsystem: 'Dead-Letter Queue',
      metric: 'Poison Jobs',
      value: `${dlqCount} poisoned`,
      reason: `${dlqCount} job(s) exhausted maximum retry attempts and are isolated in the Dead-Letter Queue.`,
      recommendation: 'Inspect error stack traces, unlock redacted payload, and trigger authenticated replay if downstream service recovered.',
      link: '/dlq',
      actionText: 'Review DLQ',
    });
  }

  // Rule 3: Stale Worker Heartbeat Check
  if (workers && workers.length > 0) {
    const staleWorkers = workers.filter((w) => {
      if (!w.lastHeartbeat) return true;
      const ageSeconds = (Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000;
      return ageSeconds > 15;
    });

    if (staleWorkers.length > 0) {
      insights.push({
        id: 'stale-worker',
        severity: 'WARNING',
        subsystem: 'Worker Fleet',
        metric: 'Heartbeat Freshness',
        value: `${staleWorkers.length} stale node(s)`,
        reason: `Worker instance ${staleWorkers.map((w) => w.instanceId).join(', ')} has missed its 5-second heartbeat window for >15s.`,
        recommendation: 'Background lease reaper will automatically reclaim abandoned tasks after the 30s lease expiry.',
        link: '/workers',
        actionText: 'Inspect Fleet',
      });
    }
  }

  // Rule 4: High Queue Depth Congestion Check
  const pendingJobs = stats?.pendingJobs ?? 0;
  const activeWorkers = stats?.activeWorkers ?? 1;
  if (pendingJobs > 100) {
    insights.push({
      id: 'queue-congestion',
      severity: 'WARNING',
      subsystem: 'Job Queue',
      metric: 'Pending Backlog',
      value: `${pendingJobs} pending`,
      reason: `Queue depth exceeds 100 jobs while active worker capacity is ${activeWorkers}. Processing delay may increase.`,
      recommendation: 'Verify worker threads are not blocked on external network I/O or increase worker instance count.',
      link: '/jobs',
      actionText: 'Explore Jobs',
    });
  }

  // Rule 5: Outbox Pending Backlog
  const pendingOutbox = outboxStats?.pendingCount ?? 0;
  if (pendingOutbox > 50) {
    insights.push({
      id: 'outbox-pending',
      severity: 'WARNING',
      subsystem: 'Transactional Outbox',
      metric: 'Pending Events',
      value: `${pendingOutbox} staged`,
      reason: 'Outbox dispatcher has >50 staged events awaiting HTTP delivery to simulated payment receiver.',
      recommendation: 'Trigger manual outbox sweep from the Event Pipeline page or inspect payment-receiver status.',
      link: '/pipeline',
      actionText: 'Review Pipeline',
    });
  }

  // Rule 6: Nominal State Fallback
  if (insights.length === 0) {
    insights.push({
      id: 'cluster-nominal',
      severity: 'NOMINAL',
      subsystem: 'Cluster Operations',
      metric: 'All Subsystems',
      value: 'Optimal',
      reason: 'All worker heartbeats fresh (<5s), primary PostgreSQL database UP, zero poison jobs in DLQ, and outbox queue healthy.',
      recommendation: 'Continue routine operational monitoring or submit synthetic workloads from Job Explorer.',
      link: '/jobs',
      actionText: 'View Workloads',
    });
  }

  const getSeverityBadge = (sev: OperationalInsight['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          bg: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
          icon: AlertOctagon,
        };
      case 'WARNING':
        return {
          bg: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
          icon: AlertTriangle,
        };
      case 'INFO':
        return {
          bg: 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border-[var(--color-cyan-border)]',
          icon: Info,
        };
      case 'NOMINAL':
      default:
        return {
          bg: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
          icon: CheckCircle2,
        };
    }
  };

  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)] flex items-center justify-center">
            <Cpu className="w-4 h-4 text-[var(--color-cyan)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
              Deterministic Operator Intelligence
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Automated invariant and threshold diagnostics derived from live telemetry.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
          {insights.length} Insight{insights.length === 1 ? '' : 's'} Evaluated
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {insights.map((ins) => {
          const badge = getSeverityBadge(ins.severity);
          const IconComp = badge.icon;

          return (
            <div
              key={ins.id}
              className="rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] p-4 flex flex-col justify-between hover:border-[var(--color-border-interactive)] transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${badge.bg}`}
                  >
                    <IconComp className="w-3 h-3" />
                    {ins.severity}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    {ins.subsystem}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    <span>{ins.metric}:</span>
                    <span className="font-mono text-[var(--color-cyan)]">{ins.value}</span>
                  </div>
                  <p className="text-[11.5px] text-[var(--color-text-secondary)] leading-relaxed mt-1">
                    {ins.reason}
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--color-border-subtle)]/60 text-[11px] text-[var(--color-text-muted)]">
                  <strong className="text-[var(--color-text-secondary)] font-medium">Action: </strong>
                  {ins.recommendation}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-end">
                <Link
                  to={ins.link}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-cyan)] hover:underline"
                >
                  <span>{ins.actionText}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
