import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Eye,
  ExternalLink,
  AlertTriangle,
  FileText,
  Terminal,
} from 'lucide-react';
import {
  useJobs,
  useJobDetail,
  useDlqJobDetail,
  useDlqActions,
} from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { Pagination } from '../components/common/Pagination';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { CopyableId } from '../components/ui/CopyableId';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { formatDate } from '../lib/formatters';
import type { FailureCategory } from '../types/job';

const FAILURE_CATEGORIES: { label: string; value: FailureCategory | '' }[] = [
  { label: 'All Failure Categories', value: '' },
  { label: 'Transient Failure', value: 'TRANSIENT_FAILURE' },
  { label: 'Permanent Failure', value: 'PERMANENT_FAILURE' },
  { label: 'Lease Expired', value: 'LEASE_EXPIRED' },
  { label: 'Handler Not Found', value: 'HANDLER_NOT_FOUND' },
];

export const DlqPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FailureCategory | ''>('');

  const { data: dlqData, isLoading, refetch, isFetching } = useJobs({
    page,
    size: pageSize,
    status: 'DEAD_LETTER',
    search: searchInput.trim() || undefined,
    sortBy: 'updatedAt',
    sortDirection: 'DESC',
  });

  const { isAuthenticated, openUnlockModal } = useAuth();
  const { replayJob, discardJob, isReplaying, isDiscarding } = useDlqActions();

  // Selected job for slide-over drawer
  const [inspectedJobId, setInspectedJobId] = useState<string | null>(null);
  const [isStackExpanded, setIsStackExpanded] = useState<boolean>(false);

  // Selected job for action modals
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'replay' | 'discard' | null>(null);

  // Queries for inspector drawer
  const { data: jobDetail, isLoading: jobDetailLoading } = useJobDetail(inspectedJobId ?? undefined);
  const { data: dlqDetail } = useDlqJobDetail(inspectedJobId ?? undefined, isAuthenticated);

  const handleActionClick = (jobId: string, action: 'replay' | 'discard') => {
    setActionJobId(jobId);
    setActionType(action);

    if (!isAuthenticated) {
      openUnlockModal();
    }
  };

  const handleConfirmAction = async () => {
    if (!actionJobId || !actionType) return;
    try {
      if (actionType === 'replay') {
        await replayJob(actionJobId);
      } else {
        await discardJob(actionJobId);
      }
      refetch();
    } catch (err: any) {
      alert(`Operation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionJobId(null);
      setActionType(null);
      if (inspectedJobId === actionJobId) {
        setInspectedJobId(null);
      }
    }
  };

  const dlqContent = dlqData?.content;

  // Client-side category filtering fallback if backend query returns unfiltered page
  const filteredJobs = useMemo(() => {
    if (!dlqContent) return [];
    if (!selectedCategory) return dlqContent;
    return dlqContent.filter((j) => j.failureCategory === selectedCategory);
  }, [dlqContent, selectedCategory]);

  const getFailureBadge = (cat?: string | null) => {
    switch (cat) {
      case 'TRANSIENT_FAILURE':
        return 'bg-[var(--color-amber-bg)] text-[var(--color-amber)] border-[var(--color-amber-border)]';
      case 'PERMANENT_FAILURE':
        return 'bg-[var(--color-crimson-bg)] text-[var(--color-crimson)] border-[var(--color-crimson-border)]';
      case 'LEASE_EXPIRED':
        return 'bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border-[var(--color-amethyst-border)]';
      case 'HANDLER_NOT_FOUND':
        return 'bg-[var(--color-crimson-bg)] text-[var(--color-crimson)] border-[var(--color-crimson-border)]';
      default:
        return 'bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Dead-Letter Queue Operations
            </h2>
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[var(--color-crimson-bg)] text-[var(--color-crimson)] border border-[var(--color-crimson-border)]">
              {dlqData?.totalElements ?? 0} Poison Jobs
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
              POISON ISOLATION
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Investigate unprocessable poison jobs, inspect diagnostics and stack traces, and execute authorized replay or discard recovery workflows
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/reliability"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--color-cyan)] bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)] rounded-lg hover:brightness-110 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Reliability Lab
          </Link>

          {isAuthenticated ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success)] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Replay / Discard Unlocked
            </span>
          ) : (
            <button
              onClick={() => openUnlockModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-amber-bg)] border border-[var(--color-amber-border)] text-[var(--color-amber)] text-xs font-semibold hover:brightness-110 transition"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Unlock Admin
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] rounded-lg border border-[var(--color-border-subtle)] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[var(--color-cyan)]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main DLQ Console Box */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg overflow-hidden">
        {/* Filter and Search Toolbar */}
        <div className="p-4 border-b border-[var(--color-border-subtle)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Poison Job Explorer
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Filter by failure taxonomy, inspect stack traces, and recover quarantined tasks
              </p>
            </div>
            {dlqData && (
              <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                {dlqData.totalElements} dead-letter records total
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by job ID, type, or error snippet..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-cyan)] focus:ring-1 focus:ring-[var(--color-cyan)] transition font-mono"
              />
            </div>

            {/* Failure Category Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value as FailureCategory | '');
                  setPage(0);
                }}
                className="px-3 py-2 bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-cyan)] transition font-mono"
              >
                {FAILURE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {(searchInput || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSelectedCategory('');
                  setPage(0);
                }}
                className="text-xs text-[var(--color-cyan)] hover:underline font-mono"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] uppercase text-[10px] tracking-wider border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-5 py-3">Job ID</th>
                <th className="px-5 py-3">Job Type</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Failure Category</th>
                <th className="px-5 py-3">Attempts</th>
                <th className="px-5 py-3">Last Error</th>
                <th className="px-5 py-3">Failed At</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-cyan)]" />
                    Loading dead-letter records...
                  </td>
                </tr>
              ) : filteredJobs && filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr
                    key={job.jobId}
                    className="hover:bg-[var(--color-bg-interactive)] transition group cursor-pointer"
                    onClick={() => setInspectedJobId(job.jobId)}
                  >
                    <td className="px-5 py-3.5 text-[var(--color-text-primary)] font-bold">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <CopyableId id={job.jobId} prefixLen={8} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[var(--color-cyan)]">
                      {job.jobType}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--color-text-secondary)] font-sans">
                      {job.tenantId || 'default'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getFailureBadge(
                          job.failureCategory
                        )}`}
                      >
                        {job.failureCategory || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--color-text-secondary)]">
                      <span className="font-bold text-[var(--color-crimson)]">{job.attemptCount}</span>
                      <span className="text-[var(--color-text-muted)]"> / {job.maxRetries}</span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate text-[var(--color-crimson)] font-sans text-[11px]" title={job.lastErrorMessage || ''}>
                      {job.lastErrorMessage || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--color-text-muted)] text-[11px]">
                      {formatDate(job.updatedAt || job.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectedJobId(job.jobId)}
                          className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-cyan)] hover:bg-[var(--color-cyan-bg)] rounded transition"
                          title="Inspect Diagnostics"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleActionClick(job.jobId, 'replay')}
                          disabled={isReplaying}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[var(--color-cyan)] hover:bg-[var(--color-cyan-bg)] rounded transition border border-[var(--color-cyan-border)]"
                          title="Replay Job to Pending"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Replay
                        </button>
                        <button
                          onClick={() => handleActionClick(job.jobId, 'discard')}
                          disabled={isDiscarding}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[var(--color-crimson)] hover:bg-[var(--color-crimson-bg)] rounded transition border border-[var(--color-crimson-border)]"
                          title="Archive Discard Job"
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
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[var(--color-success)] opacity-80" />
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Dead-Letter Queue is Clean
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      No poison jobs match the selected filter criteria. All tasks completed or retrying within bounds.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {dlqData && dlqData.totalPages > 1 && (
          <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]">
            <Pagination
              currentPage={page}
              totalPages={dlqData.totalPages}
              totalElements={dlqData.totalElements}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Slide-over Diagnostic Drawer */}
      <DetailDrawer
        isOpen={!!inspectedJobId}
        onClose={() => setInspectedJobId(null)}
        title="Dead-Letter Job Diagnostics"
      >
        {jobDetailLoading ? (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-cyan)]" />
            Loading job diagnostics...
          </div>
        ) : jobDetail ? (
          <div className="space-y-5 text-xs">
            {/* Top Identity Strip */}
            <div className="p-3.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block uppercase font-mono">
                  Job Identifier
                </span>
                <span className="font-bold text-sm font-mono text-[var(--color-text-primary)]">
                  <CopyableId id={jobDetail.jobId} prefixLen={12} />
                </span>
              </div>
              <span
                className={`px-2.5 py-1 rounded text-xs font-bold border ${getFailureBadge(
                  jobDetail.failureCategory
                )}`}
              >
                {jobDetail.failureCategory || 'DEAD_LETTER'}
              </span>
            </div>

            {/* Core Metadata Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                Execution Metadata
              </h4>
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Job Type:</span>
                  <span className="text-[var(--color-cyan)] font-bold">{jobDetail.jobType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Tenant ID:</span>
                  <span className="text-[var(--color-text-primary)] font-bold">{jobDetail.tenantId || 'default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Attempts / Max Retries:</span>
                  <span className="text-[var(--color-crimson)] font-bold">
                    {jobDetail.attemptCount} / {jobDetail.maxRetries}
                  </span>
                </div>
                {jobDetail.idempotencyKey && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Idempotency Key:</span>
                    <span className="text-[var(--color-text-secondary)] truncate max-w-[200px]" title={jobDetail.idempotencyKey}>
                      {jobDetail.idempotencyKey}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Created At:</span>
                  <span className="text-[var(--color-text-secondary)]">{formatDate(jobDetail.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Last Updated:</span>
                  <span className="text-[var(--color-text-secondary)]">{formatDate(jobDetail.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase text-[var(--color-crimson)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Fatal Error Message
              </h4>
              <div className="p-3.5 rounded-lg bg-[var(--color-crimson-bg)] border border-[var(--color-crimson-border)] text-xs text-[var(--color-crimson)] font-mono leading-relaxed break-words">
                {jobDetail.lastErrorMessage || 'No specific error message provided.'}
              </div>
            </div>

            {/* Diagnostic Stack Trace (Collapsible) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> Diagnostic Stack Trace
                </h4>
                <button
                  onClick={() => setIsStackExpanded(!isStackExpanded)}
                  className="text-[11px] text-[var(--color-cyan)] hover:underline font-mono"
                >
                  {isStackExpanded ? 'Collapse Trace' : 'Expand Trace'}
                </button>
              </div>

              {isStackExpanded && (
                <pre className="p-3 rounded-lg bg-black/60 border border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-secondary)] overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap">
                  {dlqDetail?.lastErrorStack ||
                    (jobDetail.executionLogs && jobDetail.executionLogs.length > 0 && jobDetail.executionLogs[jobDetail.executionLogs.length - 1].errorMessage) ||
                    'Stack trace unavailable or unauthenticated. Unlock Admin Mode to inspect full server-side exception frames.'}
                </pre>
              )}
            </div>

            {/* JSON Payload Viewer */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase text-[var(--color-text-muted)] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Job Payload (JSON)
              </h4>
              <pre className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-primary)] overflow-x-auto max-h-48">
                {JSON.stringify(jobDetail.payload, null, 2)}
              </pre>
            </div>

            {/* Action Bar inside Drawer */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <Link
                to={`/jobs/${jobDetail.jobId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-cyan)] hover:underline"
              >
                Open in Full Job Explorer <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleActionClick(jobDetail.jobId, 'replay')}
                  className="px-3 py-1.5 text-xs font-bold text-[var(--color-cyan)] bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)] rounded-lg hover:brightness-110 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Replay
                </button>
                <button
                  onClick={() => handleActionClick(jobDetail.jobId, 'discard')}
                  className="px-3 py-1.5 text-xs font-bold text-[var(--color-crimson)] bg-[var(--color-crimson-bg)] border border-[var(--color-crimson-border)] rounded-lg hover:brightness-110 transition flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Discard
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            Job details not found.
          </div>
        )}
      </DetailDrawer>

      {/* Confirmation Modal */}
      {actionJobId && actionType && (
        <ConfirmModal
          isOpen={true}
          title={actionType === 'replay' ? 'Replay Dead-Letter Job' : 'Discard & Archive Dead-Letter Job'}
          message={
            actionType === 'replay'
              ? `Are you sure you want to replay poison job ${actionJobId}? Its status will be safely reset to PENDING with a zeroed claim token, allowing any available healthy worker to re-attempt processing.`
              : `Are you sure you want to discard poison job ${actionJobId}? The job record will be transitioned to an archived terminal state to maintain the append-only audit trail while permanently removing it from active worker scheduling.`
          }
          confirmLabel={actionType === 'replay' ? 'Replay Job' : 'Discard Job'}
          variant={actionType === 'replay' ? 'primary' : 'danger'}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            setActionJobId(null);
            setActionType(null);
          }}
        />
      )}
    </div>
  );
};
