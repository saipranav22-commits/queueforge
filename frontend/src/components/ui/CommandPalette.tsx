import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { openUnlockModal, isAuthenticated } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open in parent
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    {
      id: 'mission-control',
      title: 'Mission Control',
      subtitle: 'Cluster overview, live KPIs and real-time execution flow',
      icon: LayoutDashboard,
      action: () => {
        navigate('/');
        onClose();
      },
    },
    {
      id: 'job-explorer',
      title: 'Job Explorer',
      subtitle: 'Search, filter and inspect durable jobs across tenants',
      icon: Layers,
      action: () => {
        navigate('/jobs');
        onClose();
      },
    },
    {
      id: 'worker-fleet',
      title: 'Worker Fleet',
      subtitle: 'Distributed worker JVM nodes, lease duration & thread status',
      icon: Cpu,
      action: () => {
        navigate('/workers');
        onClose();
      },
    },
    {
      id: 'fairshare',
      title: 'FairShare Multi-Tenant',
      subtitle: 'Deficit Round Robin weights, concurrency quotas & deficit counters',
      icon: Scale,
      action: () => {
        navigate('/fairshare');
        onClose();
      },
    },
    {
      id: 'event-pipeline',
      title: 'Event Pipeline',
      subtitle: 'Transactional outbox dispatch and payment receiver deduplication',
      icon: GitBranch,
      action: () => {
        navigate('/pipeline');
        onClose();
      },
    },
    {
      id: 'reliability-lab',
      title: 'Reliability Lab & Distributed Verification',
      subtitle: 'Resilience mechanisms, historical ChaosLab experiments and 9-invariant matrix',
      icon: Flame,
      action: () => {
        navigate('/reliability');
        onClose();
      },
    },
    {
      id: 'dlq-operations',
      title: 'Dead-Letter Queue Operations',
      subtitle: 'Exhausted retry inspection, replay triggers and failure taxonomy',
      icon: ShieldAlert,
      action: () => {
        navigate('/dlq');
        onClose();
      },
    },
    {
      id: 'observability',
      title: 'Observability & Metrics',
      subtitle: 'System Prometheus metrics summary and Grafana dashboards',
      icon: Activity,
      action: () => {
        navigate('/monitoring');
        onClose();
      },
    },
    {
      id: 'admin',
      title: 'Administration',
      subtitle: 'Tenant management, API key rotation and dispatch triggers',
      icon: Settings,
      action: () => {
        navigate('/admin');
        onClose();
      },
    },
    {
      id: 'admin-unlock',
      title: isAuthenticated ? 'Admin Mode (Active)' : 'Unlock Admin Operations',
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
      c.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className={clsx(
          'relative w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col',
          'animate-in zoom-in-95 duration-150'
        )}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-[var(--border-color)] bg-[var(--bg-header)]">
          <Search className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to screen... (Esc to close)"
            className="w-full h-14 bg-transparent px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">
              No matching commands found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[var(--qf-surface-interactive)] transition-colors qf-focus-ring cursor-pointer group"
                >
                  <div className="p-2 rounded-lg bg-[var(--qf-surface-interactive)] group-hover:bg-[var(--qf-amethyst-subtle)] text-[var(--text-secondary)] group-hover:text-[var(--qf-amethyst)] transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--qf-amethyst)] transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[var(--bg-sidebar)] border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)] font-mono">
          <span>Navigate with mouse or arrow keys</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--qf-surface-interactive)] border border-[var(--border-color)] text-[10px]">
              ESC
            </kbd>{' '}
            to exit
          </span>
        </div>
      </div>
    </div>
  );
};
