import React from 'react';
import {
  Sparkles,
  LogOut,
  Sliders,
  ShieldCheck,
  Radio,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { useScenario, SCENARIO_CATALOG, type ScenarioId } from '../../context/ScenarioContext';

export const ScenarioBanner: React.FC = () => {
  const { isScenarioMode, activeScenarioId, activeScenario, setScenario, exitScenario } = useScenario();

  if (!isScenarioMode || !activeScenario) {
    return null;
  }

  const scenarioIds: ScenarioId[] = [
    'HEALTHY_CLUSTER',
    'WORKER_FAILURE',
    'NOISY_NEIGHBOR',
    'OUTBOX_RETRY',
    'DLQ_POISON_RECOVERY',
  ];

  const getScenarioIcon = (id: ScenarioId) => {
    switch (id) {
      case 'WORKER_FAILURE':
        return Radio;
      case 'NOISY_NEIGHBOR':
        return Sliders;
      case 'OUTBOX_RETRY':
        return Layers;
      case 'DLQ_POISON_RECOVERY':
        return RotateCcw;
      case 'HEALTHY_CLUSTER':
      default:
        return ShieldCheck;
    }
  };

  return (
    <div
      role="region"
      aria-label="Simulation Scenario Control Strip"
      className="mb-6 rounded-xl border border-[var(--color-amber-border)] bg-[var(--color-amber-bg)]/80 backdrop-blur-md p-4 text-[var(--color-text-primary)] shadow-lg animate-in fade-in duration-200"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Scenario Identity & Architectural Lesson */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-amber)]/20 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[var(--color-amber)] uppercase border border-[var(--color-amber)]/40">
              <Sparkles className="w-3 h-3 text-[var(--color-amber)]" />
              SIMULATED SCENARIO
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-deep)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              {activeScenario.badge}
            </span>
            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
              {activeScenario.title}
            </span>
          </div>

          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {activeScenario.description}
          </p>

          {/* Condition Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="font-mono text-[10px] uppercase text-[var(--color-text-muted)]">
              Simulated Invariants:
            </span>
            {activeScenario.simulatedConditions.map((cond, idx) => (
              <span
                key={idx}
                className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
              >
                {cond}
              </span>
            ))}
          </div>
        </div>

        {/* Exit & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <span className="block font-mono text-[10px] text-[var(--color-amber)] font-semibold">
              SANDBOX MODE ACTIVE
            </span>
            <span className="block font-mono text-[10px] text-[var(--color-text-muted)]">
              Zero Network Calls to Backend
            </span>
          </div>

          <button
            onClick={exitScenario}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg font-mono text-xs font-semibold bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)] transition shadow-sm cursor-pointer"
            title="Exit simulation and return to live cluster connection"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Return to Live Mode</span>
          </button>
        </div>
      </div>

      {/* Quick Scenario Switcher Strip */}
      <div className="mt-3.5 pt-3 border-t border-[var(--color-amber-border)]/50 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase text-[var(--color-text-muted)]">
          Switch Scenario:
        </span>
        {scenarioIds.map((id) => {
          const item = SCENARIO_CATALOG[id];
          const isCurrent = activeScenarioId === id;
          const IconComp = getScenarioIcon(id);

          return (
            <button
              key={id}
              onClick={() => setScenario(id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] transition cursor-pointer ${
                isCurrent
                  ? 'bg-[var(--color-action-bg)] text-[var(--color-action-text)] font-semibold shadow-xs'
                  : 'bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]'
              }`}
            >
              <IconComp className="w-3 h-3" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
