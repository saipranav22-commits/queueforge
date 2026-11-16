import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ArrowUpDown, RefreshCw } from 'lucide-react';
import { useJobs, type JobsQueryFilter } from '../hooks/useQueueForgeData';
import { StatusBadge } from '../components/common/StatusBadge';
import { Pagination } from '../components/common/Pagination';
import { formatDate } from '../lib/formatters';
import type { JobStatus } from '../types/job';

export const JobExplorerPage: React.FC = () => {
  const [filters, setFilters] = useState<JobsQueryFilter>({
    page: 0,
    size: 10,
    status: '',
    jobType: '',
    search: '',
    sortBy: 'createdAt',
    sortDirection: 'DESC',
  });

  const { data: pageData, isLoading, refetch, isFetching } = useJobs(filters);

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

  const toggleSortDirection = () => {
    setFilters((prev) => ({
      ...prev,
      sortDirection: prev.sortDirection === 'DESC' ? 'ASC' : 'DESC',
      page: 0,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Job Explorer</h2>
          <p className="text-xs text-slate-400 mt-1">
            Search, filter, inspect and trace durable queue tasks across lifecycle states
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-4">
        {/* Search & Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Job ID or payload..."
              value={filters.search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Filter by Job Type (e.g. GENERATE_REPORT)..."
              value={filters.jobType}
              onChange={handleTypeChange}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sortBy: e.target.value, page: 0 }))
              }
              className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="createdAt">Sort: Created Date</option>
              <option value="updatedAt">Sort: Updated Date</option>
              <option value="retryCount">Sort: Retries</option>
            </select>
            <button
              onClick={toggleSortDirection}
              title={`Sort direction: ${filters.sortDirection}`}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          <span className="text-[11px] font-semibold uppercase text-slate-500 flex items-center gap-1 mr-1">
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
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500 font-semibold'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                {st || 'ALL'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/40 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800/80">
              <tr>
                <th className="px-6 py-3">Job ID</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Retries</th>
                <th className="px-6 py-3">Idempotency Key</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    Loading jobs from PostgreSQL...
                  </td>
                </tr>
              ) : pageData?.content && pageData.content.length > 0 ? (
                pageData.content.map((job) => (
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
                    <td className="px-6 py-3 text-slate-400 font-mono text-xs max-w-xs truncate">
                      {job.idempotencyKey || '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-400 font-sans text-xs">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-right font-sans">
                      <Link
                        to={`/jobs/${job.jobId}`}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No jobs match the specified criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pageData && (
          <Pagination
            currentPage={filters.page ?? 0}
            totalPages={pageData.totalPages}
            totalElements={pageData.totalElements}
            pageSize={filters.size ?? 10}
            onPageChange={(newPage) => setFilters((prev) => ({ ...prev, page: newPage }))}
          />
        )}
      </div>
    </div>
  );
};
