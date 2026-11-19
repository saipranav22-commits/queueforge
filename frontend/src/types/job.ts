export type JobStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER';

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
