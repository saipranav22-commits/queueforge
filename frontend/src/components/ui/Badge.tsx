import React from 'react';
import clsx from 'clsx';

export type BadgeVariant =
  | 'amethyst'
  | 'cyan'
  | 'success'
  | 'warning'
  | 'critical'
  | 'neutral'
  | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  children,
  icon: Icon,
  className,
  ...props
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantClasses: Record<BadgeVariant, string> = {
    amethyst:
      'bg-[var(--qf-amethyst-subtle)] text-[var(--qf-amethyst)] border border-[var(--qf-amethyst-border)]',
    cyan:
      'bg-[var(--qf-status-info-subtle)] text-[var(--qf-status-info)] border border-[var(--qf-status-info-border)]',
    success:
      'bg-[var(--qf-status-success-subtle)] text-[var(--qf-status-success)] border border-[var(--qf-status-success-border)]',
    warning:
      'bg-[var(--qf-status-warning-subtle)] text-[var(--qf-status-warning)] border border-[var(--qf-status-warning-border)]',
    critical:
      'bg-[var(--qf-status-critical-subtle)] text-[var(--qf-status-critical)] border border-[var(--qf-status-critical-border)]',
    neutral:
      'bg-[var(--qf-surface-interactive)] text-[var(--text-secondary)] border border-[var(--border-color)]',
    outline:
      'bg-transparent text-[var(--text-secondary)] border border-[var(--border-color)]',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-mono font-medium rounded-md tracking-tight select-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
