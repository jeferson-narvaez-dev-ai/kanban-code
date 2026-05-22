import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Info, Check, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import {
  listNotifications,
  markNotificationRead,
  deleteNotification,
  type NotificationItem,
} from '../lib/api';

interface Props {
  projectId: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function TypeIcon({ type }: { type: NotificationItem['type'] }) {
  if (type === 'error') return <AlertCircle size={16} className="text-[#f85149] flex-shrink-0" />;
  if (type === 'warning') return <AlertTriangle size={16} className="text-[#e3b341] flex-shrink-0" />;
  return <Info size={16} className="text-[#58a6ff] flex-shrink-0" />;
}

function SourceBadge({ source }: { source: NotificationItem['source'] }) {
  const color =
    source === 'agent' ? 'text-[#a371f7] bg-[#a371f710]' :
    source === 'system' ? 'text-[#8b949e] bg-[#8b949e10]' :
    'text-[#3fb950] bg-[#3fb95010]';
  return (
    <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded', color)}>
      {source}
    </span>
  );
}

export function NotificationsView({ projectId }: Props) {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', projectId],
    queryFn: () => listNotifications(projectId),
    refetchInterval: 10_000,
  });

  // Listen to WS notifications:changed events
  useEffect(() => {
    const wsUrl =
      (import.meta.env.VITE_WS_URL as string | undefined) ||
      'ws://localhost:3001/ws';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; projectId?: string };
        if (msg.type === 'notifications:changed' && msg.projectId === projectId) {
          void queryClient.invalidateQueries({ queryKey: ['notifications', projectId] });
        }
      } catch { /* ignore */ }
    };

    ws.onopen = () => {
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30_000);
      ws.addEventListener('close', () => clearInterval(ping));
    };

    return () => ws.close();
  }, [projectId, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: (filename: string) => markNotificationRead(projectId, filename),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => deleteNotification(projectId, filename),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', projectId] });
    },
  });

  const unreadNotifications = notifications.filter(n => !n.read);

  async function handleMarkAllRead() {
    await Promise.all(
      unreadNotifications.map(n => markReadMutation.mutateAsync(n.filename))
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#8b949e]">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#e6edf3]">Notifications</h2>
          {unreadNotifications.length > 0 && (
            <span className="bg-[#f85149] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {unreadNotifications.length}
            </span>
          )}
        </div>
        {unreadNotifications.length > 0 && (
          <button
            onClick={() => void handleMarkAllRead()}
            className="text-xs text-[#58a6ff] hover:text-[#79c0ff] transition-colors flex items-center gap-1"
          >
            <Check size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <Info size={32} className="text-[#484f58]" />
            <p className="text-sm text-[#8b949e]">No notifications</p>
            <p className="text-xs text-[#484f58]">Agent events and alerts will appear here</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.filename}
              className={clsx(
                'rounded-lg border p-3 transition-colors',
                notif.read
                  ? 'border-[#30363d] bg-[#161b22]'
                  : notif.type === 'error'
                  ? 'border-[#f8514940] bg-[#f8514910]'
                  : notif.type === 'warning'
                  ? 'border-[#e3b34140] bg-[#e3b34110]'
                  : 'border-[#58a6ff40] bg-[#58a6ff10]'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  <TypeIcon type={notif.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-[#e6edf3] truncate">
                      {notif.title}
                    </span>
                    <SourceBadge source={notif.source} />
                    {notif.taskId && (
                      <span className="text-[10px] font-mono text-[#8b949e] bg-[#21262d] px-1.5 py-0.5 rounded">
                        {notif.taskId}
                      </span>
                    )}
                  </div>
                  {notif.body && (
                    <p className="text-xs text-[#8b949e] leading-relaxed whitespace-pre-wrap line-clamp-3">
                      {notif.body}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-[#484f58]">{relativeTime(notif.createdAt)}</span>
                    <div className="flex items-center gap-2 ml-auto">
                      {!notif.read && (
                        <button
                          onClick={() => markReadMutation.mutate(notif.filename)}
                          className="text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors flex items-center gap-1"
                          title="Mark as read"
                        >
                          <Check size={11} />
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(notif.filename)}
                        className="text-[10px] text-[#484f58] hover:text-[#f85149] transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
