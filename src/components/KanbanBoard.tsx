import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { ChevronRight, Home, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type { Priority, Project, Status, Task } from '../types';
import type { Epic, Project as ApiProject } from '../../shared/types';
import { useKanban } from '../hooks/useKanban';
import { useKanbanSocket } from '../hooks/useKanbanSocket';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { InitProjectModal } from './InitProjectModal';
import { getProject } from '../api/client';

type FilterValue = Priority | 'all';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Med' },
  { value: 'low', label: 'Low' },
];

interface KanbanBoardProps {
  mode: 'epic' | 'project';
  epicId?: string;
  epicName?: string;
  epicColor?: string;
  epicPath?: string;
  projectId?: string;
  projectName?: string;
  projects: Project[];
  epics?: Epic[];
  agentMode?: 'auto' | 'manual';
  onNavigateHome: () => void;
}

export function KanbanBoard({
  mode,
  epicId,
  epicName,
  epicColor,
  projectId,
  projectName,
  projects,
  epics = [],
  agentMode = 'auto',
  onNavigateHome,
}: KanbanBoardProps) {
  const boardId = mode === 'epic' ? (epicId ?? '') : (projectId ?? '');
  const boardName = mode === 'epic' ? (epicName ?? '') : (projectName ?? '');

  const { columns, addTask, editTask, deleteTask, moveTask } = useKanban({
    mode,
    id: boardId,
  });

  // WebSocket — keeps TanStack Query cache in sync with server events
  useKanbanSocket(mode === 'project' ? (projectId ?? null) : null);

  const [filter, setFilter] = useState<FilterValue>('all');
  const [epicFilter, setEpicFilter] = useState<string | 'all'>('all');
  const [groupByEpic, setGroupByEpic] = useState(false);

  // Fetch the authoritative project record (includes `initialized` flag)
  const { data: apiProject, refetch: refetchApiProject } = useQuery<ApiProject>({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: mode === 'project' && Boolean(projectId),
  });

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    for (const col of columns) {
      const task = col.tasks.find((t) => t.id === id);
      if (task) {
        setActiveTask(task);
        break;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const validStatuses: Status[] = ['todo', 'in-progress', 'waiting-approval', 'done'];
    let targetStatus: Status | undefined;

    if (validStatuses.includes(overId as Status)) {
      targetStatus = overId as Status;
    } else {
      for (const col of columns) {
        if (col.tasks.some((t) => t.id === overId)) {
          targetStatus = col.id;
          break;
        }
      }
    }

    if (!targetStatus) return;

    let sourceStatus: Status | undefined;
    for (const col of columns) {
      if (col.tasks.some((t) => t.id === taskId)) {
        sourceStatus = col.id;
        break;
      }
    }

    if (sourceStatus !== targetStatus) {
      moveTask(taskId, targetStatus);
    }
  }

  // Guard: show initialization modal if the project has not been set up yet
  if (mode === 'project' && apiProject && !apiProject.initialized) {
    return (
      <InitProjectModal
        project={apiProject}
        onClose={() => void refetchApiProject()}
      />
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#09090b' }}>
      {/* Header */}
      <header
        className="px-6 py-3 flex-shrink-0"
        style={{
          background: '#111116',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5" style={{ fontSize: '13px' }}>
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1 transition-colors focus:outline-none rounded px-1"
              style={{ color: '#52525b' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
              aria-label="Go to home"
            >
              <Home size={13} aria-hidden="true" />
              <span>Home</span>
            </button>
            <ChevronRight size={12} style={{ color: '#3f3f46' }} aria-hidden="true" />
            <span
              className="font-semibold flex items-center gap-1.5"
              style={{ color: '#f4f4f5' }}
              aria-current="page"
            >
              {mode === 'epic' && epicColor && (
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: epicColor, boxShadow: `0 0 6px ${epicColor}66` }}
                  aria-hidden="true"
                />
              )}
              {boardName}
            </span>
          </nav>

          {/* Filter chips */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1" role="group" aria-label="Filter by priority">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={clsx(
                    'transition-all focus:outline-none font-medium',
                  )}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    ...(filter === f.value
                      ? {
                          background: 'rgba(99,102,241,0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99,102,241,0.3)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.03)',
                          color: '#71717a',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }),
                  }}
                  aria-pressed={filter === f.value}
                  aria-label={`Filter: ${f.label}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {epics.length > 0 && (
              <>
                <select
                  value={epicFilter}
                  onChange={(e) => { setEpicFilter(e.target.value); setGroupByEpic(false); }}
                  className="focus:outline-none transition-colors appearance-none cursor-pointer"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#71717a',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                  aria-label="Filter by epic"
                >
                  <option value="all">All Epics</option>
                  {epics.map((epic) => (
                    <option key={epic.id} value={epic.id}>
                      {epic.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => { setGroupByEpic(v => !v); setEpicFilter('all'); }}
                  className="flex items-center gap-1.5 transition-all focus:outline-none font-medium"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    ...(groupByEpic
                      ? {
                          background: 'rgba(99,102,241,0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99,102,241,0.3)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.03)',
                          color: '#71717a',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }),
                  }}
                  aria-pressed={groupByEpic}
                  title="Group tasks by epic"
                >
                  <Layers size={11} />
                  Group
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 px-6 py-5 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 items-start">
              {columns.map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  filterPriority={filter}
                  epicFilter={epicFilter}
                  epics={epics}
                  groupByEpic={groupByEpic}
                  boardMode={mode}
                  availableProjects={projects}
                  projectId={projectId}
                  agentMode={agentMode}
                  onAddTask={addTask}
                  onEditTask={editTask}
                  onDeleteTask={deleteTask}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? (
                <div style={{ transform: 'rotate(1.5deg)', opacity: 0.96 }}>
                  <TaskCard
                    task={activeTask}
                    onOpen={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    projects={projects}
                    epics={epics}
                    isDragOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>
    </div>
  );
}
