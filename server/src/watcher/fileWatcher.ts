import chokidar from 'chokidar';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config';
import { WsEvent, ColumnId } from '../../../shared/types';

export function startFileWatcher(wss: WebSocketServer): void {
  const watchGlob = path.join(config.workspace, '**', '.kanban', '*.md');

  const watcher = chokidar.watch(watchGlob, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });

  function broadcast(event: WsEvent): void {
    const msg = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  }

  watcher.on('change', (filePath) => {
    // Extract projectId and column from path: {workspace}/{projectId}/.kanban/{column}.md
    const rel = path.relative(config.workspace, filePath);
    const parts = rel.split(path.sep);
    if (parts.length < 3) return;
    const projectId = parts[0];
    const column = path.basename(filePath, '.md') as ColumnId;
    broadcast({
      type: 'column:changed',
      projectId,
      column,
      timestamp: new Date().toISOString(),
    });
  });
}
