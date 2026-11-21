import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  History,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  useJobDetail,
  useDlqActions,
} from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { ExecutionTimeline } from '../components/ui/ExecutionTimeline';
import { JsonViewer } from '../components/common/JsonViewer';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { formatDate } from '../lib/formatters';

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading, error } = useJobDetail(jobId);
  const { isAuthenticated, openUnlockModal } = useAuth();
  const { replayJob, discardJob, isReplaying, isDiscarding } = useDlqActions();

  const [confirmAction, setConfirmAction] = useState<'replay' | 'discard' | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--color-text-muted)] font-mono text-xs">
        Loading job details from PostgreSQL cluster...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 text-center space-y-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
        <div className="text-[var(--color-danger)] font-semibold text-sm">Job Not Located</div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          The requested job identifier could not be found or belongs to another tenant partition.
        </p>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-amethyst)] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Job Explorer
        </Link>
      </div>
    );
  }

  const isPayloadMasked =
    !isAuthenticated &&
    job.payload &&
    (Boolean(job.payload._masked) ||
      (typeof job.payload === 'object' && '_masked' in job.payload) ||
      (typeof job.payload === 'string' && (job.payload.includes('_masked') || job.payload.includes('REDACTED'))));

  const handleActionClick = (action: 'replay' | 'discard') => {
    if (!isAuthenticated) {
      openUnlockModal(() => setConfirmAction(action));
    } else {
      setConfirmAction(action);
    }
  };

  const handleConfirmAction = async () => {
    if (!jobId) return;
    try {
      if (confirmAction === 'replay') {
        await replayJob(jobId);
      } else if (confirmAction === 'discard') {
        await discardJob(jobId);
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setConfirmAction(null);
    }
  };

  const payloadString =
    typeof job.payload === 'string' ? job.payload : JSON.stringify(job.payload, null, 2);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-3">
          <Link
            to="/jobs"
            className="p-2 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] font-mono">{job.jobId}</h2>
              <StatusBadge status={job.status} />
              {job.tenantId && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-accent)]">
                  {job.tenantId}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-mono">
              Type: {job.jobType} • Priority: P{job.priority}
            </p>
          </div>
        </div>

        {/* DLQ Replay / Discard Actions */}
        {job.status === 'DEAD_LETTER' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleActionClick('replay')}
              disabled={isReplaying}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)] disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Replay Job
            </button>
            <button
              onClick={() => handleActionClick('discard')}
              disabled={isDiscarding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--color-danger)] bg-[var(--color-danger-bg)] hover:brightness-110 border border-[var(--color-danger-border)] rounded-lg transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard Job
            </button>
          </div>
        )}
      </div>

      {/* Grid: Metadata Properties */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] font-mono">
            Retries Exhausted
          </span>
          <div className="text-base font-bold font-mono text-[var(--color-text-primary)]">
            {job.retryCount} / {job.maxRetries} retries
          </div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono">
            Attempts: {job.attemptCount} | Priority: P{job.priority}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] font-mono">
            Assigned Worker Lease
          </span>
          <div className="text-xs font-mono text-[var(--color-accent)] truncate font-semibold">
            {job.lockedBy || 'None (Unassigned)'}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
            Status: {job.status}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] font-mono">
            Idempotency Key
          </span>
          <div className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
            {job.idempotencyKey || '—'}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
            Created: {formatDate(job.createdAt)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] font-mono">
            Lifecycle Completion
          </span>
          <div className="text-xs font-mono text-[var(--color-success)] font-semibold truncate">
            {job.completedAt ? formatDate(job.completedAt) : 'Pending / Active'}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
            Updated: {formatDate(job.updatedAt)}
          </div>
        </div>
      </div>

      {/* Error Callout if Failed */}
      {job.lastErrorMessage && (
        <div className="p-5 rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--color-danger)] font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Failure Description: {job.failureCategory ? `[${job.failureCategory}]` : ''}</span>
          </div>
          <p className="text-xs font-mono text-[var(--color-danger)] leading-relaxed bg-[var(--color-bg-deep)] p-3 rounded-lg border border-[var(--color-danger-border)] select-all break-all">
            {job.lastErrorMessage}
          </p>
        </div>
      )}

      {/* Payload Viewer / Protection */}
      {isPayloadMasked ? (
        <div className="rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Sensitive Job Payload Protected</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Authentication is required to inspect raw payload arguments and operational details.
              </p>
            </div>
          </div>
          <button
            onClick={() => openUnlockModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--color-amethyst)] hover:brightness-110 rounded-lg transition shadow-md shadow-[var(--color-amethyst)]/20"
          >
            <Unlock className="w-3.5 h-3.5" />
            Unlock to View
          </button>
        </div>
      ) : (
        <JsonViewer jsonString={payloadString} title="Job Payload JSON" />
      )}

      {/* Execution Attempt History / Timeline */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--color-amethyst)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Verified Execution Timeline</h3>
        </div>

        <ExecutionTimeline job={job} />
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmAction !== null}
        title={confirmAction === 'replay' ? 'Replay Dead-Letter Job' : 'Discard Dead-Letter Job'}
        message={
          confirmAction === 'replay'
            ? `Are you sure you want to replay job ${jobId}? Its retry counter will be reset to 0, lease cleared, and status transitioned to PENDING for immediate worker pickup.`
            : `Are you sure you want to permanently discard job ${jobId}? Its status will be marked as FAILED with a discard tombstone and it will not be executed again.`
        }
        confirmLabel={confirmAction === 'replay' ? 'Replay Job' : 'Discard Job'}
        variant={confirmAction === 'replay' ? 'primary' : 'danger'}
        isLoading={isReplaying || isDiscarding}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};
