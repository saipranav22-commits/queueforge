export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export interface TenantSummary {
  id: string;
  name: string;
  status: TenantStatus;
  weight: number;
  maxConcurrency: number;
  deficitCounter: number;
  apiKeyPrefix: string | null;
  activeRunningJobs?: number;
}

export interface TenantDetail extends TenantSummary {
  apiKey?: string; // Only returned on creation or key rotation
  lastScheduledAt: string;
  createdAt: string;
  updatedAt: string;
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
