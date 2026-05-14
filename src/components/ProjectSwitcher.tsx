import { useState, useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, Check, Plus } from 'lucide-react';
import type { Project } from '../types';

interface ProjectSwitcherProps {
  currentProject: Project;
  projects: Project[];
  onSwitch: (id: string) => void;
  onOpenFolder: () => void;
}

export function ProjectSwitcher({
  currentProject,
  projects,
  onSwitch,
  onOpenFolder,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function handleSwitch(id: string) {
    onSwitch(id);
    setOpen(false);
  }

  function handleOpenFolder() {
    onOpenFolder();
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current project: ${currentProject.name}. Click to switch project.`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#e6edf3] hover:bg-[#21262d] transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
      >
        <FolderOpen size={16} className="text-[#58a6ff]" aria-hidden="true" />
        <span className="text-sm font-medium max-w-[180px] truncate">
          {currentProject.name}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#8b949e] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Projects"
          className="absolute left-0 top-full mt-1.5 w-64 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-50"
        >
          {/* Project list */}
          <ul className="py-1 max-h-64 overflow-y-auto" role="presentation">
            {projects.map((project) => (
              <li key={project.id} role="option" aria-selected={project.id === currentProject.id}>
                <button
                  onClick={() => handleSwitch(project.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#21262d] transition-colors text-left focus:outline-none focus:bg-[#21262d]"
                  aria-label={`Switch to project ${project.name}${project.id === currentProject.id ? ' (current)' : ''}`}
                >
                  <FolderOpen
                    size={14}
                    className="text-[#58a6ff] flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-[#e6edf3] text-sm truncate">
                    {project.name}
                  </span>
                  {project.id === currentProject.id && (
                    <Check
                      size={14}
                      className="text-[#58a6ff] flex-shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="border-t border-[#30363d] my-1" aria-hidden="true" />

          {/* Open another folder */}
          <div className="py-1">
            <button
              onClick={handleOpenFolder}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#21262d] transition-colors text-left focus:outline-none focus:bg-[#21262d]"
              aria-label="Open another folder as a new project"
            >
              <Plus
                size={14}
                className="text-[#8b949e] flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-[#8b949e] text-sm">Open another folder</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
