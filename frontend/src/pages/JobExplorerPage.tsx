import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  X,
  Cpu,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useJobs, useJobDetail, useTenants, type JobsQueryFilter } from '../hooks/useQueueForgeData';
import { StatusBadge } from '../components/common/StatusBadge';
import { Pagination } from '../components/common/Pagination';
import { CopyableId } from '../components/ui/CopyableId';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { ExecutionTimeline } from '../components/ui/ExecutionTimeline';
import { formatDate } from '../lib/formatters';
import type { JobStatus } from '../types/job';
import { useAuth } from '../context/AuthContext';

export const JobExplorerPage: React.FC = () => {
  const [filters, setFilters] = useState<JobsQueryFilter>({
    page: 0,
    size: 15,
    status: '',
    jobType: '',
    search: '',
    sortBy: 'createdAt',
    sortDirection: 'DESC',
    tenantId: '',
    priority: undefined,
    minPriority: undefined,
    maxPriority: undefined,
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [drawerTab, setDrawerTab] = useState<'overview' | 'timeline' | 'payload' | 'failures'>('overview');

  const { data: pageData, isLoading, refetch, isFetching } = useJobs(filters);
  const { data: tenants } = useTenants();
  const { isAuthenticated, openUnlockModal } = useAuth();

  const { data: drawerJob, isLoading: drawerLoading } = useJobDetail(selectedJobId || undefined);

  const statuses: (JobStatus | '')[] = [
    '',
    'PENDING',
    'CLAIMED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'DEAD_LETTER',
  ];

  const handleStatusChange = (status: JobStatus | '') => {
    setFilters((prev) => ({ ...prev, status, page: 0 }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 0 }));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, jobType: e.target.value, page: 0 }));
  };

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, tenantId: e.target.value, page: 0 }));
  };

  const handlePriorityPreset = (preset: 'all' | 'high' | 'med' | 'low') => {
    switch (preset) {
      case 'high':
        setFilters((prev) => ({ ...prev, priority: undefined, minPriority: 80, page: 0 }));
        break;
      case 'med':
        setFilters((prev) => ({ ...prev, priority: 50, minPriority: undefined, page: 0 }));
        break;
      case 'low':
        setFilters((prev) => ({ ...prev, priority: 20, minPriority: undefined, page: 0 }));
        break;
      default:
        setFilters((prev) => ({ ...prev, priority: undefined, minPriority: undefined, page: 0 }));
        break;
    }
  };

  const toggleSortDirection = () => {
    setFilters((prev) => ({
      ...prev,
      sortDirection: prev.sortDirection === 'DESC' ? 'ASC' : 'DESC',
      page: 0,
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      page: 0,
      size: 15,
      status: '',
      jobType: '',
      search: '',
      sortBy: 'createdAt',
      sortDirection: 'DESC',
      tenantId: '',
      priority: undefined,
      minPriority: undefined,
      maxPriority: undefined,
    });
    setSelectedRowIds(new Set());
  };

  const hasActiveFilters = Boolean(
    filters.status ||
    filters.jobType ||
    filters.search ||
    filters.tenantId ||
    filters.priority != null ||
    filters.minPriority != null
  );

  const toggleSelectAll = () => {
    if (!pageData?.content) return;
    if (selectedRowIds.size === pageData.content.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(pageData.content.map((j) => j.jobId)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Job Explorer
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              SERVER PAGINATED
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Search, filter, inspect and trace durable queue tasks across distributed lifecycle states
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[var(--color-accent)]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-4 space-y-3.5 shadow-lg">
        {/* Search & Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search UUID or idempotency key..."
              value={filters.search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-4 py-2 text-xs bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-amethyst)]"
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Filter by Job Type (e.g. GENERATE_REPORT)..."
              value={filters.jobType}
              onChange={handleTypeChange}
              className="w-full px-3 py-2 text-xs bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-amethyst)]"
            />
          </div>

          <div>
            <select
              value={filters.tenantId || ''}
              onChange={handleTenantChange}
              className="w-full px-3 py-2 text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-amethyst)]"
            >
              <option value="">All Tenants (Global)</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sortBy: e.target.value, page: 0 }))
              }
              className="flex-1 px-3 py-2 text-xs font-mono bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-amethyst)]"
            >
              <option value="createdAt">Sort: Created Date</option>
              <option value="updatedAt">Sort: Updated Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="retryCount">Sort: Retries</option>
              <option value="scheduledAt">Sort: Scheduled Date</option>
            </select>
            <button
              onClick={toggleSortDirection}
              title={`Sort direction: ${filters.sortDirection}`}
              className="p-2 bg-[var(--color-bg-deep)] hover:bg-[var(--color-bg-interactive)] rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Pill Filters & Priority Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1 mr-1 font-mono">
              <Filter className="w-3 h-3" /> Status:
            </span>
            {statuses.map((st) => {
              const isSelected = filters.status === st;
              return (
                <button
                  key={st || 'ALL'}
                  onClick={() => handleStatusChange(st)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md border transition whitespace-nowrap ${
                    isSelected
                      ? 'bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border-[var(--color-amethyst-border)] font-semibold shadow-xs'
                      : 'bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-interactive)]'
                  }`}
                >
                  {st || 'ALL'}
                </button>
              );
            })}
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Priority:
            </span>
            {[
              { label: 'All', key: 'all', active: filters.priority === undefined && filters.minPriority === undefined },
              { label: 'High (80+)', key: 'high', active: filters.minPriority === 80 },
              { label: 'Med (50)', key: 'med', active: filters.priority === 50 },
              { label: 'Low (20)', key: 'low', active: filters.priority === 20 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => handlePriorityPreset(p.key as 'all' | 'high' | 'med' | 'low')}
                className={`px-2 py-0.5 rounded text-[11px] border transition ${
                  p.active
                    ? 'bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] border-[var(--color-accent)] font-semibold'
                    : 'bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result Metrics Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-secondary)] px-1">
        <div>
          Showing{' '}
          <span className="font-bold text-[var(--color-text-primary)]">
            {pageData ? pageData.content.length : 0}
          </span>{' '}
          of{' '}
          <span className="font-bold text-[var(--color-text-primary)]">
            {pageData?.totalElements ?? 0}
          </span>{' '}
          total matching jobs
        </div>

        {selectedRowIds.size > 0 && (
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-amethyst)]">
            <span>{selectedRowIds.size} rows selected</span>
            <button
              onClick={() => setSelectedRowIds(new Set())}
              className="text-[var(--color-text-muted)] hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Jobs Table */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] uppercase font-mono text-[10px] tracking-wider border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      pageData?.content &&
                      pageData.content.length > 0 &&
                      selectedRowIds.size === pageData.content.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)] text-[var(--color-amethyst)] focus:ring-0"
                  />
                </th>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Assigned Worker</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-[var(--color-text-muted)] font-mono">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[var(--color-amethyst)]" />
                      <span>Querying PostgreSQL database...</span>
                    </div>
                  </td>
                </tr>
              ) : pageData?.content && pageData.content.length > 0 ? (
                pageData.content.map((job) => {
                  const isSelected = selectedRowIds.has(job.jobId);
                  return (
                    <tr
                      key={job.jobId}
                      onClick={() => setSelectedJobId(job.jobId)}
                      className={`hover:bg-[var(--color-bg-interactive)] transition cursor-pointer ${
                        isSelected ? 'bg-[var(--color-amethyst-bg)]/20' : ''
                      }`}
                    >
                      <td
                        className="px-4 py-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectRow(job.jobId);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)] text-[var(--color-amethyst)] focus:ring-0"
                        />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-primary)] font-semibold">
                        <CopyableId id={job.jobId} prefixLen={8} />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {job.tenantId ? (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[10px] text-[var(--color-accent)] font-mono">
                            {job.tenantId}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">global</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {job.jobType}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            job.priority >= 75
                              ? 'bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]'
                              : job.priority >= 40
                              ? 'bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)]'
                              : 'bg-[var(--color-bg-deep)] text-[var(--color-text-muted)]'
                          }`}
                        >
                          P{job.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {job.attemptCount ?? job.retryCount} / {job.maxRetries}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] text-[11px]">
                        {job.lockedBy ? (
                          <span className="flex items-center gap-1 text-[var(--color-accent)] font-mono">
                            <Cpu className="w-3 h-3 text-[var(--color-accent)]" />
                            {job.lockedBy.split(':')[0]}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] font-sans text-xs">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJobId(job.jobId);
                            }}
                            className="text-xs text-[var(--color-amethyst)] hover:underline font-medium"
                          >
                            Inspect
                          </button>
                          <Link
                            to={`/jobs/${job.jobId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            title="Dedicated Job Page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center space-y-2 font-sans">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      No matching jobs found
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
                      No jobs matched the current filters. Adjust your search criteria or reset filters to view all jobs.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--color-amethyst)] rounded-lg hover:brightness-110"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pageData && pageData.totalPages > 1 && (
          <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]">
            <Pagination
              currentPage={filters.page ?? 0}
              totalPages={pageData.totalPages}
              totalElements={pageData.totalElements}
              pageSize={filters.size ?? 15}
              onPageChange={(newPage) => setFilters((prev) => ({ ...prev, page: newPage }))}
            />
          </div>
        )}
      </div>

      {/* JOB INSPECTOR DETAIL DRAWER */}
      <DetailDrawer
        isOpen={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
        title="Job Inspector"
        subtitle={selectedJobId ? `Job ${selectedJobId}` : ''}
        width="xl"
      >
        {drawerLoading ? (
          <div className="p-8 text-center text-xs font-mono text-[var(--color-text-muted)]">
            Loading job details from PostgreSQL...
          </div>
        ) : drawerJob ? (
          <div className="space-y-6">
            {/* Drawer Tab Navigation */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-medium">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'timeline', label: 'Execution Timeline' },
                { id: 'payload', label: 'Payload' },
                { id: 'failures', label: 'Failures & Diagnostics' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDrawerTab(tab.id as any)}
                  className={`flex-1 py-1.5 rounded-md text-xs transition ${
                    drawerTab === tab.id
                      ? 'bg-[var(--color-amethyst)] text-white font-semibold shadow-xs'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW */}
            {drawerTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Job ID</span>
                    <CopyableId id={drawerJob.jobId} prefixLen={12} />
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Status</span>
                    <div className="mt-1">
                      <StatusBadge status={drawerJob.status} />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Job Type</span>
                    <span className="text-[var(--color-text-primary)] font-semibold">{drawerJob.jobType}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Tenant Partition</span>
                    <span className="text-[var(--color-accent)] font-semibold">{drawerJob.tenantId || 'global'}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Priority Slot</span>
                    <span className="text-[var(--color-amethyst)] font-bold">P{drawerJob.priority}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Retries</span>
                    <span className="text-[var(--color-text-primary)]">
                      {drawerJob.retryCount} / {drawerJob.maxRetries}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Assigned Worker</span>
                    <span className="text-[var(--color-text-primary)]">{drawerJob.lockedBy || 'None (Idle/Completed)'}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Idempotency Key</span>
                    <span className="text-[var(--color-text-muted)] truncate block">
                      {drawerJob.idempotencyKey || '—'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Created:</span>
                    <span className="text-[var(--color-text-secondary)]">{formatDate(drawerJob.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Scheduled:</span>
                    <span className="text-[var(--color-text-secondary)]">{formatDate(drawerJob.scheduledAt)}</span>
                  </div>
                  {drawerJob.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Completed:</span>
                      <span className="text-[var(--color-success)]">{formatDate(drawerJob.completedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: EXECUTION TIMELINE */}
            {drawerTab === 'timeline' && (
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase text-[var(--color-text-muted)] tracking-wider">
                  Verified Audit Timeline
                </h4>
                <ExecutionTimeline job={drawerJob} />
              </div>
            )}

            {/* TAB 3: PAYLOAD */}
            {drawerTab === 'payload' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-[var(--color-text-muted)]">
                    Sanitized Payload Arguments
                  </span>
                  {!isAuthenticated && (
                    <button
                      onClick={() => openUnlockModal()}
                      className="text-xs text-[var(--color-amethyst)] hover:underline flex items-center gap-1 font-mono"
                    >
                      Unlock Admin to View Raw Secrets
                    </button>
                  )}
                </div>
                <pre className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-xs text-[var(--color-text-primary)] overflow-x-auto max-h-80 select-all">
                  {JSON.stringify(drawerJob.payload, null, 2)}
                </pre>
              </div>
            )}

            {/* TAB 4: FAILURES */}
            {drawerTab === 'failures' && (
              <div className="space-y-3">
                {drawerJob.lastErrorMessage || drawerJob.failureCategory ? (
                  <div className="space-y-3">
                    {drawerJob.failureCategory && (
                      <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs font-mono">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">Failure Classification</span>
                        <span className="text-[var(--color-danger)] font-bold text-sm">{drawerJob.failureCategory}</span>
                      </div>
                    )}
                    {drawerJob.lastErrorMessage && (
                      <div className="p-4 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-xs font-mono text-[var(--color-danger)] break-all">
                        <div className="font-bold mb-1 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> Latest Error Message
                        </div>
                        <div>{drawerJob.lastErrorMessage}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[var(--color-text-muted)] font-mono">
                    Zero recorded failures for this job execution lifecycle.
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <Link
                to={`/jobs/${drawerJob.jobId}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-amethyst)] hover:underline"
              >
                Dedicated Page <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedJobId(null)}
                className="px-3.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
            Job details could not be retrieved.
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
