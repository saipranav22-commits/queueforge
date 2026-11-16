export type JobStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER';

export interface JobSummary {
  jobId: string;
  jobType: string;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  payloadExcerpt: string;
  createdAt: string;
  claimExpiresAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lastErrorSnippet: string | null;
}

export interface JobDetail {
  jobId: string;
  jobType: string;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  payloadJson: string;
  idempotencyKey: string | null;
  idempotencyFingerprint: string | null;
  claimToken: string | null;
  claimExpiresAt: string | null;
  workerId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  lastErrorMessage: string | null;
  lastErrorCategory: string | null;
  lastErrorStackTrace: string | null;
  attemptCount: number;
}

export interface JobExecutionLog {
  id: number;
  jobId: string;
  attemptNumber: number;
  workerId: string;
  claimToken: string | null;
  executionStartedAt: string;
  executionEndedAt: string | null;
  durationMs: number | null;
  status: string;
  failureCategory: string | null;
  errorMessage: string | null;
  errorStackTrace: string | null;
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
