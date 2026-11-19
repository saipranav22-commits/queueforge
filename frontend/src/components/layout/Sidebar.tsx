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
import { useDashboardStats } from '../../hooks/useQueueForgeData';

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose, isMobile = false }) => {
  const { data: stats } = useDashboardStats();

  const navItems = [
    {
      to: '/',
      label: 'Mission Control',
      icon: LayoutDashboard,
      end: true,
    },
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
      badge: stats ? `${Math.round(stats.activeWorkers)}/${stats.workerCapacity}` : undefined,
    },
    {
      to: '/fairshare',
      label: 'FairShare Multi-Tenant',
      icon: Scale,
    },
    {
      to: '/pipeline',
      label: 'Event Pipeline',
      icon: GitBranch,
    },
    {
      to: '/reliability',
      label: 'Reliability Lab',
      icon: Flame,
    },
    {
      to: '/dlq',
      label: 'Dead-Letter Queue',
      icon: ShieldAlert,
      count: stats?.deadLetterJobs,
      countVariant: stats?.deadLetterJobs && stats.deadLetterJobs > 0 ? 'danger' : 'default',
    },
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
  ];

  return (
    <aside className="w-64 h-full flex-shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)] flex flex-col justify-between select-none transition-colors">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[var(--color-amethyst)] to-[var(--color-cyan)] flex items-center justify-center shadow-lg shadow-[var(--color-amethyst)]/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-1.5">
                <span>QueueForge</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border border-[var(--color-cyan-border)]">
                  V2
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-medium">Control Plane</p>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
            Navigation
          </div>
          {navItems.map((item) => (
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
                `group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border border-[var(--color-amethyst-border)] shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4 transition group-hover:text-[var(--color-amethyst)]" />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-full ${
                    item.countVariant === 'danger'
                      ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]'
                      : 'bg-[var(--color-bg-interactive)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {item.count}
                </span>
              )}
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-cyan)] bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)] rounded">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* External Observability Links */}
      <div className="p-3 border-t border-[var(--color-border-subtle)] space-y-1.5">
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
          Telemetry & Observability
        </div>
        <a
          href="http://127.0.0.1:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] rounded-lg transition group"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            Grafana Dashboard
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
        </a>
        <a
          href="http://127.0.0.1:9090"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] rounded-lg transition group"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Prometheus Metrics
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
        </a>
      </div>
    </aside>
  );
};
