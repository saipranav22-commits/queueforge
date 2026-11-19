import React from 'react';
import clsx from 'clsx';

export type StatusType = 'healthy' | 'active' | 'warning' | 'critical' | 'neutral';

interface StatusIndicatorProps {
  status: StatusType;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  pulse = false,
  size = 'md',
  label,
  className,
}) => {
  const sizeMap = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const colorMap: Record<StatusType, { dot: string; pulse: string; text: string }> = {
    healthy: {
      dot: 'bg-[#47D6AD]',
      pulse: 'bg-[#47D6AD]/60',
      text: 'text-[#47D6AD]',
    },
    active: {
      dot: 'bg-[#35D8F5]',
      pulse: 'bg-[#35D8F5]/60',
      text: 'text-[#35D8F5]',
    },
    warning: {
      dot: 'bg-[#F4B860]',
      pulse: 'bg-[#F4B860]/60',
      text: 'text-[#F4B860]',
    },
    critical: {
      dot: 'bg-[#F04455]',
      pulse: 'bg-[#F04455]/60',
      text: 'text-[#F04455]',
    },
    neutral: {
      dot: 'bg-[#9099AC]',
      pulse: 'bg-[#9099AC]/40',
      text: 'text-[#9099AC]',
    },
  };

  const config = colorMap[status] || colorMap.neutral;

  return (
    <span className={clsx('inline-flex items-center gap-1.5 select-none', className)}>
      <span className="relative flex items-center justify-center">
        {pulse && (
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.pulse,
              sizeMap[size]
            )}
          />
        )}
        <span
          className={clsx(
            'relative inline-flex rounded-full',
            config.dot,
            sizeMap[size]
          )}
        />
      </span>
      {label && (
        <span className={clsx('text-xs font-mono font-medium', config.text)}>
          {label}
        </span>
      )}
    </span>
  );
};
