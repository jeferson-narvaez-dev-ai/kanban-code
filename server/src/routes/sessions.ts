import { Router, Request, Response } from 'express';
import {
  listSessions,
  getSession,
  createSession,
  deleteSession,
  renameSession,
} from '../store/sessionStore';

const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/sessions — list sessions without messages
router.get('/', async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  try {
    const sessions = await listSessions(projectId);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/projects/:projectId/sessions — create session
router.post('/', async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const { id, name } = req.body as { id: string; name?: string };

  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    const session = await createSession(projectId, id, name ?? 'New session');
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// GET /api/projects/:projectId/sessions/:sessionId — get full session with messages
router.get('/:sessionId', async (req: Request, res: Response) => {
  const { projectId, sessionId } = req.params as { projectId: string; sessionId: string };
  try {
    const session = await getSession(projectId, sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// DELETE /api/projects/:projectId/sessions/:sessionId — delete session
router.delete('/:sessionId', async (req: Request, res: Response) => {
  const { projectId, sessionId } = req.params as { projectId: string; sessionId: string };
  try {
    await deleteSession(projectId, sessionId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// PATCH /api/projects/:projectId/sessions/:sessionId — rename session
router.patch('/:sessionId', async (req: Request, res: Response) => {
  const { projectId, sessionId } = req.params as { projectId: string; sessionId: string };
  const { name } = req.body as { name: string };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  try {
    await renameSession(projectId, sessionId, name);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
