export type WorkerStatus = 'ONLINE' | 'STALE' | 'OFFLINE';

export interface WorkerInstance {
  instanceId: string;
  mode: string;
  status: WorkerStatus;
  concurrency: number;
  activeJobs: number;
  heldLeasesCount: number;
  completedJobsCount: number;
  failedJobsCount: number;
  lastHeartbeat: string | null;
  startedAt: string | null;
  heartbeatAgeSeconds: number;
}
