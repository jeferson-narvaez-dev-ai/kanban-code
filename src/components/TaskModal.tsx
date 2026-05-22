import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Wrench, X } from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Priority, Project, Status, Task } from '../types';
import type { Epic } from '../../shared/types';

interface TaskModalProps {
  mode: 'create' | 'edit';
  boardMode?: 'epic' | 'project';
  defaultStatus?: Status;
  task?: Task;
  availableProjects?: Project[];
  epics?: Epic[];
  projectId?: string;
  agentMode?: 'auto' | 'manual';
  onClose: () => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt'>) => void;
}

export function TaskModal({
  mode,
  boardMode = 'project',
  defaultStatus = 'todo',
  task,
  availableProjects = [],
  epics = [],
  projectId,
  agentMode = 'auto',
  onClose,
  onSubmit,
}: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [tagsInput, setTagsInput] = useState((task?.tags ?? []).join(', '));
  const [formProjectId, setFormProjectId] = useState<string>(task?.projectId ?? '');
  const [epicId, setEpicId] = useState<string>(task?.epicId ?? '');
  const [role, setRole] = useState(task?.role ?? '');
  const [goal, setGoal] = useState(task?.goal ?? '');
  const [value, setValue] = useState(task?.value ?? '');
  const [titleError, setTitleError] = useState(false);
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>(mode === 'edit' ? 'preview' : 'write');

  // Chat state (only used in edit mode)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant' | 'tool'; content: string; toolName?: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

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
      projectId: formProjectId || undefined,
      epicId: epicId || undefined,
      role: role.trim() || undefined,
      goal: goal.trim() || undefined,
      value: value.trim() || undefined,
    });
    onClose();
  }

  async function refreshTaskFields() {
    if (!projectId || !task?.id) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`);
      if (!res.ok) return;
      const updated = await res.json() as { title?: string; description?: string; priority?: string; role?: string; goal?: string; value?: string; epicId?: string };
      if (updated.title) setTitle(updated.title);
      if (updated.description !== undefined) setDescription(updated.description ?? '');
      if (updated.priority) setPriority(updated.priority as Priority);
      if (updated.role !== undefined) setRole(updated.role ?? '');
      if (updated.goal !== undefined) setGoal(updated.goal ?? '');
      if (updated.value !== undefined) setValue(updated.value ?? '');
      if (updated.epicId !== undefined) setEpicId(updated.epicId ?? '');
    } catch { /* ignore */ }
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatLoading(true);

    const userMsg = { role: 'user' as const, content: text };
    const newMessages = [...chatMessages.filter(m => m.role !== 'tool'), userMsg];
    setChatMessages(prev => [...prev, userMsg]);

    // Build context: current form state as task JSON
    const taskContext = JSON.stringify({
      id: task!.id,
      title,
      description,
      priority,
      role,
      goal,
      value,
      epicId: epicId || undefined,
    }, null, 2);

    const systemMessage = {
      role: 'user' as const,
      content: `[SYSTEM CONTEXT — do not repeat this to the user]
You are refining a user story. Current task state:
\`\`\`json
${taskContext}
\`\`\`

To update the task fields, call:
PATCH http://localhost:3001/api/projects/${projectId}/tasks/${task!.id}
Body: { "title": "...", "description": "...", "role": "...", "goal": "...", "value": "...", "priority": "...", "contextId": "${projectId}" }

Only include fields you want to change. After updating, briefly confirm what changed.
Always respond in the same language as the user.`
    };

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [systemMessage, ...newMessages.filter(m => m.role !== 'tool').map(m => ({ role: m.role, content: m.content }))],
          projectId,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const lines = block.split('\n');
          let event = 'message', data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data = line.slice(5).trim();
          }
          if (!data) continue;
          if (event === 'tool_call') {
            const p = JSON.parse(data) as { name: string; input: Record<string, unknown> };
            setChatMessages(prev => [...prev, { role: 'tool', content: '', toolName: p.name }]);
          } else if (event === 'message') {
            const p = JSON.parse(data) as { content: string };
            setChatMessages(prev => [...prev, { role: 'assistant', content: p.content }]);
            // After agent responds, refresh form fields from the API
            void refreshTaskFields();
          } else if (event === 'done') {
            setChatLoading(false);
          } else if (event === 'error') {
            setChatLoading(false);
          }
        }
      }
    } catch {
      setChatLoading(false);
    } finally {
      setChatLoading(false);
    }
  }

  const showChat = mode === 'edit' && Boolean(projectId) && Boolean(task?.id) && agentMode !== 'manual';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Create task' : 'Edit task'}
    >
      <div className={clsx(
        'w-full mx-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl',
        showChat ? 'max-w-6xl flex max-h-[90vh]' : 'max-w-md max-h-[90vh]'
      )}>
        {/* Form column */}
        <div className={clsx('flex flex-col min-h-0', showChat ? 'flex-1 min-w-0' : '')}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
            <div className="flex items-center gap-2">
              <h2 className="text-[#e6edf3] font-semibold text-base">
                {mode === 'create' ? 'New Task' : 'Edit Task'}
              </h2>
              {mode === 'edit' && task?.id && (
                <span className="text-xs font-mono text-[#8b949e] bg-[#21262d] border border-[#30363d] rounded px-1.5 py-0.5">
                  {task.id}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
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

            {/* Description — write/preview tabs */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#8b949e]">
                  Description
                </label>
                <div className="flex rounded-md overflow-hidden border border-[#30363d] text-[10px]">
                  {(['write', 'preview'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDescriptionTab(tab)}
                      className={clsx(
                        'px-2.5 py-0.5 capitalize transition-colors',
                        descriptionTab === tab
                          ? 'bg-[#21262d] text-[#e6edf3]'
                          : 'text-[#8b949e] hover:text-[#e6edf3]'
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {descriptionTab === 'write' ? (
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Supports markdown..."
                  rows={6}
                  className="w-full bg-[#0d1117] text-[#e6edf3] text-sm border border-[#30363d] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#58a6ff] focus:border-[#58a6ff] placeholder-[#484f58] resize-y font-mono"
                />
              ) : (
                <div className="min-h-[120px] max-h-[300px] overflow-y-auto bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3]">
                  {/* User story callout */}
                  {(role || goal || value) && (
                    <div className="bg-[#0d2d6e]/30 border border-[#58a6ff]/30 rounded-md px-3 py-2 mb-3 text-sm leading-relaxed">
                      {role && <>As a <strong className="text-[#a5d6ff]">{role}</strong>, </>}
                      {goal && <>I want to <strong className="text-[#a5d6ff]">{goal}</strong>, </>}
                      {value && <>so that <strong className="text-[#a5d6ff]">{value}</strong>.</>}
                    </div>
                  )}
                  {description?.trim() ? (
                    <div className="prose prose-invert prose-sm max-w-none
                      prose-headings:text-[#e6edf3] prose-headings:font-semibold prose-headings:border-b prose-headings:border-[#30363d] prose-headings:pb-1
                      prose-p:text-[#c9d1d9] prose-p:leading-relaxed
                      prose-a:text-[#58a6ff] prose-a:no-underline hover:prose-a:underline
                      prose-strong:text-[#e6edf3]
                      prose-code:text-[#f0883e] prose-code:bg-[#21262d] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-[#30363d] prose-pre:rounded-md prose-pre:text-xs
                      prose-li:text-[#c9d1d9]
                      prose-blockquote:border-l-[#30363d] prose-blockquote:text-[#8b949e]
                      prose-hr:border-[#30363d]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-[#484f58] italic text-xs">Nothing to preview</span>
                  )}
                </div>
              )}
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

            {/* Epic */}
            {epics.length > 0 && (
              <div>
                <label
                  htmlFor="task-epic"
                  className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
                >
                  Epic
                </label>
                <select
                  id="task-epic"
                  value={epicId}
                  onChange={(e) => setEpicId(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors appearance-none cursor-pointer"
                  aria-label="Linked epic"
                >
                  <option value="">None</option>
                  {epics.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* User Story */}
            <div>
              <p className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider">
                User Story
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#484f58] w-16 flex-shrink-0">As a</span>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="developer"
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
                    aria-label="Role"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#484f58] w-16 flex-shrink-0">I want to</span>
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="configure authentication"
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
                    aria-label="Goal"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#484f58] w-16 flex-shrink-0">So that</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="users can log in securely"
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
                    aria-label="Value"
                  />
                </div>
              </div>
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
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
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

        {/* Refinement chat panel (edit mode only) */}
        {showChat && (
          <div className="w-[460px] flex-shrink-0 flex flex-col border-l border-[#30363d] overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363d] bg-[#0d1117]">
              <Bot size={14} className="text-[#58a6ff]" />
              <span className="text-xs font-semibold text-[#e6edf3]">Refine with Agent</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {chatMessages.length === 0 && (
                <p className="text-xs text-[#484f58] text-center pt-4">
                  Ask the agent to refine this story — it will update the fields automatically.
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'tool' ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2d2a00] border border-[#4d4400] text-[#e3b341] text-[10px]">
                      <Wrench size={10} />
                      <span className="font-medium">{msg.toolName}</span>
                    </div>
                  ) : (
                    <div className={clsx(
                      'max-w-[90%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed break-words overflow-x-hidden',
                      msg.role === 'user'
                        ? 'bg-[#1f6feb] text-white rounded-br-sm'
                        : 'bg-[#21262d] text-[#e6edf3] border border-[#30363d] rounded-bl-sm'
                    )}>
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          code: ({ children }) => <code className="bg-[#161b22] px-1 rounded text-[10px] font-mono break-all">{children}</code>,
                        }}>{msg.content}</ReactMarkdown>
                      ) : msg.content}
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-2.5 py-1.5 rounded-xl rounded-bl-sm bg-[#21262d] border border-[#30363d]">
                    <span className="flex gap-1 items-center h-3">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1 h-1 rounded-full bg-[#8b949e] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t border-[#30363d] bg-[#0d1117]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChatMessage(); } }}
                  disabled={chatLoading}
                  placeholder="Refine this story..."
                  className="flex-1 bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:ring-1 focus:ring-[#58a6ff] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void sendChatMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1f6feb] text-white disabled:opacity-40 hover:bg-[#388bfd] transition-colors"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
