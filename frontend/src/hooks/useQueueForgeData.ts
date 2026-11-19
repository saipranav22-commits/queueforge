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
  tenantId?: string;
  priority?: number;
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
  if (filters.tenantId) queryParams.set('tenantId', filters.tenantId);
  if (filters.priority != null) queryParams.set('priority', filters.priority.toString());

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

export function useWorkerFleet() {
  return useQuery<import('../types/worker').WorkerInstance[]>({
    queryKey: ['system-workers'],
    queryFn: () => apiRequest<import('../types/worker').WorkerInstance[]>('/system/workers'),
    refetchInterval: 3000,
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

export function useTenants(enabled = true) {
  return useQuery<import('../types/tenant').TenantSummary[]>({
    queryKey: ['admin-tenants'],
    queryFn: () => apiRequest<import('../types/tenant').TenantSummary[]>('/admin/tenants'),
    enabled,
    refetchInterval: 5000,
    retry: false, // Don't spam if 401 unauthenticated
  });
}

export function useManualOutboxDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params?: { batchSize?: number; leaseDurationSeconds?: number }) => {
      const q = new URLSearchParams();
      if (params?.batchSize) q.set('batchSize', params.batchSize.toString());
      if (params?.leaseDurationSeconds) q.set('leaseDurationSeconds', params.leaseDurationSeconds.toString());
      const queryStr = q.toString();
      return apiRequest<import('../types/outbox').OutboxDispatchResult>(
        `/admin/outbox/dispatch${queryStr ? `?${queryStr}` : ''}`,
        { method: 'POST' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['system-metrics-summary'] });
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      jobType: string;
      payload: any;
      priority?: number;
      maxRetries?: number;
      delaySeconds?: number;
      tenantId?: string;
      idempotencyKey?: string;
    }) => {
      const headers: Record<string, string> = {};
      if (data.idempotencyKey) {
        headers['Idempotency-Key'] = data.idempotencyKey;
      }
      return apiRequest<{ jobId: string; tenantId: string; status: string; createdAt: string }>('/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jobType: data.jobType,
          payload: data.payload,
          priority: data.priority ?? 50,
          maxRetries: data.maxRetries ?? 3,
          delaySeconds: data.delaySeconds ?? 0,
          tenantId: data.tenantId,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
