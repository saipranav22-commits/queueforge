import React, { useState } from 'react';
import {
  Lock,
  X,
  Sliders,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useSystemHealth, useWorkerFleet } from '../../hooks/useQueueForgeData';
import { useScenario } from '../../context/ScenarioContext';

export type TopologyNodeId =
  | 'frontend'
  | 'api-server'
  | 'sender-db'
  | 'worker-1'
  | 'worker-2'
  | 'payment-receiver'
  | 'receiver-db'
  | 'drr-scheduler'
  | 'outbox-dispatcher';

interface TopologyNodeMeta {
  id: TopologyNodeId;
  label: string;
  sublabel: string;
  role: string;
  kind: 'CONTAINER' | 'LOGICAL_SUBSYSTEM';
  zone: 'INGRESS' | 'PERSISTENCE' | 'EXECUTION' | 'DELIVERY';
  network: string;
  ports: string;
  image: string;
  description: string;
  invariants: string[];
}

const NODES_DATA: Record<TopologyNodeId, TopologyNodeMeta> = {
  frontend: {
    id: 'frontend',
    label: 'frontend',
    sublabel: 'Nginx 1.27 Alpine',
    role: 'Edge Ingress & Reverse Proxy',
    kind: 'CONTAINER',
    zone: 'INGRESS',
    network: 'Host Loopback + qf-prod-edge-net',
    ports: '127.0.0.1:8088 -> Container :80',
    image: 'ghcr.io/saipranav22-commits/queueforge/frontend:latest',
    description: 'Serves React 19 static production assets and reverse proxies /api/ requests with strict security headers.',
    invariants: ['Zero direct backend DB exposure', 'Strict CSP & no-eval headers', 'Rate-limited edge proxy'],
  },
  'api-server': {
    id: 'api-server',
    label: 'api-server',
    sublabel: 'Spring Boot 3 (Java 21)',
    role: 'Job Ingestion & Admin Gateway',
    kind: 'CONTAINER',
    zone: 'INGRESS',
    network: 'qf-prod-edge-net + qf-prod-backend-net',
    ports: 'Internal Port 8080 (No Host Binding)',
    image: 'ghcr.io/saipranav22-commits/queueforge/backend:latest (APP_MODE=API_ONLY)',
    description: 'Stateless API ingest node validating jobs, enforcing tenant rate limits, and redacting sensitive demo payloads.',
    invariants: ['Zero task execution threads in API mode', 'Durable tenant rate limit checks', 'Response-level payload redaction'],
  },
  'sender-db': {
    id: 'sender-db',
    label: 'sender-db',
    sublabel: 'PostgreSQL 16.8 Alpine',
    role: 'Primary ACID Queue & Outbox Store',
    kind: 'CONTAINER',
    zone: 'PERSISTENCE',
    network: 'qf-prod-backend-net (Isolated)',
    ports: 'Port 5432 (Internal Bridge Only)',
    image: 'postgres:16.8-alpine',
    description: 'PostgreSQL 16 persistence store holding the durable queue table (qf_jobs) and the atomic transactional outbox (qf_outbox_events).',
    invariants: ['Zero host port binding in production compose', 'FOR UPDATE SKIP LOCKED lease claims', 'Atomic order + outbox transaction'],
  },
  'worker-1': {
    id: 'worker-1',
    label: 'worker-1',
    sublabel: 'Spring Boot 3 (Worker Mode)',
    role: 'DRR Execution Daemon #1',
    kind: 'CONTAINER',
    zone: 'EXECUTION',
    network: 'qf-prod-backend-net (Isolated)',
    ports: 'No Ports Exposed (Worker Poller)',
    image: 'ghcr.io/saipranav22-commits/queueforge/backend:latest (APP_MODE=WORKER_ONLY)',
    description: 'Autonomous worker process claiming pending jobs via multi-tenant Deficit Round Robin scheduling with 30-second time-bounded lease fencing.',
    invariants: ['PostgreSQL advisory lock fencing', 'Exponential backoff with full jitter', 'Poison failure isolation into DLQ'],
  },
  'worker-2': {
    id: 'worker-2',
    label: 'worker-2',
    sublabel: 'Spring Boot 3 (Worker Mode)',
    role: 'DRR Execution Daemon #2',
    kind: 'CONTAINER',
    zone: 'EXECUTION',
    network: 'qf-prod-backend-net (Isolated)',
    ports: 'No Ports Exposed (Worker Poller)',
    image: 'ghcr.io/saipranav22-commits/queueforge/backend:latest (APP_MODE=WORKER_ONLY)',
    description: 'Concurrent worker executing alongside worker-1 to demonstrate distributed multi-worker lease ownership without lock contention.',
    invariants: ['Zero duplicate job executions', 'Independent lease heartbeats (3s poll)', 'Dynamic crash recovery sweeping'],
  },
  'drr-scheduler': {
    id: 'drr-scheduler',
    label: 'DRR Deficit Scheduler',
    sublabel: 'Algorithm: O(1) Per Tenant',
    role: 'Deficit Round-Robin Multi-Tenant Engine',
    kind: 'LOGICAL_SUBSYSTEM',
    zone: 'EXECUTION',
    network: 'In-Process JVM Poller Component',
    ports: 'Internal Memory Structures',
    image: 'Embedded in Backend Workers',
    description: 'Deficit Round Robin queueing discipline prevents noisy tenants from monopolizing worker threads, guaranteeing starvation prevention.',
    invariants: ['Fair quantum credits (Qi = wi * Qbase)', 'Deficit accumulation up to max burst limit', 'Head-of-line blocking elimination'],
  },
  'outbox-dispatcher': {
    id: 'outbox-dispatcher',
    label: 'Transactional Outbox Dispatcher',
    sublabel: 'At-Least-Once Delivery Daemon',
    role: 'Atomic Outbox Poller & HTTP Dispatcher',
    kind: 'LOGICAL_SUBSYSTEM',
    zone: 'DELIVERY',
    network: 'In-Process Background Poller',
    ports: 'Outbound HTTP to Receiver',
    image: 'Embedded in Backend Services',
    description: 'Polls qf_outbox_events with SELECT FOR UPDATE SKIP LOCKED, dispatches HTTP webhooks, and handles exponential retry backoff.',
    invariants: ['Zero lost webhook events across crashes', 'Deterministic exponential backoff', 'At-least-once transport guarantee'],
  },
  'payment-receiver': {
    id: 'payment-receiver',
    label: 'payment-receiver',
    sublabel: 'Spring Boot 3 (Microservice)',
    role: 'Simulated Downstream Partner Gateway',
    kind: 'CONTAINER',
    zone: 'DELIVERY',
    network: 'qf-prod-backend-net (Isolated)',
    ports: 'Internal Port 8085 (Bridge Only)',
    image: 'ghcr.io/saipranav22-commits/queueforge/simulated-payment-receiver:latest',
    description: 'Simulates an external downstream payment partner receiving at-least-once outbox HTTP webhooks with idempotent deduplication.',
    invariants: ['SHA-256 idempotency key deduplication', 'Strict receiver authentication token', 'Simulated transient & permanent faults'],
  },
  'receiver-db': {
    id: 'receiver-db',
    label: 'receiver-db',
    sublabel: 'PostgreSQL 16.8 (Receiver)',
    role: 'Receiver Idempotency Inbox Store',
    kind: 'CONTAINER',
    zone: 'DELIVERY',
    network: 'qf-prod-backend-net (Isolated)',
    ports: 'Port 5433 Internal (Zero Host Binding)',
    image: 'postgres:16.8-alpine',
    description: 'Dedicated isolated database storing processed idempotency keys to ensure duplicate webhook deliveries produce exactly one business execution.',
    invariants: ['Complete physical database isolation', 'Unique constraint on idempotency_key', 'Zero direct connection from sender API'],
  },
};

