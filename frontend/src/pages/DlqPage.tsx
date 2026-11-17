import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useJobs, useDlqActions } from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { Pagination } from '../components/common/Pagination';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { formatDate } from '../lib/formatters';

export const DlqPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data: dlqData, isLoading, refetch, isFetching } = useJobs({
    page,
    size: pageSize,
    status: 'DEAD_LETTER',
    sortBy: 'updatedAt',
    sortDirection: 'DESC',
  });

  const { isAuthenticated, openUnlockModal } = useAuth();
  const { replayJob, discardJob, isReplaying, isDiscarding } = useDlqActions();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'replay' | 'discard' | null>(null);

  const handleAction = (jobId: string, action: 'replay' | 'discard') => {
    setSelectedJobId(jobId);
    setActionType(action);

    if (!isAuthenticated) {
      openUnlockModal();
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedJobId || !actionType) return;
    try {
      if (actionType === 'replay') {
        await replayJob(selectedJobId);
      } else {
        await discardJob(selectedJobId);
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setSelectedJobId(null);
      setActionType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Dead-Letter Queue</h2>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-purple-950/60 text-purple-300 border border-purple-800">
              {dlqData?.totalElements ?? 0} Poison Jobs
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Jobs that have exhausted maximum retries or encountered non-recoverable errors
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Replay / Discard Unlocked
            </span>
          ) : (
            <button
              onClick={() => openUnlockModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Unlock Admin for Replay
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* DLQ Table */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/40 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800/80">
              <tr>
                <th className="px-6 py-3">Job ID</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Retries</th>
                <th className="px-6 py-3">Failure Diagnostics</th>
                <th className="px-6 py-3">Failed At</th>
                <th className="px-6 py-3 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-sans">
                    Inspecting Dead-Letter Queue...
                  </td>
                </tr>
              ) : dlqData?.content && dlqData.content.length > 0 ? (
                dlqData.content.map((job) => (
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
                    <td className="px-6 py-3 text-rose-400">
                      {job.retryCount} / {job.maxRetries}
                    </td>
                    <td className="px-6 py-3 text-rose-300 max-w-sm truncate font-sans text-xs">
                      {job.lastErrorMessage || 'No error details recorded'}
                    </td>
                    <td className="px-6 py-3 text-slate-400 font-sans text-xs">
                      {formatDate(job.completedAt || job.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(job.jobId, 'replay')}
                          disabled={isReplaying}
                          title="Replay job: reset retries and requeue"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition shadow shadow-blue-600/20 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Replay
                        </button>
                        <button
                          onClick={() => handleAction(job.jobId, 'discard')}
                          disabled={isDiscarding}
                          title="Permanently discard poison job"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 rounded-md transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Discard
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-semibold text-white">
                        Dead-Letter Queue is Empty
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm">
                        All jobs are processing cleanly without unrecoverable errors.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {dlqData && (
          <Pagination
            currentPage={page}
            totalPages={dlqData.totalPages}
            totalElements={dlqData.totalElements}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
          />
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={selectedJobId !== null && isAuthenticated}
        title={actionType === 'replay' ? 'Replay Dead-Letter Job' : 'Discard Dead-Letter Job'}
        message={
          actionType === 'replay'
            ? `Replaying job ${selectedJobId} will reset its retry count to 0 and immediately transition it to PENDING.`
            : `Discarding job ${selectedJobId} will permanently mark it as FAILED and remove it from active queueing.`
        }
        confirmLabel={actionType === 'replay' ? 'Replay Job' : 'Discard Job'}
        variant={actionType === 'replay' ? 'primary' : 'danger'}
        isLoading={isReplaying || isDiscarding}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setSelectedJobId(null);
          setActionType(null);
        }}
      />
    </div>
  );
};
