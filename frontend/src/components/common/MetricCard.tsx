import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'blue':
        return {
          iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          accent: 'border-l-blue-500',
        };
      case 'emerald':
        return {
          iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          accent: 'border-l-emerald-500',
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          accent: 'border-l-amber-500',
        };
      case 'rose':
        return {
          iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          accent: 'border-l-rose-500',
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          accent: 'border-l-purple-500',
        };
      case 'cyan':
        return {
          iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          accent: 'border-l-cyan-500',
        };
      default:
        return {
          iconBg: 'bg-slate-800 text-slate-300 border-slate-700',
          accent: 'border-l-slate-600',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg backdrop-blur-sm border-l-4 ${styles.accent}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${styles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl font-bold tracking-tight text-white font-mono">
          {value}
        </div>
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
          {subtitle}
        </div>
      )}
    </div>
  );
};
