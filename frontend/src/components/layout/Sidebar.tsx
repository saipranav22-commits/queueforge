import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Flame,
  Activity,
  Cpu,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { useDashboardStats } from '../../hooks/useQueueForgeData';

export const Sidebar: React.FC = () => {
  const { data: stats } = useDashboardStats();

  const navItems = [
    {
      to: '/',
      label: 'Overview',
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
      to: '/dlq',
      label: 'Dead-Letter Queue',
      icon: Flame,
      count: stats?.deadLetterJobs,
      countVariant: stats?.deadLetterJobs && stats.deadLetterJobs > 0 ? 'rose' : 'default',
    },
    {
      to: '/workers',
      label: 'Workers & System',
      icon: Cpu,
      badge: stats ? `${Math.round(stats.activeWorkers)}/${stats.workerCapacity}` : undefined,
    },
    {
      to: '/monitoring',
      label: 'Monitoring & Metrics',
      icon: Activity,
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/90 flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>QueueForge</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Reliable Job Engine</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Operations
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4 transition group-hover:text-blue-400" />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-full ${
                    item.countVariant === 'rose'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.count}
                </span>
              )}
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 rounded">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* External Observability Links */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Observability
        </div>
        <a
          href="http://127.0.0.1:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition group"
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
          className="flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition group"
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