export const SystemTopology: React.FC = () => {
  const [selectedId, setSelectedId] = useState<TopologyNodeId>('api-server');
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'invariants' | 'telemetry'>('overview');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const { data: health } = useSystemHealth();
  const { data: workers } = useWorkerFleet();
  const { isScenarioMode, activeScenarioId, activeScenario } = useScenario();

  const isBackendOnline = Boolean(health);
  const selectedMeta = NODES_DATA[selectedId];

  // Derive node status with scenario override awareness
  const getNodeHealth = (id: TopologyNodeId): 'healthy' | 'degraded' | 'disconnected' => {
    if (isScenarioMode) {
      if (activeScenarioId === 'WORKER_FAILURE') {
        if (id === 'worker-2') return 'disconnected';
        return 'healthy';
      }
      if (activeScenarioId === 'OUTBOX_RETRY') {
        if (id === 'payment-receiver') return 'degraded';
        return 'healthy';
      }
      if (activeScenarioId === 'DLQ_POISON_RECOVERY') {
        if (id === 'worker-1') return 'degraded';
        return 'healthy';
      }
      return 'healthy';
    }

    if (!isBackendOnline) {
      return 'disconnected';
    }

    if (id === 'sender-db') {
      return health?.dbStatus === 'UP' ? 'healthy' : 'disconnected';
    }
    if (id === 'api-server') {
      return health?.status === 'UP' ? 'healthy' : 'disconnected';
    }
    if (id === 'worker-1' || id === 'worker-2') {
      const match = workers?.find(
        (w) => w.instanceId === id || w.instanceId.toLowerCase().includes(id.replace('-', ''))
      );
      if (!match) {
        return health?.workerStatus === 'RUNNING' ? 'healthy' : 'disconnected';
      }
      const age = match.lastHeartbeat
        ? (Date.now() - new Date(match.lastHeartbeat).getTime()) / 1000
        : 999;
      return age < 15 ? 'healthy' : 'degraded';
    }
    if (id === 'frontend') {
      return 'healthy';
    }
    if (id === 'drr-scheduler' || id === 'outbox-dispatcher') {
      return health?.workerStatus === 'RUNNING' ? 'healthy' : 'disconnected';
    }
    return 'disconnected';
  };

  const currentHealth = getNodeHealth(selectedId);

  // Keyboard navigation for accessible SVG nodes
  const handleKeyDown = (e: React.KeyboardEvent, id: TopologyNodeId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedId(id);
      setInspectorOpen(true);
    } else if (e.key === 'Escape') {
      setInspectorOpen(false);
    }
  };

  return (
    <div className="rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] shadow-sm overflow-hidden transition-all">
      {/* Topology Header Bar */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-standard)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-bg-deep)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
              Signature Distributed Topology & Boundary Canvas
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] font-medium">
              7 CONTAINERS + 2 ENGINES
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {isScenarioMode
              ? `Scenario Active: Simulating realistic flows and faults (${activeScenario?.title || activeScenarioId})`
              : isBackendOnline
              ? 'Live Cluster: Select any container or subsystem to inspect boundaries, invariants, and live telemetry.'
              : 'Architecture Mode — Showing verified structural contracts (Backend Daemons Disconnected).'}
          </p>
        </div>

        {/* Canvas Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.1))}
              className="px-2 py-1 text-xs font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              title="Zoom Out"
            >
              -
            </button>
            <span className="px-1 text-[10px] font-mono text-[var(--color-text-muted)]">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              className="px-2 py-1 text-xs font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border-l border-[var(--color-border-subtle)]"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-interactive)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] rounded transition cursor-pointer"
            title={inspectorOpen ? 'Collapse Inspector' : 'Expand Inspector'}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Topology + Contextual Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        {/* Topology SVG Canvas */}
        <div
          className={`${
            inspectorOpen ? 'lg:col-span-8' : 'lg:col-span-12'
          } p-4 sm:p-6 bg-[var(--color-bg-base)] flex items-center justify-center relative select-none border-b lg:border-b-0 lg:border-r border-[var(--color-border-subtle)] overflow-hidden transition-all`}
        >
          <div
            className="w-full transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          >
            <svg
              className="w-full h-auto max-h-[520px]"
              viewBox="0 0 880 500"
              role="region"
              aria-label="Distributed System Topology"
            >
              <defs>
                <marker
                  id="arrow-subtle"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-text-dim)" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-accent)" />
                </marker>
                <marker
                  id="arrow-amber"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-warning)" />
                </marker>
              </defs>

              {/* 4 ARCHITECTURAL SUBSYSTEM ZONES */}
              {/* ZONE 1: INGRESS */}
              <rect
                x="15"
                y="20"
                width="190"
                height="460"
                rx="10"
                fill="var(--color-bg-deep)"
                fillOpacity="0.4"
                stroke="var(--color-border-subtle)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text x="25" y="42" fill="var(--color-text-dim)" fontSize="10" fontFamily="monospace" fontWeight="700">
                ZONE 1: EDGE & INGRESS
              </text>

              {/* ZONE 2: EXECUTION FLEET */}
              <rect
                x="220"
                y="20"
                width="220"
                height="460"
                rx="10"
                fill="var(--color-bg-deep)"
                fillOpacity="0.3"
                stroke="var(--color-border-subtle)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text x="230" y="42" fill="var(--color-text-dim)" fontSize="10" fontFamily="monospace" fontWeight="700">
                ZONE 2: DRR EXECUTION FLEET
              </text>

              {/* ZONE 3: PERSISTENCE (ACID) */}
              <rect
                x="455"
                y="20"
                width="190"
                height="460"
                rx="10"
                fill="var(--color-bg-deep)"
                fillOpacity="0.4"
                stroke="var(--color-border-subtle)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text x="465" y="42" fill="var(--color-text-dim)" fontSize="10" fontFamily="monospace" fontWeight="700">
                ZONE 3: PRIMARY PERSISTENCE
              </text>

              {/* ZONE 4: AT-LEAST-ONCE DELIVERY */}
              <rect
                x="660"
                y="20"
                width="205"
                height="460"
                rx="10"
                fill="var(--color-bg-deep)"
                fillOpacity="0.3"
                stroke="var(--color-border-subtle)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text x="670" y="42" fill="var(--color-text-dim)" fontSize="10" fontFamily="monospace" fontWeight="700">
                ZONE 4: AT-LEAST-ONCE DELIVERY
              </text>

              {/* CONNECTION PATHWAYS */}
              {/* Ingress -> API Server */}
              <path
                d="M 155 105 L 235 105"
                stroke={isScenarioMode || isBackendOnline ? 'var(--color-accent)' : 'var(--color-border-interactive)'}
                strokeWidth="1.5"
                markerEnd="url(#arrow-subtle)"
                fill="none"
              />
              {/* API Server -> Sender DB (Ingest commit) */}
              <path
                d="M 365 105 C 410 105, 430 140, 470 140"
                stroke="var(--color-border-interactive)"
                strokeWidth="1.5"
                markerEnd="url(#arrow-subtle)"
                fill="none"
              />
              {/* Workers -> Sender DB (FOR UPDATE SKIP LOCKED Polling) */}
              <path
                d="M 365 240 C 410 240, 430 200, 470 170"
                stroke="var(--color-border-subtle)"
                strokeWidth="1.5"
                strokeDasharray="4,3"
                fill="none"
              />
              <path
                d="M 365 330 C 415 330, 435 220, 470 190"
                stroke={
                  isScenarioMode && activeScenarioId === 'WORKER_FAILURE'
                    ? 'var(--color-danger)'
                    : 'var(--color-border-subtle)'
                }
                strokeWidth="1.5"
                strokeDasharray={isScenarioMode && activeScenarioId === 'WORKER_FAILURE' ? '2,2' : '4,3'}
                fill="none"
              />
              {/* Outbox Dispatcher -> Payment Receiver */}
              <path
                d="M 635 375 L 675 375"
                stroke={
                  isScenarioMode && activeScenarioId === 'OUTBOX_RETRY'
                    ? 'var(--color-warning)'
                    : 'var(--color-accent)'
                }
                strokeWidth="1.5"
                strokeDasharray="4,3"
                markerEnd={
                  isScenarioMode && activeScenarioId === 'OUTBOX_RETRY'
                    ? 'url(#arrow-amber)'
                    : 'url(#arrow-active)'
                }
                fill="none"
              />
              {/* Payment Receiver -> Receiver DB */}
              <path
                d="M 760 345 C 760 320, 760 310, 760 305"
                stroke="var(--color-border-interactive)"
                strokeWidth="1.5"
                markerEnd="url(#arrow-subtle)"
                fill="none"
              />

              {/* NODE 1: Frontend Ingress */}
              <g
                tabIndex={0}
                transform="translate(30, 75)"
                onClick={() => setSelectedId('frontend')}
                onKeyDown={(e) => handleKeyDown(e, 'frontend')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="135"
                  height="70"
                  rx="8"
                  fill={selectedId === 'frontend' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                  stroke={selectedId === 'frontend' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                  strokeWidth={selectedId === 'frontend' ? '2' : '1'}
                />
                <circle cx="16" cy="18" r="4" fill="var(--color-success)" />
                <text x="28" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                  frontend
                </text>
                <text x="16" y="42" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  Nginx 1.27 Edge
                </text>
                <text x="16" y="58" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                  :8088 Loopback
                </text>
              </g>

              {/* NODE 2: API Gateway */}
              <g
                tabIndex={0}
                transform="translate(235, 75)"
                onClick={() => setSelectedId('api-server')}
                onKeyDown={(e) => handleKeyDown(e, 'api-server')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="145"
                  height="70"
                  rx="8"
                  fill={selectedId === 'api-server' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                  stroke={selectedId === 'api-server' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                  strokeWidth={selectedId === 'api-server' ? '2' : '1'}
                />
                <circle
                  cx="16"
                  cy="18"
                  r="4"
                  fill={getNodeHealth('api-server') === 'healthy' ? 'var(--color-success)' : 'var(--color-text-dim)'}
                />
                <text x="28" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                  api-server
                </text>
                <text x="16" y="42" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  Spring Boot 3 API
                </text>
                <text x="16" y="58" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                  Stateless Ingest
                </text>
              </g>

              {/* NODE: DRR Engine Subsystem (Logical) */}
              <g
                tabIndex={0}
                transform="translate(235, 160)"
                onClick={() => setSelectedId('drr-scheduler')}
                onKeyDown={(e) => handleKeyDown(e, 'drr-scheduler')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="145"
                  height="45"
                  rx="6"
                  fill={selectedId === 'drr-scheduler' ? 'var(--color-accent-bg)' : 'var(--color-bg-deep)'}
                  stroke={selectedId === 'drr-scheduler' ? 'var(--color-accent)' : 'var(--color-border-subtle)'}
                  strokeWidth={selectedId === 'drr-scheduler' ? '2' : '1'}
                />
                <text x="14" y="22" fill="var(--color-accent)" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                  DRR SCHEDULER
                </text>
                <text x="14" y="36" fill="var(--color-text-muted)" fontSize="8.5" fontFamily="monospace">
                  Qi = wi × Qbase Deficits
                </text>
              </g>

              {/* NODE 4: Worker 1 */}
              <g
                tabIndex={0}
                transform="translate(235, 215)"
                onClick={() => setSelectedId('worker-1')}
                onKeyDown={(e) => handleKeyDown(e, 'worker-1')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="145"
                  height="65"
                  rx="8"
                  fill={selectedId === 'worker-1' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                  stroke={selectedId === 'worker-1' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                  strokeWidth={selectedId === 'worker-1' ? '2' : '1'}
                />
                <circle
                  cx="16"
                  cy="18"
                  r="4"
                  fill={
                    getNodeHealth('worker-1') === 'healthy'
                      ? 'var(--color-success)'
                      : getNodeHealth('worker-1') === 'degraded'
                      ? 'var(--color-warning)'
                      : 'var(--color-text-dim)'
                  }
                />
                <text x="28" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                  worker-1 (JVM)
                </text>
                <text x="16" y="42" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  4 Thread Pool
                </text>
                <text x="16" y="56" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                  30s Fenced Lease
                </text>
              </g>

              {/* NODE 5: Worker 2 */}
              <g
                tabIndex={0}
                transform="translate(235, 290)"
                onClick={() => setSelectedId('worker-2')}
                onKeyDown={(e) => handleKeyDown(e, 'worker-2')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="145"
                  height="65"
                  rx="8"
                  fill={selectedId === 'worker-2' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                  stroke={
                    selectedId === 'worker-2'
                      ? 'var(--color-accent)'
                      : isScenarioMode && activeScenarioId === 'WORKER_FAILURE'
                      ? 'var(--color-danger)'
                      : 'var(--color-border-standard)'
                  }
                  strokeWidth={selectedId === 'worker-2' ? '2' : '1'}
                />
                <circle
                  cx="16"
                  cy="18"
                  r="4"
                  fill={
                    isScenarioMode && activeScenarioId === 'WORKER_FAILURE'
                      ? 'var(--color-danger)'
                      : getNodeHealth('worker-2') === 'healthy'
                      ? 'var(--color-success)'
                      : 'var(--color-text-dim)'
                  }
                />
                <text x="28" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                  worker-2 (JVM)
                </text>
                <text x="16" y="42" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  {isScenarioMode && activeScenarioId === 'WORKER_FAILURE' ? 'CRASHED / OFFLINE' : '4 Thread Pool'}
                </text>
                <text x="16" y="56" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                  {isScenarioMode && activeScenarioId === 'WORKER_FAILURE' ? 'Advisory Lock Revoked' : '30s Fenced Lease'}
                </text>
              </g>

              {/* NODE 3: Sender DB (Primary ACID) */}
              <g
                tabIndex={0}
                transform="translate(470, 75)"
                onClick={() => setSelectedId('sender-db')}
                onKeyDown={(e) => handleKeyDown(e, 'sender-db')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="165"
                  height="180"
                  rx="8"
                  fill={selectedId === 'sender-db' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                  stroke={selectedId === 'sender-db' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                  strokeWidth={selectedId === 'sender-db' ? '2' : '1'}
                />
                <circle
                  cx="16"
                  cy="18"
                  r="4"
                  fill={getNodeHealth('sender-db') === 'healthy' ? 'var(--color-success)' : 'var(--color-text-dim)'}
                />
                <text x="28" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                  sender-db (Postgres)
                </text>
                <text x="16" y="44" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  • qf_jobs (Queue)
                </text>
                <text x="16" y="60" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  • qf_tenants (DRR)
                </text>
                <text x="16" y="76" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  • qf_outbox_events (2PC)
                </text>
                <text x="16" y="92" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  • qf_job_leases (Locks)
                </text>
                <rect x="14" y="106" width="137" height="24" rx="4" fill="var(--color-bg-deep)" />
                <text x="20" y="122" fill="var(--color-text-secondary)" fontSize="8.5" fontFamily="monospace" fontWeight="600">
                  SKIP LOCKED FENCING
                </text>
                <rect x="14" y="136" width="137" height="24" rx="4" fill="var(--color-bg-deep)" />
                <text x="20" y="152" fill="var(--color-text-dim)" fontSize="8.5" fontFamily="monospace" fontWeight="600">
                  ZERO HOST PORT EXPOSURE
                </text>
              </g>

              {/* NODE: Outbox Dispatcher (Logical) */}
              <g
                tabIndex={0}
                transform="translate(470, 345)"
                onClick={() => setSelectedId('outbox-dispatcher')}
                onKeyDown={(e) => handleKeyDown(e, 'outbox-dispatcher')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="165"
                  height="60"
                  rx="6"
                  fill={selectedId === 'outbox-dispatcher' ? 'var(--color-accent-bg)' : 'var(--color-bg-deep)'}
                  stroke={selectedId === 'outbox-dispatcher' ? 'var(--color-accent)' : 'var(--color-border-subtle)'}
                  strokeWidth={selectedId === 'outbox-dispatcher' ? '2' : '1'}
                />
                <text x="14" y="24" fill="var(--color-accent)" fontSize="9.5" fontWeight="700" fontFamily="monospace">
                  OUTBOX DISPATCHER
                </text>
                <text x="14" y="42" fill="var(--color-text-muted)" fontSize="8.5" fontFamily="monospace">
                  Polling qf_outbox_events
                </text>
              </g>

              {/* NODE 6: Payment Receiver */}
              <g
                tabIndex={0}
                transform="translate(680, 345)"
                onClick={() => setSelectedId('payment-receiver')}
                onKeyDown={(e) => handleKeyDown(e, 'payment-receiver')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="165"
                  height="65"
                  rx="8"
                  fill={selectedId === 'payment-receiver' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                  stroke={
                    selectedId === 'payment-receiver'
                      ? 'var(--color-accent)'
                      : isScenarioMode && activeScenarioId === 'OUTBOX_RETRY'
                      ? 'var(--color-warning)'
                      : 'var(--color-border-standard)'
                  }
                  strokeWidth={selectedId === 'payment-receiver' ? '2' : '1'}
                />
                <circle
                  cx="16"
                  cy="18"
                  r="4"
                  fill={
                    isScenarioMode && activeScenarioId === 'OUTBOX_RETRY'
                      ? 'var(--color-warning)'
                      : 'var(--color-accent)'
                  }
                />
                <text x="28" y="22" fill="var(--color-text-primary)" fontSize="10.5" fontWeight="600">
                  payment-receiver
                </text>
                <text x="16" y="40" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  External HTTP Receiver
                </text>
                <text x="16" y="54" fill="var(--color-accent)" fontSize="9" fontFamily="monospace">
                  Idempotency Verification
                </text>
              </g>

              {/* NODE 7: Receiver DB */}
              <g
                tabIndex={0}
                transform="translate(680, 230)"
                onClick={() => setSelectedId('receiver-db')}
                onKeyDown={(e) => handleKeyDown(e, 'receiver-db')}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  width="165"
                  height="75"
                  rx="8"
                  fill={selectedId === 'receiver-db' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                  stroke={selectedId === 'receiver-db' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                  strokeWidth={selectedId === 'receiver-db' ? '2' : '1'}
                />
                <circle cx="16" cy="18" r="4" fill="var(--color-text-dim)" />
                <text x="28" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                  receiver-db
                </text>
                <text x="16" y="42" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                  PostgreSQL 16.8 (:5433)
                </text>
                <text x="16" y="56" fill="var(--color-text-dim)" fontSize="9" fontFamily="monospace">
                  processed_keys Table
                </text>
              </g>

              {/* Security Boundary Indicator */}
              <g transform="translate(30, 460)">
                <text x="0" y="0" fill="var(--color-text-dim)" fontSize="9" fontFamily="monospace">
                  🔒 Zero Direct Database Exposure Outside Docker Bridge Network
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Collapsible Contextual Inspector with Structured Tabs */}
        {inspectorOpen && (
          <div className="lg:col-span-4 p-5 bg-[var(--color-bg-deep)] flex flex-col justify-between space-y-4 transition-all">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-text-muted)] font-semibold">
                      {selectedMeta.kind} INSPECTOR
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                      {selectedMeta.zone}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2 mt-0.5">
                    {selectedMeta.label}
                    <span
                      className={`w-2 h-2 rounded-full ${
                        currentHealth === 'healthy'
                          ? 'bg-[var(--color-success)]'
                          : currentHealth === 'degraded'
                          ? 'bg-[var(--color-warning)]'
                          : 'bg-[var(--color-text-dim)]'
                      }`}
                    />
                  </h4>
                </div>
                <button
                  onClick={() => setInspectorOpen(false)}
                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] transition cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Inspector Structured Navigation Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[11px] font-mono">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-1 px-2 rounded font-medium transition ${
                    activeTab === 'overview'
                      ? 'bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('network')}
                  className={`flex-1 py-1 px-2 rounded font-medium transition ${
                    activeTab === 'network'
                      ? 'bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  Network
                </button>
                <button
                  onClick={() => setActiveTab('invariants')}
                  className={`flex-1 py-1 px-2 rounded font-medium transition ${
                    activeTab === 'invariants'
                      ? 'bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  Invariants
                </button>
                <button
                  onClick={() => setActiveTab('telemetry')}
                  className={`flex-1 py-1 px-2 rounded font-medium transition ${
                    activeTab === 'telemetry'
                      ? 'bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  Telemetry
                </button>
              </div>

              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                      ARCHITECTURAL ROLE
                    </span>
                    <p className="text-[var(--color-text-primary)] font-medium mt-0.5">
                      {selectedMeta.role}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                      DESCRIPTION
                    </span>
                    <p className="text-[var(--color-text-secondary)] text-xs mt-0.5 leading-relaxed">
                      {selectedMeta.description}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                      CONTAINER IMAGE / ARTIFACT
                    </span>
                    <p className="text-[var(--color-text-muted)] font-mono text-[10px] break-all mt-0.5">
                      {selectedMeta.image}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Network & Ports */}
              {activeTab === 'network' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                      NETWORK BRIDGE
                    </span>
                    <p className="text-[var(--color-text-secondary)] font-mono text-[11px] mt-0.5">
                      {selectedMeta.network}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                      PORT BINDING & SECURITY
                    </span>
                    <p className="text-[var(--color-text-primary)] font-mono text-[11px] mt-0.5">
                      {selectedMeta.ports}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-muted)]">
                    Protected by Docker Bridge Network Isolation. Direct DB access from host OS is strictly prohibited.
                  </div>
                </div>
              )}

              {/* Tab 3: Distributed Invariants */}
              {activeTab === 'invariants' && (
                <div className="space-y-2 text-xs">
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block mb-1">
                    FORMALLY VERIFIED INVARIANTS
                  </span>
                  {selectedMeta.invariants.map((inv, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] text-[var(--color-text-secondary)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                      <span>{inv}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 4: Telemetry */}
              {activeTab === 'telemetry' && (
                <div className="space-y-3 text-xs font-mono">
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                    OBSERVED RUNTIME STATUS
                  </span>
                  <div className="p-3 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">Operational State:</span>
                      <span className={`font-semibold ${
                        currentHealth === 'healthy' ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dim)]'
                      }`}>
                        {currentHealth.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">Data Provenance:</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {isScenarioMode ? 'Deterministic Scenario' : isBackendOnline ? 'Live 3s Query' : 'Static Schema Spec'}
                      </span>
                    </div>
                    {isScenarioMode && (
                      <div className="pt-2 border-t border-[var(--color-border-subtle)] text-[10px] text-[var(--color-warning)]">
                        Active Simulation: {activeScenario?.title || activeScenarioId}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-[var(--color-text-muted)]" />
                ACID Isolation Protected
              </span>
              <span className="font-mono text-[10px] text-[var(--color-text-dim)]">
                qf-v2
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
