import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Cpu,
  Scale,
  GitBranch,
  Flame,
  ShieldAlert,
  Activity,
  Settings,
  Search,
  X,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  category: 'NAVIGATION' | 'WORKLOADS' | 'RELIABILITY' | 'OPERATIONS' | 'SECURITY';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { openUnlockModal, isAuthenticated } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: 'mission-control',
      category: 'NAVIGATION',
      title: 'Mission Control',
      subtitle: 'Cluster overview, 7-service topology, and operator intelligence',
      icon: LayoutDashboard,
      action: () => {
        navigate('/');
        onClose();
      },
    },
    {
      id: 'job-explorer',
      category: 'WORKLOADS',
      title: 'Job Explorer',
      subtitle: 'Search, filter, and inspect durable background jobs across tenants',
      icon: Layers,
      action: () => {
        navigate('/jobs');
        onClose();
      },
    },
    {
      id: 'worker-fleet',
      category: 'WORKLOADS',
      title: 'Worker Fleet',
      subtitle: 'Distributed worker JVM nodes, lease allocations & heartbeat monitors',
      icon: Cpu,
      action: () => {
        navigate('/workers');
        onClose();
      },
    },
    {
      id: 'fairshare',
      category: 'WORKLOADS',
      title: 'FairShare Scheduler',
      subtitle: 'Deficit Round Robin weights, concurrency quotas & interactive simulator',
      icon: Scale,
      action: () => {
        navigate('/fairshare');
        onClose();
      },
    },
    {
      id: 'event-pipeline',
      category: 'RELIABILITY',
      title: 'Event Pipeline',
      subtitle: 'Transactional outbox dispatch and simulated receiver deduplication',
      icon: GitBranch,
      action: () => {
        navigate('/pipeline');
        onClose();
      },
    },
    {
      id: 'dlq-operations',
      category: 'RELIABILITY',
      title: 'Dead-Letter Queue Operations',
      subtitle: 'Poison job isolation, error diagnostic traces, and authenticated replay',
      icon: ShieldAlert,
      action: () => {
        navigate('/dlq');
        onClose();
      },
    },
    {
      id: 'reliability-lab',
      category: 'RELIABILITY',
      title: 'Reliability Lab & Distributed Verification',
      subtitle: 'Resilience mechanisms, crash recovery, and 9-invariant correctness matrix',
      icon: Flame,
      action: () => {
        navigate('/reliability');
        onClose();
      },
    },
    {
      id: 'observability',
      category: 'OPERATIONS',
      title: 'Observability & Metrics',
      subtitle: 'Prometheus metrics summary, latency percentiles, and Grafana telemetry',
      icon: Activity,
      action: () => {
        navigate('/monitoring');
        onClose();
      },
    },
    {
      id: 'admin',
      category: 'OPERATIONS',
      title: 'Administration',
      subtitle: 'Tenant management, API key rotation, and administrative configuration',
      icon: Settings,
      action: () => {
        navigate('/admin');
        onClose();
      },
    },
    {
      id: 'admin-unlock',
      category: 'SECURITY',
      title: isAuthenticated ? 'Admin Mode (Active)' : 'Unlock Administrator Access',
      subtitle: 'Authenticate with X-Admin-Key for state-changing operational controls',
      icon: Lock,
      action: () => {
        onClose();
        openUnlockModal();
      },
    },
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className={clsx(
          'relative w-full max-w-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col',
          'animate-in zoom-in-95 duration-150'
        )}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]">
          <Search className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or navigate... (↑/↓ to select, Enter to run, Esc to exit)"
            className="w-full h-14 bg-transparent px-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              aria-label="Clear Search Query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--color-text-muted)] font-mono">
              No matching commands or destinations found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-[var(--color-bg-interactive)] border border-[var(--color-border-interactive)] shadow-sm'
                      : 'hover:bg-[var(--color-bg-interactive)]/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-bg-elevated)] text-[var(--color-accent)] border border-[var(--color-border-interactive)]'
                          : 'bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-[var(--color-bg-deep)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-[var(--color-accent)] ml-2 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[var(--color-bg-deep)] border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)] font-mono">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[10px]">
              ↑
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[10px]">
              ↓
            </kbd>
            <span>Navigate</span>
            <kbd className="ml-2 px-1.5 py-0.5 rounded bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[10px]">
              ↵
            </kbd>
            <span>Select</span>
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] text-[10px]">
              ESC
            </kbd>{' '}
            Close
          </span>
        </div>
      </div>
    </div>
  );
};
