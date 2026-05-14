import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Priority, Project, Status, Task } from '../types';

interface TaskModalProps {
  mode: 'create' | 'edit';
  boardMode?: 'epic' | 'project';
  defaultStatus?: Status;
  task?: Task;
  availableProjects?: Project[];
  onClose: () => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt'>) => void;
}

export function TaskModal({
  mode,
  boardMode = 'project',
  defaultStatus = 'todo',
  task,
  availableProjects = [],
  onClose,
  onSubmit,
}: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [tagsInput, setTagsInput] = useState((task?.tags ?? []).join(', '));
  const [projectId, setProjectId] = useState<string>(task?.projectId ?? '');
  const [titleError, setTitleError] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status: task?.status ?? defaultStatus,
      tags: tags.length ? tags : undefined,
      projectId: projectId || undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Create task' : 'Edit task'}
    >
      <div className="w-full max-w-md mx-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <h2 className="text-[#e6edf3] font-semibold text-base">
            {mode === 'create' ? 'New Task' : 'Edit Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="task-title"
              className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
            >
              Title <span className="text-[#f85149]">*</span>
            </label>
            <input
              ref={titleRef}
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) setTitleError(false);
              }}
              placeholder="Task title..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
              aria-required="true"
              aria-invalid={titleError}
            />
            {titleError && (
              <p className="text-[#f85149] text-xs mt-1" role="alert">
                Title is required.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="task-description"
              className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
            >
              Description
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label
              htmlFor="task-priority"
              className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
            >
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors appearance-none cursor-pointer"
              aria-label="Task priority"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Project (epic mode only) */}
          {boardMode === 'epic' && (
            <div>
              <label
                htmlFor="task-project"
                className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
              >
                Project
              </label>
              <select
                id="task-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors appearance-none cursor-pointer"
                aria-label="Linked project"
              >
                <option value="">None (general)</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          <div>
            <label
              htmlFor="task-tags"
              className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
            >
              Tags
            </label>
            <input
              id="task-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="frontend, backend, bug..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
            />
            <p className="text-[#484f58] text-xs mt-1">Comma-separated</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#8b949e] hover:text-[#e6edf3] bg-transparent border border-[#30363d] hover:border-[#8b949e] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043]/50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#3fb950]"
            >
              {mode === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
