import { useEffect, useRef, useState } from 'react';
import { X, FolderOpen } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function CreateProjectModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError(true); return; }
    onCreate(name.trim());
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-[#58a6ff]" />
            <h2 className="text-sm font-semibold text-[#e6edf3]">New Project</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-xs font-medium text-[#8b949e] mb-1.5">
              Project name
            </label>
            <input
              ref={inputRef}
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(false); }}
              placeholder="my-project"
              className={`w-full bg-[#0d1117] border rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] outline-none focus:ring-2 focus:ring-[#58a6ff] transition-colors ${
                nameError ? 'border-[#f85149]' : 'border-[#30363d]'
              }`}
            />
            {nameError && (
              <p className="text-[#f85149] text-xs mt-1">Name is required</p>
            )}
            {slug && slug !== name && (
              <p className="text-[#484f58] text-xs mt-1">
                Workspace slug: <span className="font-mono text-[#8b949e]">{slug}</span>
              </p>
            )}
          </div>

          <p className="text-[#484f58] text-xs">
            Tasks will be stored in{' '}
            <span className="font-mono text-[#8b949e]">~/.kanban/{slug || 'project-name'}/</span>
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm font-medium bg-[#238636] hover:bg-[#2ea043] text-white rounded-md transition-colors"
            >
              Create project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
