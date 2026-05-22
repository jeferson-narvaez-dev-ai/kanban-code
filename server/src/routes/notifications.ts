import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { config } from '../config';

const router = Router({ mergeParams: true });

function notificationsDirPath(projectId: string): string {
  return path.join(config.workspace, projectId, 'notifications');
}

export interface NotificationItem {
  filename: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  source: 'agent' | 'system' | 'user';
  taskId?: string;
  read: boolean;
  createdAt: string;
  body: string;
}

async function parseNotificationFile(
  dirPath: string,
  filename: string
): Promise<NotificationItem | null> {
  try {
    const filePath = path.join(dirPath, filename);
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(raw);
    return {
      filename,
      type: (parsed.data.type as NotificationItem['type']) || 'info',
      title: (parsed.data.title as string) || filename,
      source: (parsed.data.source as NotificationItem['source']) || 'system',
      taskId: parsed.data.taskId as string | undefined,
      read: parsed.data.read === true || parsed.data.read === 'true',
      createdAt: (parsed.data.createdAt as string) || new Date().toISOString(),
      body: parsed.content.trim(),
    };
  } catch {
    return null;
  }
}

// GET /api/projects/:projectId/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const dir = notificationsDirPath(projectId);

    if (!fsSync.existsSync(dir)) {
      res.json([]);
      return;
    }

    const entries = await fs.readdir(dir);
    const mdFiles = entries.filter(e => e.endsWith('.md'));

    const notifications = await Promise.all(
      mdFiles.map(filename => parseNotificationFile(dir, filename))
    );

    const valid = notifications
      .filter((n): n is NotificationItem => n !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(valid);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

// POST /api/projects/:projectId/notifications/refresh
// Just a no-op endpoint agents can call; the folder watcher handles broadcast
router.post('/refresh', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// PATCH /api/projects/:projectId/notifications/:filename — mark as read
router.patch('/:filename', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const filename = String(req.params['filename']);
    const dir = notificationsDirPath(projectId);
    const filePath = path.join(dir, filename);

    if (!fsSync.existsSync(filePath)) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(raw);
    parsed.data.read = true;

    const updated = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(filePath, updated, 'utf-8');

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// DELETE /api/projects/:projectId/notifications/:filename
router.delete('/:filename', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const filename = String(req.params['filename']);
    const dir = notificationsDirPath(projectId);
    const filePath = path.join(dir, filename);

    if (!fsSync.existsSync(filePath)) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    await fs.unlink(filePath);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
