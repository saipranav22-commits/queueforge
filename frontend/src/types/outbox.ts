export type OutboxStatus = 'PENDING' | 'DISPATCHING' | 'DELIVERED' | 'DEAD_LETTER';

export interface OutboxDispatchResult {
  dispatchedCount: number;
  batchSize: number;
  leaseDurationSeconds: number;
}

export interface OutboxStats {
  pendingCount: number;
  dispatchingCount: number;
  deliveredCount: number;
  deadLetterCount: number;
  totalCount: number;
}

export interface OutboxEventSummary {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  status: OutboxStatus;
  attemptCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  claimedBy: string | null;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
  idempotencyKey: string;
}

export interface OutboxEventDetail extends OutboxEventSummary {
  updatedAt: string;
  payloadFingerprint: string;
  payload: any;
}

export interface OutboxQueryFilter {
  page?: number;
  size?: number;
  status?: OutboxStatus | '';
  eventType?: string;
  search?: string;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}
