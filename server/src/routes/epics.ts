import { Router, Request, Response } from 'express';
import { Epic } from '../models/Epic';
import { Task } from '../models/Task';

const router = Router();

// GET /api/epics
router.get('/', async (_req: Request, res: Response) => {
  try {
    const epics = await Epic.find({});
    res.json(epics.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      color: e.color,
      createdAt: e.createdAt,
      projectIds: e.projectIds,
      path: e.path,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch epics' });
  }
});

// POST /api/epics
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, description, color, projectIds, path } = req.body as {
      id: string;
      name: string;
      description?: string;
      color: string;
      projectIds?: string[];
      path?: string;
    };
    const epic = await Epic.create({
      id,
      name,
      description,
      color,
      createdAt: new Date().toISOString(),
      projectIds: projectIds ?? [],
      path,
    });
    res.status(201).json({
      id: epic.id,
      name: epic.name,
      description: epic.description,
      color: epic.color,
      createdAt: epic.createdAt,
      projectIds: epic.projectIds,
      path: epic.path,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create epic' });
  }
});

// PUT /api/epics/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<{
      name: string;
      description: string;
      color: string;
      projectIds: string[];
      path: string;
    }>;
    const epic = await Epic.findOneAndUpdate({ id }, updates, { new: true });
    if (!epic) {
      res.status(404).json({ error: 'Epic not found' });
      return;
    }
    res.json({
      id: epic.id,
      name: epic.name,
      description: epic.description,
      color: epic.color,
      createdAt: epic.createdAt,
      projectIds: epic.projectIds,
      path: epic.path,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update epic' });
  }
});

// DELETE /api/epics/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Epic.deleteOne({ id });
    await Task.deleteMany({ contextType: 'epic', contextId: id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete epic' });
  }
});

export default router;
