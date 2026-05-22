import { useState } from 'react';
import { FolderOpen, Plus, Layers, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Epic, Project } from '../types';
import { CreateEpicModal } from './CreateEpicModal';
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
      className="text-left rounded-lg overflow-hidden transition-all duration-150 focus:outline-none group"
      style={{
        background: '#111116',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#18181f';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.09)';
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#111116';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
      }}
      aria-label={`Open epic: ${epic.name}`}
    >
      {/* Color accent bar */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: epic.color, opacity: 0.85 }}
        aria-hidden="true"
      />
      <div className="p-4">
        <div className="flex items-start gap-2.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
            style={{ backgroundColor: epic.color, boxShadow: `0 0 8px ${epic.color}55` }}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#f4f4f5] truncate">
              {epic.name}
            </p>
            {epic.description && (
              <p className="text-xs text-[#71717a] mt-0.5 line-clamp-2 leading-relaxed">
                {epic.description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3" style={{ fontSize: '10px', color: '#71717a' }}>
          <span className="font-mono">{taskCount}</span>
          <span className="text-[#3f3f46]">{taskCount === 1 ? 'task' : 'tasks'}</span>
          <span className="text-[#3f3f46]">·</span>
          <span className="font-mono">{epic.projectIds.length}</span>
          <span className="text-[#3f3f46]">{epic.projectIds.length === 1 ? 'project' : 'projects'}</span>
          <span className="ml-auto text-[#52525b]">{formatDate(epic.createdAt)}</span>
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
      className="text-left rounded-lg p-4 transition-all duration-150 focus:outline-none group"
      style={{
        background: '#111116',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#18181f';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.09)';
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#111116';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
      }}
      aria-label={`Open project: ${project.name}`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <FolderOpen size={13} style={{ color: '#818cf8' }} aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-[#f4f4f5] truncate">
          {project.name}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between" style={{ fontSize: '10px', color: '#71717a' }}>
        <span>
          <span className="font-mono text-[#a1a1aa]">{taskCount}</span>
          <span className="ml-1 text-[#52525b]">{taskCount === 1 ? 'task' : 'tasks'}</span>
        </span>
        <span className="text-[#52525b]">{formatDate(project.createdAt)}</span>
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
  const [showCreateEpic, setShowCreateEpic] = useState(false);

  function handleCreateEpic(name: string, description: string | undefined, color: string, path?: string) {
    onCreateEpic(name, description, color, path);
    setShowCreateEpic(false);
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#09090b' }}>
      {/* Header */}
      <header
        className="px-6 py-3 flex-shrink-0"
        style={{
          background: '#111116',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <Zap size={14} style={{ color: '#818cf8' }} aria-hidden="true" />
            </div>
            <span className="font-semibold text-[#f4f4f5] tracking-tight" style={{ fontSize: '15px' }}>
              Kanban
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: '9px',
                letterSpacing: '0.1em',
                color: '#52525b',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '4px',
                padding: '2px 6px',
                textTransform: 'uppercase',
              }}
            >
              v2
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Epics section */}
          <section aria-labelledby="epics-heading">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Layers size={13} style={{ color: '#52525b' }} aria-hidden="true" />
                <h2
                  id="epics-heading"
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#71717a',
                  }}
                >
                  Epics
                </h2>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '9px',
                    color: '#52525b',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    padding: '1px 5px',
                  }}
                >
                  {epics.length}
                </span>
              </div>
              <button
                onClick={() => setShowCreateEpic(true)}
                className="flex items-center gap-1.5 transition-colors focus:outline-none"
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#a1a1aa',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#f4f4f5';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }}
                aria-label="Create new epic"
              >
                <Plus size={12} aria-hidden="true" />
                New Epic
              </button>
            </div>

            {epics.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-center rounded-xl"
                style={{
                  background: '#111116',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Layers size={28} style={{ color: '#3f3f46', marginBottom: '10px' }} aria-hidden="true" />
                <p style={{ color: '#71717a', fontSize: '13px' }}>No epics yet</p>
                <p style={{ color: '#52525b', fontSize: '11px', marginTop: '4px' }}>
                  Create one to group related tasks across projects
                </p>
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
              <div className="flex items-center gap-2.5">
                <FolderOpen size={13} style={{ color: '#52525b' }} aria-hidden="true" />
                <h2
                  id="projects-heading"
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#71717a',
                  }}
                >
                  Projects
                </h2>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '9px',
                    color: '#52525b',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    padding: '1px 5px',
                  }}
                >
                  {projects.length}
                </span>
              </div>
              <button
                onClick={onOpenFolder}
                className="flex items-center gap-1.5 transition-colors focus:outline-none"
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#a1a1aa',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#f4f4f5';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }}
                aria-label="Open a folder to add a project"
              >
                <Plus size={12} aria-hidden="true" />
                Open Folder
              </button>
            </div>

            {projects.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-center rounded-xl"
                style={{
                  background: '#111116',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <FolderOpen size={28} style={{ color: '#3f3f46', marginBottom: '10px' }} aria-hidden="true" />
                <p style={{ color: '#71717a', fontSize: '13px' }}>No projects yet</p>
                <p style={{ color: '#52525b', fontSize: '11px', marginTop: '4px' }}>
                  Open a local folder to start tracking tasks
                </p>
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

    </div>
  );
}
