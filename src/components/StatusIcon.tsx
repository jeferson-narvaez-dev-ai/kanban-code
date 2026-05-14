import { Circle, Clock, CheckCircle2 } from 'lucide-react';
import type { Status } from '../types';

interface StatusIconProps {
  status: Status;
  size?: number;
}

export function StatusIcon({ status, size = 14 }: StatusIconProps) {
  if (status === 'todo') {
    return <Circle size={size} className="text-[#8b949e]" aria-label="To do" />;
  }
  if (status === 'in-progress') {
    return <Clock size={size} className="text-[#58a6ff]" aria-label="In progress" />;
  }
  return <CheckCircle2 size={size} className="text-[#3fb950]" aria-label="Done" />;
}
