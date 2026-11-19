export type OutboxStatus = 'PENDING' | 'DISPATCHING' | 'DELIVERED' | 'FAILED';

export interface OutboxDispatchResult {
  dispatchedCount: number;
  batchSize: number;
  leaseDurationSeconds: number;
}

export interface OutboxStats {
  pendingEvents: number;
  deliveredEvents: number;
  failedEvents: number;
}
