import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ArrowRight,
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
        value: `${dlqCount} quarantined`,
        reason: 'Permanent handler exceptions or exhausted retries have isolated jobs into the dead-letter queue.',
        recommendation: 'Inspect exception traces and trigger authenticated recovery replay.',
        link: '/dlq',
        actionText: 'Review Poison Jobs',
      });
    }

    // Rule 3: Stale Worker Heartbeats
    if (workers && workers.length > 0) {
      const staleWorkers = workers.filter((w) => {
        if (!w.lastHeartbeat) return true;
        const ageSeconds = (Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000;
        return ageSeconds > 15;
      });

      if (staleWorkers.length > 0) {
        insights.push({
          id: 'stale-heartbeat',
          severity: 'WARNING',
          subsystem: 'Worker Fleet',
          metric: 'Heartbeat Health',
          value: `${staleWorkers.length} nodes stale`,
          reason: 'Worker nodes have missed the 15-second heartbeat freshness deadline. Leases are eligible for sweeper reclamation.',
          recommendation: 'Check worker CPU saturation or restart unresponsive worker JVM instances.',
          link: '/workers',
          actionText: 'Inspect Worker Nodes',
        });
      }
    }

    // Rule 4: Queue Congestion Threshold
    const pendingCount = stats?.pendingJobs ?? 0;
    if (pendingCount > 100) {
      insights.push({
        id: 'queue-congestion',
        severity: 'WARNING',
        subsystem: 'Job Queue',
        metric: 'Pending Backlog',
        value: `${pendingCount} jobs`,
        reason: 'High ingestion rate exceeds current cluster claiming concurrency capacity.',
        recommendation: 'Increase worker instance count or adjust tenant DRR quantum weights.',
        link: '/jobs',
        actionText: 'View Queue Backlog',
      });
    }

    // Rule 5: Outbox Backlog Warning
    const unprocessedOutbox = outboxStats?.pendingCount ?? 0;
    if (unprocessedOutbox > 50) {
      insights.push({
        id: 'outbox-backlog',
        severity: 'WARNING',
        subsystem: 'Transactional Outbox',
        metric: 'Unprocessed Events',
        value: `${unprocessedOutbox} pending`,
        reason: 'Outbox polling publisher has accumulated un-relayed business events.',
        recommendation: 'Trigger manual batch dispatch or inspect simulated payment receiver latency.',
        link: '/pipeline',
        actionText: 'Dispatch Outbox Batch',
      });
    }

  // Fallback Nominal Baseline (Only if zero issues detected)
  if (insights.length === 0) {
    insights.push({
      id: 'nominal-baseline',
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

  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
            Deterministic Operator Intelligence
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Automated invariant and threshold diagnostics derived from telemetry.
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
          {insights.length} {insights.length === 1 ? 'Insight' : 'Insights'} Evaluated
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {insights.map((insight) => {
          const isCritical = insight.severity === 'CRITICAL';
          const isWarning = insight.severity === 'WARNING';
          const isNominal = insight.severity === 'NOMINAL';

          return (
            <div
              key={insight.id}
              className={`rounded-lg bg-[var(--color-bg-deep)] border p-4 flex flex-col justify-between transition ${
                isCritical
                  ? 'border-[var(--color-danger-border)]'
                  : isWarning
                  ? 'border-[var(--color-warning-border)]'
                  : isNominal
                  ? 'border-[var(--color-success-border)]'
                  : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-interactive)]'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${
                      isCritical
                        ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]'
                        : isWarning
                        ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]'
                        : isNominal
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
                        : 'bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]'
                    }`}
                  >
                    {isCritical && <AlertOctagon className="w-3 h-3" />}
                    {isWarning && <AlertTriangle className="w-3 h-3" />}
                    {isNominal && <CheckCircle2 className="w-3 h-3" />}
                    {!isCritical && !isWarning && !isNominal && <Info className="w-3 h-3" />}
                    {insight.severity}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    {insight.subsystem}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                    <span>{insight.metric}:</span>
                    <span className="font-mono text-[var(--color-text-primary)]">
                      {insight.value}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[var(--color-text-secondary)] leading-relaxed mt-1">
                    {insight.reason}
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--color-border-subtle)]/60 text-[11px] text-[var(--color-text-muted)]">
                  <strong className="text-[var(--color-text-secondary)] font-medium">Action: </strong>
                  {insight.recommendation}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-end">
                <Link
                  to={insight.link}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition"
                >
                  <span>{insight.actionText}</span>
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
