import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'amethyst';
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  onClick,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'amethyst':
      case 'purple':
        return {
          icon: 'text-[var(--color-accent)] bg-[var(--color-bg-interactive)] border-[var(--color-border-subtle)]',
          topAccent: 'border-t-2 border-t-[var(--color-accent)]',
        };
      case 'cyan':
      case 'blue':
        return {
          icon: 'text-[var(--color-text-primary)] bg-[var(--color-bg-interactive)] border-[var(--color-border-subtle)]',
          topAccent: 'border-t-2 border-t-[var(--color-border-interactive)]',
        };
      case 'emerald':
        return {
          icon: 'text-[var(--color-success)] bg-[var(--color-success-bg)] border-[var(--color-success-border)]',
          topAccent: 'border-t-2 border-t-[var(--color-success)]',
        };
      case 'amber':
        return {
          icon: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)] border-[var(--color-warning-border)]',
          topAccent: 'border-t-2 border-t-[var(--color-warning)]',
        };
      case 'rose':
        return {
          icon: 'text-[var(--color-danger)] bg-[var(--color-danger-bg)] border-[var(--color-danger-border)]',
          topAccent: 'border-t-2 border-t-[var(--color-danger)]',
        };
      default:
        return {
          icon: 'text-[var(--color-text-secondary)] bg-[var(--color-bg-interactive)] border-[var(--color-border-subtle)]',
          topAccent: 'border-t-2 border-t-[var(--color-border-subtle)]',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-standard)] p-5 shadow-sm transition-all duration-200 ${
        styles.topAccent
      } ${onClick ? 'cursor-pointer hover:border-[var(--color-border-interactive)] hover:bg-[var(--color-bg-interactive)]/40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
          {title}
        </span>
        <div className={`p-2 rounded-md border ${styles.icon} transition-colors`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)] font-mono tabular-nums">
          {value}
        </div>
        {trend && (
          <span
            className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${
              trend.isPositive
                ? 'text-[var(--color-success)] bg-[var(--color-success-bg)]'
                : 'text-[var(--color-danger)] bg-[var(--color-danger-bg)]'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-[var(--color-text-secondary)] flex items-center gap-1 font-sans">
          {subtitle}
        </div>
      )}
    </div>
  );
};
