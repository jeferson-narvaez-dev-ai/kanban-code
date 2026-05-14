import { useEffect, useRef, useState } from 'react';
import { X, Folder } from 'lucide-react';
import clsx from 'clsx';

const PRESET_COLORS = [
  { value: '#a371f7', label: 'Purple' },
  { value: '#58a6ff', label: 'Blue' },
  { value: '#3fb950', label: 'Green' },
  { value: '#f0883e', label: 'Orange' },
  { value: '#f85149', label: 'Red' },
  { value: '#d29922', label: 'Yellow' },
];

interface CreateEpicModalProps {
  onClose: () => void;
  onCreate: (name: string, description: string | undefined, color: string, path?: string) => void;
}

export function CreateEpicModal({ onClose, onCreate }: CreateEpicModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0].value);
  const [path, setPath] = useState('');
  const [nameError, setNameError] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    onCreate(name.trim(), description.trim() || undefined, color, path.trim() || undefined);
    onClose();
  }

  async function handleBrowse() {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker();
        setPath(`~/${handle.name}`);
      } catch {
        // user cancelled
      }
    } else {
      const folderName = window.prompt('Enter folder name:');
      if (folderName) {
        setPath(`~/${folderName}`);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Create epic"
    >
      <div className="w-full max-w-md mx-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <h2 className="text-[#e6edf3] font-semibold text-base">New Epic</h2>
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
          {/* Name */}
          <div>
            <label
              htmlFor="epic-name"
              className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
            >
              Name <span className="text-[#f85149]">*</span>
            </label>
            <input
              ref={nameRef}
              id="epic-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError(false);
              }}
              placeholder="Epic name..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
              aria-required="true"
              aria-invalid={nameError}
            />
            {nameError && (
              <p className="text-[#f85149] text-xs mt-1" role="alert">
                Name is required.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="epic-description"
              className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
            >
              Description
            </label>
            <textarea
              id="epic-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors resize-none"
            />
          </div>

          {/* Color picker */}
          <div>
            <span className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider">
              Color
            </span>
            <div className="flex items-center gap-2" role="group" aria-label="Epic color">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={clsx(
                    'w-7 h-7 rounded-full border-2 transition-transform focus:outline-none focus:ring-2 focus:ring-[#58a6ff] focus:ring-offset-2 focus:ring-offset-[#161b22]',
                    color === c.value
                      ? 'border-[#e6edf3] scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c.value }}
                  aria-label={`Color: ${c.label}`}
                  aria-pressed={color === c.value}
                />
              ))}
            </div>
          </div>

          {/* Local folder */}
          <div>
            <label
              htmlFor="epic-path"
              className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider"
            >
              Local Folder
            </label>
            <div className="flex items-center gap-2">
              <input
                id="epic-path"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="~/path/to/epic"
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8b949e] hover:text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] hover:border-[#8b949e] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] flex-shrink-0"
                aria-label="Browse for folder"
                title="Browse for folder"
              >
                <Folder size={14} aria-hidden="true" />
                Browse
              </button>
            </div>
            <p className="text-[#484f58] text-xs mt-1">(optional) Terminal opens here when in epic mode</p>
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
              Create Epic
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
