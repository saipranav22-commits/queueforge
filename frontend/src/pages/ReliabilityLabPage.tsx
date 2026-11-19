import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Layers,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Terminal,
  Zap,
  Server,
  Lock,
} from 'lucide-react';
import {
  useDashboardStats,
  useSystemMetricsSummary,
  useWorkerFleet,
  useOutboxStats,
} from '../hooks/useQueueForgeData';
import { MetricCard } from '../components/common/MetricCard';

interface ResilienceMechanism {
  id: string;
  title: string;
  category: 'CONCURRENCY' | 'FAULT_TOLERANCE' | 'TRANSACTIONAL' | 'RECOVERY';
  subtitle: string;
  problem: string;
  solution: string;
  codeSnippet: string;
  guarantee: string;
}

const RESILIENCE_MECHANISMS: ResilienceMechanism[] = [
  {
    id: 'fencing',
    title: 'Lease Fencing & Stale Worker Rejection',
    category: 'CONCURRENCY',
    subtitle: 'Protects against zombie writes following GC pauses or network delays',
    problem: 'Slow or partitioned workers waking up after lease expiration attempt to commit stale results, causing split-brain anomalies and data corruption.',
    solution: 'Every claimed job receives a unique UUID claim token and monotonic attempt counter. Mutations enforce lease expiration boundaries directly in PostgreSQL.',
    codeSnippet: `UPDATE qf_jobs 
SET status = 'COMPLETED', completed_at = NOW()
WHERE id = :id 
  AND claim_token = :token 
  AND lease_until >= NOW();`,
    guarantee: 'SAFETY-2: Only the current valid lease holder can commit completion. Stale workers match 0 rows and are safely fenced out.',
  },
  {
    id: 'sweeper',
    title: 'Orphaned Lease Sweeper & Auto-Recovery',
    category: 'RECOVERY',
    subtitle: 'Recovers jobs abandoned by crashed or ungracefully terminated worker containers',
    problem: 'Hard SIGKILL, machine hardware failure, or container OOM leaves tasks permanently stuck in RUNNING or CLAIMED states.',
    solution: 'Dedicated LeaseRecoverySweeper runs every 1,000ms. It scans for active leases where lease_until < NOW(), logs failure traces, and resets status to PENDING or DEAD_LETTER.',
    codeSnippet: `SELECT * FROM qf_jobs 
WHERE status IN ('CLAIMED', 'RUNNING') 
  AND lease_until < NOW() 
FOR UPDATE SKIP LOCKED;`,
    guarantee: 'LIVENESS-1: Abandoned jobs are automatically discovered and returned to eligible scheduling within at most 1 sweep cycle after lease expiration.',
  },
  {
    id: 'backoff',
    title: 'Exponential Retry Backoff with Full Jitter',
    category: 'FAULT_TOLERANCE',
    subtitle: 'Prevents thundering herd stampedes during downstream microservice outages',
    problem: 'Immediate retries or synchronized fixed delays overload recovering downstream databases or external APIs during transient failures.',
    solution: 'Calculates exponential backoff delay based on retry attempt count, then applies Full Jitter (random uniform value between 0 and calculated exponential ceiling).',
    codeSnippet: `// BackoffCalculator.java
long exponentialDelay = baseDelayMs * (1L << attemptCount);
long cappedDelay = Math.min(maxDelayMs, exponentialDelay);
long jitteredDelay = ThreadLocalRandom.current().nextLong(cappedDelay + 1);`,
    guarantee: 'SAFETY-4: Retries strictly observe bounded maximum attempt limits while spreading network load across a decorrelated time horizon.',
  },
  {
    id: 'dlq',
    title: 'Dead-Letter Queue Poison Isolation',
    category: 'FAULT_TOLERANCE',
    subtitle: 'Isolates unprocessable jobs to maintain healthy queue throughput',
    problem: 'Permanent schema mismatches, corrupt payloads, or unresolvable dependencies endlessly cycle in worker queues, causing head-of-line blocking.',
    solution: 'Jobs that exceed maxRetries or encounter PERMANENT_FAILURE are immediately partitioned into status = DEAD_LETTER with structured failure classification and stack traces.',
    codeSnippet: `if (!retryable || retryCount >= maxRetries) {
    job.setStatus(JobStatus.DEAD_LETTER);
    job.setFailureCategory(failureCategory);
    job.setLastErrorStack(stackTrace);
}`,
    guarantee: 'LIVENESS-2: Poison jobs never block healthy work. Human operators inspect, repair, and safely replay jobs via authorized DLQ operations.',
  },
  {
    id: 'outbox',
    title: 'Transactional Outbox Pattern (SKIP LOCKED)',
    category: 'TRANSACTIONAL',
    subtitle: 'Eliminates dual-write inconsistencies between domain state and message dispatch',
    problem: 'Writing business entity updates to PostgreSQL while publishing HTTP/AMQP events in separate transactions creates data inconsistencies if one fails.',
    solution: 'Orders and their corresponding outbox events are inserted into the same ACID transaction. Dispatchers claim batches using SELECT FOR UPDATE SKIP LOCKED.',
    codeSnippet: `SELECT * FROM outbox_events 
WHERE status = 'PENDING' 
ORDER BY created_at ASC 
LIMIT :batchSize 
FOR UPDATE SKIP LOCKED;`,
    guarantee: 'SAFETY-3: Zero event loss. Dual writes are eliminated, and asynchronous dispatchers achieve at-least-once delivery.',
  },
  {
    id: 'idempotency',
    title: 'Consumer-Side Durable Idempotency',
    category: 'TRANSACTIONAL',
    subtitle: 'Guarantees exactly-once business effects despite network replay',
    problem: 'At-least-once transport inevitably delivers duplicate HTTP charge requests when acknowledgments are lost or network connections drop.',
    solution: 'Downstream payment receiver enforces UNIQUE(idempotency_key) constraints. Replay requests matching an existing key return cached responses without re-charging.',
    codeSnippet: `INSERT INTO simulated_charges (id, idempotency_key, amount, status)
VALUES (:id, :key, :amount, 'COMMITTED')
ON CONFLICT (idempotency_key) DO UPDATE 
SET replay_count = simulated_charges.replay_count + 1;`,
    guarantee: 'END-TO-END EXACTLY-ONCE: Retried or replayed delivery requests commit financial state exactly once, returning identical idempotent receipts.',
  },
  {
    id: 'fairshare',
    title: 'FairShare DRR Scheduling & Concurrency Quotas',
    category: 'CONCURRENCY',
    subtitle: 'Multi-tenant fair queuing preventing noisy neighbor starvation',
    problem: 'A high-volume enterprise tenant flooding millions of jobs starves smaller tier tenants of shared cluster execution capacity.',
    solution: 'Weighted Deficit Round Robin (DRR) tracks quantum credits per scheduling sweep, enforcing strict per-tenant concurrency ceilings (slots) in real time.',
    codeSnippet: `// Claim capacity bounded by batch, deficit & available quota
int availableQuota = tenant.getMaxConcurrency() - tenant.getRunningCount();
int claimLimit = Math.min(batchRemaining, Math.min(deficit, availableQuota));`,
    guarantee: 'FAIRNESS: High-frequency tenants cannot consume more than their allocated concurrency quota, ensuring sub-second response for peer tenants.',
  },
  {
    id: 'lifecycle',
    title: 'Worker SmartLifecycle & Thread Pool Draining',
    category: 'RECOVERY',
    subtitle: 'Graceful shutdown preventing in-flight execution interruption',
    problem: 'Rolling deployments and autoscaling scale-down events abruptly kill executing threads, creating unnecessary lease recovery cycles.',
    solution: 'WorkerCoordinator implements Spring SmartLifecycle with phase Integer.MAX_VALUE. It halts polling new jobs, allows in-flight tasks up to 25s to finish, and drains HikariCP.',
    codeSnippet: `public void stop() {
    this.running = false;
    executorService.shutdown();
    executorService.awaitTermination(25, TimeUnit.SECONDS);
}`,
    guarantee: 'GRACEFUL DRAIN: In-flight jobs complete normally during planned rolling updates without generating false failure alarms.',
  },
];

