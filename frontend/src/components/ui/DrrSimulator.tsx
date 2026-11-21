import React, { useState } from 'react';
import { Play, RotateCcw, Scale } from 'lucide-react';

interface SimTenant {
  id: string;
  name: string;
  weight: number;
  deficit: number;
  queuedJobs: number;
  completedJobs: number;
  color: string;
}

interface StepLog {
  round: number;
  tenantId: string;
  action: string;
  cost: number;
  newDeficit: number;
}

export const DrrSimulator: React.FC = () => {
  const [quantum, setQuantum] = useState<number>(10);
  const [round, setRound] = useState<number>(0);
  const [activeTenantIdx, setActiveTenantIdx] = useState<number>(0);
  const [logs, setLogs] = useState<StepLog[]>([]);

  const [tenants, setTenants] = useState<SimTenant[]>([
    {
      id: 'tenant-heavy-batch',
      name: 'Batch Flood (Heavy)',
      weight: 4,
      deficit: 0,
      queuedJobs: 20,
      completedJobs: 0,
      color: '#F43F5E', // Red/Crimson
    },
    {
      id: 'tenant-interactive-a',
      name: 'Interactive User A (Quiet)',
      weight: 1,
      deficit: 0,
      queuedJobs: 3,
      completedJobs: 0,
      color: '#00F0FF', // Cyan
    },
    {
      id: 'tenant-interactive-b',
      name: 'Interactive User B (Quiet)',
      weight: 1,
      deficit: 0,
      queuedJobs: 2,
      completedJobs: 0,
      color: '#10B981', // Emerald
    },
  ]);

  const handleStepSweep = () => {
    const jobCost = 10; // Standard job cost
    let nextTenants = [...tenants];
    let currentIdx = activeTenantIdx;
    let nextLogs = [...logs];
    let nextRound = round + 1;

    let target = { ...nextTenants[currentIdx] };

    // DRR Step 1: Add quantum credit proportional to weight
    target.deficit += quantum * target.weight;

    let executedInSweep = 0;
    while (target.deficit >= jobCost && target.queuedJobs > 0) {
      target.deficit -= jobCost;
      target.queuedJobs -= 1;
      target.completedJobs += 1;
      executedInSweep += 1;
    }

    nextLogs.unshift({
      round: nextRound,
      tenantId: target.id,
      action: `Credited ${quantum * target.weight} units. Dispatched ${executedInSweep} job(s). Remaining deficit: ${target.deficit}.`,
      cost: executedInSweep * jobCost,
      newDeficit: target.deficit,
    });

    nextTenants[currentIdx] = target;

    // Advance to next active tenant
    const nextIdx = (currentIdx + 1) % nextTenants.length;

    setTenants(nextTenants);
    setActiveTenantIdx(nextIdx);
    setRound(nextRound);
    setLogs(nextLogs.slice(0, 8)); // keep last 8
  };

  const handleReset = () => {
    setRound(0);
    setActiveTenantIdx(0);
    setLogs([]);
    setTenants([
      {
        id: 'tenant-heavy-batch',
        name: 'Batch Flood (Heavy)',
        weight: 4,
        deficit: 0,
        queuedJobs: 20,
        completedJobs: 0,
        color: '#F43F5E',
      },
      {
        id: 'tenant-interactive-a',
        name: 'Interactive User A (Quiet)',
        weight: 1,
        deficit: 0,
        queuedJobs: 3,
        completedJobs: 0,
        color: '#00F0FF',
      },
      {
        id: 'tenant-interactive-b',
        name: 'Interactive User B (Quiet)',
        weight: 1,
        deficit: 0,
        queuedJobs: 2,
        completedJobs: 0,
        color: '#10B981',
      },
    ]);
  };

  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg space-y-5">
      {/* Educational Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)] flex items-center justify-center">
            <Scale className="w-4 h-4 text-[var(--color-cyan)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
              Educational Simulator: Deficit Round-Robin (DRR) Scheduling Mechanics
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Step through scheduling rounds to see why DRR eliminates head-of-line blocking under contention.
            </p>
          </div>
        </div>

        <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold self-start sm:self-auto">
          ⚠️ EDUCATIONAL SIMULATION — NOT LIVE SCHEDULER STATE
        </span>
      </div>

      {/* Simulator Controls & Quantum Configuration */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-4">
          <label className="text-xs font-mono text-[var(--color-text-secondary)] flex items-center gap-2">
            <span>Base Quantum ($Q$):</span>
            <input
              type="number"
              min="5"
              max="50"
              step="5"
              value={quantum}
              onChange={(e) => setQuantum(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs font-mono rounded bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:border-[var(--color-cyan)] outline-none"
            />
          </label>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Job Unit Cost = 10 credits
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleStepSweep}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-cyan-hover)] text-gray-950 hover:brightness-110 shadow-md shadow-[var(--color-cyan-glow)] transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Simulate Sweep (Round {round + 1})
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Tenant Deficit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tenants.map((t, idx) => {
          const isTurn = idx === activeTenantIdx;
          return (
            <div
              key={t.id}
              className={`rounded-lg p-4 border transition-all ${
                isTurn
                  ? 'bg-[var(--color-cyan-bg)] border-[var(--color-cyan)] shadow-md shadow-[var(--color-cyan-glow)]'
                  : 'bg-[var(--color-bg-deep)] border-[var(--color-border-subtle)]'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">
                    Weight: W={t.weight}
                  </span>
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{t.name}</h4>
                </div>
                {isTurn && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-cyan)] text-gray-950 font-bold">
                    ACTIVE TURN
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Current Deficit ($D_i$):</span>
                  <span className="font-bold text-[var(--color-cyan)]">{t.deficit}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Queued Jobs:</span>
                  <span className="text-[var(--color-text-primary)]">{t.queuedJobs}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Completed in Sim:</span>
                  <span className="text-[var(--color-success)]">{t.completedJobs}</span>
                </div>

                {/* Progress Visual */}
                <div className="w-full bg-[var(--color-bg-base)] h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (t.deficit / (quantum * t.weight || 1)) * 100)}%`,
                      backgroundColor: t.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sweep Execution Traces */}
      {logs.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-text-muted)]">
            Recent Sweep Execution Traces
          </h4>
          <div className="rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)] text-xs font-mono">
            {logs.map((lg, i) => (
              <div key={i} className="p-2.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-cyan)] font-bold">R{lg.round}</span>
                  <span className="text-[var(--color-text-primary)]">{lg.tenantId}</span>
                  <span className="text-[var(--color-text-muted)]">→</span>
                  <span className="text-[var(--color-text-secondary)]">{lg.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
