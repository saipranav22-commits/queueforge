export type JobStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER';

export type FailureCategory =
  | 'TRANSIENT_FAILURE'
  | 'PERMANENT_FAILURE'
  | 'LEASE_EXPIRED'
  | 'HANDLER_NOT_FOUND'
  | 'UNKNOWN';

export interface DlqJobSummary {
  jobId: string;
  jobType: string;
  status: string;
  attemptCount: number;
  retryCount: number;
  maxRetries: number;
  failureCategory: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  scheduledAt?: string | null;
  updatedAt?: string | null;
  tenantId?: string;
}

export interface DlqJobDetail {
  jobId: string;
  idempotencyKey?: string | null;
  jobType: string;
  payload: any;
  priority: number;
  status: string;
  attemptCount: number;
  retryCount: number;
  maxRetries: number;
  failureCategory: string | null;
  lastErrorMessage: string | null;
  lastErrorStack?: string | null;
  createdAt: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  tenantId?: string;
}

export interface JobSummary {
  jobId: string;
  tenantId?: string;
  jobType: string;
  status: JobStatus;
  priority: number;
  attemptCount: number;
  retryCount: number;
  maxRetries: number;
  failureCategory?: string | null;
  lastErrorMessage?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  idempotencyKey?: string | null;
  lockedBy?: string | null;
  updatedAt?: string | null;
}

export interface JobDetail {
  jobId: string;
  tenantId?: string;
  jobType: string;
  status: JobStatus;
  payload: any;
  priority: number;
  attemptCount: number;
  retryCount: number;
  maxRetries: number;
  failureCategory: string | null;
  lastErrorMessage: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  idempotencyKey: string | null;
  lockedBy: string | null;
  executionLogs: JobExecutionLog[];
}

export interface JobExecutionLog {
  id: number;
  jobId: string;
  tenantId?: string;
  workerId: string;
  attempt: number;
  status: string;
  executionTimeMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
}