interface ChaosExperiment {
  id: string;
  name: string;
  badge: string;
  faultMechanism: string;
  significance: string;
  timeline: string[];
  outcome: string;
  invariantStatus: string;
}

const CHAOS_EXPERIMENTS: ChaosExperiment[] = [
  {
    id: 'exp-a',
    name: 'Experiment A: Hard Worker Crash Mid-Execution',
    badge: 'UNPREVENTABLE SIGKILL',
    faultMechanism: 'Submits an 8-second processing task to Worker 1. Once database confirms status = RUNNING and active disk lease, docker kill delivers an uncatchable SIGKILL to the container process.',
    significance: 'Unlike graceful shutdowns with @PreDestroy hooks, SIGKILL simulates sudden kernel panics, OOM kills, and power outages. HikariCP connections terminate without TCP FIN.',
    timeline: [
      'T+0.00s: Job submitted and claimed by Worker 1 (lease duration = 6.00s).',
      'T+1.20s: Database confirms job status = RUNNING, disk lock verified.',
      'T+1.50s: Fault injected: docker kill -s KILL qf-chaos-worker-1.',
      'T+7.50s: Worker 1 lease expires without heartbeat renewal in PostgreSQL.',
      'T+8.00s: Worker 2 LeaseRecoverySweeper discovers expired lease and resets job to PENDING.',
      'T+8.10s: Worker 2 claims job with fresh claim token (attemptCount: 2).',
      'T+12.10s: Worker 2 completes execution successfully (status = COMPLETED).',
    ],
    outcome: 'Zero task loss. Database row survived crash. Sweeper detected lease expiration and successfully re-assigned task to healthy worker.',
    invariantStatus: 'SAFETY-1, SAFETY-3, LIVENESS-1 VERIFIED PASS',
  },
  {
    id: 'exp-b',
    name: 'Experiment B: Zombie Worker & Fencing Token Protection',
    badge: 'SPLIT-BRAIN CONFLICT',
    faultMechanism: 'Worker 1 claims a job, then enters an artificial Stop-The-World (STW) JVM pause with heartbeat disabled. Lease expires. Worker 2 detects expiry, re-claims, and completes job. Worker 1 then awakens and attempts to commit.',
    significance: 'Proves distributed consensus and fencing correctness without requiring heavyweight consensus algorithms like Paxos/Raft for task completion.',
    timeline: [
      'T+0.00s: Worker 1 claims job with claim_token = T1, lease expires at T+6.00s.',
      'T+1.00s: Artificial GC pause barrier engaged on Worker 1; heartbeat renewal paused.',
      'T+6.05s: Lease expires in PostgreSQL.',
      'T+7.00s: Worker 2 detects expired lease, claims job with claim_token = T2 (attemptCount: 2).',
      'T+9.00s: Worker 2 successfully completes job (status = COMPLETED, token = T2).',
      'T+10.00s: GC barrier released on Worker 1. Worker 1 resumes and executes UPDATE ... WHERE claim_token = T1.',
      'T+10.05s: PostgreSQL UPDATE matches 0 rows! Worker 1 logs "Fenced out! Stale token T1".',
    ],
    outcome: 'Zombie write rejected. Database remains COMPLETED under Worker 2 token. Zero split-brain data corruption.',
    invariantStatus: 'SAFETY-2, SAFETY-5 VERIFIED PASS',
  },
  {
    id: 'exp-c',
    name: 'Experiment C: Split-Brain Network Partition',
    badge: 'ISOLATION PARTITION',
    faultMechanism: 'Worker 1 is isolated from PostgreSQL database container via docker network disconnect. Ingress API and Worker 2 remain on healthy network.',
    significance: 'Simulates top-of-rack switch failure, network segmentation, or cloud availability zone disruption affecting a subset of worker nodes.',
    timeline: [
      'T+0.00s: Cluster operating normally across 2 active worker instances.',
      'T+1.00s: Fault injected: Worker 1 network interface disconnected from qf-chaos-net.',
      'T+2.00s: Worker 1 JDBC pool marks connections broken, suspends polling.',
      'T+2.50s: Continuous job ingress submitted to API cluster.',
      'T+3.00s-T+15.00s: Worker 2 continues uninterrupted claiming, executing, and completing jobs.',
      'T+16.00s: Network restored: docker network connect qf-chaos-net Worker 1.',
      'T+17.00s: Worker 1 restores HikariCP pool and resumes queue participation without container restart.',
    ],
    outcome: 'Partitioned worker failed cleanly without locking shared tables. Healthy worker maintained continuous cluster throughput (LIVENESS-3).',
    invariantStatus: 'SAFETY-1, LIVENESS-3 VERIFIED PASS',
  },
];

