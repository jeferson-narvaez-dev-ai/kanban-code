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
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-100 focus:outline-none relative',
        active
          ? 'text-[#f4f4f5]'
          : 'text-[#71717a] hover:text-[#a1a1aa]'
      )}
      style={active ? {
        background: 'rgba(99,102,241,0.1)',
        borderLeft: '2px solid #6366f1',
        paddingLeft: '10px',
        boxShadow: 'inset 0 0 12px rgba(99,102,241,0.06)',
      } : {
        borderLeft: '2px solid transparent',
      }}
    >
      <span style={{ color: active ? '#818cf8' : 'inherit' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="font-mono leading-none min-w-[16px] text-center"
          style={{
            fontSize: '9px',
            fontWeight: 700,
            background: '#ef4444',
            color: 'white',
            borderRadius: '9999px',
            padding: '2px 5px',
          }}
        >
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

  // Auto-navigate to Agent tab when a session is created by the server
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
      setHarnessMsg(`${result.skills.length} skills installed`);
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
    <div className="h-screen flex overflow-hidden" style={{ background: '#09090b' }}>
      {/* Left Sidebar */}
      <aside
        className="w-[216px] flex-shrink-0 flex flex-col overflow-hidden"
        style={{
          background: '#111116',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Project header */}
        <div
          className="px-3 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1 transition-colors focus:outline-none mb-2"
            style={{ fontSize: '11px', color: '#52525b' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#71717a'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
            aria-label="Go home"
          >
            <ChevronLeft size={11} />
            <span>Home</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <p
              className="text-sm font-semibold truncate flex-1"
              style={{ color: '#f4f4f5', fontSize: '13px' }}
            >
              {projectName}
            </p>
            <span
              className={clsx(
                'flex-shrink-0 inline-flex items-center gap-1 rounded font-mono leading-none',
              )}
              style={{
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                padding: '2px 6px',
                ...(agentMode === 'manual'
                  ? {
                      background: 'rgba(255,255,255,0.04)',
                      color: '#52525b',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }
                  : {
                      background: 'rgba(16,185,129,0.1)',
                      color: '#10b981',
                      border: '1px solid rgba(16,185,129,0.2)',
                    }),
              }}
              title={agentMode === 'manual' ? 'Agent disabled (manual mode)' : 'Agent active (auto mode)'}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: agentMode === 'manual' ? '#52525b' : '#10b981',
                  boxShadow: agentMode === 'manual' ? 'none' : '0 0 4px rgba(16,185,129,0.5)',
                }}
              />
              {agentMode === 'manual' ? 'manual' : 'agent'}
            </span>
          </div>
        </div>

        {/* Setup Harness */}
        <div
          className="px-3 py-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={handleSetupHarness}
            disabled={harnessState === 'loading'}
            className={clsx(
              'w-full flex items-center gap-1.5 rounded-md transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            style={{
              fontSize: '11px',
              fontWeight: 500,
              padding: '5px 8px',
              ...(harnessState === 'success'
                ? { color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }
                : harnessState === 'error'
                ? { color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }
                : { color: '#71717a', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }),
            }}
            aria-label="Setup Harness"
          >
            {harnessState === 'loading' ? (
              <>
                <svg
                  className="animate-spin"
                  width={12}
                  height={12}
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
                <Zap size={12} aria-hidden="true" />
                {harnessState === 'success' ? 'Harness ready' : 'Setup Harness'}
              </>
            )}
          </button>
          {(harnessState === 'success' || harnessState === 'error') && harnessMsg && (
            <span
              className={clsx(
                'block mt-1 truncate font-mono',
                harnessState === 'success' ? 'text-[#10b981]' : 'text-[#ef4444]'
              )}
              style={{ fontSize: '9px' }}
              title={harnessMsg}
            >
              {harnessMsg}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="px-2 py-2 space-y-0.5">
          <NavItem
            icon={<Kanban size={14} />}
            label="Board"
            active={activeTab === 'board'}
            onClick={() => setActiveTab('board')}
          />
          <NavItem
            icon={<FileText size={14} />}
            label="Docs"
            active={activeTab === 'docs'}
            onClick={() => setActiveTab('docs')}
          />
          {agentMode !== 'manual' && (
            <NavItem
              icon={<Bot size={14} />}
              label="Agent"
              active={activeTab === 'agent'}
              onClick={() => setActiveTab('agent')}
            />
          )}
          <NavItem
            icon={<Bell size={14} />}
            label="Notifications"
            active={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
            badge={unreadCount}
          />
          <NavItem
            icon={<Settings size={14} />}
            label="Config"
            active={activeTab === 'config'}
            onClick={() => setActiveTab('config')}
          />
        </nav>

        {/* Sessions list — only when agent tab is active and not in manual mode */}
        {activeTab === 'agent' && agentMode !== 'manual' && (
          <div
            className="flex-1 overflow-y-auto px-2 py-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
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
          <div className="flex-1 flex items-center justify-center" style={{ background: '#09090b' }}>
            <div className="text-center space-y-2">
              <Bot size={28} style={{ color: '#3f3f46', margin: '0 auto' }} />
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#71717a' }}>Agent disabled</p>
              <p style={{ fontSize: '11px', color: '#52525b' }}>
                This project is in{' '}
                <span className="font-mono" style={{ color: '#a1a1aa' }}>manual</span> mode.
                Enable <span className="font-mono" style={{ color: '#a1a1aa' }}>auto</span> in Config to use the agent.
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
