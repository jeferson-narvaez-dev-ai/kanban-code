import { useState, useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Kanban, FileText, Bot, Zap, Bell, Settings } from 'lucide-react';
import clsx from 'clsx';
import type { Project } from '../types';
import type { Epic } from '../../shared/types';
import { uiStore, setActiveTab } from '../store/uiStore';
import { KanbanBoard } from './KanbanBoard';
import { DocsView } from './DocsView';
import { AgentChat } from './AgentChat';
import { SessionsSidebar } from './SessionsSidebar';
import { NotificationsView } from './NotificationsView';
import { ProjectConfigView } from './ProjectConfigView';
import { setupHarness, getSession, createSession, listEpics, listNotifications, getProjectConfig } from '../lib/api';
import type { ChatMessage } from '../lib/api';
import type { WsEvent } from '../../shared/types';

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
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
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
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-[#f85149] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[16px] text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export function ProjectWorkspace({ projectId, projectName, projects, onNavigateHome }: Props) {
  const { activeTab } = useStore(uiStore);
  const queryClient = useQueryClient();
  const [harnessState, setHarnessState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [harnessMsg, setHarnessMsg] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ['epics', projectId],
    queryFn: () => listEpics(projectId),
  });

  // Project config — used to read agentMode
  const { data: projectConfig } = useQuery({
    queryKey: ['project-config', projectId],
    queryFn: () => getProjectConfig(projectId),
  });
  const agentMode = projectConfig?.agentMode ?? 'auto';

  // Unread notifications count for badge
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', projectId],
    queryFn: () => listNotifications(projectId),
    refetchInterval: 15_000,
  });
  const unreadCount = notifications.filter(n => !n.read).length;

  // Auto-navigate to Agent tab when a session is created by the server (e.g. task dragged to in-progress)
  useEffect(() => {
    const wsUrl =
      (import.meta.env.VITE_WS_URL as string | undefined) ||
      'ws://localhost:3001/ws';

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent;
        if (
          data.type === 'session:created' &&
          data.projectId === projectId &&
          agentMode !== 'manual'
        ) {
          void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] });
          void handleSelectSession(data.sessionId);
        }
        if (data.type === 'notifications:changed' && data.projectId === projectId) {
          void queryClient.invalidateQueries({ queryKey: ['notifications', projectId] });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onopen = () => {
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30_000);
      ws.addEventListener('close', () => clearInterval(ping));
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
          {agentMode !== 'manual' && (
            <NavItem
              icon={<Bot size={15} />}
              label="Agent"
              active={activeTab === 'agent'}
              onClick={() => setActiveTab('agent')}
            />
          )}
          <NavItem
            icon={<Bell size={15} />}
            label="Notifications"
            active={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
            badge={unreadCount}
          />
          <NavItem
            icon={<Settings size={15} />}
            label="Config"
            active={activeTab === 'config'}
            onClick={() => setActiveTab('config')}
          />
        </nav>

        {/* Sessions list — only when agent tab is active and not in manual mode */}
        {activeTab === 'agent' && agentMode !== 'manual' && (
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
            epics={epics}
            agentMode={agentMode}
            onNavigateHome={onNavigateHome}
          />
        )}
        {activeTab === 'docs' && (
          <DocsView projectId={projectId} />
        )}
        {activeTab === 'agent' && agentMode !== 'manual' && (
          <AgentChat
            projectId={projectId}
            sessionId={activeSessionId}
            initialMessages={sessionMessages}
          />
        )}
        {activeTab === 'agent' && agentMode === 'manual' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Bot size={32} className="text-[#30363d] mx-auto" />
              <p className="text-sm font-medium text-[#8b949e]">Agent disabled</p>
              <p className="text-xs text-[#484f58]">
                This project is in <span className="text-[#e6edf3] font-mono">manual</span> mode.
                Enable <span className="text-[#e6edf3] font-mono">auto</span> mode in Config to use the agent.
              </p>
            </div>
          </div>
        )}
        {activeTab === 'notifications' && (
          <NotificationsView projectId={projectId} />
        )}
        {activeTab === 'config' && (
          <ProjectConfigView projectId={projectId} />
        )}
      </main>
    </div>
  );
}
