import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlayCircle,
  Flame,
  Cpu,
} from 'lucide-react';
import type { JobDetail } from '../../types/job';
import { formatDate, formatDurationMs } from '../../lib/formatters';

interface ExecutionTimelineProps {
  job: JobDetail;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({ job }) => {
  const logs = [...(job.executionLogs || [])].sort((a, b) => a.attempt - b.attempt);

  return (
    <div className="space-y-4">
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--color-border-subtle)]">
        {/* Event 1: Job Submission */}
        <div className="relative">
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--color-bg-deep)] border-2 border-[var(--color-amethyst)] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-amethyst)]" />
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                Job Enqueued
              </span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                {formatDate(job.createdAt)}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] font-mono flex items-center gap-3">
              <span>Priority: {job.priority}</span>
              <span>•</span>
              <span>Max Retries: {job.maxRetries}</span>
              {job.tenantId && (
                <>
                  <span>•</span>
                  <span>Tenant: {job.tenantId}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Event 2: Scheduled Delay (if applicable) */}
        {job.scheduledAt &&
          new Date(job.scheduledAt).getTime() > new Date(job.createdAt).getTime() + 1000 && (
            <div className="relative">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--color-bg-deep)] border-2 border-[var(--color-accent)] flex items-center justify-center">
                <Clock className="w-3 h-3 text-[var(--color-accent)]" />
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    Scheduled Delay Dispatch
                  </span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    {formatDate(job.scheduledAt)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] font-sans">
                  Job execution deferred until target timestamp.
                </div>
              </div>
            </div>
          )}

        {/* Event 3: Recorded Execution Attempts from Audit Log */}
        {logs.map((log) => {
          const isSuccess = log.status === 'COMPLETED';
          const isFailure = log.status === 'FAILED';
          const isDeadLetter = log.status === 'DEAD_LETTER';

          const borderColor = isSuccess
            ? 'border-[var(--color-success)]'
            : isFailure
            ? 'border-[var(--color-warning)]'
            : isDeadLetter
            ? 'border-[var(--color-danger)]'
            : 'border-[var(--color-accent)]';

          const iconColor = isSuccess
            ? 'text-[var(--color-success)]'
            : isFailure
            ? 'text-[var(--color-warning)]'
            : isDeadLetter
            ? 'text-[var(--color-danger)]'
            : 'text-[var(--color-accent)]';

          return (
            <div key={log.id} className="relative">
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--color-bg-deep)] border-2 ${borderColor} flex items-center justify-center`}
              >
                {isSuccess ? (
                  <CheckCircle2 className={`w-3 h-3 ${iconColor}`} />
                ) : isDeadLetter ? (
                  <Flame className={`w-3 h-3 ${iconColor}`} />
                ) : isFailure ? (
                  <AlertTriangle className={`w-3 h-3 ${iconColor}`} />
                ) : (
                  <PlayCircle className={`w-3 h-3 ${iconColor}`} />
                )}
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      Execution Attempt #{log.attempt}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isSuccess
                          ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                          : isDeadLetter
                          ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]'
                          : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                <div className="mt-1 text-[11px] font-mono text-[var(--color-text-secondary)] flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-[var(--color-text-muted)]" />
                    Actor: {log.workerId || 'unknown-worker'}
                  </span>
                  <span>•</span>
                  <span>Duration: {formatDurationMs(log.executionTimeMs)}</span>
                </div>

                {log.errorMessage && (
                  <div className="mt-2 p-2 rounded bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[11px] font-mono text-[var(--color-danger)] break-all">
                    {log.errorMessage}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Event 4: Currently Running / Claimed Active Lease */}
        {(job.status === 'RUNNING' || job.status === 'CLAIMED') && (
          <div className="relative">
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--color-bg-deep)] border-2 border-[var(--color-accent)] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-ping" />
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-accent-border)] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-accent)] flex items-center gap-1.5">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Currently Executing on Worker
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent-border)]">
                  ACTIVE LEASE
                </span>
              </div>
              <div className="mt-1.5 text-[11px] font-mono text-[var(--color-text-secondary)]">
                Assigned Worker: <span className="text-[var(--color-text-primary)] font-semibold">{job.lockedBy || 'Active Worker Thread'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Event 5: Terminal Completion or Terminal Dead Letter */}
        {job.status === 'COMPLETED' && logs.length > 0 && logs[logs.length - 1].status === 'COMPLETED' && (
          <div className="relative">
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--color-bg-deep)] border-2 border-[var(--color-success)] flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-success)]">
                  Terminal Success Committed
                </span>
                <span className="text-[10px] font-mono text-[var(--color-success)]">
                  {formatDate(job.completedAt || job.updatedAt)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                All execution lifecycle requirements satisfied. Job output committed to database.
              </p>
            </div>
          </div>
        )}

        {job.status === 'DEAD_LETTER' && (
          <div className="relative">
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[var(--color-bg-deep)] border-2 border-[var(--color-danger)] flex items-center justify-center">
              <Flame className="w-3 h-3 text-[var(--color-danger)]" />
            </div>
            <div className="p-3.5 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-danger)] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  Dead-Letter Partition: Max Retries Exhausted
                </span>
                <span className="text-[10px] font-mono text-[var(--color-danger)]">
                  {formatDate(job.completedAt || job.updatedAt)}
                </span>
              </div>
              {job.failureCategory && (
                <div className="mt-1 text-[11px] font-mono text-[var(--color-text-secondary)]">
                  Classification: <span className="text-[var(--color-danger)] font-bold">{job.failureCategory}</span>
                </div>
              )}
              {job.lastErrorMessage && (
                <div className="mt-1 text-[11px] font-mono text-[var(--color-text-secondary)] break-all">
                  Final Reason: {job.lastErrorMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
