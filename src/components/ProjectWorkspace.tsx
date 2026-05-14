import { useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { ChevronLeft, Kanban, FileText, Bot, Zap } from 'lucide-react';
import clsx from 'clsx';
import type { Project } from '../types';
import { uiStore, setActiveTab } from '../store/uiStore';
import { KanbanBoard } from './KanbanBoard';
import { DocsView } from './DocsView';
import { AgentChat } from './AgentChat';
import { SessionsSidebar } from './SessionsSidebar';
import { setupHarness, getSession, createSession } from '../lib/api';
import type { ChatMessage } from '../lib/api';

interface Props {
  projectId: string;
  projectName: string;
  projects: Project[];
  onNavigateHome: () => void;
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
        active
          ? 'bg-[#21262d] text-[#e6edf3]'
          : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]/50'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function ProjectWorkspace({ projectId, projectName, projects, onNavigateHome }: Props) {
  const { activeTab } = useStore(uiStore);
  const [harnessState, setHarnessState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [harnessMsg, setHarnessMsg] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);

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

  async function handleSelectSession(sessionId: string) {
    try {
      const full = await getSession(projectId, sessionId);
      setSessionMessages(full.messages);
    } catch {
      setSessionMessages([]);
    }
    setActiveSessionId(sessionId);
    setActiveTab('agent');
  }

  async function handleNewSession() {
    const id = crypto.randomUUID();
    try {
      await createSession(projectId, id);
    } catch {
      // session will be created lazily by the server on first message
    }
    setActiveSessionId(id);
    setSessionMessages([]);
    setActiveTab('agent');
  }

  return (
    <div className="h-screen bg-[#0d1117] flex overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-[#161b22] border-r border-[#30363d] flex flex-col overflow-hidden">
        {/* Breadcrumb */}
        <div className="px-3 py-3 border-b border-[#30363d]">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors mb-1 focus:outline-none"
            aria-label="Go home"
          >
            <ChevronLeft size={12} />
            Home
          </button>
          <p className="text-sm font-semibold text-[#e6edf3] truncate">{projectName}</p>
        </div>

        {/* Setup Harness */}
        <div className="px-3 py-2 border-b border-[#30363d]">
          <button
            onClick={handleSetupHarness}
            disabled={harnessState === 'loading'}
            className={clsx(
              'w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed',
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
                'block mt-1 text-[10px] truncate',
                harnessState === 'success' ? 'text-[#3fb950]' : 'text-[#f85149]'
              )}
              title={harnessMsg}
            >
              {harnessMsg}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="px-2 py-2 space-y-0.5">
          <NavItem
            icon={<Kanban size={15} />}
            label="Board"
            active={activeTab === 'board'}
            onClick={() => setActiveTab('board')}
          />
          <NavItem
            icon={<FileText size={15} />}
            label="Docs"
            active={activeTab === 'docs'}
            onClick={() => setActiveTab('docs')}
          />
          <NavItem
            icon={<Bot size={15} />}
            label="Agent"
            active={activeTab === 'agent'}
            onClick={() => setActiveTab('agent')}
          />
        </nav>

        {/* Sessions list — only when agent tab is active */}
        {activeTab === 'agent' && (
          <div className="flex-1 overflow-y-auto border-t border-[#30363d] px-2 py-2">
            <SessionsSidebar
              projectId={projectId}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => void handleSelectSession(id)}
              onNewSession={() => void handleNewSession()}
            />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
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
          <AgentChat
            projectId={projectId}
            sessionId={activeSessionId}
            initialMessages={sessionMessages}
          />
        )}
      </main>
    </div>
  );
}
