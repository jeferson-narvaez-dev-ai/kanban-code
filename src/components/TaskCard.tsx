import { useRef, useState, useEffect } from 'react';
import { MoreVertical, FolderOpen } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { Project, Task } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { StatusIcon } from './StatusIcon';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  projects?: Project[];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TaskCard({ task, onEdit, onDelete, projects = [] }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const linkedProject = task.projectId
    ? projects.find((p) => p.id === task.projectId)
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group relative bg-[#21262d] border border-[#30363d] rounded-lg p-3 cursor-grab active:cursor-grabbing select-none',
        'hover:bg-[#262c36] hover:border-[#444c56] transition-colors',
        isDragging && 'opacity-50 ring-2 ring-[#58a6ff]'
      )}
      {...attributes}
      {...listeners}
      aria-label={`Task: ${task.title}`}
    >
      {/* Top row: status icon + title + menu */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex-shrink-0">
          <StatusIcon status={task.status} size={14} />
        </div>
        <span className="flex-1 text-sm font-medium text-[#e6edf3] leading-snug break-words">
          {task.title}
        </span>
        {/* 3-dot menu — stop drag propagation */}
        <div
          ref={menuRef}
          className="relative flex-shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="p-0.5 text-[#484f58] hover:text-[#8b949e] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
            aria-label="Task options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 w-32 bg-[#161b22] border border-[#30363d] rounded-md shadow-lg overflow-hidden"
              role="menu"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEdit(task);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[#e6edf3] hover:bg-[#21262d] transition-colors focus:outline-none focus:bg-[#21262d]"
                role="menuitem"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(task.id);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[#f85149] hover:bg-[#21262d] transition-colors focus:outline-none focus:bg-[#21262d]"
                role="menuitem"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="mt-1.5 ml-5 text-xs text-[#8b949e] line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer: badge + project badge + tags + date */}
      <div className="mt-2.5 ml-5 flex items-center gap-1.5 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {linkedProject && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#0d1117] text-[#8b949e] border border-[#30363d]"
            aria-label={`Project: ${linkedProject.name}`}
          >
            <FolderOpen size={10} aria-hidden="true" />
            {linkedProject.name}
          </span>
        )}
        {task.tags?.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[#0d1117] text-[#8b949e] border border-[#30363d]"
          >
            {tag}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-[#484f58] whitespace-nowrap">
          {formatDate(task.createdAt)}
        </span>
      </div>
    </div>
  );
}
