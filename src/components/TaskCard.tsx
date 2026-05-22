import { useRef, useState, useEffect } from 'react';
import { MoreVertical, FolderOpen } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project, Task } from '../types';
import type { Epic } from '../../shared/types';
import { PriorityBadge } from './PriorityBadge';
import { StatusIcon } from './StatusIcon';

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  projects?: Project[];
  epics?: Epic[];
  isDragOverlay?: boolean;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TaskCard({ task, onOpen, onEdit, onDelete, projects = [], epics = [], isDragOverlay = false }: TaskCardProps) {
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
  const [isHovered, setIsHovered] = useState(false);
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

  const linkedEpic = task.epicId
    ? epics.find((e) => e.id === task.epicId)
    : undefined;

  const cardStyle: React.CSSProperties = {
    background: '#18181f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: isDragOverlay ? 'grabbing' : 'grab',
    userSelect: 'none',
    transition: isDragging ? 'none' : 'box-shadow 0.12s ease, transform 0.12s ease, border-color 0.12s ease, background 0.12s ease',
    ...(isDragging
      ? {
          opacity: 0.3,
          boxShadow: 'none',
        }
      : isDragOverlay
      ? {
          boxShadow: '0 0 0 2px #6366f1, 0 8px 24px rgba(99,102,241,0.3)',
          background: '#1e1e28',
          borderColor: 'rgba(99,102,241,0.4)',
        }
      : isHovered
      ? {
          boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          background: '#1e1e28',
          borderColor: 'rgba(255,255,255,0.11)',
          transform: 'translateY(-1px)',
        }
      : {
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        }),
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...cardStyle }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      aria-label={`Task: ${task.title}`}
    >
      {/* Top row: status icon + title + menu */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex-shrink-0">
          <StatusIcon status={task.status} size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-mono leading-none mb-0.5"
            style={{ fontSize: '9px', color: '#52525b' }}
          >
            {task.id}
          </p>
          <span
            className="font-medium leading-snug break-words"
            style={{ fontSize: '13px', color: '#f4f4f5' }}
          >
            {task.title}
          </span>
        </div>

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
            onPointerDown={(e) => e.stopPropagation()}
            className="p-0.5 rounded transition-all focus:outline-none"
            style={{
              color: '#52525b',
              opacity: isHovered || menuOpen ? 1 : 0,
              transition: 'opacity 0.1s ease, color 0.1s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
            aria-label="Task options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={13} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 w-28 overflow-hidden"
              style={{
                background: '#1e1e28',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
              role="menu"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEdit(task);
                }}
                className="w-full text-left px-3 py-2 transition-colors focus:outline-none"
                style={{ fontSize: '12px', color: '#a1a1aa' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#f4f4f5'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa'; }}
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
                className="w-full text-left px-3 py-2 transition-colors focus:outline-none"
                style={{ fontSize: '12px', color: '#ef4444' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
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
        <p
          className="mt-1.5 ml-5 line-clamp-2 leading-relaxed"
          style={{ fontSize: '11px', color: '#71717a' }}
        >
          {task.description}
        </p>
      )}

      {/* Epic pill */}
      {linkedEpic && (
        <div className="mt-1.5 ml-5">
          <span
            className="inline-flex items-center gap-1 font-medium"
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '9999px',
              backgroundColor: `${linkedEpic.color}18`,
              color: linkedEpic.color,
              border: `1px solid ${linkedEpic.color}33`,
            }}
            aria-label={`Epic: ${linkedEpic.name}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: linkedEpic.color }}
              aria-hidden="true"
            />
            {linkedEpic.name}
          </span>
        </div>
      )}

      {/* Footer: badge + project badge + tags + date */}
      <div className="mt-2.5 ml-5 flex items-center gap-1.5 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {linkedProject && (
          <span
            className="inline-flex items-center gap-1"
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)',
              color: '#71717a',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
            aria-label={`Project: ${linkedProject.name}`}
          >
            <FolderOpen size={9} aria-hidden="true" />
            {linkedProject.name}
          </span>
        )}
        {task.tags?.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center"
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)',
              color: '#71717a',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {tag}
          </span>
        ))}
        <span
          className="ml-auto font-mono whitespace-nowrap"
          style={{ fontSize: '9px', color: '#52525b' }}
        >
          {formatDate(task.createdAt)}
        </span>
      </div>
    </div>
  );
}
