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
        bg: 'bg-[var(--color-warning-bg)]',
        text: 'text-[var(--color-warning)]',
        border: 'border-[var(--color-warning-border)]',
        dot: 'bg-[var(--color-warning)]',
      };
    case 'CLAIMED':
      return {
        bg: 'bg-[var(--color-accent-bg)]',
        text: 'text-[var(--color-accent)]',
        border: 'border-[var(--color-accent-border)]',
        dot: 'bg-[var(--color-accent)]',
      };
    case 'RUNNING':
      return {
        bg: 'bg-[var(--color-accent-bg)]',
        text: 'text-[var(--color-accent)]',
        border: 'border-[var(--color-accent-border)]',
        dot: 'bg-[var(--color-accent)] animate-pulse',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-[var(--color-success-bg)]',
        text: 'text-[var(--color-success)]',
        border: 'border-[var(--color-success-border)]',
        dot: 'bg-[var(--color-success)]',
      };
    case 'FAILED':
      return {
        bg: 'bg-[var(--color-danger-bg)]',
        text: 'text-[var(--color-danger)]',
        border: 'border-[var(--color-danger-border)]',
        dot: 'bg-[var(--color-danger)]',
      };
    case 'DEAD_LETTER':
      return {
        bg: 'bg-[var(--color-danger-bg)]',
        text: 'text-[var(--color-danger)]',
        border: 'border-[var(--color-danger-border)]',
        dot: 'bg-[var(--color-danger)]',
      };
    default:
      return {
        bg: 'bg-[var(--color-bg-deep)]',
        text: 'text-[var(--color-text-secondary)]',
        border: 'border-[var(--color-border-subtle)]',
        dot: 'bg-[var(--color-text-muted)]',
      };
  }
}
