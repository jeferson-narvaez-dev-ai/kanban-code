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
  { value: 'medium', label: 'Medium' },
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

  // Accent color for the header accent: use epic color if in epic mode, otherwise blue
  const accentColor = mode === 'epic' && epicColor ? epicColor : '#58a6ff';

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
    <div className="h-full bg-[#0d1117] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#30363d] bg-[#161b22] px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1 text-[#8b949e] hover:text-[#e6edf3] transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] rounded px-1"
              aria-label="Go to home"
            >
              <Home size={14} aria-hidden="true" />
              <span>Home</span>
            </button>
            <ChevronRight size={13} className="text-[#484f58]" aria-hidden="true" />
            <span
              className="font-semibold text-[#e6edf3] flex items-center gap-1.5"
              aria-current="page"
            >
              {mode === 'epic' && epicColor && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                  aria-hidden="true"
                />
              )}
              {boardName}
            </span>
          </nav>

          {/* Filter chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5" role="group" aria-label="Filter by priority">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]',
                    filter === f.value
                      ? 'bg-[#58a6ff] text-[#0d1117]'
                      : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] border border-[#30363d]'
                  )}
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
                  className="bg-[#21262d] border border-[#30363d] rounded-md px-2 py-1 text-xs text-[#8b949e] hover:text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors appearance-none cursor-pointer"
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
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]',
                    groupByEpic
                      ? 'bg-[#1f6feb33] text-[#58a6ff] border-[#58a6ff]'
                      : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] border-[#30363d]'
                  )}
                  aria-pressed={groupByEpic}
                  title="Group tasks by epic"
                >
                  <Layers size={12} />
                  Group
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 px-6 py-6 overflow-auto">
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
                <div className="rotate-1 opacity-95">
                  <TaskCard
                    task={activeTask}
                    onOpen={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    projects={projects}
                    epics={epics}
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