interface InvariantSpec {
  id: string;
  category: 'SAFETY' | 'LIVENESS';
  name: string;
  formalDefinition: string;
  verificationLogic: string;
  status: 'VERIFIED PASS';
}

const INVARIANT_MATRIX: InvariantSpec[] = [
  {
    id: 'SAFETY-1',
    category: 'SAFETY',
    name: 'Single Valid Owner',
    formalDefinition: 'At any point in time t, at most one worker holds an active lease for any given job: |{w | lease(j, w, t)}| ≤ 1.',
    verificationLogic: 'In PostgreSQL state, at most one active lease (locked_by, claim_token) exists per job row at any point in time.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'SAFETY-2',
    category: 'SAFETY',
    name: 'Stale Worker Fenced',
    formalDefinition: 'A worker w with claim_token T_old where lease_until < NOW() cannot transition job status or mutate task output.',
    verificationLogic: 'UPDATE ... WHERE claim_token = :token AND lease_until >= NOW() yields 0 updated rows for stale workers.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'SAFETY-3',
    category: 'SAFETY',
    name: 'Durable Storage Survival',
    formalDefinition: '∀j ∈ Submissions: j acknowledged ⇒ j ∈ PostgreSQL database until explicit retention pruning.',
    verificationLogic: 'No acknowledged job submission is lost or silently deleted during worker crashes, OOM kills, or network partitions.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'SAFETY-4',
    category: 'SAFETY',
    name: 'Bounded Retries',
    formalDefinition: 'attempt_count ≤ max_retries + 1 ∧ retry_count ≤ max_retries.',
    verificationLogic: 'attempt_count and retry_count strictly respect configured limits before final transition to DEAD_LETTER.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'SAFETY-5',
    category: 'SAFETY',
    name: 'No Terminal Reversal',
    formalDefinition: 'status(j, t) = COMPLETED ⇒ ∀t\' > t: status(j, t\') = COMPLETED.',
    verificationLogic: 'Once a job reaches COMPLETED status, no subsequent worker event or sweeper pass can regress it to RUNNING or PENDING.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'SAFETY-6',
    category: 'SAFETY',
    name: 'Consistent Audit Evidence',
    formalDefinition: '∀ terminal transition ∈ qf_jobs, ∃! matching execution log record ∈ qf_job_execution_logs.',
    verificationLogic: 'Every terminal transition has a corresponding queryable execution log record with matching attempt number and status.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'LIVENESS-1',
    category: 'LIVENESS',
    name: 'Abandoned Job Recoverable',
    formalDefinition: 'status(j, t) = RUNNING ∧ lease_until < t ⇒ ∃t\' > t: status(j, t\') = PENDING ∨ DEAD_LETTER.',
    verificationLogic: 'LeaseRecoverySweeper detects expired leases and resets them to PENDING or DEAD_LETTER within bounded recovery sweep intervals.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'LIVENESS-2',
    category: 'LIVENESS',
    name: 'Eventual Terminal State',
    formalDefinition: 'Under bounded test execution, every non-poison job eventually reaches COMPLETED, and every poison job reaches DEAD_LETTER.',
    verificationLogic: 'Task lifecycle converges deterministically without infinite retry loops or permanent orphaned states.',
    status: 'VERIFIED PASS',
  },
  {
    id: 'LIVENESS-3',
    category: 'LIVENESS',
    name: 'Healthy Worker Continuity',
    formalDefinition: 'Fault(Worker_1) does not prevent Worker_2 from claiming and processing available queue jobs.',
    verificationLogic: 'A crash or network partition affecting Worker 1 does not starve, halt, or deadlock healthy peer workers.',
    status: 'VERIFIED PASS',
  },
];

