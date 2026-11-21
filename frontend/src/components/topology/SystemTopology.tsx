import React, { useState } from 'react';
import {
  Radio,
  CheckCircle2,
  Lock,
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
    description: 'Serves React 19 production static assets and reverse proxies /api/ requests to the API server with strict security headers.',
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
    description: 'Stateless API ingest node validating jobs, enforcing tenant rate limits, redacting sensitive payloads for demo view, and hosting administrative endpoints.',
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
    description: 'Houses indexed durable task queue (qf_jobs), multi-tenant quotas (qf_tenants), transactional outbox log (qf_outbox_events), and worker heartbeats.',
    invariants: ['Contention-free SELECT FOR UPDATE SKIP LOCKED', 'Atomic dual-write order + outbox transaction', 'Zero host port binding'],
  },
  'worker-1': {
    id: 'worker-1',
    label: 'worker-1',
    sublabel: 'Spring Boot 3 (Java 21)',
    role: 'Distributed Task Processor Node 1',
    network: 'qf-prod-backend-net',
    ports: 'Internal Bridge Only',
    image: 'ghcr.io/saipranav22-commits/queueforge/backend:latest (APP_MODE=WORKER_ONLY)',
    description: 'Independent execution instance claiming jobs via Deficit Round Robin and SKIP LOCKED, renewing 30-second leases and heartbeating every 5s.',
    invariants: ['Monotonic claim fencing tokens', 'Crash recovery via lease reaper', 'Thread pool graceful draining'],
  },
  'worker-2': {
    id: 'worker-2',
    label: 'worker-2',
    sublabel: 'Spring Boot 3 (Java 21)',
    role: 'Distributed Task Processor Node 2',
    network: 'qf-prod-backend-net',
    ports: 'Internal Bridge Only',
    image: 'ghcr.io/saipranav22-commits/queueforge/backend:latest (APP_MODE=WORKER_ONLY)',
    description: 'Independent execution instance running in parallel with worker-1 to demonstrate multi-instance concurrent claiming without split-brain conflicts.',
    invariants: ['Concurrent SKIP LOCKED batch claiming', 'Automatic heartbeat registration', 'Outbox asynchronous event polling'],
  },
  'payment-receiver': {
    id: 'payment-receiver',
    label: 'payment-receiver',
    sublabel: 'Spring Boot 3 (Java 21)',
    role: 'Simulated Payment Gateway',
    network: 'qf-prod-backend-net',
    ports: 'Internal Port 8081 (Internal Bridge Only)',
    image: 'ghcr.io/saipranav22-commits/queueforge/payment-receiver:latest',
    description: 'Standalone simulated microservice receiving outbox event dispatches with durable inbox deduplication and SHA-256 idempotency verification.',
    invariants: ['Exactly-once consumer semantics', 'Durable idempotency table check', 'X-Service-Key authorization'],
  },
  'receiver-db': {
    id: 'receiver-db',
    label: 'receiver-db',
    sublabel: 'PostgreSQL 16.8',
    role: 'Durable Inbox Deduplication Store',
    network: 'qf-prod-backend-net (Isolated)',
    ports: 'Port 5432 (Internal Bridge Only)',
    image: 'postgres:16.8-alpine',
    description: 'Independent datastore maintaining the receiver inbox_deduplication table ensuring duplicate HTTP attempts never re-execute business mutations.',
    invariants: ['Unique constraint on SHA-256 key', 'Zero cross-database coupling', 'Zero external host exposure'],
  },
};

