import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSystemHealth } from '../../hooks/useQueueForgeData';
import { ShieldCheck, ShieldAlert, Lock, Unlock, Database, Cpu, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { isAuthenticated, openUnlockModal, logout } = useAuth();
  const { data: health } = useSystemHealth();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3 sm:gap-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden transition"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-sm font-semibold text-slate-200 hidden sm:block">QueueForge Console</h1>
        <div className="h-4 w-px bg-slate-800 hidden sm:block" />
        <div className="flex items-center gap-2 sm:gap-3">
          {/* DB Health Pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-[11px] font-mono text-slate-300">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">PostgreSQL:</span>
            <span
              className={`font-semibold ${
                health?.dbStatus === 'UP' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {health?.dbStatus || 'UNKNOWN'}
            </span>
          </div>

          {/* Coordinator Pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-[11px] font-mono text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Coordinator:</span>
            <span
              className={`font-semibold ${
                health?.workerStatus === 'RUNNING'
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {health?.workerStatus || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Live sync pulse */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono">Live</span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        {/* Admin Authentication Status */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Admin Mode</span>
            </span>
            <button
              onClick={() => logout()}
              title="Lock Admin session"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              Read-Only
            </span>
            <button
              onClick={() => openUnlockModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-md shadow-blue-600/20"
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
