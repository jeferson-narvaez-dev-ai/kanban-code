import chokidar from 'chokidar';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config';
import { WsEvent, ColumnId } from '../types';

export function startFileWatcher(wss: WebSocketServer): void {
  const tasksGlob = path.join(config.workspace, '*', 'tasks', '*.md');
  const harnessGlob = path.join(config.workspace, '*', '**', '*');

  const watcher = chokidar.watch([tasksGlob, harnessGlob], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    ignored: /(^|[/\\])\../,
  });

  function broadcast(event: WsEvent): void {
    const msg = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  }

  function extractProjectId(filePath: string): string | null {
    const rel = path.relative(config.workspace, filePath);
    const parts = rel.split(path.sep);
    return parts.length >= 1 ? parts[0] : null;
  }

  function handleChange(filePath: string): void {
    const rel = path.relative(config.workspace, filePath);
    const parts = rel.split(path.sep);
    if (parts.length < 2) return;
    const projectId = parts[0];

    if (parts[1] === 'tasks' && filePath.endsWith('.md')) {
      const column = path.basename(filePath, '.md') as ColumnId;
      broadcast({ type: 'column:changed', projectId, column, timestamp: new Date().toISOString() });
    }

    broadcast({ type: 'files:changed', projectId, path: rel, timestamp: new Date().toISOString() });
  }

  watcher.on('change', handleChange);
  watcher.on('add', (filePath) => {
    const projectId = extractProjectId(filePath);
    if (!projectId) return;
    const rel = path.relative(config.workspace, filePath);
    broadcast({ type: 'files:changed', projectId, path: rel, timestamp: new Date().toISOString() });
  });
  watcher.on('unlink', (filePath) => {
    const projectId = extractProjectId(filePath);
    if (!projectId) return;
    const rel = path.relative(config.workspace, filePath);
    broadcast({ type: 'files:changed', projectId, path: rel, timestamp: new Date().toISOString() });
  });
}
