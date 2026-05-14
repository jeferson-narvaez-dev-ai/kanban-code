import { useState } from 'react';
import { FolderOpen, Plus, Layers, TerminalSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-store';
import clsx from 'clsx';
import type { Epic, Project } from '../types';
import { CreateEpicModal } from './CreateEpicModal';
import { TerminalPanel } from './TerminalPanel';
import { uiStore, toggleTerminal } from '../store/uiStore';
import { getTasks } from '../lib/api';

interface HomeScreenProps {
  epics: Epic[];
  projects: Project[];
  onNavigateEpic: (epicId: string) => void;
  onNavigateProject: (projectId: string) => void;
  onCreateEpic: (name: string, description: string | undefined, color: string, path?: string) => void;
  onOpenFolder: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function EpicCard({
  epic,
  onClick,
}: {
  epic: Epic;
  onClick: () => void;
}) {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'epic', epic.id],
    queryFn: () => getTasks('epic', epic.id),
    refetchInterval: 3000,
  });
  const taskCount = tasks.length;

  return (
    <button
      onClick={onClick}
      className="text-left bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden hover:bg-[#1c2128] hover:border-[#444c56] transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] group"
      aria-label={`Open epic: ${epic.name}`}
    >
      {/* Color accent bar */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: epic.color }}
        aria-hidden="true"
      />
      <div className="p-4">
        <div className="flex items-start gap-2.5">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
            style={{ backgroundColor: epic.color }}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#e6edf3] truncate group-hover:text-white transition-colors">
              {epic.name}
            </p>
            {epic.description && (
              <p className="text-xs text-[#8b949e] mt-0.5 line-clamp-2 leading-relaxed">
                {epic.description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[10px] text-[#8b949e]">
          <span>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
          <span>·</span>
          <span>{epic.projectIds.length} {epic.projectIds.length === 1 ? 'project' : 'projects'}</span>
          <span className="ml-auto">{formatDate(epic.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

function ProjectCard({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'project', project.id],
    queryFn: () => getTasks('project', project.id),
    refetchInterval: 3000,
  });
  const taskCount = tasks.length;

  return (
    <button
      onClick={onClick}
      className="text-left bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:bg-[#1c2128] hover:border-[#444c56] transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] group"
      aria-label={`Open project: ${project.name}`}
    >
      <div className="flex items-center gap-2.5">
        <FolderOpen
          size={16}
          className="text-[#58a6ff] flex-shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-[#e6edf3] truncate group-hover:text-white transition-colors">
          {project.name}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-[#8b949e]">
        <span>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
        <span>{formatDate(project.createdAt)}</span>
      </div>
    </button>
  );
}

export function HomeScreen({
  epics,
  projects,
  onNavigateEpic,
  onNavigateProject,
  onCreateEpic,
  onOpenFolder,
}: HomeScreenProps) {
  const { showTerminal } = useStore(uiStore);
  const [showCreateEpic, setShowCreateEpic] = useState(false);

  function handleCreateEpic(name: string, description: string | undefined, color: string, path?: string) {
    onCreateEpic(name, description, color, path);
    setShowCreateEpic(false);
  }

  return (
    <div className="h-screen bg-[#0d1117] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#30363d] bg-[#161b22] px-6 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers size={22} className="text-[#58a6ff]" aria-hidden="true" />
            <span className="text-[#e6edf3] font-semibold text-lg tracking-tight">Kanban</span>
          </div>
          {/* Terminal toggle */}
          <button
            onClick={toggleTerminal}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]',
              showTerminal
                ? 'bg-[#58a6ff] text-[#0d1117] border-[#58a6ff]'
                : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] border-[#30363d] hover:border-[#8b949e]'
            )}
            aria-pressed={showTerminal}
            aria-label="Toggle terminal"
            title="Toggle terminal"
          >
            <TerminalSquare size={13} aria-hidden="true" />
            <span>Terminal</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Epics section */}
          <section aria-labelledby="epics-heading">
            <div className="flex items-center justify-between mb-4">
              <h2
                id="epics-heading"
                className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest"
              >
                Epics
              </h2>
              <button
                onClick={() => setShowCreateEpic(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] hover:border-[#8b949e] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
                aria-label="Create new epic"
              >
                <Plus size={13} aria-hidden="true" />
                New Epic
              </button>
            </div>

            {epics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-[#161b22] border border-[#30363d] rounded-xl text-center">
                <Layers size={36} className="text-[#30363d] mb-3" aria-hidden="true" />
                <p className="text-[#8b949e] text-sm">No epics yet.</p>
                <p className="text-[#484f58] text-xs mt-1">Create one to group related tasks across projects.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {epics.map((epic) => (
                  <EpicCard
                    key={epic.id}
                    epic={epic}
                    onClick={() => onNavigateEpic(epic.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Projects section */}
          <section aria-labelledby="projects-heading">
            <div className="flex items-center justify-between mb-4">
              <h2
                id="projects-heading"
                className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest"
              >
                Projects
              </h2>
              <button
                onClick={onOpenFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] hover:border-[#8b949e] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
                aria-label="Open a folder to add a project"
              >
                <Plus size={13} aria-hidden="true" />
                Open Folder
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-[#161b22] border border-[#30363d] rounded-xl text-center">
                <FolderOpen size={36} className="text-[#30363d] mb-3" aria-hidden="true" />
                <p className="text-[#8b949e] text-sm">No projects yet.</p>
                <p className="text-[#484f58] text-xs mt-1">Open a local folder to start tracking tasks.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => onNavigateProject(project.id)}
                  />
                ))}
              </div>
            )}
          </section>

        </div>
      </main>

      {showCreateEpic && (
        <CreateEpicModal
          onClose={() => setShowCreateEpic(false)}
          onCreate={handleCreateEpic}
        />
      )}

      {/* Terminal panel */}
      {showTerminal && <TerminalPanel onClose={toggleTerminal} />}
    </div>
  );
}
