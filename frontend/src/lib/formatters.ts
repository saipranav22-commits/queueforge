import { type JobStatus } from '../types/job';

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export function getStatusBadgeStyle(status: JobStatus | string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        bg: 'bg-amber-950/40',
        text: 'text-amber-400',
        border: 'border-amber-700/40',
        dot: 'bg-amber-400',
      };
    case 'CLAIMED':
      return {
        bg: 'bg-cyan-950/40',
        text: 'text-cyan-400',
        border: 'border-cyan-700/40',
        dot: 'bg-cyan-400',
      };
    case 'RUNNING':
      return {
        bg: 'bg-blue-950/50',
        text: 'text-blue-400',
        border: 'border-blue-700/40',
        dot: 'bg-blue-400 animate-pulse',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-400',
        border: 'border-emerald-700/40',
        dot: 'bg-emerald-400',
      };
    case 'FAILED':
      return {
        bg: 'bg-rose-950/50',
        text: 'text-rose-400',
        border: 'border-rose-700/40',
        dot: 'bg-rose-400',
      };
    case 'DEAD_LETTER':
      return {
        bg: 'bg-purple-950/50',
        text: 'text-purple-300',
        border: 'border-purple-600/50',
        dot: 'bg-purple-400',
      };
    default:
      return {
        bg: 'bg-slate-800',
        text: 'text-slate-300',
        border: 'border-slate-700',
        dot: 'bg-slate-400',
      };
  }
}
