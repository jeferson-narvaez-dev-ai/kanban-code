import type { Priority } from '../types';
import clsx from 'clsx';

interface PriorityBadgeProps {
  priority: Priority;
}

const config: Record<Priority, { label: string; classes: string }> = {
  high: {
    label: 'HIGH',
    classes: 'bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/30',
  },
  medium: {
    label: 'MED',
    classes: 'bg-[#d29922]/20 text-[#d29922] border border-[#d29922]/30',
  },
  low: {
    label: 'LOW',
    classes: 'bg-[#8b949e]/20 text-[#8b949e] border border-[#8b949e]/30',
  },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { label, classes } = config[priority];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
        classes
      )}
    >
      {label}
    </span>
  );
}
