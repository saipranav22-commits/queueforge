import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ApiError } from '../lib/apiClient';
import type {
  JobSummary,
  JobDetail,
  DlqJobDetail,
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
    queryFn: async () => {
      const data = await apiRequest<DashboardStats>('/dashboard/stats');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected DashboardStats object');
      }
      return data;
    },
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
  minPriority?: number;
  maxPriority?: number;
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
  if (filters.minPriority != null) queryParams.set('minPriority', filters.minPriority.toString());
  if (filters.maxPriority != null) queryParams.set('maxPriority', filters.maxPriority.toString());

  const queryString = queryParams.toString();
  const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;

  return useQuery<PageResponse<JobSummary>>({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const data = await apiRequest<PageResponse<JobSummary>>(endpoint);
      if (!data || typeof data !== 'object' || !Array.isArray(data.content)) {
        throw new ApiError(500, 'Invalid API response schema: expected PageResponse with content array');
      }
      return data;
    },
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
    queryFn: async () => {
      const data = await apiRequest<JobExecutionLog[]>(`/jobs/${jobId}/history`);
      if (!Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected JobExecutionLog array');
      }
      return data;
    },
    enabled: !!jobId,
    refetchInterval: () => {
      // If any active attempts, poll more often
      return 3000;
    },
  });
}

export function useDlqJobDetail(jobId: string | undefined, enabled = true) {
  return useQuery<DlqJobDetail>({
    queryKey: ['dlq-job-detail', jobId],
    queryFn: () => apiRequest<DlqJobDetail>(`/admin/dlq/${jobId}`),
    enabled: !!jobId && enabled,
    retry: false,
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const data = await apiRequest<SystemHealth>('/system/health');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected SystemHealth object');
      }
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useSystemMetricsSummary() {
  return useQuery<SystemMetricsSummary>({
    queryKey: ['system-metrics-summary'],
    queryFn: async () => {
      const data = await apiRequest<SystemMetricsSummary>('/system/metrics-summary');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected SystemMetricsSummary object');
      }
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useWorkerFleet() {
  return useQuery<import('../types/worker').WorkerInstance[]>({
    queryKey: ['system-workers'],
    queryFn: async () => {
      const data = await apiRequest<import('../types/worker').WorkerInstance[]>('/system/workers');
      if (!Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected WorkerInstance array');
      }
      return data;
    },
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
    queryFn: async () => {
      const data = await apiRequest<import('../types/tenant').TenantSummary[]>('/admin/tenants');
      if (!Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected TenantSummary array');
      }
      return data;
    },
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
      queryClient.invalidateQueries({ queryKey: ['admin-outbox-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-outbox-events'] });
    },
  });
}

export function useSchedulerConfig(enabled = true) {
  return useQuery<import('../types/tenant').FairShareSchedulerConfig>({
    queryKey: ['admin-scheduler-config'],
    queryFn: async () => {
      const data = await apiRequest<import('../types/tenant').FairShareSchedulerConfig>('/admin/tenants/scheduler-config');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected FairShareSchedulerConfig object');
      }
      return data;
    },
    enabled,
    refetchInterval: 10000,
    retry: false,
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: import('../types/tenant').UpdateTenantRequest }) =>
      apiRequest<import('../types/tenant').TenantDetail>(`/admin/tenants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-scheduler-config'] });
    },
  });
}

export function useOutboxStats(enabled = true) {
  return useQuery<import('../types/outbox').OutboxStats>({
    queryKey: ['admin-outbox-stats'],
    queryFn: async () => {
      const data = await apiRequest<import('../types/outbox').OutboxStats>('/admin/outbox/stats');
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApiError(500, 'Invalid API response schema: expected OutboxStats object');
      }
      return data;
    },
    enabled,
    refetchInterval: 3000,
    retry: false,
  });
}

export function useOutboxEvents(filters: import('../types/outbox').OutboxQueryFilter, enabled = true) {
  const queryParams = new URLSearchParams();
  if (filters.page != null) queryParams.set('page', filters.page.toString());
  if (filters.size != null) queryParams.set('size', filters.size.toString());
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.eventType) queryParams.set('eventType', filters.eventType);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);
  if (filters.sortDirection) queryParams.set('sortDirection', filters.sortDirection);

  const queryString = queryParams.toString();
  const endpoint = `/admin/outbox/events${queryString ? `?${queryString}` : ''}`;

  return useQuery<import('../types/job').PageResponse<import('../types/outbox').OutboxEventSummary>>({
    queryKey: ['admin-outbox-events', filters],
    queryFn: async () => {
      const data = await apiRequest<import('../types/job').PageResponse<import('../types/outbox').OutboxEventSummary>>(endpoint);
      if (!data || typeof data !== 'object' || !Array.isArray(data.content)) {
        throw new ApiError(500, 'Invalid API response schema: expected PageResponse with content array');
      }
      return data;
    },
    enabled,
    refetchInterval: 3000,
    retry: false,
  });
}

export function useOutboxEventDetail(id?: string) {
  return useQuery<import('../types/outbox').OutboxEventDetail>({
    queryKey: ['admin-outbox-event-detail', id],
    queryFn: () => apiRequest<import('../types/outbox').OutboxEventDetail>(`/admin/outbox/events/${id}`),
    enabled: Boolean(id),
    retry: false,
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
