import React from 'react';
import clsx from 'clsx';

interface TenantQuotaProgressProps {
  tenantId: string;
  tenantName: string;
  weight: number;
  maxConcurrency: number;
  activeRunning?: number;
  deficit?: number;
  className?: string;
}

export const TenantQuotaProgress: React.FC<TenantQuotaProgressProps> = ({
  tenantId,
  tenantName,
  weight,
  maxConcurrency,
  activeRunning = 0,
  deficit = 0,
  className,
}) => {
  const percentage = Math.min(100, Math.round((activeRunning / Math.max(1, maxConcurrency)) * 100));

  // Determine indicator color based on quota utilization
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div
      className={clsx(
        'p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] transition-colors',
        className
      )}
    >
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-primary)]">{tenantName}</span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)] bg-[var(--qf-surface-interactive)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
            {tenantId}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-[var(--text-tertiary)]">Weight:</span>
          <span className="text-[var(--qf-amethyst)] font-bold">{weight}x</span>
          <span className="text-[var(--border-color)]">|</span>
          <span className="text-[var(--text-tertiary)]">Quota:</span>
          <span
            className={clsx(
              'font-bold',
              isAtLimit
                ? 'text-[var(--qf-status-warning)]'
                : 'text-[var(--text-primary)]'
            )}
          >
            {activeRunning}/{maxConcurrency}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-[var(--qf-surface-interactive)] overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out',
            isAtLimit
              ? 'bg-[var(--qf-status-warning)]'
              : isNearLimit
              ? 'bg-[var(--qf-cyan)]'
              : 'bg-[var(--qf-amethyst)]'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5 text-[10px] text-[var(--text-tertiary)] font-mono">
        <span title="Persisted deficit counter from qf_tenants.deficit_counter (last executed DRR sweep)">
          Persisted Sweep Deficit (Di): {deficit.toFixed(1)}
        </span>
        <span>{percentage}% active</span>
      </div>
    </div>
  );
};
