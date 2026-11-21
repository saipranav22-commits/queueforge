import { useScenario } from '../context/ScenarioContext';
import {
  useDashboardStats,
  useSystemHealth,
  useWorkerFleet,
  useOutboxStats,
  useTenants,
  useSchedulerConfig,
  useJobs,
  useSystemMetricsSummary,
} from './useQueueForgeData';
import type { DashboardStats, SystemMetricsSummary } from '../types/stats';
import type { SystemHealth } from '../types/health';
import type { WorkerInstance } from '../types/worker';
import type { OutboxStats } from '../types/outbox';
import type { TenantSummary, FairShareSchedulerConfig } from '../types/tenant';
import type { JobSummary, PageResponse } from '../types/job';
import type { ScenarioId, ScenarioMetadata } from '../context/ScenarioContext';

export type DataProvenance = 'LIVE_CONNECTED' | 'LIVE_OFFLINE' | 'SIMULATED_SCENARIO';

export function useScenarioAwareCluster() {
  const scenario = useScenario();

  // Live TanStack queries
  const liveStats = useDashboardStats();
  const liveHealth = useSystemHealth();
  const liveWorkers = useWorkerFleet();
  const liveOutboxStats = useOutboxStats();
  const liveMetrics = useSystemMetricsSummary();
  const liveJobs = useJobs({ page: 0, size: 20 });
  const liveTenants = useTenants();
  const liveConfig = useSchedulerConfig();

  const isBackendOnline = Boolean(liveHealth.data && liveHealth.data.dbStatus);

  if (scenario.isScenarioMode) {
    const scenarioPageResponse: PageResponse<JobSummary> = {
      content: scenario.scenarioJobs,
      page: 0,
      size: 20,
      totalElements: scenario.scenarioJobs.length,
      totalPages: 1,
      last: true,
      first: true,
    };

    return {
      isScenarioMode: true,
      provenance: 'SIMULATED_SCENARIO' as DataProvenance,
      activeScenarioId: scenario.activeScenarioId,
      scenarioMeta: scenario.activeScenario,
      stats: scenario.scenarioStats,
      metrics: scenario.scenarioMetrics,
      health: scenario.scenarioHealth,
      workers: scenario.scenarioWorkers,
      outboxStats: scenario.scenarioOutboxStats,
      tenants: scenario.scenarioTenants,
      schedulerConfig: scenario.scenarioSchedulerConfig,
      jobs: scenarioPageResponse,
      dlqJobs: scenario.scenarioDlqJobs,
      outboxEvents: scenario.scenarioOutboxEvents,
      dataUpdatedAt: Date.now(),
      isFetching: false,
      refetch: () => Promise.resolve(),
      isLiveOnline: false,
    };
  }

  return {
    isScenarioMode: false,
    provenance: (isBackendOnline ? 'LIVE_CONNECTED' : 'LIVE_OFFLINE') as DataProvenance,
    activeScenarioId: null as ScenarioId | null,
    scenarioMeta: null as ScenarioMetadata | null,
    stats: liveStats.data as DashboardStats | undefined,
    metrics: liveMetrics.data as SystemMetricsSummary | undefined,
    health: liveHealth.data as SystemHealth | undefined,
    workers: liveWorkers.data as WorkerInstance[] | undefined,
    outboxStats: liveOutboxStats.data as OutboxStats | undefined,
    tenants: liveTenants.data as TenantSummary[] | undefined,
    schedulerConfig: liveConfig.data as FairShareSchedulerConfig | undefined,
    jobs: liveJobs.data as PageResponse<JobSummary> | undefined,
    dlqJobs: undefined,
    outboxEvents: undefined,
    dataUpdatedAt: liveStats.dataUpdatedAt || Date.now(),
    isFetching: liveStats.isFetching || liveHealth.isFetching || liveWorkers.isFetching,
    refetch: () => {
      liveStats.refetch();
      liveHealth.refetch();
      liveWorkers.refetch();
      liveOutboxStats.refetch();
      liveJobs.refetch();
    },
    isLiveOnline: isBackendOnline,
  };
}
