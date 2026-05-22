import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import type { Column as ColumnType, Priority, Project, Status, Task } from '../types';
import type { Epic } from '../../shared/types';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { StatusIcon } from './StatusIcon';

interface ColumnProps {
  column: ColumnType;
  filterPriority: Priority | 'all';
  epicFilter?: string | 'all';
  epics?: Epic[];
  groupByEpic?: boolean;
  boardMode?: 'epic' | 'project';
  availableProjects?: Project[];
  projectId?: string;
  agentMode?: 'auto' | 'manual';
  onAddTask: (status: Status, data: Omit<Task, 'id' | 'createdAt'>) => void;
  onEditTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

interface EpicGroupsProps {
  tasks: Task[];
  epics: Epic[];
  onOpen: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  availableProjects: Project[];
}

function EpicGroups({ tasks, epics, onOpen, onEdit, onDelete, availableProjects }: EpicGroupsProps) {
  // Build ordered groups: epics first (in definition order), then unassigned
  const epicIds = epics.map((e) => e.id);
  const groups: { epicId: string | null; tasks: Task[] }[] = [
    ...epicIds.map((id) => ({ epicId: id, tasks: tasks.filter((t) => t.epicId === id) })),
    { epicId: null, tasks: tasks.filter((t) => !t.epicId || !epicIds.includes(t.epicId)) },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const epic = group.epicId ? epics.find((e) => e.id === group.epicId) : null;
        return (
          <div key={group.epicId ?? '__none__'}>
            {/* Epic label */}
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              {epic ? (
                <>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: epic.color }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: epic.color }}>
                    {epic.name}
                  </span>
                  <span className="text-[10px] text-[#484f58]">· {group.tasks.length}</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#484f58]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58]">
                    No Epic
                  </span>
                  <span className="text-[10px] text-[#484f58]">· {group.tasks.length}</span>
                </>
              )}
            </div>
            <div className="space-y-2">
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  projects={availableProjects}
                  epics={epics}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const accentMap: Record<Status, string> = {
  todo: '#8b949e',
  'in-progress': '#58a6ff',
  'waiting-approval': '#e3b341',
  done: '#3fb950',
};

export function Column({
  column,
  filterPriority,
  epicFilter = 'all',
  epics = [],
  groupByEpic = false,
  boardMode = 'project',
  availableProjects = [],
  projectId,
  agentMode = 'auto',
  onAddTask,
  onEditTask,
  onDeleteTask,
}: ColumnProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const filteredTasks = column.tasks
    .filter((t) => filterPriority === 'all' || t.priority === filterPriority)
    .filter((t) => epicFilter === 'all' || t.epicId === epicFilter);

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
            'flex-1 min-h-[120px] rounded-b-lg border border-t-0 border-[#30363d] p-2 transition-colors',
            isOver ? 'bg-[#1c2128]' : 'bg-[#161b22]'
          )}
        >
          <SortableContext
            items={filteredTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {groupByEpic ? (
              <EpicGroups
                tasks={filteredTasks}
                epics={epics}
                onOpen={(t) => setDetailTask(t)}
                onEdit={(t) => setEditingTask(t)}
                onDelete={onDeleteTask}
                availableProjects={availableProjects}
              />
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={(t) => setDetailTask(t)}
                    onEdit={(t) => setEditingTask(t)}
                    onDelete={onDeleteTask}
                    projects={availableProjects}
                    epics={epics}
                  />
                ))}
              </div>
            )}
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
          epics={epics}
          projectId={projectId}
          agentMode={agentMode}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => onAddTask(column.id, data)}
        />
      )}

      {/* Detail modal */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          epics={epics}
          onClose={() => setDetailTask(null)}
          onEdit={(t) => { setDetailTask(null); setEditingTask(t); }}
        />
      )}

      {/* Edit modal */}
      {editingTask && (
        <TaskModal
          mode="edit"
          boardMode={boardMode}
          task={editingTask}
          availableProjects={availableProjects}
          epics={epics}
          projectId={projectId}
          agentMode={agentMode}
          onClose={() => setEditingTask(null)}
          onSubmit={(data) => {
            onEditTask(editingTask.id, data);
          }}
        />
      )}
    </>
  );
}
