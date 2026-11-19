import React, { useState } from 'react';
import {
  Send,
  ShieldCheck,
  CheckCircle2,
  Radio,
  Clock,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Lock,
  Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useManualOutboxDispatch,
  useOutboxStats,
  useOutboxEvents,
  useOutboxEventDetail,
} from '../hooks/useQueueForgeData';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/common/MetricCard';
import { CopyableId } from '../components/ui/CopyableId';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate } from '../lib/formatters';
import type { OutboxStatus, OutboxQueryFilter, OutboxEventSummary } from '../types/outbox';

const PIPELINE_STAGES = [
  {
    step: 1,
    title: 'Order Created',
    detail: 'Client submits checkout or payment request to business domain API.',
    entity: 'qf_orders',
  },
  {
    step: 2,
    title: 'Outbox Event Persisted',
    detail: 'Event record inserted into outbox_events in the same ACID database transaction.',
    entity: 'outbox_events (PENDING)',
  },
  {
    step: 3,
    title: 'Dispatcher Claims Event',
    detail: 'Dispatcher acquires lease via SELECT FOR UPDATE SKIP LOCKED with claim token.',
    entity: 'claim_token + claim_expires_at',
  },
  {
    step: 4,
    title: 'HTTP Dispatch to Receiver',
    detail: 'Dispatcher relays charge request to simulated payment service with X-Service-Key.',
    entity: 'POST :8085/api/v1/receiver/charges',
  },
  {
    step: 5,
    title: 'Receiver Idempotency Check',
    detail: 'Receiver validates Idempotency-Key. If key was previously processed, replay returns cached charge.',
    entity: 'UNIQUE(idempotency_key)',
  },
  {
    step: 6,
    title: 'Business Effect Recorded',
    detail: 'Downstream payment microservice commits simulated financial charge transaction.',
    entity: 'simulated_charges',
  },
  {
    step: 7,
    title: 'Delivery Acknowledged',
    detail: 'Dispatcher receives HTTP 200/201 OK and updates outbox status to DELIVERED.',
    entity: 'status = DELIVERED',
  },
];

