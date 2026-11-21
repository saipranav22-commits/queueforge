import React, { useState } from 'react';
import {
  Lock,
  X,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useSystemHealth, useWorkerFleet } from '../../hooks/useQueueForgeData';

export type TopologyNodeId =
  | 'frontend'
  | 'api-server'
  | 'sender-db'
  | 'worker-1'
  | 'worker-2'
  | 'payment-receiver'
  | 'receiver-db';

interface TopologyNodeMeta {
  id: TopologyNodeId;
  label: string;
  sublabel: string;
  role: string;
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
    network: 'qf-prod-edge-net + qf-prod-backend-net',
    ports: 'Internal Port 8080 (No Host Binding)',
    image: 'ghcr.io/saipranav22-commits/queueforge/backend:latest (APP_MODE=API_ONLY)',
    description: 'Stateless API ingest node validating jobs, enforcing tenant rate limits, and redacting sensitive demo payloads.',
    invariants: ['Zero task execution threads in API mode', 'Durable tenant rate limit checks', 'Response-level payload redaction'],
  },
  'sender-db': {
    id: 'sender-db',
    label: 'sender-db',
    sublabel: 'PostgreSQL 16.8',
    role: 'Primary ACID Queue & Outbox Store',
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
    role: 'Deficit Round-Robin Execution Daemon',
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
    role: 'Deficit Round-Robin Execution Daemon',
    network: 'qf-prod-backend-net (Isolated)',
    ports: 'No Ports Exposed (Worker Poller)',
    image: 'ghcr.io/saipranav22-commits/queueforge/backend:latest (APP_MODE=WORKER_ONLY)',
    description: 'Concurrent worker executing alongside worker-1 to demonstrate distributed multi-worker lease ownership without lock contention.',
    invariants: ['Zero duplicate job executions', 'Independent lease heartbeats (3s poll)', 'Dynamic crash recovery sweeping'],
  },
  'payment-receiver': {
    id: 'payment-receiver',
    label: 'payment-receiver',
    sublabel: 'Spring Boot 3 (Microservice)',
    role: 'Simulated External Payment Gateway',
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
  const { data: health } = useSystemHealth();
  const { data: workers } = useWorkerFleet();

  const isBackendOnline = Boolean(health);
  const selectedMeta = NODES_DATA[selectedId];

  // Derive honest node health
  const getNodeHealth = (id: TopologyNodeId): 'healthy' | 'degraded' | 'disconnected' => {
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
      return 'healthy'; // Currently rendering this UI
    }
    return 'disconnected';
  };

  const currentHealth = getNodeHealth(selectedId);

  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-sm overflow-hidden transition-all">
      {/* Topology Header Bar */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-bg-deep)]/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
              Interactive 7-Service Distributed Topology
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] font-medium">
              ACID CLUSTER
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {isBackendOnline
              ? 'Select any container node to inspect network boundaries, runtime telemetry, and architectural invariants.'
              : 'Architecture View — Runtime Telemetry Unavailable (Backend Offline)'}
          </p>
        </div>

        {/* Legend & Inspector Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-dim)]'}`} />
              {isBackendOnline ? 'Healthy' : 'Offline / Unobserved'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
              Selected
            </span>
          </div>

          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-interactive)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] rounded transition cursor-pointer"
            title={inspectorOpen ? 'Collapse Container Inspector' : 'Open Container Inspector'}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Topology + Contextual Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Topology SVG Map (2/3 width when inspector open, 12 cols when collapsed) */}
        <div
          className={`${
            inspectorOpen ? 'lg:col-span-8' : 'lg:col-span-12'
          } p-4 sm:p-6 bg-[var(--color-bg-base)] flex items-center justify-center relative select-none border-b lg:border-b-0 lg:border-r border-[var(--color-border-subtle)] transition-all`}
        >
          <svg
            className="w-full h-auto max-h-[450px]"
            viewBox="0 0 780 440"
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
            </defs>

            {/* Network Boundary Box: qf-prod-backend-net */}
            <rect
              x="220"
              y="30"
              width="540"
              height="390"
              rx="12"
              fill="var(--color-bg-deep)"
              fillOpacity="0.4"
              stroke="var(--color-border-subtle)"
              strokeWidth="1"
              strokeDasharray="6,5"
            />
            <text
              x="235"
              y="52"
              fill="var(--color-text-dim)"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="600"
              letterSpacing="0.05em"
            >
              ISOLATED NETWORK: qf-prod-backend-net (Zero External Port Exposure)
            </text>

            {/* Edge Network Indicator */}
            <rect
              x="25"
              y="55"
              width="160"
              height="150"
              rx="10"
              fill="var(--color-bg-deep)"
              fillOpacity="0.3"
              stroke="var(--color-border-subtle)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <text
              x="35"
              y="74"
              fill="var(--color-text-dim)"
              fontSize="9"
              fontFamily="monospace"
            >
              HOST INGRESS (:8088)
            </text>

            {/* CONNECTION EDGES */}
            {/* Frontend -> API Server */}
            <path
              d="M 160 145 L 245 145"
              stroke="var(--color-border-interactive)"
              strokeWidth="1.5"
              markerEnd="url(#arrow-subtle)"
              fill="none"
            />
            {/* API Server -> Sender DB */}
            <path
              d="M 390 145 L 485 145"
              stroke="var(--color-border-interactive)"
              strokeWidth="1.5"
              markerEnd="url(#arrow-subtle)"
              fill="none"
            />
            {/* Worker 1 -> Sender DB (Lease Polling) */}
            <path
              d="M 390 245 C 440 245, 460 165, 485 160"
              stroke="var(--color-border-subtle)"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              fill="none"
            />
            {/* Worker 2 -> Sender DB (Lease Polling) */}
            <path
              d="M 390 325 C 440 325, 460 175, 485 170"
              stroke="var(--color-border-subtle)"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              fill="none"
            />
            {/* Outbox Flow: Workers -> Payment Receiver */}
            <path
              d="M 320 355 L 320 380 L 415 380"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              fill="none"
            />
            {/* Payment Receiver -> Receiver DB */}
            <path
              d="M 555 380 L 610 380"
              stroke="var(--color-border-interactive)"
              strokeWidth="1.5"
              markerEnd="url(#arrow-subtle)"
              fill="none"
            />

            {/* NODE 1: Frontend */}
            <g
              transform="translate(35, 105)"
              onClick={() => setSelectedId('frontend')}
              className="cursor-pointer"
            >
              <rect
                width="125"
                height="75"
                rx="8"
                fill={selectedId === 'frontend' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                stroke={selectedId === 'frontend' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                strokeWidth={selectedId === 'frontend' ? '2' : '1'}
              />
              <circle
                cx="15"
                cy="18"
                r="4"
                fill={getNodeHealth('frontend') === 'healthy' ? 'var(--color-success)' : 'var(--color-text-dim)'}
              />
              <text x="26" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                frontend
              </text>
              <text x="15" y="42" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                Nginx 1.27
              </text>
              <text x="15" y="58" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                :8088 Loopback
              </text>
            </g>

            {/* NODE 2: API Server */}
            <g
              transform="translate(250, 105)"
              onClick={() => setSelectedId('api-server')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="75"
                rx="8"
                fill={selectedId === 'api-server' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                stroke={selectedId === 'api-server' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                strokeWidth={selectedId === 'api-server' ? '2' : '1'}
              />
              <circle
                cx="15"
                cy="18"
                r="4"
                fill={getNodeHealth('api-server') === 'healthy' ? 'var(--color-success)' : 'var(--color-text-dim)'}
              />
              <text x="26" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                api-server
              </text>
              <text x="15" y="42" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                Spring Boot (API)
              </text>
              <text x="15" y="58" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                Ingest Gateway
              </text>
            </g>

            {/* NODE 3: Sender DB */}
            <g
              transform="translate(490, 85)"
              onClick={() => setSelectedId('sender-db')}
              className="cursor-pointer"
            >
              <rect
                width="165"
                height="115"
                rx="8"
                fill={selectedId === 'sender-db' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                stroke={selectedId === 'sender-db' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                strokeWidth={selectedId === 'sender-db' ? '2' : '1'}
              />
              <circle
                cx="15"
                cy="18"
                r="4"
                fill={getNodeHealth('sender-db') === 'healthy' ? 'var(--color-success)' : 'var(--color-text-dim)'}
              />
              <text x="26" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                sender-db (Postgres 16)
              </text>
              <text x="15" y="44" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                • qf_jobs (Queue)
              </text>
              <text x="15" y="60" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                • qf_tenants (DRR Quotas)
              </text>
              <text x="15" y="76" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                • qf_outbox_events (ACID)
              </text>
              <rect x="15" y="88" width="135" height="18" rx="4" fill="var(--color-bg-deep)" />
              <text x="22" y="100" fill="var(--color-text-dim)" fontSize="8.5" fontFamily="monospace" fontWeight="600">
                ZERO HOST PORT EXPOSURE
              </text>
            </g>

            {/* NODE 4: Worker 1 */}
            <g
              transform="translate(250, 215)"
              onClick={() => setSelectedId('worker-1')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="65"
                rx="8"
                fill={selectedId === 'worker-1' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                stroke={selectedId === 'worker-1' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                strokeWidth={selectedId === 'worker-1' ? '2' : '1'}
              />
              <circle
                cx="15"
                cy="18"
                r="4"
                fill={getNodeHealth('worker-1') === 'healthy' ? 'var(--color-success)' : 'var(--color-text-dim)'}
              />
              <text x="26" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                worker-1 (JVM)
              </text>
              <text x="15" y="40" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                DRR SKIP LOCKED
              </text>
              <text x="15" y="54" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                Lease Fenced (30s)
              </text>
            </g>

            {/* NODE 5: Worker 2 */}
            <g
              transform="translate(250, 295)"
              onClick={() => setSelectedId('worker-2')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="65"
                rx="8"
                fill={selectedId === 'worker-2' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                stroke={selectedId === 'worker-2' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                strokeWidth={selectedId === 'worker-2' ? '2' : '1'}
              />
              <circle
                cx="15"
                cy="18"
                r="4"
                fill={getNodeHealth('worker-2') === 'healthy' ? 'var(--color-success)' : 'var(--color-text-dim)'}
              />
              <text x="26" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                worker-2 (JVM)
              </text>
              <text x="15" y="40" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                DRR SKIP LOCKED
              </text>
              <text x="15" y="54" fill="var(--color-text-secondary)" fontSize="9" fontFamily="monospace">
                Lease Fenced (30s)
              </text>
            </g>

            {/* NODE 6: Payment Receiver */}
            <g
              transform="translate(415, 350)"
              onClick={() => setSelectedId('payment-receiver')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="65"
                rx="8"
                fill={selectedId === 'payment-receiver' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                stroke={selectedId === 'payment-receiver' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                strokeWidth={selectedId === 'payment-receiver' ? '2' : '1'}
              />
              <circle cx="15" cy="18" r="4" fill="var(--color-accent)" />
              <text x="26" y="22" fill="var(--color-text-primary)" fontSize="10.5" fontWeight="600">
                payment-receiver
              </text>
              <text x="15" y="40" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                Simulated Gateway
              </text>
              <text x="15" y="54" fill="var(--color-accent)" fontSize="9" fontFamily="monospace">
                Idempotency Engine
              </text>
            </g>

            {/* NODE 7: Receiver DB */}
            <g
              transform="translate(610, 350)"
              onClick={() => setSelectedId('receiver-db')}
              className="cursor-pointer"
            >
              <rect
                width="135"
                height="65"
                rx="8"
                fill={selectedId === 'receiver-db' ? 'var(--color-bg-interactive)' : 'var(--color-bg-elevated)'}
                stroke={selectedId === 'receiver-db' ? 'var(--color-accent)' : 'var(--color-border-standard)'}
                strokeWidth={selectedId === 'receiver-db' ? '2' : '1'}
              />
              <circle cx="15" cy="18" r="4" fill="var(--color-text-dim)" />
              <text x="26" y="22" fill="var(--color-text-primary)" fontSize="11" fontWeight="600">
                receiver-db
              </text>
              <text x="15" y="40" fill="var(--color-text-muted)" fontSize="9" fontFamily="monospace">
                PostgreSQL 16.8
              </text>
              <text x="15" y="54" fill="var(--color-text-dim)" fontSize="9" fontFamily="monospace">
                inbox_deduplication
              </text>
            </g>

            {/* ACID Boundary Annotation */}
            <g transform="translate(660, 420)">
              <text x="0" y="0" fill="var(--color-text-dim)" fontSize="9" fontFamily="monospace">
                backend isolation
              </text>
            </g>
          </svg>
        </div>

        {/* Collapsible Contextual Inspector (4 cols) */}
        {inspectorOpen && (
          <div className="lg:col-span-4 p-5 bg-[var(--color-bg-deep)] flex flex-col justify-between space-y-4 transition-all">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-text-muted)] font-semibold">
                    CONTAINER INSPECTOR
                  </span>
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

              {/* Specifications */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                    ARCHITECTURE ROLE
                  </span>
                  <p className="text-[var(--color-text-primary)] font-medium mt-0.5">
                    {selectedMeta.role}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                    NETWORK BOUNDARY
                  </span>
                  <p className="text-[var(--color-text-secondary)] font-mono text-[11px] mt-0.5">
                    {selectedMeta.network}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                    PORT BINDING & EXPOSURE
                  </span>
                  <p className="text-[var(--color-text-primary)] font-mono text-[11px] mt-0.5">
                    {selectedMeta.ports}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                    CONTAINER IMAGE
                  </span>
                  <p className="text-[var(--color-text-muted)] font-mono text-[10px] break-all mt-0.5">
                    {selectedMeta.image}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block mb-1">
                    DISTRIBUTED INVARIANTS
                  </span>
                  <div className="space-y-1">
                    {selectedMeta.invariants.map((inv, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                        <span>{inv}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block mb-0.5">
                    OBSERVED RUNTIME TELEMETRY
                  </span>
                  <div className="p-2.5 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[11px] font-mono">
                    {isBackendOnline ? (
                      <span className="text-[var(--color-success)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                        Active Telemetry Verified
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                        Offline Preview — Static Configuration Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
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
