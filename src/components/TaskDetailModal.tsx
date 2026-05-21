import { X, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Task } from '../types';
import type { Epic } from '../../shared/types';
import { PriorityBadge } from './PriorityBadge';
import { StatusIcon } from './StatusIcon';

interface Props {
  task: Task;
  epics?: Epic[];
  onClose: () => void;
  onEdit: (task: Task) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TaskDetailModal({ task, epics = [], onClose, onEdit }: Props) {
  const linkedEpic = task.epicId ? epics.find((e) => e.id === task.epicId) : undefined;
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      <div className="w-full max-w-2xl mx-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#30363d] gap-3 flex-shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 flex-shrink-0">
              <StatusIcon status={task.status} size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-[#484f58] mb-0.5">{task.id}</p>
              <h2 className="text-[#e6edf3] font-semibold text-base leading-snug break-words">
                {task.title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { onClose(); onEdit(task); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#8b949e] hover:text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
            >
              <Pencil size={11} />
              Edit
            </button>
            <button
              onClick={onClose}
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-[#30363d] flex-shrink-0 flex-wrap">
          <PriorityBadge priority={task.priority} />
          {linkedEpic ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${linkedEpic.color}22`,
                color: linkedEpic.color,
                border: `1px solid ${linkedEpic.color}44`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: linkedEpic.color }}
                aria-hidden="true"
              />
              {linkedEpic.name}
            </span>
          ) : task.epicId ? (
            <span className="text-xs text-[#8b949e] font-mono">
              epic: {task.epicId}
            </span>
          ) : null}
          {task.tags?.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] bg-[#0d1117] text-[#8b949e] border border-[#30363d]"
            >
              {tag}
            </span>
          ))}
          <span className="ml-auto text-xs text-[#484f58]">
            Created {formatDate(task.createdAt)}
            {task.updatedAt && ` · Updated ${formatDate(task.updatedAt)}`}
          </span>
        </div>

        {/* User story callout */}
        {(task.role || task.goal || task.value) && (
          <div className="px-5 py-3 border-b border-[#30363d] flex-shrink-0">
            <div className="bg-[#0d2d6e]/30 border border-[#58a6ff]/30 rounded-md px-4 py-3">
              <p className="text-sm text-[#79c0ff] leading-relaxed">
                {task.role && <>As a <strong className="text-[#a5d6ff]">{task.role}</strong>, </>}
                {task.goal && <>I want to <strong className="text-[#a5d6ff]">{task.goal}</strong></>}
                {task.value && <>, so that <strong className="text-[#a5d6ff]">{task.value}</strong></>}
                {(task.role || task.goal || task.value) ? '.' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Description body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {task.description ? (
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-[#e6edf3] prose-headings:font-semibold prose-headings:border-b prose-headings:border-[#30363d] prose-headings:pb-1
              prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
              prose-p:text-[#c9d1d9] prose-p:leading-relaxed
              prose-a:text-[#58a6ff] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-[#e6edf3]
              prose-code:text-[#f0883e] prose-code:bg-[#21262d] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-[#30363d] prose-pre:rounded-md prose-pre:text-xs
              prose-table:text-sm prose-table:border-collapse
              prose-th:text-[#e6edf3] prose-th:bg-[#0d1117] prose-th:border prose-th:border-[#30363d] prose-th:px-3 prose-th:py-1.5
              prose-td:text-[#c9d1d9] prose-td:border prose-td:border-[#30363d] prose-td:px-3 prose-td:py-1.5
              prose-li:text-[#c9d1d9]
              prose-blockquote:border-l-[#30363d] prose-blockquote:text-[#8b949e]
              prose-hr:border-[#30363d]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.description}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-[#484f58] italic">No description.</p>
          )}
        </div>
      </div>
    </div>
  );
}
