import { FolderOpen } from 'lucide-react';
import type { Project } from '../types';

interface ProjectPickerProps {
  projects: Project[];
  onOpen: () => void;
  onSwitch: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ProjectPicker({ projects, onOpen, onSwitch }: ProjectPickerProps) {
  return (
    <div
      className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4"
      role="main"
    >
      {/* Card */}
      <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl p-8 flex flex-col items-center gap-6 shadow-2xl">
        {/* Icon */}
        <FolderOpen
          size={56}
          className="text-[#58a6ff]"
          aria-hidden="true"
        />

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[#e6edf3] text-2xl font-semibold tracking-tight mb-2">
            Open a Project
          </h1>
          <p className="text-[#8b949e] text-sm leading-relaxed">
            Select a local folder to start tracking tasks
          </p>
        </div>

        {/* Open Folder Button */}
        <button
          onClick={onOpen}
          className="w-full py-2.5 px-5 bg-[#238636] hover:bg-[#2ea043] active:bg-[#238636] text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] focus:ring-offset-2 focus:ring-offset-[#161b22]"
          aria-label="Open a folder to create a new project"
        >
          Open Folder
        </button>

        {/* Recent Projects */}
        {projects.length > 0 && (
          <div className="w-full mt-2">
            <div className="text-[#8b949e] text-xs font-medium uppercase tracking-widest mb-3">
              Recent Projects
            </div>
            <ul className="flex flex-col gap-1" role="list" aria-label="Recent projects">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => onSwitch(project.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#21262d] transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
                    aria-label={`Open project ${project.name}`}
                  >
                    <FolderOpen
                      size={16}
                      className="text-[#58a6ff] flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-[#e6edf3] text-sm truncate">
                      {project.name}
                    </span>
                    <span className="text-[#8b949e] text-xs flex-shrink-0">
                      {formatDate(project.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
