import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              {epic ? (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: epic.color, boxShadow: `0 0 4px ${epic.color}55` }}
                  />
                  <span
                    style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: epic.color }}
                  >
                    {epic.name}
                  </span>
                  <span style={{ fontSize: '9px', color: '#52525b' }} className="font-mono">· {group.tasks.length}</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3f3f46' }} />
                  <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52525b' }}>
                    No Epic
                  </span>
                  <span style={{ fontSize: '9px', color: '#52525b' }} className="font-mono">· {group.tasks.length}</span>
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

// Column accent: unique color per column status
const accentMap: Record<Status, { color: string; bgDim: string; glow: string }> = {
  'todo':             { color: '#8b5cf6', bgDim: 'rgba(139,92,246,0.08)', glow: 'rgba(139,92,246,0.15)' },
  'in-progress':      { color: '#3b82f6', bgDim: 'rgba(59,130,246,0.08)', glow: 'rgba(59,130,246,0.15)' },
  'waiting-approval': { color: '#f59e0b', bgDim: 'rgba(245,158,11,0.08)', glow: 'rgba(245,158,11,0.15)' },
  'done':             { color: '#10b981', bgDim: 'rgba(16,185,129,0.08)', glow: 'rgba(16,185,129,0.15)' },
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
      <div className="flex flex-col w-72 flex-shrink-0">
        {/* Column header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 rounded-t-lg"
          style={{
            background: '#111116',
            borderTop: `1px solid rgba(255,255,255,0.06)`,
            borderLeft: `2px solid ${accent.color}`,
            borderRight: `1px solid rgba(255,255,255,0.06)`,
            borderBottom: 'none',
          }}
        >
          <div className="flex items-center gap-2">
            <StatusIcon status={column.id} size={13} />
            <span
              className="text-xs font-semibold"
              style={{ color: accent.color }}
            >
              {column.title}
            </span>
            <span
              className="font-mono leading-none"
              style={{
                fontSize: '9px',
                fontWeight: 600,
                color: accent.color,
                background: accent.bgDim,
                border: `1px solid ${accent.color}33`,
                borderRadius: '4px',
                padding: '2px 5px',
              }}
            >
              {filteredTasks.length}
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="transition-colors rounded p-0.5 focus:outline-none"
            style={{ color: '#52525b' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = accent.color; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
            aria-label={`Add task to ${column.title}`}
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Droppable task list */}
        <div
          ref={setNodeRef}
          className="flex-1 min-h-[120px] rounded-b-lg p-2 transition-all duration-150"
          style={{
            background: isOver ? `rgba(99,102,241,0.04)` : '#111116',
            borderLeft: `2px solid ${isOver ? accent.color : 'rgba(255,255,255,0.04)'}`,
            borderRight: `1px solid rgba(255,255,255,0.06)`,
            borderBottom: `1px solid rgba(255,255,255,0.06)`,
            boxShadow: isOver ? `inset 0 0 24px ${accent.glow}` : 'none',
          }}
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
            <div
              className="flex items-center justify-center h-14"
              style={{ fontSize: '11px', color: '#3f3f46' }}
            >
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
