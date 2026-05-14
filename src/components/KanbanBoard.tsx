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
import { ChevronRight, Home, TerminalSquare } from 'lucide-react';
import { useStore } from '@tanstack/react-store';
import clsx from 'clsx';
import type { Priority, Project, Status, Task } from '../types';
import { useKanban } from '../hooks/useKanban';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { TerminalPanel } from './TerminalPanel';
import { uiStore, toggleTerminal } from '../store/uiStore';

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
  onNavigateHome: () => void;
}

export function KanbanBoard({
  mode,
  epicId,
  epicName,
  epicColor,
  epicPath,
  projectId,
  projectName,
  projects,
  onNavigateHome,
}: KanbanBoardProps) {
  const boardId = mode === 'epic' ? (epicId ?? '') : (projectId ?? '');
  const boardName = mode === 'epic' ? (epicName ?? '') : (projectName ?? '');

  const { columns, addTask, editTask, deleteTask, moveTask } = useKanban({
    mode,
    id: boardId,
  });

  const { showTerminal } = useStore(uiStore);
  const [filter, setFilter] = useState<FilterValue>('all');

  const currentProject = mode === 'project'
    ? projects.find(p => p.id === projectId)
    : undefined;
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

    const validStatuses: Status[] = ['todo', 'in-progress', 'done'];
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

  return (
    <div className="h-screen bg-[#0d1117] flex flex-col">
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

          <div className="flex items-center gap-3">
            {/* Filter chips */}
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

            {/* Terminal toggle */}
            <button
              onClick={toggleTerminal}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]',
                showTerminal
                  ? 'bg-[#58a6ff] text-[#0d1117] border-[#58a6ff]'
                  : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] border-[#30363d] hover:border-[#8b949e]'
              )}
              aria-pressed={showTerminal}
              aria-label="Toggle terminal"
              title="Toggle terminal"
            >
              <TerminalSquare size={13} aria-hidden="true" />
              <span>Terminal</span>
            </button>
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
                  boardMode={mode}
                  availableProjects={projects}
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
                    onEdit={() => {}}
                    onDelete={() => {}}
                    projects={projects}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>

      {/* Terminal panel */}
      {showTerminal && (
        <TerminalPanel
          onClose={toggleTerminal}
          cwd={mode === 'epic' ? epicPath : currentProject?.path}
        />
      )}
    </div>
  );
}
