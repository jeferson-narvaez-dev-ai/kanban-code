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

// Shared input style for form fields
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#09090b',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  padding: '7px 10px',
  fontSize: '13px',
  color: '#f4f4f5',
  outline: 'none',
  transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#71717a',
  marginBottom: '6px',
};

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  );
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

  const focusStyles = `
    focus:border-[#6366f1] focus:ring-0
  `;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Create task' : 'Edit task'}
    >
      <div
        className={clsx(
          'w-full mx-4',
          showChat ? 'max-w-5xl flex max-h-[90vh]' : 'max-w-md flex flex-col max-h-[90vh]'
        )}
        style={{
          background: '#111116',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        {/* Form column */}
        <div className={clsx('flex flex-col min-h-0 overflow-hidden', showChat ? 'flex-1 min-w-0' : 'flex-1')}>
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2.5">
              <h2 style={{ color: '#f4f4f5', fontWeight: 600, fontSize: '14px' }}>
                {mode === 'create' ? 'New Task' : 'Edit Task'}
              </h2>
              {mode === 'edit' && task?.id && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: '10px',
                    color: '#e3b341',
                    background: 'rgba(227,179,65,0.08)',
                    border: '1px solid rgba(227,179,65,0.2)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                  }}
                >
                  {task.id}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="transition-colors rounded p-0.5 focus:outline-none"
              style={{ color: '#52525b' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Title */}
            <FormField label="Title" required>
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
                className={focusStyles}
                style={{
                  ...inputStyle,
                  ...(titleError ? { borderColor: 'rgba(239,68,68,0.5)' } : {}),
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#6366f1';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = titleError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
                }}
                aria-required="true"
                aria-invalid={titleError}
              />
              {titleError && (
                <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }} role="alert">
                  Title is required.
                </p>
              )}
            </FormField>

            {/* Description — write/preview tabs */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                <label style={labelStyle}>Description</label>
                <div
                  className="flex overflow-hidden"
                  style={{
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {(['write', 'preview'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDescriptionTab(tab)}
                      style={{
                        fontSize: '10px',
                        padding: '3px 10px',
                        textTransform: 'capitalize',
                        fontWeight: 500,
                        transition: 'all 0.1s ease',
                        ...(descriptionTab === tab
                          ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8' }
                          : { background: 'transparent', color: '#71717a' }),
                      }}
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
                  style={{
                    ...inputStyle,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px',
                    resize: 'vertical',
                    lineHeight: 1.6,
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#6366f1';
                    (e.currentTarget as HTMLTextAreaElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLTextAreaElement).style.boxShadow = 'none';
                  }}
                />
              ) : (
                <div
                  className="overflow-y-auto"
                  style={{
                    minHeight: '120px',
                    maxHeight: '280px',
                    background: '#09090b',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '13px',
                  }}
                >
                  {/* User story callout */}
                  {(role || goal || value) && (
                    <div
                      className="rounded-md mb-3"
                      style={{
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        padding: '10px 12px',
                        fontSize: '13px',
                        lineHeight: 1.6,
                        color: '#a1a1aa',
                      }}
                    >
                      {role && <>As a <strong style={{ color: '#818cf8' }}>{role}</strong>, </>}
                      {goal && <>I want to <strong style={{ color: '#818cf8' }}>{goal}</strong>, </>}
                      {value && <>so that <strong style={{ color: '#818cf8' }}>{value}</strong>.</>}
                    </div>
                  )}
                  {description?.trim() ? (
                    <div className="prose prose-invert prose-sm max-w-none
                      prose-headings:text-[#f4f4f5] prose-headings:font-semibold prose-headings:border-b prose-headings:border-white/5 prose-headings:pb-1
                      prose-p:text-[#a1a1aa] prose-p:leading-relaxed
                      prose-a:text-[#818cf8] prose-a:no-underline hover:prose-a:underline
                      prose-strong:text-[#f4f4f5]
                      prose-code:text-[#f59e0b] prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-code:font-mono
                      prose-pre:bg-[#09090b] prose-pre:border prose-pre:border-white/6 prose-pre:rounded-md prose-pre:text-xs
                      prose-li:text-[#a1a1aa]
                      prose-blockquote:border-l-white/10 prose-blockquote:text-[#71717a]
                      prose-hr:border-white/6">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                    </div>
                  ) : (
                    <span style={{ color: '#3f3f46', fontStyle: 'italic', fontSize: '12px' }}>Nothing to preview</span>
                  )}
                </div>
              )}
            </div>

            {/* Priority */}
            <FormField label="Priority">
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLSelectElement).style.borderColor = '#6366f1';
                  (e.currentTarget as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLSelectElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLSelectElement).style.boxShadow = 'none';
                }}
                aria-label="Task priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </FormField>

            {/* Epic */}
            {epics.length > 0 && (
              <FormField label="Epic">
                <select
                  id="task-epic"
                  value={epicId}
                  onChange={(e) => setEpicId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLSelectElement).style.borderColor = '#6366f1';
                    (e.currentTarget as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLSelectElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLSelectElement).style.boxShadow = 'none';
                  }}
                  aria-label="Linked epic"
                >
                  <option value="">None</option>
                  {epics.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {/* User Story */}
            <div>
              <p style={labelStyle}>User Story</p>
              <div className="space-y-2">
                {[
                  { prefix: 'As a', val: role, set: setRole, placeholder: 'developer', label: 'Role' },
                  { prefix: 'I want to', val: goal, set: setGoal, placeholder: 'configure authentication', label: 'Goal' },
                  { prefix: 'So that', val: value, set: setValue, placeholder: 'users can log in securely', label: 'Value' },
                ].map(({ prefix, val, set, placeholder, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      style={{ fontSize: '11px', color: '#52525b', width: '54px', flexShrink: 0 }}
                    >
                      {prefix}
                    </span>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      style={{ ...inputStyle, padding: '5px 10px', fontSize: '12px' }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLInputElement).style.borderColor = '#6366f1';
                        (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
                        (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
                      }}
                      aria-label={label}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Project (epic mode only) */}
            {boardMode === 'epic' && (
              <FormField label="Project">
                <select
                  id="task-project"
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLSelectElement).style.borderColor = '#6366f1';
                    (e.currentTarget as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLSelectElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLSelectElement).style.boxShadow = 'none';
                  }}
                  aria-label="Linked project"
                >
                  <option value="">None (general)</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {/* Tags */}
            <FormField label="Tags">
              <input
                id="task-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="frontend, backend, bug..."
                style={inputStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#6366f1';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
                }}
              />
              <p style={{ color: '#52525b', fontSize: '10px', marginTop: '4px' }}>Comma-separated</p>
            </FormField>

            {/* Actions */}
            <div
              className="flex items-center justify-end gap-2 pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="transition-colors focus:outline-none"
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '7px 14px',
                  borderRadius: '6px',
                  color: '#71717a',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#71717a';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="transition-colors focus:outline-none"
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '7px 14px',
                  borderRadius: '6px',
                  color: 'white',
                  background: '#6366f1',
                  border: '1px solid rgba(99,102,241,0.5)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#818cf8';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#6366f1';
                }}
              >
                {mode === 'create' ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Refinement chat panel (edit mode only) */}
        {showChat && (
          <div
            className="w-[440px] flex-shrink-0 flex flex-col overflow-hidden"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Chat header */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: '#0d0d12',
              }}
            >
              <Bot size={13} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#f4f4f5' }}>Refine with Agent</span>
              <span
                className="ml-auto font-mono"
                style={{
                  fontSize: '9px',
                  color: '#52525b',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  borderRadius: '4px',
                  padding: '1px 5px',
                }}
              >
                AI
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0" style={{ background: '#0d0d12' }}>
              {chatMessages.length === 0 && (
                <p style={{ fontSize: '11px', color: '#3f3f46', textAlign: 'center', paddingTop: '16px' }}>
                  Ask the agent to refine this story — it will update the fields automatically.
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'tool' ? (
                    <div
                      className="flex items-center gap-1.5"
                      style={{
                        fontSize: '10px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        color: '#f59e0b',
                      }}
                    >
                      <Wrench size={9} />
                      <span className="font-medium font-mono">{msg.toolName}</span>
                    </div>
                  ) : (
                    <div
                      className="max-w-[90%] break-words overflow-x-hidden"
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.55,
                        padding: '7px 11px',
                        borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                        ...(msg.role === 'user'
                          ? {
                              background: '#6366f1',
                              color: 'white',
                            }
                          : {
                              background: '#18181f',
                              color: '#d4d4d8',
                              border: '1px solid rgba(255,255,255,0.07)',
                            }),
                      }}
                    >
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          code: ({ children }) => (
                            <code
                              className="font-mono break-all"
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                fontSize: '10px',
                              }}
                            >
                              {children}
                            </code>
                          ),
                        }}>{msg.content}</ReactMarkdown>
                      ) : msg.content}
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px 10px 10px 3px',
                      background: '#18181f',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span className="flex gap-1 items-center h-3">
                      {[0, 150, 300].map(d => (
                        <span
                          key={d}
                          className="w-1 h-1 rounded-full animate-bounce"
                          style={{ background: '#71717a', animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div
              className="px-3 py-2.5"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.07)',
                background: '#0d0d12',
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChatMessage(); } }}
                  disabled={chatLoading}
                  placeholder="Refine this story..."
                  style={{
                    flex: 1,
                    background: '#18181f',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    color: '#f4f4f5',
                    outline: 'none',
                    opacity: chatLoading ? 0.5 : 1,
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLInputElement).style.borderColor = '#6366f1';
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.07)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => void sendChatMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="flex items-center justify-center transition-colors focus:outline-none"
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    background: '#6366f1',
                    color: 'white',
                    opacity: chatLoading || !chatInput.trim() ? 0.4 : 1,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!chatLoading && chatInput.trim()) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#818cf8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#6366f1';
                  }}
                >
                  <Send size={11} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
