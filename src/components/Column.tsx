import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import type { Column as ColumnType, Priority, Project, Status, Task } from '../types';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { StatusIcon } from './StatusIcon';

interface ColumnProps {
  column: ColumnType;
  filterPriority: Priority | 'all';
  boardMode?: 'epic' | 'project';
  availableProjects?: Project[];
  onAddTask: (status: Status, data: Omit<Task, 'id' | 'createdAt'>) => void;
  onEditTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

const accentMap: Record<Status, string> = {
  todo: '#8b949e',
  'in-progress': '#58a6ff',
  done: '#3fb950',
};

export function Column({
  column,
  filterPriority,
  boardMode = 'project',
  availableProjects = [],
  onAddTask,
  onEditTask,
  onDeleteTask,
}: ColumnProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const filteredTasks =
    filterPriority === 'all'
      ? column.tasks
      : column.tasks.filter((t) => t.priority === filterPriority);

  const accent = accentMap[column.id];

  return (
    <>
      <div className="flex flex-col w-80 flex-shrink-0">
        {/* Column header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 rounded-t-lg border-t-2"
          style={{ borderColor: accent, backgroundColor: '#161b22' }}
        >
          <div className="flex items-center gap-2">
            <StatusIcon status={column.id} size={15} />
            <span
              className="text-sm font-semibold"
              style={{ color: accent }}
            >
              {column.title}
            </span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#21262d] text-[10px] font-medium text-[#8b949e]">
              {filteredTasks.length}
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
            aria-label={`Add task to ${column.title}`}
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Droppable task list */}
        <div
          ref={setNodeRef}
          className={clsx(
            'flex-1 min-h-[120px] rounded-b-lg border border-t-0 border-[#30363d] p-2 space-y-2 transition-colors',
            isOver ? 'bg-[#1c2128]' : 'bg-[#161b22]'
          )}
        >
          <SortableContext
            items={filteredTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={(t) => setEditingTask(t)}
                onDelete={onDeleteTask}
                projects={availableProjects}
              />
            ))}
          </SortableContext>

          {filteredTasks.length === 0 && (
            <div className="flex items-center justify-center h-16 text-xs text-[#484f58]">
              No tasks
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <TaskModal
          mode="create"
          boardMode={boardMode}
          defaultStatus={column.id}
          availableProjects={availableProjects}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => onAddTask(column.id, data)}
        />
      )}

      {/* Edit modal */}
      {editingTask && (
        <TaskModal
          mode="edit"
          boardMode={boardMode}
          task={editingTask}
          availableProjects={availableProjects}
          onClose={() => setEditingTask(null)}
          onSubmit={(data) => {
            onEditTask(editingTask.id, data);
          }}
        />
      )}
    </>
  );
}
