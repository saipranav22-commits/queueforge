import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Flame,
  ShieldAlert,
  Activity,
  Cpu,
  Scale,
  GitBranch,
  Shield,
  Settings,
  ExternalLink,
  X,
} from 'lucide-react';
import { useDashboardStats, useWorkerFleet } from '../../hooks/useQueueForgeData';

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

interface NavSection {
  title: string;
  items: Array<{
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
    count?: number;
    countVariant?: 'default' | 'danger';
    badge?: string;
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose, isMobile = false }) => {
  const { data: stats } = useDashboardStats();
  const { data: workers } = useWorkerFleet();

  const activeWorkerCount = Array.isArray(workers)
    ? workers.filter(w => w.status === 'ONLINE').length
    : (stats?.activeWorkers ? Math.round(stats.activeWorkers) : 0);
  const totalWorkerCapacity = stats?.workerCapacity ?? (Array.isArray(workers) ? workers.length : 2);

  const sections: NavSection[] = [
    {
      title: 'MISSION CONTROL',
      items: [
        {
          to: '/',
          label: 'Overview',
          icon: LayoutDashboard,
          end: true,
        },
      ],
    },
    {
      title: 'WORKLOADS',
      items: [
        {
          to: '/jobs',
          label: 'Job Explorer',
          icon: Layers,
          count: stats?.totalJobs,
        },
        {
          to: '/workers',
          label: 'Worker Fleet',
          icon: Cpu,
          badge: `${activeWorkerCount}/${totalWorkerCapacity}`,
        },
        {
          to: '/fairshare',
          label: 'FairShare Scheduler',
          icon: Scale,
        },
      ],
    },
    {
      title: 'RELIABILITY',
      items: [
        {
          to: '/pipeline',
          label: 'Event Pipeline',
          icon: GitBranch,
        },
        {
          to: '/dlq',
          label: 'Dead-Letter Queue',
          icon: ShieldAlert,
          count: stats?.deadLetterJobs,
          countVariant: stats?.deadLetterJobs && stats.deadLetterJobs > 0 ? 'danger' : 'default',
        },
        {
          to: '/reliability',
          label: 'Reliability Lab',
          icon: Flame,
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          to: '/monitoring',
          label: 'Observability',
          icon: Activity,
        },
        {
          to: '/admin',
          label: 'Administration',
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 h-full flex-shrink-0 border-r border-[var(--color-border-standard)] bg-[var(--color-bg-deep)] flex flex-col justify-between select-none transition-colors">
      <div className="overflow-y-auto">
        {/* Brand Header — Precision Engineering Aesthetic */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[var(--color-border-standard)] bg-[var(--color-bg-base)]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center border border-[var(--color-border-interactive)] shadow-sm">
              <Shield className="w-4 h-4 text-[var(--color-accent)]" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-1.5">
                <span className="font-extrabold tracking-wide">QueueForge</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent-border)] font-semibold">
                  V2
                </span>
              </div>
              <p className="text-[9.5px] text-[var(--color-text-muted)] font-mono tracking-widest uppercase">CONTROL PLANE</p>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] cursor-pointer"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Structured Command Sections */}
        <div className="p-3 space-y-4">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-0.5">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] font-mono opacity-80">
                {sec.title}
              </div>
              {sec.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => {
                    if (isMobile && onClose) {
                      onClose();
                    }
                  }}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-all duration-150 relative ${
                      isActive
                        ? 'bg-[var(--color-accent-bg)] text-[var(--color-text-primary)] font-semibold border-l-2 border-[var(--color-accent)] pl-2.5 shadow-sm'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)]/60'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5">
                        <item.icon className={`w-4 h-4 transition ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.count !== undefined && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono font-medium rounded ${
                            item.countVariant === 'danger'
                              ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]'
                              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-standard)]'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-standard)] rounded">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* External Observability Endpoints Footer */}
      <div className="p-3 border-t border-[var(--color-border-standard)] space-y-1 flex-shrink-0 bg-[var(--color-bg-base)]/40">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
          MONITORING HUBS
        </div>
        <a
          href="http://127.0.0.1:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] rounded-md transition group"
        >
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
            Grafana Hub
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80" />
        </a>
        <a
          href="http://127.0.0.1:9090"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] rounded-md transition group"
        >
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" />
            Prometheus Metrics
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80" />
        </a>
      </div>
    </aside>
  );
};