export const SystemTopology: React.FC = () => {
  const [selectedId, setSelectedId] = useState<TopologyNodeId>('api-server');
  const { data: health } = useSystemHealth();
  const { data: workers } = useWorkerFleet();

  const selectedMeta = NODES_DATA[selectedId];

  // Derive real node health
  const getNodeHealth = (id: TopologyNodeId) => {
    if (id === 'sender-db') {
      return health?.dbStatus === 'UP' ? 'healthy' : 'degraded';
    }
    if (id === 'api-server') {
      return health?.status === 'UP' ? 'healthy' : 'degraded';
    }
    if (id === 'worker-1' || id === 'worker-2') {
      const match = workers?.find(
        (w) => w.instanceId === id || w.instanceId.toLowerCase().includes(id.replace('-', ''))
      );
      if (!match) {
        return health?.workerStatus === 'RUNNING' ? 'healthy' : 'unobserved';
      }
      const age = match.lastHeartbeat
        ? (Date.now() - new Date(match.lastHeartbeat).getTime()) / 1000
        : 999;
      return age < 15 ? 'healthy' : 'degraded';
    }
    if (id === 'frontend') {
      return 'healthy'; // Currently rendering
    }
    // payment-receiver & receiver-db are isolated background internal microservices
    return 'unobserved';
  };

  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-xl overflow-hidden transition-all">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-bg-deep)]/50">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--color-cyan)] animate-pulse" />
            <h3 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
              Interactive 7-Service Distributed Topology
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)] font-semibold">
              ACID CLUSTER
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Click any container node to inspect network boundaries, runtime telemetry, and architectural invariants.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
            Healthy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-cyan)]" />
            Selected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Internal / Unobserved
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* SVG Topology Diagram Canvas (8 cols) */}
        <div className="lg:col-span-8 p-4 sm:p-6 bg-[#070A12] flex items-center justify-center relative overflow-hidden select-none border-b lg:border-b-0 lg:border-r border-[var(--color-border-subtle)]">
          <svg viewBox="0 0 780 460" className="w-full h-auto max-h-[440px] drop-shadow-2xl">
            <defs>
              <linearGradient id="grad-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#7E22CE" stopOpacity="0.8" />
              </linearGradient>
              <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Network Subgraph Boundaries */}
            <rect
              x="20"
              y="20"
              width="740"
              height="420"
              rx="12"
              fill="rgba(15, 23, 42, 0.4)"
              stroke="#1E293B"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text x="35" y="42" fill="#64748B" fontSize="10" fontFamily="monospace" fontWeight="600">
              VIRTUAL NETWORK: qf-prod-backend-net (Zero External Port Exposure)
            </text>

            {/* Connection Paths */}
            {/* Frontend -> API Server */}
            <path
              d="M 160 110 L 260 110"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeDasharray={selectedId === 'frontend' || selectedId === 'api-server' ? 'none' : '4,3'}
              className="transition-all"
            />
            {/* API Server -> Sender DB */}
            <path
              d="M 400 110 L 520 110"
              stroke="#10B981"
              strokeWidth="2"
              className="transition-all"
            />
            {/* Worker 1 -> Sender DB */}
            <path
              d="M 390 230 C 450 230, 470 140, 520 130"
              stroke="#00F0FF"
              strokeWidth="1.8"
              strokeDasharray="5,4"
              fill="none"
            />
            {/* Worker 2 -> Sender DB */}
            <path
              d="M 390 310 C 460 310, 480 160, 520 150"
              stroke="#00F0FF"
              strokeWidth="1.8"
              strokeDasharray="5,4"
              fill="none"
            />
            {/* Outbox Flow: Workers -> Payment Receiver */}
            <path
              d="M 330 335 L 330 380 L 410 380"
              stroke="#A855F7"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              fill="none"
            />
            {/* Payment Receiver -> Receiver DB */}
            <path
              d="M 540 380 L 600 380"
              stroke="#10B981"
              strokeWidth="2"
              fill="none"
            />

            {/* NODE 1: Frontend */}
            <g
              transform="translate(40, 75)"
              onClick={() => setSelectedId('frontend')}
              className="cursor-pointer"
            >
              <rect
                width="120"
                height="70"
                rx="8"
                fill={selectedId === 'frontend' ? '#172554' : '#0F172A'}
                stroke={selectedId === 'frontend' ? '#00F0FF' : '#334155'}
                strokeWidth={selectedId === 'frontend' ? '2.5' : '1.5'}
                filter={selectedId === 'frontend' ? 'url(#glow-cyan)' : 'none'}
              />
              <circle cx="15" cy="20" r="4" fill="#10B981" />
              <text x="26" y="23" fill="#F8FAFC" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                frontend
              </text>
              <text x="15" y="42" fill="#94A3B8" fontSize="9" fontFamily="monospace">
                Nginx 1.27
              </text>
              <text x="15" y="58" fill="#38BDF8" fontSize="9" fontFamily="monospace">
                :8088 Loopback
              </text>
            </g>

            {/* NODE 2: API Server */}
            <g
              transform="translate(260, 75)"
              onClick={() => setSelectedId('api-server')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="70"
                rx="8"
                fill={selectedId === 'api-server' ? '#172554' : '#0F172A'}
                stroke={selectedId === 'api-server' ? '#00F0FF' : '#334155'}
                strokeWidth={selectedId === 'api-server' ? '2.5' : '1.5'}
                filter={selectedId === 'api-server' ? 'url(#glow-cyan)' : 'none'}
              />
              <circle cx="15" cy="20" r="4" fill="#10B981" />
              <text x="26" y="23" fill="#F8FAFC" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                api-server
              </text>
              <text x="15" y="42" fill="#94A3B8" fontSize="9" fontFamily="monospace">
                Spring Boot 3 (API)
              </text>
              <text x="15" y="58" fill="#00F0FF" fontSize="9" fontFamily="monospace">
                Ingest Gateway
              </text>
            </g>

            {/* NODE 3: Sender DB (Primary PostgreSQL) */}
            <g
              transform="translate(520, 60)"
              onClick={() => setSelectedId('sender-db')}
              className="cursor-pointer"
            >
              <rect
                width="190"
                height="110"
                rx="10"
                fill={selectedId === 'sender-db' ? '#064E3B' : '#06281E'}
                stroke={selectedId === 'sender-db' ? '#00F0FF' : '#10B981'}
                strokeWidth={selectedId === 'sender-db' ? '2.5' : '1.5'}
                filter={selectedId === 'sender-db' ? 'url(#glow-cyan)' : 'none'}
              />
              <circle cx="20" cy="22" r="5" fill="#10B981" />
              <text x="32" y="26" fill="#F8FAFC" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                sender-db (PostgreSQL 16)
              </text>
              <text x="20" y="48" fill="#6EE7B7" fontSize="10" fontFamily="monospace">
                • qf_jobs (Queue)
              </text>
              <text x="20" y="66" fill="#6EE7B7" fontSize="10" fontFamily="monospace">
                • qf_tenants (DRR Quotas)
              </text>
              <text x="20" y="84" fill="#6EE7B7" fontSize="10" fontFamily="monospace">
                • qf_outbox_events (ACID)
              </text>
              <text x="20" y="100" fill="#F59E0B" fontSize="9" fontFamily="monospace" fontWeight="600">
                ZERO HOST PORT EXPOSURE
              </text>
            </g>

            {/* NODE 4: Worker 1 */}
            <g
              transform="translate(250, 195)"
              onClick={() => setSelectedId('worker-1')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="65"
                rx="8"
                fill={selectedId === 'worker-1' ? '#172554' : '#0F172A'}
                stroke={selectedId === 'worker-1' ? '#00F0FF' : '#334155'}
                strokeWidth={selectedId === 'worker-1' ? '2.5' : '1.5'}
                filter={selectedId === 'worker-1' ? 'url(#glow-cyan)' : 'none'}
              />
              <circle cx="15" cy="20" r="4" fill="#10B981" />
              <text x="26" y="23" fill="#F8FAFC" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                worker-1 (JVM)
              </text>
              <text x="15" y="42" fill="#94A3B8" fontSize="9" fontFamily="monospace">
                DRR SKIP LOCKED
              </text>
              <text x="15" y="56" fill="#10B981" fontSize="9" fontFamily="monospace">
                Lease Fenced (30s)
              </text>
            </g>

            {/* NODE 5: Worker 2 */}
            <g
              transform="translate(250, 275)"
              onClick={() => setSelectedId('worker-2')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="65"
                rx="8"
                fill={selectedId === 'worker-2' ? '#172554' : '#0F172A'}
                stroke={selectedId === 'worker-2' ? '#00F0FF' : '#334155'}
                strokeWidth={selectedId === 'worker-2' ? '2.5' : '1.5'}
                filter={selectedId === 'worker-2' ? 'url(#glow-cyan)' : 'none'}
              />
              <circle cx="15" cy="20" r="4" fill="#10B981" />
              <text x="26" y="23" fill="#F8FAFC" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                worker-2 (JVM)
              </text>
              <text x="15" y="42" fill="#94A3B8" fontSize="9" fontFamily="monospace">
                DRR SKIP LOCKED
              </text>
              <text x="15" y="56" fill="#10B981" fontSize="9" fontFamily="monospace">
                Lease Fenced (30s)
              </text>
            </g>

            {/* NODE 6: Payment Receiver */}
            <g
              transform="translate(410, 350)"
              onClick={() => setSelectedId('payment-receiver')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="65"
                rx="8"
                fill={selectedId === 'payment-receiver' ? '#3B0764' : '#1E1035'}
                stroke={selectedId === 'payment-receiver' ? '#00F0FF' : '#A855F7'}
                strokeWidth={selectedId === 'payment-receiver' ? '2.5' : '1.5'}
                filter={selectedId === 'payment-receiver' ? 'url(#glow-cyan)' : 'none'}
              />
              <circle cx="15" cy="18" r="4" fill="#A855F7" />
              <text x="26" y="22" fill="#F8FAFC" fontSize="10.5" fontWeight="700" fontFamily="sans-serif">
                payment-receiver
              </text>
              <text x="15" y="40" fill="#D8B4FE" fontSize="9" fontFamily="monospace">
                Simulated Gateway
              </text>
              <text x="15" y="54" fill="#A855F7" fontSize="9" fontFamily="monospace">
                Idempotency Engine
              </text>
            </g>

            {/* NODE 7: Receiver DB */}
            <g
              transform="translate(600, 350)"
              onClick={() => setSelectedId('receiver-db')}
              className="cursor-pointer"
            >
              <rect
                width="140"
                height="65"
                rx="8"
                fill={selectedId === 'receiver-db' ? '#064E3B' : '#06281E'}
                stroke={selectedId === 'receiver-db' ? '#00F0FF' : '#10B981'}
                strokeWidth={selectedId === 'receiver-db' ? '2.5' : '1.5'}
                filter={selectedId === 'receiver-db' ? 'url(#glow-cyan)' : 'none'}
              />
              <circle cx="15" cy="18" r="4" fill="#10B981" />
              <text x="26" y="22" fill="#F8FAFC" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                receiver-db
              </text>
              <text x="15" y="40" fill="#6EE7B7" fontSize="9" fontFamily="monospace">
                PostgreSQL 16.8
              </text>
              <text x="15" y="54" fill="#6EE7B7" fontSize="9" fontFamily="monospace">
                inbox_deduplication
              </text>
            </g>
          </svg>
        </div>

        {/* Node Inspector Contextual Drawer (4 cols) */}
        <div className="lg:col-span-4 p-5 bg-[var(--color-bg-deep)]/90 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-cyan)] font-semibold">
                  CONTAINER INSPECTOR
                </span>
                <h4 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2 mt-0.5">
                  {selectedMeta.label}
                  <span
                    className={`w-2 h-2 rounded-full ${
                      getNodeHealth(selectedId) === 'healthy'
                        ? 'bg-[var(--color-success)] shadow-sm shadow-[var(--color-success)]'
                        : getNodeHealth(selectedId) === 'degraded'
                        ? 'bg-[var(--color-warning)]'
                        : 'bg-slate-500'
                    }`}
                  />
                </h4>
              </div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-interactive)] px-2 py-0.5 rounded border border-[var(--color-border-subtle)]">
                {selectedMeta.sublabel}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
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
                  NETWORK TOPOLOGY
                </span>
                <p className="text-[var(--color-text-secondary)] font-mono text-[11px] mt-0.5">
                  {selectedMeta.network}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                  PORT BINDING & EXPOSURE
                </span>
                <p className="text-[var(--color-cyan)] font-mono text-[11px] mt-0.5">
                  {selectedMeta.ports}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block">
                  CONTAINER SPECIFICATION
                </span>
                <p className="text-[var(--color-text-secondary)] text-[11.5px] leading-relaxed mt-0.5">
                  {selectedMeta.description}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] block mb-1">
                  DISTRIBUTED INVARIANTS
                </span>
                <ul className="space-y-1">
                  {selectedMeta.invariants.map((inv, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                      <span>{inv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-muted)] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-[var(--color-cyan)]" />
              ACID Boundary
            </span>
            <span className="text-[10px] text-[var(--color-text-dim)] truncate max-w-[160px]">
              {selectedMeta.image.split(':')[0].split('/').pop()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
