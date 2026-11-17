import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient';
import type {
  JobSummary,
  JobDetail,
  JobExecutionLog,
  PageResponse,
  JobStatus,
} from '../types/job';
import type { DashboardStats, SystemMetricsSummary } from '../types/stats';
import type { SystemHealth } from '../types/health';
import type { ApiMessageResponse } from '../types/auth';

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiRequest<DashboardStats>('/dashboard/stats'),
    refetchInterval: 3000,
  });
}

export interface JobsQueryFilter {
  page?: number;
  size?: number;
  status?: JobStatus | '';
  jobType?: string;
  search?: string;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export function useJobs(filters: JobsQueryFilter) {
  const queryParams = new URLSearchParams();
  if (filters.page != null) queryParams.set('page', filters.page.toString());
  if (filters.size != null) queryParams.set('size', filters.size.toString());
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.jobType) queryParams.set('jobType', filters.jobType);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);
  if (filters.sortDirection) queryParams.set('sortDirection', filters.sortDirection);

  const queryString = queryParams.toString();
  const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;

  return useQuery<PageResponse<JobSummary>>({
    queryKey: ['jobs', filters],
    queryFn: () => apiRequest<PageResponse<JobSummary>>(endpoint),
    refetchInterval: 3000,
  });
}

export function useJobDetail(jobId: string | undefined) {
  return useQuery<JobDetail>({
    queryKey: ['job-detail', jobId],
    queryFn: () => apiRequest<JobDetail>(`/jobs/${jobId}/detail`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'RUNNING' || data.status === 'CLAIMED' || data.status === 'PENDING')) {
        return 2000;
      }
      return 10000;
    },
  });
}

export function useJobHistory(jobId: string | undefined) {
  return useQuery<JobExecutionLog[]>({
    queryKey: ['job-history', jobId],
    queryFn: () => apiRequest<JobExecutionLog[]>(`/jobs/${jobId}/history`),
    enabled: !!jobId,
    refetchInterval: () => {
      // If any active attempts, poll more often
      return 3000;
    },
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: () => apiRequest<SystemHealth>('/system/health'),
    refetchInterval: 5000,
  });
}

export function useSystemMetricsSummary() {
  return useQuery<SystemMetricsSummary>({
    queryKey: ['system-metrics-summary'],
    queryFn: () => apiRequest<SystemMetricsSummary>('/system/metrics-summary'),
    refetchInterval: 5000,
  });
}

export function useDlqActions() {
  const queryClient = useQueryClient();

  const replayMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiRequest<ApiMessageResponse>(`/admin/dlq/${jobId}/replay`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-detail'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const discardMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiRequest<ApiMessageResponse>(`/admin/dlq/${jobId}/discard`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-detail'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  return {
    replayJob: replayMutation.mutateAsync,
    isReplaying: replayMutation.isPending,
    discardJob: discardMutation.mutateAsync,
    isDiscarding: discardMutation.isPending,
  };
}
