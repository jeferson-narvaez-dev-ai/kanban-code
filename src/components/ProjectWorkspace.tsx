import { useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { ChevronRight, Kanban, FileText, Bot, Zap } from 'lucide-react';
import clsx from 'clsx';
import type { Project } from '../types';
import { uiStore, setActiveTab } from '../store/uiStore';
import { KanbanBoard } from './KanbanBoard';
import { DocsView } from './DocsView';
import { AgentChat } from './AgentChat';
import { setupHarness } from '../lib/api';

interface Props {
  projectId: string;
  projectName: string;
  projects: Project[];
  onNavigateHome: () => void;
}

type Tab = 'board' | 'docs' | 'agent';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'board', label: 'Board', icon: <Kanban size={14} /> },
  { id: 'docs', label: 'Docs', icon: <FileText size={14} /> },
  { id: 'agent', label: 'Agent', icon: <Bot size={14} /> },
];

export function ProjectWorkspace({ projectId, projectName, projects, onNavigateHome }: Props) {
  const { activeTab } = useStore(uiStore);
  const [harnessState, setHarnessState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [harnessMsg, setHarnessMsg] = useState('');

  async function handleSetupHarness() {
    setHarnessState('loading');
    try {
      const result = await setupHarness(projectId);
      setHarnessMsg(`${result.skills.length} skills → ${result.commandsDir}`);
      setHarnessState('success');
      setTimeout(() => setHarnessState('idle'), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to setup harness';
      setHarnessMsg(msg);
      setHarnessState('error');
      setTimeout(() => setHarnessState('idle'), 4000);
    }
  }

  return (
    <div className="h-screen bg-[#0d1117] flex flex-col">
      {/* Header with breadcrumb + tab bar */}
      <header className="flex-shrink-0 border-b border-[#30363d] bg-[#161b22]">
        {/* Breadcrumb row */}
        <div className="px-6 pt-3 pb-0 flex items-center gap-1.5 text-sm">
          <button
            onClick={onNavigateHome}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] rounded px-1"
            aria-label="Go home"
          >
            Home
          </button>
          <ChevronRight size={13} className="text-[#484f58]" aria-hidden="true" />
          <span className="font-semibold text-[#e6edf3]" aria-current="page">
            {projectName}
          </span>
        </div>

        {/* Tab bar + Setup Harness button */}
        <div className="flex items-end px-6 mt-1">
          <nav
            className="flex items-end flex-1"
            role="tablist"
            aria-label="Project workspace tabs"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] mr-1',
                    isActive
                      ? 'border-[#f78166] text-[#e6edf3]'
                      : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#8b949e]'
                  )}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Setup Harness */}
          <div className="flex flex-col items-end pb-1 gap-0.5">
            <button
              onClick={handleSetupHarness}
              disabled={harnessState === 'loading'}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed',
                harnessState === 'success'
                  ? 'text-[#3fb950] border-[#3fb950]'
                  : harnessState === 'error'
                  ? 'text-[#f85149] border-[#f85149]'
                  : 'text-[#8b949e] hover:text-[#e6edf3] border-[#30363d] hover:border-[#8b949e]'
              )}
              aria-label="Setup Harness"
            >
              {harnessState === 'loading' ? (
                <>
                  <svg
                    className="animate-spin"
                    width={13}
                    height={13}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Setting up...
                </>
              ) : (
                <>
                  <Zap size={13} aria-hidden="true" />
                  {harnessState === 'success' ? 'Harness ready' : 'Setup Harness'}
                </>
              )}
            </button>
            {(harnessState === 'success' || harnessState === 'error') && harnessMsg && (
              <span
                className={clsx(
                  'text-xs max-w-xs truncate',
                  harnessState === 'success' ? 'text-[#3fb950]' : 'text-[#f85149]'
                )}
                title={harnessMsg}
              >
                {harnessMsg}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          {activeTab === 'board' && (
            <KanbanBoard
              mode="project"
              projectId={projectId}
              projectName={projectName}
              projects={projects}
              onNavigateHome={onNavigateHome}
            />
          )}
          {activeTab === 'docs' && (
            <DocsView projectId={projectId} />
          )}
          {activeTab === 'agent' && (
            <AgentChat projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}
