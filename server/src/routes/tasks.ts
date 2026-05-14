import { Router, Request, Response } from 'express';
import { Task } from '../models/Task';

const router = Router();

// GET /api/tasks?contextType=epic&contextId=xxx
router.get('/', async (req: Request, res: Response) => {
  try {
    const { contextType, contextId } = req.query as { contextType?: string; contextId?: string };
    const filter: Record<string, string> = {};
    if (contextType) filter.contextType = contextType;
    if (contextId) filter.contextId = contextId;
    const tasks = await Task.find(filter);
    res.json(tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      tags: t.tags,
      createdAt: t.createdAt,
      projectId: t.projectId,
      epicId: t.epicId,
      parentProjectId: t.parentProjectId,
      contextType: t.contextType,
      contextId: t.contextId,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      title: string;
      description?: string;
      priority: 'low' | 'medium' | 'high';
      status: 'todo' | 'in-progress' | 'done';
      tags?: string[];
      projectId?: string;
      epicId?: string;
      parentProjectId?: string;
      contextType: 'epic' | 'project';
      contextId: string;
    };
    const task = await Task.create({
      id: crypto.randomUUID(),
      title: body.title,
      description: body.description,
      priority: body.priority,
      status: body.status ?? 'todo',
      tags: body.tags ?? [],
      createdAt: new Date().toISOString(),
      projectId: body.projectId,
      epicId: body.epicId,
      parentProjectId: body.parentProjectId,
      contextType: body.contextType,
      contextId: body.contextId,
    });
    res.status(201).json({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      tags: task.tags,
      createdAt: task.createdAt,
      projectId: task.projectId,
      epicId: task.epicId,
      parentProjectId: task.parentProjectId,
      contextType: task.contextType,
      contextId: task.contextId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<{
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
      tags: string[];
      projectId: string;
    }>;
    const task = await Task.findOneAndUpdate({ id }, updates, { new: true });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      tags: task.tags,
      createdAt: task.createdAt,
      projectId: task.projectId,
      epicId: task.epicId,
      parentProjectId: task.parentProjectId,
      contextType: task.contextType,
      contextId: task.contextId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:id/move
router.patch('/:id/move', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: 'todo' | 'in-progress' | 'done' };
    const task = await Task.findOneAndUpdate({ id }, { status }, { new: true });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      tags: task.tags,
      createdAt: task.createdAt,
      projectId: task.projectId,
      epicId: task.epicId,
      parentProjectId: task.parentProjectId,
      contextType: task.contextType,
      contextId: task.contextId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to move task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Task.deleteOne({ id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
