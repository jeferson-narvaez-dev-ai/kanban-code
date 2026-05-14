import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus } from 'lucide-react';
import clsx from 'clsx';
import { listSessions, deleteSession } from '../lib/api';
import type { ChatSession } from '../lib/api';

interface Props {
  projectId: string;
  activeSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function SessionsSidebar({ projectId, activeSessionId, onSelectSession, onNewSession }: Props) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery<ChatSession[]>({
    queryKey: ['sessions', projectId],
    queryFn: () => listSessions(projectId),
    staleTime: 10_000,
  });

  async function handleDelete(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    setDeletingId(sessionId);
    try {
      await deleteSession(projectId, sessionId);
      await queryClient.invalidateQueries({ queryKey: ['sessions', projectId] });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* New session button */}
      <button
        onClick={onNewSession}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]/50 transition-colors"
        aria-label="New session"
      >
        <Plus size={13} />
        <span>New session</span>
      </button>

      {/* Session list */}
      {isLoading && (
        <p className="px-2 py-1 text-xs text-[#484f58]">Loading...</p>
      )}

      {!isLoading && sessions.length === 0 && (
        <p className="px-2 py-1 text-xs text-[#484f58]">No sessions yet</p>
      )}

      {sessions.map((session) => (
        <div
          key={session.id}
          className="relative group"
          onMouseEnter={() => setHoveredId(session.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <button
            onClick={() => onSelectSession(session.id)}
            className={clsx(
              'w-full flex flex-col items-start px-2 py-1.5 rounded-md text-left transition-colors',
              session.id === activeSessionId
                ? 'bg-[#21262d] text-[#e6edf3]'
                : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]/50'
            )}
          >
            <span className="text-xs font-medium leading-snug pr-5 truncate w-full">
              {truncate(session.name || session.id, 28)}
            </span>
            <span className="text-[10px] text-[#484f58] leading-tight">
              {relativeTime(session.updatedAt)}
            </span>
          </button>

          {/* Delete button — shown on hover */}
          {hoveredId === session.id && (
            <button
              onClick={(e) => void handleDelete(e, session.id)}
              disabled={deletingId === session.id}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#3d0f0f] transition-colors disabled:opacity-50"
              aria-label={`Delete session ${session.name || session.id}`}
              title="Delete session"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
