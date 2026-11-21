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
      color: '#E7AB5A', // Warm Amber
    },
    {
      id: 'tenant-interactive-a',
      name: 'Interactive User A (Quiet)',
      weight: 1,
      deficit: 0,
      queuedJobs: 3,
      completedJobs: 0,
      color: '#A78BFA', // Restrained Violet
    },
    {
      id: 'tenant-interactive-b',
      name: 'Interactive User B (Quiet)',
      weight: 1,
      deficit: 0,
      queuedJobs: 2,
      completedJobs: 0,
      color: '#55B88A', // Forest Emerald
    },
  ]);

  const handleStepSweep = () => {
    const jobCost = 10; // Standard job cost
    const nextTenants = [...tenants];
    const nextLogs = [...logs];
    const currentIdx = activeTenantIdx;
    const target = { ...nextTenants[currentIdx] };
    const nextRound = round + 1;

    // DRR Step 1: Accumulate Deficit = Deficit + Quantum * Weight
    const addedQuantum = quantum * target.weight;
    target.deficit += addedQuantum;

    // DRR Step 2: Service queued jobs as long as deficit >= jobCost
    let executedInSweep = 0;
    while (target.deficit >= jobCost && target.queuedJobs > 0) {
      target.deficit -= jobCost;
      target.queuedJobs -= 1;
      target.completedJobs += 1;
      executedInSweep += 1;
    }

    // Anti-hoarding: If queue is empty, reset deficit to 0
    if (target.queuedJobs === 0) {
      target.deficit = 0;
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
        color: '#E7AB5A',
      },
      {
        id: 'tenant-interactive-a',
        name: 'Interactive User A (Quiet)',
        weight: 1,
        deficit: 0,
        queuedJobs: 3,
        completedJobs: 0,
        color: '#A78BFA',
      },
      {
        id: 'tenant-interactive-b',
        name: 'Interactive User B (Quiet)',
        weight: 1,
        deficit: 0,
        queuedJobs: 2,
        completedJobs: 0,
        color: '#55B88A',
      },
    ]);
  };

  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-sm space-y-5">
      {/* Educational Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-bg)] border border-[var(--color-accent-border)] flex items-center justify-center">
            <Scale className="w-4 h-4 text-[var(--color-accent)]" />
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

        <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)] font-semibold self-start sm:self-auto">
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
              className="w-16 px-2 py-1 text-xs font-mono rounded bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] outline-none"
            />
          </label>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Job Unit Cost = 10 credits
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleStepSweep}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)] shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Simulate Sweep (Round {round + 1})
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition cursor-pointer"
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
                  ? 'bg-[var(--color-bg-interactive)] border-[var(--color-accent)] shadow-sm'
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
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-accent)] text-[var(--color-action-text)] font-semibold">
                    ACTIVE TURN
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Deficit Counter ($D_i$):</span>
                  <strong className="text-[var(--color-text-primary)]">{t.deficit} credits</strong>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Queued Workload:</span>
                  <span className="text-[var(--color-text-secondary)]">{t.queuedJobs} jobs remaining</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[var(--color-text-muted)]">Completed Dispatches:</span>
                  <span className="text-[var(--color-success)] font-semibold">{t.completedJobs} jobs</span>
                </div>

                <div className="w-full bg-[var(--color-bg-base)] h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (t.deficit / 50) * 100)}%`,
                      backgroundColor: t.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sweep Execution Trace Log */}
      <div>
        <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-[var(--color-text-muted)] mb-2">
          Sweep Step Execution Log
        </h4>
        <div className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-[var(--color-text-muted)] text-[11px] py-3 text-center">
              Click &quot;Simulate Sweep&quot; to step through deficit rounds.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-[var(--color-border-subtle)]/50 last:border-0">
                <span className="text-[var(--color-accent)] font-semibold">Round {log.round}</span>
                <span className="text-[var(--color-text-secondary)]">{log.tenantId}</span>
                <span className="text-[var(--color-text-muted)] truncate max-w-md">{log.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
