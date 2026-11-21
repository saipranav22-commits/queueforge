import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  ChevronDown,
  ShieldCheck,
  Radio,
  Sliders,
  Layers,
  RotateCcw,
  Activity,
  Check,
} from 'lucide-react';
import { useScenario, SCENARIO_CATALOG, type ScenarioId } from '../../context/ScenarioContext';

export const ScenarioSelectorMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isScenarioMode, activeScenarioId, setScenario, exitScenario } = useScenario();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const scenarios: { id: ScenarioId; label: string; icon: React.FC<any>; tag: string }[] = [
    { id: 'HEALTHY_CLUSTER', label: 'Nominal Multi-Node Cluster', icon: ShieldCheck, tag: 'OPTIMAL' },
    { id: 'WORKER_FAILURE', label: 'Worker Heartbeat Loss & Recovery', icon: Radio, tag: 'FAULT' },
    { id: 'NOISY_NEIGHBOR', label: 'Noisy-Neighbor DRR Contention', icon: Sliders, tag: 'FAIRNESS' },
    { id: 'OUTBOX_RETRY', label: 'Transactional Outbox 503 & Ack', icon: Layers, tag: 'RELIABILITY' },
    { id: 'DLQ_POISON_RECOVERY', label: 'Poison Payload Quarantine & Replay', icon: RotateCcw, tag: 'RECOVERY' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        data-testid="scenario-selector-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 h-10 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer select-none ${
          isScenarioMode
            ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)] border-[var(--color-amber-border)] shadow-xs'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] border-[var(--color-border-subtle)]'
        }`}
        title="Open Scenario Explorer to demonstrate QueueForge architectures without live backend"
        aria-label="Open Scenario Explorer"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Sparkles className={`w-3.5 h-3.5 ${isScenarioMode ? 'text-[var(--color-amber)]' : 'text-[var(--color-accent)]'}`} />
        <span className="font-mono hidden sm:inline">
          {isScenarioMode ? 'Scenario Mode' : 'Scenarios'}
        </span>
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-2 shadow-2xl z-50 animate-in fade-in duration-150">
          <div className="px-3 py-2 border-b border-[var(--color-border-subtle)] mb-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)] font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Scenario Explorer
              </span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">
                Deterministic
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Demonstrate platform execution patterns when local backend is stopped.
            </p>
          </div>

          <div className="space-y-1">
            {scenarios.map(({ id, label, icon: IconComp, tag }) => {
              const isSelected = activeScenarioId === id;
              return (
                <button
                  key={id}
                  data-testid={`scenario-option-${id}`}
                  onClick={() => {
                    setScenario(id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition flex items-start gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--color-bg-interactive)] border-l-2 border-[var(--color-accent)] text-[var(--color-text-primary)] font-semibold'
                      : 'hover:bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <IconComp className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{label}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
                        {tag}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 mt-1 border-t border-[var(--color-border-subtle)]">
            <button
              onClick={() => {
                exitScenario();
                setIsOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-2 cursor-pointer ${
                !isScenarioMode
                  ? 'bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] font-semibold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Cluster Mode (Direct API)</span>
              {!isScenarioMode && <Check className="w-3.5 h-3.5 ml-auto text-[var(--color-accent)]" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
