export interface SystemHealth {
  status: string;
  dbStatus: string;
  workerStatus: string;
  activeWorkers: number;
  workerCapacity: number;
  leaseDurationSeconds: number;
  pollIntervalMs: number;
  databasePoolActive: number;
  databasePoolIdle: number;
  databasePoolTotal: number;
  uptimeSeconds: number;
}
