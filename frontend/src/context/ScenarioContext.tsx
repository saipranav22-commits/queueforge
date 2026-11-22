import React, { createContext, useContext, useState, useMemo } from 'react';
import type { DashboardStats, SystemMetricsSummary } from '../types/stats';
import type { SystemHealth } from '../types/health';
import type { WorkerInstance } from '../types/worker';
import type { OutboxStats, OutboxEventSummary } from '../types/outbox';
import type { TenantSummary, FairShareSchedulerConfig } from '../types/tenant';
import type { JobSummary } from '../types/job';

export type ScenarioId =
  | 'HEALTHY_CLUSTER'
  | 'WORKER_FAILURE'
  | 'NOISY_NEIGHBOR'
  | 'OUTBOX_RETRY'
  | 'DLQ_POISON_RECOVERY';

export interface ScenarioMetadata {
  id: ScenarioId;
  title: string;
  badge: string;
  subtitle: string;
  description: string;
  primarySubsystem: string;
  architecturalLesson: string;
  simulatedConditions: string[];
}

export const SCENARIO_CATALOG: Record<ScenarioId, ScenarioMetadata> = {
  HEALTHY_CLUSTER: {
    id: 'HEALTHY_CLUSTER',
    title: 'Nominal Multi-Node Cluster',
    badge: 'OPTIMAL RUNTIME',
    subtitle: 'Dual-worker active claiming with 100% heartbeat freshness and 0 DLQ poison backlog',
    description:
      'Demonstrates QueueForge in optimal steady-state. Worker-1 and Worker-2 share load across 20 concurrency slots via PostgreSQL SELECT FOR UPDATE SKIP LOCKED. Outbox dispatcher streams payment events with confirmed receipts.',
    primarySubsystem: 'EXECUTION & TOPOLOGY',
    architecturalLesson:
      'Lock-free partition claiming prevents database contention while lease fencing ensures exactly-one worker attribution.',
    simulatedConditions: [
      'Worker-1: 8/10 active slots (heartbeat 1.2s)',
      'Worker-2: 7/10 active slots (heartbeat 2.1s)',
      'PostgreSQL pool: 4 active / 20 total',
      'Outbox delivery rate: 45 events/min',
    ],
  },
  WORKER_FAILURE: {
    id: 'WORKER_FAILURE',
    title: 'Worker Heartbeat Loss & Orphan Recovery',
    badge: 'FAULT INJECTION',
    subtitle: 'Worker-2 crashes (>25s heartbeat loss); atomic lease sweeper reclaims orphaned tasks',
    description:
      'Simulates a JVM crash or network partition on Worker-2. Heartbeat freshness deadline (15s) expires. QueueForge background sweeper detects orphaned claim tokens, safely releases them to PENDING, and Worker-1 assumes execution without split-brain.',
    primarySubsystem: 'COORDINATION & RECOVERY',
    architecturalLesson:
      'Time-bounded leases (10s TTL + 3s dynamic renewal) prevent deadlocks when nodes terminate abruptly without graceful drain.',
    simulatedConditions: [
      'Worker-2 heartbeat age: 28.4s (Flagged OFFLINE)',
      'Orphaned leases detected: 6 tasks',
      'Sweeper reclamation latency: 980ms',
      'Worker-1 load absorbed safely',
    ],
  },
  NOISY_NEIGHBOR: {
    id: 'NOISY_NEIGHBOR',
    title: 'Noisy-Neighbor Contention & DRR Throttling',
    badge: 'FAIRNESS ALGORITHM',
    subtitle: 'Greedy batch flood prevented from starving latency-critical enterprise workloads',
    description:
      'Simulates Tenant "tenant-stream" flooding 800 batch jobs. The Weighted Deficit Round Robin (DRR) scheduler caps credit accumulation (Qi = wi × Q_base). Deficit exhaustion pauses greedy claims, preserving immediate time-slices for Tenant "tenant-fintech".',
    primarySubsystem: 'FAIRSHARE SCHEDULING',
    architecturalLesson:
      'DRR reduces quiet-tenant median wait latency from 11,868ms to 1,210ms (89.8% reduction) with documented 21.2% aggregate throughput trade-off.',
    simulatedConditions: [
      'tenant-stream: 820 pending / 6 active (Deficit 0.0 — Paused)',
      'tenant-fintech: 2 pending / 5 active (Deficit 15.0 — Priority Claim)',
      'tenant-enterprise: 20 pending / 3 active (Deficit 8.0)',
      'Contention ratio: 41:1 backlog skew',
    ],
  },
  OUTBOX_RETRY: {
    id: 'OUTBOX_RETRY',
    title: 'Outbox Downstream 503 & Idempotent Redelivery',
    badge: 'TWO-PHASE RELIABILITY',
    subtitle: 'Simulated payment gateway timeout triggers backoff retry followed by deduplicated ack',
    description:
      'Simulates HTTP 503 Service Unavailable from the payment receiver on order "ord_9f81a7b2". Outbox dispatcher sets exponential backoff retry. On second dispatch, receipt commits and payment receiver database dedupes by Idempotency-Key.',
    primarySubsystem: 'TRANSACTIONAL OUTBOX',
    architecturalLesson:
      'Dual-write anomalies are eliminated by committing business state and outbox event in one ACID transaction, coupled with receiver idempotency constraints.',
    simulatedConditions: [
      'HTTP 503 injected on step 4 dispatch',
      'Exponential backoff: next retry in 4,000ms',
      'Receiver constraint: UNIQUE(idempotency_key)',
      'Zero duplicate financial charges',
    ],
  },
  DLQ_POISON_RECOVERY: {
    id: 'DLQ_POISON_RECOVERY',
    title: 'Poison Payload Quarantine & Operator Replay',
    badge: 'DEAD-LETTER WORKFLOW',
    subtitle: 'Malformed task quarantined after 3 retries; forensic stack inspection & zero-loss replay',
    description:
      'Simulates an unprocessable task containing a schema syntax error. After 3 retries, task transitions to DEAD_LETTER to prevent worker crash loops. Operator inspects the forensic stack trace, fixes configuration, and triggers authenticated replay.',
    primarySubsystem: 'DLQ & FAILURE FORENSICS',
    architecturalLesson:
      'Dead-letter queues isolate non-transient poison pills while append-only execution logs preserve cryptographic audit trails.',
    simulatedConditions: [
      'Poison job: job_poison_8842 (MalformedPayloadException)',
      'Attempts exhausted: 3 / 3',
      'Quarantined in DLQ ledger',
      'Authenticated Replay & Discard unlocked',
    ],
  },
};

