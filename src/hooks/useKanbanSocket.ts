import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { WsEvent } from '../../shared/types';

export function useKanbanSocket(projectId: string | null): void {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const wsUrl =
      (import.meta.env.VITE_WS_URL as string | undefined) ||
      'ws://localhost:3001/ws';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent;
        if (data.type === 'column:changed' && data.projectId === projectId) {
          queryClient.invalidateQueries({
            queryKey: ['tasks', projectId, data.column],
          });
          queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
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
      wsRef.current = null;
    };
  }, [projectId, queryClient]);
}