export const ReliabilityLabPage: React.FC = () => {
  const { data: dashboardStats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: metrics, isLoading: metricsLoading } = useSystemMetricsSummary();
  const { data: workers } = useWorkerFleet();
  const { data: outboxStats } = useOutboxStats();

  const [activeMechanismTab, setActiveMechanismTab] = useState<string>('fencing');
  const [expandedChaosId, setExpandedChaosId] = useState<string>('exp-a');
  const [invariantFilter, setInvariantFilter] = useState<'ALL' | 'SAFETY' | 'LIVENESS'>('ALL');

  const onlineWorkers = workers?.filter((w) => w.status === 'ONLINE').length ?? 0;
  const totalWorkers = workers?.length ?? 0;

  const currentMechanism = RESILIENCE_MECHANISMS.find((m) => m.id === activeMechanismTab) || RESILIENCE_MECHANISMS[0];

  const filteredInvariants = INVARIANT_MATRIX.filter((inv) => {
    if (invariantFilter === 'ALL') return true;
    return inv.category === invariantFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Reliability Lab & Distributed Verification
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)]">
              CHAOS TESTED
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
              9/9 INVARIANTS PASS
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Real-time fault resilience telemetry, resilience mechanism architecture, historical ChaosLab experiment evidence, and formal distributed correctness guarantees
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/dlq"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--color-crimson)] bg-[var(--color-crimson-bg)] border border-[var(--color-crimson-border)] rounded-lg hover:brightness-110 transition"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Dead-Letter Operations
          </Link>
          <button
            onClick={() => refetchStats()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Section 1: Reliability Overview Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="DLQ Poison Jobs"
          value={statsLoading ? '...' : (dashboardStats?.deadLetterJobs ?? 0)}
          subtitle="Isolated poison tasks"
          icon={ShieldAlert}
          variant={(dashboardStats?.deadLetterJobs ?? 0) > 0 ? 'rose' : 'emerald'}
        />
        <MetricCard
          title="Total System Failures"
          value={metricsLoading ? '...' : Math.round(metrics?.failedTotal ?? 0)}
          subtitle="Encountered failure events"
          icon={Flame}
          variant="amber"
        />
        <MetricCard
          title="Successful Executions"
          value={metricsLoading ? '...' : Math.round(metrics?.completedTotal ?? 0)}
          subtitle="Terminal completed jobs"
          icon={CheckCircle2}
          variant="emerald"
        />
        <MetricCard
          title="Outbox DLQ Events"
          value={outboxStats?.deadLetterCount ?? 0}
          subtitle="Non-transient relay failures"
          icon={AlertTriangle}
          variant={(outboxStats?.deadLetterCount ?? 0) > 0 ? 'rose' : 'emerald'}
        />
        <MetricCard
          title="Worker Fleet Resilience"
          value={`${onlineWorkers}/${totalWorkers} ACTIVE`}
          subtitle="Heartbeating instances"
          icon={Server}
          variant="cyan"
        />
      </div>

      {/* Section 2: 8 Resilience Mechanisms Explorer */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--color-cyan)]" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Core Distributed Resilience Mechanisms
            </h3>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Architectural defenses preventing data loss, zombie writes, noisy neighbor starvation, and split-brain anomalies
          </p>
        </div>

        {/* Mechanism Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {RESILIENCE_MECHANISMS.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMechanismTab(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeMechanismTab === m.id
                  ? 'bg-[var(--color-cyan)] text-black font-semibold shadow-md shadow-[var(--color-cyan)]/20'
                  : 'bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]'
              }`}
            >
              <Zap className="w-3 h-3" />
              {m.title}
            </button>
          ))}
        </div>

        {/* Detailed Mechanism Card */}
        <div className="p-5 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                  {currentMechanism.title}
                </h4>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]">
                  {currentMechanism.category}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {currentMechanism.subtitle}
              </p>
            </div>
            <div className="text-[11px] font-mono text-[var(--color-cyan)] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Fencing Guarantee Enforced
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
              <div className="font-bold text-[var(--color-crimson)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Problem Solved
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                {currentMechanism.problem}
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
              <div className="font-bold text-[var(--color-success)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Architectural Solution
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                {currentMechanism.solution}
              </p>
            </div>
          </div>

          {/* Code Implementation Snippet */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase font-bold text-[var(--color-text-muted)] flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" /> Implementation & Database Protocol
            </div>
            <pre className="p-3.5 rounded-lg bg-black/60 border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-cyan)] overflow-x-auto leading-relaxed">
              {currentMechanism.codeSnippet}
            </pre>
          </div>

          {/* Formal Guarantee Box */}
          <div className="p-3 rounded-lg bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)] text-xs text-[var(--color-cyan)] flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>{currentMechanism.guarantee}</span>
          </div>
        </div>
      </div>

      {/* Section 3: Historical ChaosLab Fault Injection Scenarios */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[var(--color-amber)]" />
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                ChaosLab Distributed Fault Experiments
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Empirical evidence from automated chaos injection against live multi-instance worker containers
            </p>
          </div>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-deep)] px-2 py-1 rounded border border-[var(--color-border-subtle)]">
            Evidence Source: docs/engineering/chaoslab.md
          </span>
        </div>

        <div className="space-y-3">
          {CHAOS_EXPERIMENTS.map((exp) => {
            const isExpanded = expandedChaosId === exp.id;
            return (
              <div
                key={exp.id}
                className="rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] overflow-hidden transition"
              >
                <button
                  onClick={() => setExpandedChaosId(isExpanded ? '' : exp.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--color-bg-interactive)] transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-amber-bg)] text-[var(--color-amber)] border border-[var(--color-amber-border)]">
                      {exp.badge}
                    </span>
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                      {exp.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[var(--color-success)] hidden sm:inline">
                      {exp.invariantStatus}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-[var(--color-border-subtle)] space-y-3 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                          Fault Injection Mechanism
                        </span>
                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                          {exp.faultMechanism}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                          Architectural Significance
                        </span>
                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                          {exp.significance}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Sequence */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                        Verified Execution Chronology (Milliseconds)
                      </span>
                      <div className="p-3 rounded-lg bg-black/60 border border-[var(--color-border-subtle)] space-y-1 font-mono text-[11px]">
                        {exp.timeline.map((step, idx) => (
                          <div key={idx} className="text-[var(--color-text-secondary)] flex items-start gap-2">
                            <span className="text-[var(--color-cyan)] font-bold">›</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[11px] text-[var(--color-success)] flex items-center justify-between font-mono">
                      <span>✓ {exp.outcome}</span>
                      <span className="font-bold">{exp.invariantStatus}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Formal Correctness Invariant Matrix */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--color-success)]" />
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Formal Distributed Correctness Invariants (9 Matrix)
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Mathematical guarantees verified by InvariantVerifier.java across database states and append-only audit traces
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[var(--color-bg-deep)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
            {(['ALL', 'SAFETY', 'LIVENESS'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setInvariantFilter(filter)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded transition ${
                  invariantFilter === filter
                    ? 'bg-[var(--color-cyan)] text-black'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] uppercase text-[10px] tracking-wider border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Invariant Name</th>
                <th className="px-4 py-3">Formal Mathematical / Database Specification</th>
                <th className="px-4 py-3">Verification Logic</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filteredInvariants.map((inv) => (
                <tr key={inv.id} className="hover:bg-[var(--color-bg-interactive)] transition">
                  <td className="px-4 py-3 font-bold text-[var(--color-cyan)]">
                    {inv.id}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                        inv.category === 'SAFETY'
                          ? 'bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border-[var(--color-amethyst-border)]'
                          : 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)]'
                      }`}
                    >
                      {inv.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)] font-sans">
                    {inv.name}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--color-text-secondary)] font-mono max-w-xs">
                    {inv.formalDefinition}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)] font-mono max-w-xs">
                    {inv.verificationLogic}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
                      <CheckCircle2 className="w-3 h-3" /> {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