export interface ScenarioContextType {
  isScenarioMode: boolean;
  activeScenarioId: ScenarioId | null;
  activeScenario: ScenarioMetadata | null;
  setScenario: (id: ScenarioId | null) => void;
  exitScenario: () => void;

  // Scenario Fixture Accessors
  scenarioStats: DashboardStats;
  scenarioMetrics: SystemMetricsSummary;
  scenarioHealth: SystemHealth;
  scenarioWorkers: WorkerInstance[];
  scenarioOutboxStats: OutboxStats;
  scenarioTenants: TenantSummary[];
  scenarioSchedulerConfig: FairShareSchedulerConfig;
  scenarioJobs: JobSummary[];
  scenarioDlqJobs: JobSummary[];
  scenarioOutboxEvents: OutboxEventSummary[];

  // Deterministic Simulated Mutations (Zero backend network requests)
  simulatedActionCount: number;
  triggerSimulatedDispatch: () => { dispatched: number; message: string };
  triggerSimulatedReplay: (jobId: string) => { success: boolean; message: string };
  triggerSimulatedDrrStep: () => { steppedRound: number; scheduledTenant: string };
}

const ScenarioContext = createContext<ScenarioContextType | undefined>(undefined);

export const ScenarioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId | null>(null);
  const [simulatedActionCount, setSimulatedActionCount] = useState<number>(0);
  const [simulatedStepRound, setSimulatedStepRound] = useState<number>(1);

  const isScenarioMode = activeScenarioId !== null;
  const activeScenario = activeScenarioId ? SCENARIO_CATALOG[activeScenarioId] : null;

  const setScenario = (id: ScenarioId | null) => {
    setActiveScenarioId(id);
    setSimulatedActionCount(0);
    setSimulatedStepRound(1);
  };

  const exitScenario = () => {
    setActiveScenarioId(null);
  };

  // Deterministic Datasets based on Scenario
  const scenarioStats: DashboardStats = useMemo(() => {
    switch (activeScenarioId) {
      case 'WORKER_FAILURE':
        return {
          pendingJobs: 28,
          runningJobs: 7,
          completedJobs: 4790,
          deadLetterJobs: 0,
          archivedJobs: 140,
          totalJobs: 4965,
          activeWorkers: 1,
          workerCapacity: 10,
          workerStatus: 'DEGRADED',
          submittedTotal: 4965,
          completedTotal: 4790,
          failedTotal: 6,
          retriedTotal: 18,
          recoveredTotal: 6,
        };
      case 'NOISY_NEIGHBOR':
        return {
          pendingJobs: 842,
          runningJobs: 14,
          completedJobs: 5120,
          deadLetterJobs: 0,
          archivedJobs: 190,
          totalJobs: 6166,
          activeWorkers: 2,
          workerCapacity: 20,
          workerStatus: 'ONLINE',
          submittedTotal: 6166,
          completedTotal: 5120,
          failedTotal: 2,
          retriedTotal: 8,
          recoveredTotal: 2,
        };
      case 'OUTBOX_RETRY':
        return {
          pendingJobs: 14,
          runningJobs: 8,
          completedJobs: 4850,
          deadLetterJobs: 0,
          archivedJobs: 120,
          totalJobs: 4992,
          activeWorkers: 2,
          workerCapacity: 20,
          workerStatus: 'ONLINE',
          submittedTotal: 4992,
          completedTotal: 4850,
          failedTotal: 5,
          retriedTotal: 12,
          recoveredTotal: 5,
        };
      case 'DLQ_POISON_RECOVERY':
        return {
          pendingJobs: 6,
          runningJobs: 8,
          completedJobs: 3420,
          deadLetterJobs: 2,
          archivedJobs: 84,
          totalJobs: 3520,
          activeWorkers: 2,
          workerCapacity: 20,
          workerStatus: 'ONLINE',
          submittedTotal: 3520,
          completedTotal: 3420,
          failedTotal: 14,
          retriedTotal: 22,
          recoveredTotal: 12,
        };
      case 'HEALTHY_CLUSTER':
      default:
        return {
          pendingJobs: 12,
          runningJobs: 15,
          completedJobs: 4820,
          deadLetterJobs: 0,
          archivedJobs: 110,
          totalJobs: 4957,
          activeWorkers: 2,
          workerCapacity: 20,
          workerStatus: 'ONLINE',
          submittedTotal: 4957,
          completedTotal: 4820,
          failedTotal: 3,
          retriedTotal: 9,
          recoveredTotal: 3,
        };
    }
  }, [activeScenarioId]);

  const scenarioMetrics: SystemMetricsSummary = useMemo(() => {
    const isNoisy = activeScenarioId === 'NOISY_NEIGHBOR';
    return {
      submittedTotal: scenarioStats.submittedTotal,
      completedTotal: scenarioStats.completedTotal,
      failedTotal: scenarioStats.failedTotal,
      retriedTotal: scenarioStats.retriedTotal,
      recoveredTotal: scenarioStats.recoveredTotal,
      failuresByCategory: {
        NETWORK_TIMEOUT: 4,
        DOWNSTREAM_5XX: activeScenarioId === 'OUTBOX_RETRY' ? 8 : 1,
        DATA_CORRUPTION: activeScenarioId === 'DLQ_POISON_RECOVERY' ? 2 : 0,
        TRANSIENT_DB: 1,
      },
      executionLatencyP50Ms: isNoisy ? 1210 : 185,
      executionLatencyP95Ms: isNoisy ? 2840 : 420,
      executionLatencyP99Ms: isNoisy ? 5400 : 890,
      queueWaitLatencyP50Ms: isNoisy ? 1210 : 48,
      queueWaitLatencyP95Ms: isNoisy ? 11868 : 145,
    };
  }, [activeScenarioId, scenarioStats]);

  const scenarioHealth: SystemHealth = useMemo(() => {
    const isWorkerDown = activeScenarioId === 'WORKER_FAILURE';
    return {
      status: isWorkerDown ? 'DEGRADED' : 'UP',
      dbStatus: 'UP (POSTGRESQL 16.8)',
      workerStatus: isWorkerDown ? 'DEGRADED (1 OF 2 NODES HEARTBEATING)' : 'OPTIMAL (2/2 NODES ONLINE)',
      activeWorkers: isWorkerDown ? 1 : 2,
      workerCapacity: isWorkerDown ? 10 : 20,
      leaseDurationSeconds: 10,
      pollIntervalMs: 100,
      databasePoolActive: isWorkerDown ? 2 : 4,
      databasePoolIdle: 16,
      databasePoolTotal: 20,
      uptimeSeconds: 86420,
    };
  }, [activeScenarioId]);

  const scenarioWorkers: WorkerInstance[] = useMemo(() => {
    const isWorkerDown = activeScenarioId === 'WORKER_FAILURE';
    return [
      {
        instanceId: 'qf-worker-1',
        mode: 'DISTRIBUTED_ACTIVE',
        status: 'ONLINE',
        concurrency: 10,
        activeJobs: isWorkerDown ? 7 : 8,
        heldLeasesCount: isWorkerDown ? 7 : 8,
        completedJobsCount: 2610,
        failedJobsCount: 1,
        lastHeartbeat: new Date(Date.now() - 1200).toISOString(),
        startedAt: new Date(Date.now() - 86400000).toISOString(),
        heartbeatAgeSeconds: 1.2,
      },
      {
        instanceId: 'qf-worker-2',
        mode: 'DISTRIBUTED_ACTIVE',
        status: isWorkerDown ? 'OFFLINE' : 'ONLINE',
        concurrency: 10,
        activeJobs: isWorkerDown ? 0 : 7,
        heldLeasesCount: isWorkerDown ? 0 : 7,
        completedJobsCount: 2180,
        failedJobsCount: isWorkerDown ? 5 : 2,
        lastHeartbeat: isWorkerDown
          ? new Date(Date.now() - 28400).toISOString()
          : new Date(Date.now() - 2100).toISOString(),
        startedAt: new Date(Date.now() - 86400000).toISOString(),
        heartbeatAgeSeconds: isWorkerDown ? 28.4 : 2.1,
      },
    ];
  }, [activeScenarioId]);

  const scenarioOutboxStats: OutboxStats = useMemo(() => {
    switch (activeScenarioId) {
      case 'OUTBOX_RETRY':
        return {
          pendingCount: 4,
          dispatchingCount: 2,
          deliveredCount: 980,
          deadLetterCount: 1,
          totalCount: 987,
        };
      case 'HEALTHY_CLUSTER':
      default:
        return {
          pendingCount: 2,
          dispatchingCount: 1,
          deliveredCount: 1480,
          deadLetterCount: 0,
          totalCount: 1483,
        };
    }
  }, [activeScenarioId]);

  const scenarioTenants: TenantSummary[] = useMemo(() => {
    if (activeScenarioId === 'NOISY_NEIGHBOR') {
      return [
        {
          id: 'tenant-stream',
          name: 'Streaming Telemetry Pipeline',
          status: 'ACTIVE',
          weight: 1,
          maxConcurrency: 6,
          deficitCounter: 0.0,
          runningCount: 6,
          pendingCount: 820,
          lastScheduledAt: new Date(Date.now() - 1500).toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'tenant-fintech',
          name: 'High-Value Settlement API',
          status: 'ACTIVE',
          weight: 5,
          maxConcurrency: 8,
          deficitCounter: 15.0,
          runningCount: 5,
          pendingCount: 2,
          lastScheduledAt: new Date(Date.now() - 200).toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'tenant-enterprise',
          name: 'Global Enterprise Core',
          status: 'ACTIVE',
          weight: 4,
          maxConcurrency: 8,
          deficitCounter: 8.0,
          runningCount: 3,
          pendingCount: 20,
          lastScheduledAt: new Date(Date.now() - 800).toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
    }
    return [
      {
        id: 'tenant-enterprise',
        name: 'Global Enterprise Core',
        status: 'ACTIVE',
        weight: 5,
        maxConcurrency: 10,
        deficitCounter: 12.0,
        runningCount: 8,
        pendingCount: 4,
        lastScheduledAt: new Date(Date.now() - 1200).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'tenant-fintech',
        name: 'High-Value Settlement API',
        status: 'ACTIVE',
        weight: 3,
        maxConcurrency: 8,
        deficitCounter: 8.0,
        runningCount: 5,
        pendingCount: 2,
        lastScheduledAt: new Date(Date.now() - 2400).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'tenant-analytics',
        name: 'Aggregated Data Analytics',
        status: 'ACTIVE',
        weight: 2,
        maxConcurrency: 4,
        deficitCounter: 4.0,
        runningCount: 2,
        pendingCount: 6,
        lastScheduledAt: new Date(Date.now() - 3600).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  }, [activeScenarioId]);

  const scenarioSchedulerConfig: FairShareSchedulerConfig = useMemo(() => ({
    enabled: true,
    baseQuantum: 1,
    maxTenantsPerSweep: 10,
    activeTenantsCount: scenarioTenants.length,
    totalConfiguredWeight: scenarioTenants.reduce((acc, t) => acc + t.weight, 0),
    totalMaxConcurrency: scenarioTenants.reduce((acc, t) => acc + t.maxConcurrency, 0),
  }), [scenarioTenants]);

  const scenarioJobs: JobSummary[] = useMemo(() => [
    {
      jobId: 'job_settle_8821a4',
      jobType: 'SETTLEMENT_CLEARING',
      tenantId: 'tenant-fintech',
      priority: 85,
      status: 'RUNNING',
      attemptCount: 1,
      retryCount: 0,
      maxRetries: 3,
      lockedBy: 'qf-worker-1:thread-2',
      createdAt: new Date(Date.now() - 4200).toISOString(),
      updatedAt: new Date(Date.now() - 800).toISOString(),
    },
    {
      jobId: 'job_ledger_9104c2',
      jobType: 'TRANSACTION_JOURNAL',
      tenantId: 'tenant-enterprise',
      priority: 80,
      status: 'RUNNING',
      attemptCount: 1,
      retryCount: 0,
      maxRetries: 3,
      lockedBy: 'qf-worker-2:thread-4',
      createdAt: new Date(Date.now() - 6500).toISOString(),
      updatedAt: new Date(Date.now() - 1200).toISOString(),
    },
    {
      jobId: 'job_ingest_7421b8',
      jobType: 'STREAM_INGEST',
      tenantId: 'tenant-stream',
      priority: 50,
      status: 'PENDING',
      attemptCount: 0,
      retryCount: 0,
      maxRetries: 3,
      lockedBy: null,
      createdAt: new Date(Date.now() - 12000).toISOString(),
      updatedAt: new Date(Date.now() - 12000).toISOString(),
    },
    {
      jobId: 'job_report_3319f0',
      jobType: 'ANALYTICS_ROLLUP',
      tenantId: 'tenant-analytics',
      priority: 40,
      status: 'COMPLETED',
      attemptCount: 1,
      retryCount: 0,
      maxRetries: 3,
      lockedBy: 'qf-worker-1:thread-1',
      createdAt: new Date(Date.now() - 32000).toISOString(),
      updatedAt: new Date(Date.now() - 18000).toISOString(),
    },
  ], []);

  const scenarioDlqJobs: JobSummary[] = useMemo(() => [
    {
      jobId: 'job_poison_8842',
      jobType: 'CARD_TOKEN_INGEST',
      tenantId: 'tenant-fintech',
      priority: 75,
      status: 'DEAD_LETTER',
      attemptCount: 3,
      retryCount: 3,
      maxRetries: 3,
      failureCategory: 'NON_TRANSIENT_DATA_CORRUPTION',
      lastErrorMessage:
        'com.queueforge.core.exceptions.MalformedPayloadException: Unexpected byte sequence 0xFFFE at offset 128',
      lockedBy: null,
      createdAt: new Date(Date.now() - 120000).toISOString(),
      updatedAt: new Date(Date.now() - 45000).toISOString(),
    },
    {
      jobId: 'job_poison_4419',
      jobType: 'TAX_SYNC_BATCH',
      tenantId: 'tenant-enterprise',
      priority: 60,
      status: 'DEAD_LETTER',
      attemptCount: 3,
      retryCount: 3,
      maxRetries: 3,
      failureCategory: 'DOWNSTREAM_CONTRACT_VIOLATION',
      lastErrorMessage:
        'org.springframework.web.client.HttpClientErrorException$UnprocessableEntity: 422 Schema Incompatible',
      lockedBy: null,
      createdAt: new Date(Date.now() - 240000).toISOString(),
      updatedAt: new Date(Date.now() - 90000).toISOString(),
    },
  ], []);

  const scenarioOutboxEvents: OutboxEventSummary[] = useMemo(() => [
    {
      id: 'evt_9f81a7b2-4821-4f11-9a18-d7102e',
      aggregateType: 'ORDER',
      aggregateId: 'ord_9f81a7b2',
      eventType: 'ORDER_PAYMENT_REQUESTED',
      status: activeScenarioId === 'OUTBOX_RETRY' ? 'DISPATCHING' : 'DELIVERED',
      attemptCount: activeScenarioId === 'OUTBOX_RETRY' ? 2 : 1,
      maxRetries: 5,
      nextRetryAt: activeScenarioId === 'OUTBOX_RETRY' ? new Date(Date.now() + 3800).toISOString() : null,
      claimedBy: 'outbox-dispatcher-thread-1',
      lastError:
        activeScenarioId === 'OUTBOX_RETRY'
          ? 'HTTP 503 Service Unavailable (Simulated Payment Gateway Latency Spike)'
          : null,
      deliveredAt: activeScenarioId === 'OUTBOX_RETRY' ? null : new Date(Date.now() - 1400).toISOString(),
      createdAt: new Date(Date.now() - 15000).toISOString(),
      idempotencyKey: 'idemp_ord_9f81a7b2_step4',
    },
    {
      id: 'evt_4a21e891-1184-4d82-8219-c4190b',
      aggregateType: 'ORDER',
      aggregateId: 'ord_4a21e891',
      eventType: 'ORDER_FULFILLMENT_REQUESTED',
      status: 'DELIVERED',
      attemptCount: 1,
      maxRetries: 5,
      nextRetryAt: null,
      claimedBy: 'outbox-dispatcher-thread-2',
      lastError: null,
      deliveredAt: new Date(Date.now() - 8400).toISOString(),
      createdAt: new Date(Date.now() - 25000).toISOString(),
      idempotencyKey: 'idemp_ord_4a21e891_step4',
    },
  ], [activeScenarioId]);

  // Safe simulated mutations
  const triggerSimulatedDispatch = () => {
    setSimulatedActionCount((c) => c + 1);
    return {
      dispatched: 3,
      message: 'Simulated Outbox Batch Dispatched: 3 events relayed with receiver idempotency ack (Sandbox)',
    };
  };

  const triggerSimulatedReplay = (jobId: string) => {
    setSimulatedActionCount((c) => c + 1);
    return {
      success: true,
      message: `Simulated Replay: Poison job ${jobId.substring(0, 8)} status transitioned from DEAD_LETTER to PENDING (Sandbox)`,
    };
  };

  const triggerSimulatedDrrStep = () => {
    setSimulatedActionCount((c) => c + 1);
    const round = simulatedStepRound + 1;
    setSimulatedStepRound(round);
    const tenantNames = ['tenant-fintech (Weight 5x)', 'tenant-enterprise (Weight 4x)', 'tenant-stream (Weight 1x)'];
    const chosen = tenantNames[round % tenantNames.length];
    return {
      steppedRound: round,
      scheduledTenant: chosen,
    };
  };

  const value: ScenarioContextType = {
    isScenarioMode,
    activeScenarioId,
    activeScenario,
    setScenario,
    exitScenario,
    scenarioStats,
    scenarioMetrics,
    scenarioHealth,
    scenarioWorkers,
    scenarioOutboxStats,
    scenarioTenants,
    scenarioSchedulerConfig,
    scenarioJobs,
    scenarioDlqJobs,
    scenarioOutboxEvents,
    simulatedActionCount,
    triggerSimulatedDispatch,
    triggerSimulatedReplay,
    triggerSimulatedDrrStep,
  };

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
};

const fallbackLiveContext: ScenarioContextType = {
  isScenarioMode: false,
  activeScenarioId: null,
  activeScenario: null,
  setScenario: () => {},
  exitScenario: () => {},
  scenarioStats: {
    pendingJobs: 0,
    runningJobs: 0,
    completedJobs: 0,
    deadLetterJobs: 0,
    archivedJobs: 0,
    totalJobs: 0,
    activeWorkers: 0,
    workerCapacity: 20,
    workerStatus: 'OFFLINE',
    submittedTotal: 0,
    completedTotal: 0,
    failedTotal: 0,
    retriedTotal: 0,
    recoveredTotal: 0,
  },
  scenarioMetrics: {
    submittedTotal: 0,
    completedTotal: 0,
    failedTotal: 0,
    retriedTotal: 0,
    recoveredTotal: 0,
    failuresByCategory: {},
    executionLatencyP50Ms: 0,
    executionLatencyP95Ms: 0,
    executionLatencyP99Ms: 0,
    queueWaitLatencyP50Ms: 0,
    queueWaitLatencyP95Ms: 0,
  },
  scenarioHealth: {
    status: 'DEGRADED',
    dbStatus: 'DOWN',
    workerStatus: 'OFFLINE',
    activeWorkers: 0,
    workerCapacity: 20,
    leaseDurationSeconds: 30,
    pollIntervalMs: 3000,
    databasePoolActive: 0,
    databasePoolIdle: 0,
    databasePoolTotal: 20,
    uptimeSeconds: 0,
  },
  scenarioWorkers: [],
  scenarioOutboxStats: {
    pendingCount: 0,
    dispatchingCount: 0,
    deliveredCount: 0,
    deadLetterCount: 0,
    totalCount: 0,
  },
  scenarioTenants: [],
  scenarioSchedulerConfig: {
    enabled: true,
    baseQuantum: 1,
    maxTenantsPerSweep: 10,
    totalConfiguredWeight: 10,
    totalMaxConcurrency: 20,
    activeTenantsCount: 3,
  },
  scenarioJobs: [],
  scenarioDlqJobs: [],
  scenarioOutboxEvents: [],
  simulatedActionCount: 0,
  triggerSimulatedDispatch: () => ({ dispatched: 0, message: '' }),
  triggerSimulatedReplay: () => ({ success: true, message: '' }),
  triggerSimulatedDrrStep: () => ({ steppedRound: 0, scheduledTenant: '' }),
};

export function useScenario() {
  const context = useContext(ScenarioContext);
  return context || fallbackLiveContext;
}
