import type { Priority } from '../types';

interface PriorityBadgeProps {
  priority: Priority;
}

const config: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  high: {
    label: 'HIGH',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.25)',
  },
  medium: {
    label: 'MED',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
  },
  low: {
    label: 'LOW',
    color: '#71717a',
    bg: 'rgba(113,113,122,0.1)',
    border: 'rgba(113,113,122,0.2)',
  },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { label, color, bg, border } = config[priority];
  return (
    <span
      className="inline-flex items-center font-mono font-semibold"
      style={{
        fontSize: '9px',
        letterSpacing: '0.06em',
        padding: '2px 5px',
        borderRadius: '9999px',
        color,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      {label}
    </span>
  );
}
