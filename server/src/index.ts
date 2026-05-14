import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { connectDB } from './db';
import projectsRouter from './routes/projects';
import epicsRouter from './routes/epics';
import tasksRouter from './routes/tasks';
import { setupTerminalWS } from './terminal';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/epics', epicsRouter);
app.use('/api/tasks', tasksRouter);

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/terminal' });
setupTerminalWS(wss);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
