import React, { useState } from 'react';
import {
  GitBranch,
  Send,
  ShieldCheck,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { useManualOutboxDispatch } from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/common/MetricCard';

export const EventPipelinePage: React.FC = () => {
  const { isAuthenticated, openUnlockModal } = useAuth();
  const dispatchMutation = useManualOutboxDispatch();

  const [batchSize, setBatchSize] = useState<number>(25);
  const [dispatchResult, setDispatchResult] = useState<{
    dispatchedCount: number;
    batchSize: number;
    leaseDurationSeconds: number;
  } | null>(null);

  const handleManualDispatch = async () => {
    if (!isAuthenticated) {
      openUnlockModal();
      return;
    }
    try {
      const res = await dispatchMutation.mutateAsync({ batchSize });
      setDispatchResult({
        dispatchedCount: res.dispatchedCount,
        batchSize: res.batchSize,
        leaseDurationSeconds: res.leaseDurationSeconds,
      });
    } catch (err: any) {
      alert(`Outbox dispatch failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Transactional Outbox Event Pipeline
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)]">
              AT-LEAST-ONCE
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Durable PostgreSQL outbox pattern guaranteeing atomic job state transitions and downstream payment event delivery
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-1 text-xs">
            <span className="text-[var(--color-text-muted)] font-mono px-2">Batch:</span>
            {[10, 25, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => setBatchSize(size)}
                className={`px-2 py-1 rounded font-mono text-xs transition ${
                  batchSize === size
                    ? 'bg-[var(--color-cyan)] text-black font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <button
            onClick={handleManualDispatch}
            disabled={dispatchMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--color-cyan)] text-black hover:brightness-110 rounded-lg transition shadow-md shadow-[var(--color-cyan)]/20 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {dispatchMutation.isPending ? 'Relaying Batch...' : 'Trigger Dispatch'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Relayer Daemon"
          value="ACTIVE"
          subtitle="Autonomous background polling relay"
          icon={Radio}
          variant="emerald"
        />
        <MetricCard
          title="Payment Receiver Target"
          value="Port 8085"
          subtitle="Simulated payment microservice"
          icon={GitBranch}
          variant="cyan"
        />
        <MetricCard
          title="Delivery Guarantee"
          value="DURABLE"
          subtitle="Idempotency-Key + X-Service-Key"
          icon={ShieldCheck}
          variant="amethyst"
        />
      </div>

      {/* Dispatch Feedback Banner */}
      {dispatchResult && (
        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-cyan-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--color-cyan)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                Outbox Batch Dispatched Successfully
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] font-mono">
                {dispatchResult.dispatchedCount} dispatched • batch size: {dispatchResult.batchSize} • lease: {dispatchResult.leaseDurationSeconds}s
              </div>
            </div>
          </div>
          <button
            onClick={() => setDispatchResult(null)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Architecture & Flow Visualizer */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          Guaranteed Delivery Pipeline Architecture
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-6">
          How QueueForge eliminates dual-write anomalies using the transactional outbox pattern
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--color-amethyst)] font-bold mb-1">
                Step 1: Atomic Commit
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                Transactional Write
              </h4>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Job completion and event publication occur in the exact same PostgreSQL database transaction.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] font-mono text-[10px] text-[var(--color-text-muted)]">
              TABLE: outbox_events
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--color-cyan)] font-bold mb-1">
                Step 2: Lease Claim
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                SKIP LOCKED Polling
              </h4>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                The outbox relayer claims pending event batches with exclusive distributed leases, preventing contention.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] font-mono text-[10px] text-[var(--color-text-muted)]">
              LEASE: 30s timeout
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--color-warning)] font-bold mb-1">
                Step 3: Secure Relay
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                HTTP Payment Dispatch
              </h4>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Events are dispatched via HTTP POST with mandatory `X-Service-Key` authentication and idempotency headers.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] font-mono text-[10px] text-[var(--color-text-muted)]">
              ENDPOINT: /payments/charges
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--color-success)] font-bold mb-1">
                Step 4: Idempotency
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                Durable Deduplication
              </h4>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Payment receiver checks `payment_idempotency_keys` table. Duplicates receive cached 200 OK without double charges.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] font-mono text-[10px] text-[var(--color-text-muted)]">
              STATUS: COMMITTED
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
