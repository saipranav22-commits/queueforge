import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Cpu,
  Shield,
  Key,
  AlertTriangle,
  History,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  useJobDetail,
  useJobHistory,
  useDlqActions,
} from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { JsonViewer } from '../components/common/JsonViewer';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { formatDate, formatDurationMs } from '../lib/formatters';

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading, error } = useJobDetail(jobId);
  const { data: history } = useJobHistory(jobId);
  const { isAuthenticated, openUnlockModal } = useAuth();
  const { replayJob, discardJob, isReplaying, isDiscarding } = useDlqActions();

  const [showStackTrace, setShowStackTrace] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'replay' | 'discard' | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 font-mono text-xs">
        Loading job details...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-rose-400 font-semibold text-sm">Job Not Found</div>
        <p className="text-xs text-slate-400">
          The requested job identifier could not be located in the database.
        </p>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Job Explorer
        </Link>
      </div>
    );
  }

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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/jobs"
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white font-mono">{job.jobId}</h2>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Type: {job.jobType}</p>
          </div>
        </div>

        {/* DLQ Replay / Discard Actions */}
        {job.status === 'DEAD_LETTER' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleActionClick('replay')}
              disabled={isReplaying}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Replay Job
            </button>
            <button
              onClick={() => handleActionClick('discard')}
              disabled={isDiscarding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 rounded-lg transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard Job
            </button>
          </div>
        )}
      </div>

      {/* Grid: Metadata Properties */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Retries Exhausted
          </span>
          <div className="text-base font-bold font-mono text-white">
            {job.retryCount} / {job.maxRetries} attempts
          </div>
          <div className="text-xs text-slate-500">Timeout: {job.timeoutSeconds}s</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Claim / Worker
          </span>
          <div className="text-xs font-mono text-slate-300 truncate">
            {job.workerId || 'None (Unassigned)'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 truncate">
            Token: {job.claimToken || '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Idempotency Key
          </span>
          <div className="text-xs font-mono text-slate-300 truncate">
            {job.idempotencyKey || 'None'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 truncate">
            Hash: {job.idempotencyFingerprint ? `${job.idempotencyFingerprint.slice(0, 16)}...` : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Created Date
          </span>
          <div className="text-xs font-mono text-slate-300">
            {formatDate(job.createdAt)}
          </div>
          <div className="text-[11px] text-slate-500">
            Updated: {formatDate(job.updatedAt)}
          </div>
        </div>
      </div>

      {/* Error Diagnostics (if failed/dead-letter) */}
      {(job.lastErrorMessage || job.lastErrorCategory) && (
        <div className="rounded-xl bg-rose-950/20 border border-rose-900/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Failure Diagnostics
              </span>
            </div>
            {job.lastErrorCategory && (
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                {job.lastErrorCategory}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-rose-200/90 leading-relaxed bg-rose-950/40 p-3 rounded-lg border border-rose-900/40">
            {job.lastErrorMessage}
          </p>
          {job.lastErrorStackTrace && (
            <div>
              <button
                onClick={() => setShowStackTrace((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium"
              >
                {showStackTrace ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showStackTrace ? 'Hide Stack Trace' : 'Show Full Stack Trace'}
              </button>
              {showStackTrace && (
                <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 max-h-60 overflow-y-auto">
                  <pre className="text-[11px] font-mono text-rose-300/80 leading-relaxed">
                    {job.lastErrorStackTrace}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payload Viewer */}
      <JsonViewer jsonString={job.payloadJson} title="Job Payload JSON" />

      {/* Execution Attempt History / Timeline */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Execution Attempt History</h3>
        </div>

        {history && history.length > 0 ? (
          <div className="space-y-3 font-mono">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-400">
                      Attempt #{item.attemptNumber}
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">Worker: {item.workerId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[11px]">
                      Duration: {formatDurationMs(item.durationMs)}
                    </span>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-sans flex items-center justify-between">
                  <span>Started: {formatDate(item.executionStartedAt)}</span>
                  <span>Ended: {formatDate(item.executionEndedAt)}</span>
                </div>

                {item.errorMessage && (
                  <div className="mt-1 text-xs text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-900/30">
                    <span className="font-semibold text-rose-400">[{item.failureCategory || 'ERROR'}]: </span>
                    {item.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 font-sans">
            No historical worker execution attempts logged yet for this job.
          </div>
        )}
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
