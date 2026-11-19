export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export interface TenantSummary {
  id: string;
  name: string;
  status: TenantStatus;
  weight: number;
  maxConcurrency: number;
  deficitCounter: number;
  runningCount: number;
  pendingCount: number;
  lastScheduledAt: string | null;
  createdAt: string;
  apiKeyPrefix?: string | null;
  activeRunningJobs?: number; // Backward-compatible alias
}

export interface TenantDetail extends TenantSummary {
  apiKey?: string; // Only returned once on creation or key rotation
  updatedAt: string;
}

export interface FairShareSchedulerConfig {
  enabled: boolean;
  baseQuantum: number;
  maxTenantsPerSweep: number;
  activeTenantsCount: number;
  totalConfiguredWeight: number;
  totalMaxConcurrency: number;
}

export interface CreateTenantRequest {
  id: string;
  name: string;
  weight: number;
  maxConcurrency: number;
  apiKey?: string;
}

export interface UpdateTenantRequest {
  name?: string;
  weight?: number;
  maxConcurrency?: number;
  status?: TenantStatus;
}
