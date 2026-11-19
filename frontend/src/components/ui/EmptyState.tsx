import React from 'react';
import clsx from 'clsx';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  description = 'There are no active records matching the current criteria.',
  icon: Icon = Inbox,
  action,
  className,
}) => {
  return (
    <div
      className={clsx(
        'p-8 text-center flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--qf-surface-interactive)] flex items-center justify-center text-[var(--text-tertiary)] mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--text-tertiary)] max-w-sm mt-1 mb-4">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--qf-amethyst)] hover:bg-[var(--qf-amethyst-hover)] transition cursor-pointer qf-focus-ring shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load telemetry',
  message = 'An unexpected error occurred while communicating with the QueueForge cluster.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={clsx(
        'p-6 text-center flex flex-col items-center justify-center rounded-xl border border-[var(--qf-status-critical-border)] bg-[var(--qf-status-critical-subtle)] text-[var(--text-primary)]',
        className
      )}
    >
      <AlertCircle className="w-8 h-8 text-[var(--qf-status-critical)] mb-2" />
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="text-xs text-[var(--text-secondary)] max-w-md mt-1 mb-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--qf-surface-interactive)] hover:bg-[var(--qf-surface-hover)] border border-[var(--border-color)] transition cursor-pointer qf-focus-ring"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Request
        </button>
      )}
    </div>
  );
};

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  rows = 4,
  className,
}) => {
  return (
    <div className={clsx('space-y-3 animate-pulse', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 bg-[var(--qf-surface-interactive)]/60 rounded-lg border border-[var(--border-color)]/40"
        />
      ))}
    </div>
  );
};
