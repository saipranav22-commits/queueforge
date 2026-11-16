export interface DashboardStats {
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  deadLetterJobs: number;
  archivedJobs: number;
  totalJobs: number;
  activeWorkers: number;
  workerCapacity: number;
  workerStatus: string;
  submittedTotal: number;
  completedTotal: number;
  failedTotal: number;
  retriedTotal: number;
  recoveredTotal: number;
}

export interface SystemMetricsSummary {
  submittedTotal: number;
  completedTotal: number;
  failedTotal: number;
  retriedTotal: number;
  recoveredTotal: number;
  failuresByCategory: Record<string, number>;
  executionLatencyP50Ms: number;
  executionLatencyP95Ms: number;
  executionLatencyP99Ms: number;
  queueWaitLatencyP50Ms: number;
  queueWaitLatencyP95Ms: number;
}
