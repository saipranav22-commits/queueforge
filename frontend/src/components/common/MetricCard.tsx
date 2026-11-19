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
          iconBg: 'bg-[var(--color-amethyst-bg)] text-[var(--color-amethyst)] border-[var(--color-amethyst-border)]',
          accent: 'border-l-[var(--color-amethyst)]',
          glow: 'hover:shadow-[0_0_20px_rgba(155,112,245,0.12)]',
        };
      case 'cyan':
      case 'blue':
        return {
          iconBg: 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan)] border-[var(--color-cyan-border)]',
          accent: 'border-l-[var(--color-cyan)]',
          glow: 'hover:shadow-[0_0_20px_rgba(53,216,245,0.12)]',
        };
      case 'emerald':
        return {
          iconBg: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
          accent: 'border-l-[var(--color-success)]',
          glow: 'hover:shadow-[0_0_20px_rgba(71,214,173,0.12)]',
        };
      case 'amber':
        return {
          iconBg: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
          accent: 'border-l-[var(--color-warning)]',
          glow: 'hover:shadow-[0_0_20px_rgba(244,184,96,0.12)]',
        };
      case 'rose':
        return {
          iconBg: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
          accent: 'border-l-[var(--color-danger)]',
          glow: 'hover:shadow-[0_0_20px_rgba(240,68,85,0.12)]',
        };
      default:
        return {
          iconBg: 'bg-[var(--color-bg-interactive)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]',
          accent: 'border-l-[var(--color-amethyst)]',
          glow: 'hover:shadow-[0_0_20px_rgba(155,112,245,0.08)]',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-5 shadow-lg backdrop-blur-sm border-l-4 transition-all duration-200 ${
        styles.accent
      } ${styles.glow} ${onClick ? 'cursor-pointer hover:border-[var(--color-border-interactive)]' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${styles.iconBg} transition-colors`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] font-mono">
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
