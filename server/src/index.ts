import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import agentRouter from './routes/agent';
import filesRouter from './routes/files';
import sessionsRouter from './routes/sessions';
import { startFileWatcher } from './watcher/fileWatcher';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/tasks', tasksRouter);
app.use('/api/projects/:projectId/files', filesRouter);
app.use('/api/projects/:projectId/sessions', sessionsRouter);
app.use('/api/agent', agentRouter);

const httpServer = createServer(app);
const kanbanWss = new WebSocketServer({ server: httpServer, path: '/ws' });

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

httpServer.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
