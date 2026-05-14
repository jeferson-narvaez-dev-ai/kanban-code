import { Router, Request, Response } from 'express';
import { Project } from '../models/Project';
import { Task } from '../models/Task';

const router = Router();

// GET /api/projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await Project.find({});
    res.json(projects.map(p => ({ id: p.id, name: p.name, createdAt: p.createdAt, path: p.path })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, createdAt, path } = req.body as { id: string; name: string; createdAt?: string; path?: string };
    const project = await Project.create({
      id,
      name,
      createdAt: createdAt ?? new Date().toISOString(),
      path,
    });
    res.status(201).json({ id: project.id, name: project.name, createdAt: project.createdAt, path: project.path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Project.deleteOne({ id });
    await Task.deleteMany({ contextType: 'project', contextId: id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
