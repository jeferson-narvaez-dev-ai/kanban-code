import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import agentRouter from './routes/agent';
import filesRouter from './routes/files';
import sessionsRouter from './routes/sessions';
import notificationsRouter from './routes/notifications';
import projectConfigRouter from './routes/projectConfig';
import { startFileWatcher } from './watcher/fileWatcher';
import chokidar from 'chokidar';
import path from 'path';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/tasks', tasksRouter);
app.use('/api/projects/:projectId/files', filesRouter);
app.use('/api/projects/:projectId/sessions', sessionsRouter);
app.use('/api/projects/:projectId/notifications', notificationsRouter);
app.use('/api/projects/:projectId/config', projectConfigRouter);
app.use('/api/agent', agentRouter);

const httpServer = createServer(app);
export const kanbanWss = new WebSocketServer({ server: httpServer, path: '/ws' });

kanbanWss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'Kanban WS ready' }));
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch {
      // ignore malformed messages
    }
  });
});

startFileWatcher(kanbanWss);

// Watch notifications folders for new .md files and broadcast to WS clients
const notificationsGlob = path.join(config.workspace, '*', 'notifications', '*.md');
const notificationsWatcher = chokidar.watch(notificationsGlob, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
});

notificationsWatcher.on('add', (filePath) => {
  const rel = path.relative(config.workspace, filePath);
  const parts = rel.split(path.sep);
  if (parts.length < 1) return;
  const projectId = parts[0];
  const msg = JSON.stringify({ type: 'notifications:changed', projectId });
  kanbanWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
});

notificationsWatcher.on('change', (filePath) => {
  const rel = path.relative(config.workspace, filePath);
  const parts = rel.split(path.sep);
  if (parts.length < 1) return;
  const projectId = parts[0];
  const msg = JSON.stringify({ type: 'notifications:changed', projectId });
  kanbanWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
});

httpServer.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