export const EventPipelinePage: React.FC = () => {
  const { isAuthenticated, openUnlockModal } = useAuth();
  const dispatchMutation = useManualOutboxDispatch();

  // Outbox Stats
  const { data: stats, isLoading: statsLoading } = useOutboxStats(isAuthenticated);

  // Manual Dispatch State
  const [batchSize, setBatchSize] = useState<number>(25);
  const [dispatchConfirmOpen, setDispatchConfirmOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    dispatchedCount: number;
    batchSize: number;
    leaseDurationSeconds: number;
  } | null>(null);

  // Event Explorer Query Filters
  const [filters, setFilters] = useState<OutboxQueryFilter>({
    page: 0,
    size: 15,
    status: '',
    eventType: '',
    search: '',
    sortBy: 'createdAt',
    sortDirection: 'DESC',
  });

  // Outbox Events Data
  const { data: eventsData, isLoading: eventsLoading } = useOutboxEvents(filters, isAuthenticated);

  // Selected Event & Inspector Drawer
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { data: eventDetail, isLoading: detailLoading } = useOutboxEventDetail(selectedEventId || undefined);

  const handleManualDispatchConfirm = async () => {
    if (!isAuthenticated) {
      openUnlockModal();
      return;
    }
    setDispatchConfirmOpen(false);
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

  const getStageHighlightIndex = (status?: OutboxStatus) => {
    switch (status) {
      case 'PENDING':
        return 2; // Persisted in outbox, awaiting pickup
      case 'DISPATCHING':
        return 4; // Currently claimed and in HTTP transit
      case 'DELIVERED':
        return 7; // Completed and acknowledged
      case 'DEAD_LETTER':
        return 4; // Failed during dispatch / retries exhausted
      default:
        return 0; // Architecture view
    }
  };

  const activeStage = getStageHighlightIndex(eventDetail?.status);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Transactional Outbox Event Pipeline
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)]">
              AT-LEAST-ONCE
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)]">
              POSTGRESQL SKIP LOCKED
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Durable transactional outbox eliminating dual-write anomalies and relaying business events with receiver idempotency
          </p>
        </div>

        {/* Dispatch Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-1 text-xs">
            <span className="text-[var(--color-text-muted)] font-mono px-2 text-[11px]">Batch:</span>
            {[5, 10, 25, 50].map((size) => (
              <button
                key={size}
                onClick={() => setBatchSize(size)}
                className={`px-2 py-0.5 rounded font-mono text-xs transition ${
                  batchSize === size
                    ? 'bg-[var(--color-cyan)] text-black font-bold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (!isAuthenticated) openUnlockModal();
              else setDispatchConfirmOpen(true);
            }}
            disabled={dispatchMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--color-cyan)] text-black hover:brightness-110 rounded-lg transition shadow-md shadow-[var(--color-cyan)]/20 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {dispatchMutation.isPending ? 'Relaying Batch...' : 'Trigger Dispatch'}
          </button>
        </div>
      </div>

      {/* Real Outbox Counters KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pending Events"
          value={statsLoading ? '...' : (stats?.pendingCount ?? 0)}
          subtitle="Awaiting dispatcher pickup"
          icon={Clock}
          variant="amber"
        />
        <MetricCard
          title="In-Flight Dispatching"
          value={statsLoading ? '...' : (stats?.dispatchingCount ?? 0)}
          subtitle="Currently leased by dispatchers"
          icon={Radio}
          variant="cyan"
        />
        <MetricCard
          title="Acknowledged Delivered"
          value={statsLoading ? '...' : (stats?.deliveredCount ?? 0)}
          subtitle="Verified payment receiver ack"
          icon={ShieldCheck}
          variant="emerald"
        />
        <MetricCard
          title="Dead Letter Events"
          value={statsLoading ? '...' : (stats?.deadLetterCount ?? 0)}
          subtitle="Retry exhaustion / non-transient"
          icon={AlertTriangle}
          variant="rose"
        />
      </div>

      {/* Dispatch Feedback Banner */}
      {dispatchResult && (
        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-cyan-border)] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--color-cyan)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                Outbox Batch Dispatched Successfully
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] font-mono mt-0.5">
                {dispatchResult.dispatchedCount} events delivered • Batch limit: {dispatchResult.batchSize} • Lease fencing: {dispatchResult.leaseDurationSeconds}s
              </div>
            </div>
          </div>
          <button
            onClick={() => setDispatchResult(null)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-mono px-2 py-1 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section 1: Business Flow Visualizer */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                End-to-End Business Flow & Idempotent Delivery Pipeline
              </h3>
              {selectedEventId && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)]">
                  INSPECTING: {selectedEventId.substring(0, 8)}...
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Dual-write anomaly elimination: order state and outbox event are persisted in the same ACID commit, dispatched via SKIP LOCKED, and deduplicated at the receiver
            </p>
          </div>
          {selectedEventId && (
            <button
              onClick={() => setSelectedEventId(null)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-mono"
            >
              Clear Inspector Focus
            </button>
          )}
        </div>

        {/* 7-Step Pipeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {PIPELINE_STAGES.map((s) => {
            const isCompleted = activeStage > 0 && s.step < activeStage;
            const isCurrent = activeStage > 0 && s.step === activeStage;
            const isDeadLetter = eventDetail?.status === 'DEAD_LETTER' && s.step === 4;

            let borderColor = 'border-[var(--color-border-subtle)]';
            let bgBadge = 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]';

            if (isDeadLetter) {
              borderColor = 'border-[var(--color-crimson)]';
              bgBadge = 'bg-[var(--color-crimson-bg)] text-[var(--color-crimson)] font-bold';
            } else if (isCurrent) {
              borderColor = 'border-[var(--color-cyan)] ring-1 ring-[var(--color-cyan)]';
              bgBadge = 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] font-bold';
            } else if (isCompleted) {
              borderColor = 'border-[var(--color-success-border)]';
              bgBadge = 'bg-[var(--color-success-bg)] text-[var(--color-success)]';
            }

            return (
              <div
                key={s.step}
                className={`p-3.5 rounded-xl bg-[var(--color-bg-deep)] border ${borderColor} flex flex-col justify-between transition relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${bgBadge}`}>
                      Step {s.step}
                    </span>
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />}
                    {isCurrent && !isDeadLetter && (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-cyan)] animate-pulse" />
                    )}
                    {isDeadLetter && (
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-crimson)]" />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    {s.title}
                  </h4>
                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    {s.detail}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-muted)] truncate">
                  {s.entity}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Outbox Event Explorer Table */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[var(--color-border-subtle)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Transactional Outbox Event Explorer
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Search, inspect delivery attempts, view error traces, and audit downstream receiver dispatches
              </p>
            </div>
            {eventsData && (
              <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                {eventsData.totalElements} events total
              </span>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search aggregate ID, idempotency key, or UUID..."
                value={filters.search || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 0 }))}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-primary)] font-mono placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-cyan)]"
              />
            </div>

            {/* Event Type Filter */}
            <input
              type="text"
              placeholder="Filter Event Type (e.g. ORDER_CREATED)"
              value={filters.eventType || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, eventType: e.target.value, page: 0 }))}
              className="w-56 px-3 py-1.5 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-primary)] font-mono placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-cyan)]"
            />

            {/* Status Pills */}
            <div className="flex items-center gap-1 font-mono text-xs">
              {(['', 'PENDING', 'DISPATCHING', 'DELIVERED', 'DEAD_LETTER'] as (OutboxStatus | '')[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilters((prev) => ({ ...prev, status: st, page: 0 }))}
                  className={`px-2.5 py-1 rounded text-[11px] border transition ${
                    filters.status === st
                      ? 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border-[var(--color-cyan-border)] font-bold'
                      : 'bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {st || 'ALL'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] uppercase text-[10px] tracking-wider border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-5 py-3">Event ID</th>
                <th className="px-5 py-3">Aggregate</th>
                <th className="px-5 py-3">Event Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Attempts</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Delivered / Next Retry</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {eventsLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--color-text-muted)] font-mono">
                    Loading outbox events...
                  </td>
                </tr>
              ) : !isAuthenticated ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center space-y-3 font-sans">
                    <Lock className="w-6 h-6 text-[var(--color-cyan)] mx-auto opacity-75" />
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      Outbox event telemetry requires authenticated administrator mode.
                    </div>
                    <button
                      onClick={() => openUnlockModal()}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--color-cyan)] text-black rounded-lg hover:brightness-110 transition"
                    >
                      Unlock Admin Mode
                    </button>
                  </td>
                </tr>
              ) : eventsData && eventsData.content.length > 0 ? (
                eventsData.content.map((evt: OutboxEventSummary) => {
                  const isSelected = selectedEventId === evt.id;
                  return (
                    <tr
                      key={evt.id}
                      className={`hover:bg-[var(--color-bg-interactive)] transition ${
                        isSelected ? 'bg-[var(--color-bg-interactive)] border-l-2 border-[var(--color-cyan)]' : ''
                      }`}
                    >
                      <td className="px-5 py-3 font-semibold text-[var(--color-text-primary)]">
                        <CopyableId id={evt.id} prefixLen={8} />
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-primary)]">
                        <span className="text-[var(--color-text-muted)] text-[10px]">{evt.aggregateType}: </span>
                        <span className="font-semibold">{evt.aggregateId}</span>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                        {evt.eventType}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={evt.status} />
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                        <span className={evt.attemptCount > 0 ? 'text-[var(--color-amber)] font-bold' : ''}>
                          {evt.attemptCount}
                        </span>
                        <span className="text-[var(--color-text-muted)]"> / {evt.maxRetries}</span>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                        {formatDate(evt.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">
                        {evt.deliveredAt
                          ? formatDate(evt.deliveredAt)
                          : evt.nextRetryAt
                          ? formatDate(evt.nextRetryAt)
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setSelectedEventId(evt.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[var(--color-cyan)] bg-[var(--color-cyan-bg)] hover:brightness-110 border border-[var(--color-cyan-border)] rounded transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--color-text-muted)] font-sans">
                    No outbox events match the current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {eventsData && eventsData.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs font-mono text-[var(--color-text-secondary)]">
            <div>
              Page {eventsData.page + 1} of {eventsData.totalPages} ({eventsData.totalElements} items)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(0, (prev.page ?? 0) - 1) }))}
                disabled={eventsData.first}
                className="p-1 rounded hover:bg-[var(--color-bg-deep)] disabled:opacity-30 disabled:hover:bg-transparent transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 0) + 1 }))}
                disabled={eventsData.last}
                className="p-1 rounded hover:bg-[var(--color-bg-deep)] disabled:opacity-30 disabled:hover:bg-transparent transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Durable Idempotency & Resilience Educational Architecture */}
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-lg">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">
          Durable Idempotency Architecture & Network Resilience
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-6">
          How QueueForge achieves exactly-once business outcome guarantees despite at-least-once distributed network transport
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-[var(--color-text-secondary)]">
          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
            <div className="font-bold text-[var(--color-cyan)] flex items-center gap-2">
              <Layers className="w-4 h-4" /> 1. At-Least-Once Delivery
            </div>
            <p className="text-[11px] leading-relaxed">
              If an HTTP response drops due to network partition or worker crash after the charge was accepted, the dispatcher lease expires and the event is retried. Network delivery is inherently at-least-once.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
            <div className="font-bold text-[var(--color-amethyst)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> 2. Receiver Deduplication
            </div>
            <p className="text-[11px] leading-relaxed">
              The payment receiver maintains a unique database constraint on <code className="text-[var(--color-text-primary)]">Idempotency-Key</code>. When a duplicate key is presented, the existing charge is returned without re-executing payment processing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
            <div className="font-bold text-[var(--color-success)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> 3. Business Effect Uniqueness
            </div>
            <p className="text-[11px] leading-relaxed">
              Even under aggressive dispatch retries or duplicate relaying, exactly one financial transaction is ever committed. The client receives confirmed delivery without risk of duplicate charges.
            </p>
          </div>
        </div>
      </div>

      {/* Event Detail Inspector Drawer */}
      <DetailDrawer
        isOpen={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        title="Outbox Event Detail"
        subtitle={selectedEventId ? `Event ID: ${selectedEventId}` : ''}
      >
        {detailLoading || !eventDetail ? (
          <div className="py-12 text-center text-xs font-mono text-[var(--color-text-muted)]">
            Loading outbox event metadata...
          </div>
        ) : (
          <div className="space-y-6 text-xs font-mono">
            {/* Header Status Strip */}
            <div className="p-4 rounded-xl bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block uppercase">
                  Current Status
                </span>
                <StatusBadge status={eventDetail.status} />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[var(--color-text-muted)] block uppercase">
                  Attempts
                </span>
                <span className="text-sm font-bold text-[var(--color-text-primary)]">
                  {eventDetail.attemptCount} / {eventDetail.maxRetries}
                </span>
              </div>
            </div>

            {/* Core Metadata */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                Event Identifiers
              </h4>
              <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Aggregate:</span>
                  <span className="text-[var(--color-text-primary)] font-bold">
                    {eventDetail.aggregateType}: {eventDetail.aggregateId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Event Type:</span>
                  <span className="text-[var(--color-cyan)] font-bold">{eventDetail.eventType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Idempotency Key:</span>
                  <span className="text-[var(--color-text-primary)]">{eventDetail.idempotencyKey}</span>
                </div>
                {eventDetail.claimedBy && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Claimed By:</span>
                    <span className="text-[var(--color-amethyst)]">{eventDetail.claimedBy}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Created At:</span>
                  <span className="text-[var(--color-text-secondary)]">{formatDate(eventDetail.createdAt)}</span>
                </div>
                {eventDetail.deliveredAt && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Delivered At:</span>
                    <span className="text-[var(--color-success)] font-bold">{formatDate(eventDetail.deliveredAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message if present */}
            {eventDetail.lastError && (
              <div className="p-3.5 rounded-lg bg-[var(--color-crimson-bg)] border border-[var(--color-crimson-border)] text-xs text-[var(--color-crimson)] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Last Dispatch Error
                </div>
                <p className="text-[11px] leading-relaxed break-words font-mono">
                  {eventDetail.lastError}
                </p>
              </div>
            )}

            {/* Event Payload Viewer */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                Event Payload (JSONB)
              </h4>
              <pre className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-primary)] overflow-x-auto max-h-56">
                {JSON.stringify(eventDetail.payload, null, 2)}
              </pre>
            </div>

            {/* Deep-link Action to Related Job in Job Explorer */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <Link
                to={`/jobs?search=${encodeURIComponent(eventDetail.aggregateId)}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-cyan)] hover:underline"
              >
                Inspect Related Jobs in Explorer <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedEventId(null)}
                className="px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Manual Dispatch Confirmation Modal */}
      {dispatchConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
              Trigger Immediate Outbox Dispatch
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              This triggers the outbox dispatcher to claim up to <strong className="text-[var(--color-text-primary)]">{batchSize} pending events</strong> using PostgreSQL SKIP LOCKED and relay them to the payment receiver.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border-subtle)] text-xs">
              <button
                onClick={() => setDispatchConfirmOpen(false)}
                className="px-3 py-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={handleManualDispatchConfirm}
                className="px-4 py-1.5 font-semibold text-white bg-[var(--color-cyan)] text-black rounded-lg hover:brightness-110 transition shadow-md shadow-[var(--color-cyan)]/20"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
