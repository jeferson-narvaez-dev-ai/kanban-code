import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { listProjects, initProject, readColumn, archiveDone } from '../store/markdownStore';
import { COLUMNS } from '../types';

const router = Router();

// GET /api/projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await listProjects();
    const enriched = await Promise.all(
      projects.map(async (p) => {
        let taskCount = 0;
        if (p.initialized) {
          const counts = await Promise.all(COLUMNS.map((col) => readColumn(p.id, col)));
          taskCount = counts.flat().length;
        }
        return { ...p, taskCount };
      })
    );
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, path: projectPath } = req.body as { id?: string; name?: string; path?: string };
    if (!id || typeof id !== 'string' || !id.trim()) {
      res.status(400).json({ error: 'Missing required field: id' });
      return;
    }
    const projectId = id.trim();
    await initProject(projectId, { name: name ?? projectId, path: projectPath });
    res.status(201).json({
      id: projectId,
      name: name ?? projectId,
      workspacePath: path.join(config.workspace, projectId, '.kanban'),
      initialized: true,
      taskCount: 0,
      path: projectPath,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const projects = await listProjects();
    const project = projects.find((p) => p.id === id);
    if (!project) {
      res.status(404).json({ error: `Project '${id}' not found` });
      return;
    }
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const projectPath = path.join(config.workspace, id);
    try {
      await fs.access(projectPath);
    } catch {
      res.status(404).json({ error: `Project '${id}' not found` });
      return;
    }
    await fs.rm(projectPath, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /api/projects/:id/archive-done
router.post('/:id/archive-done', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const { olderThanDays } = req.body as { olderThanDays?: number };
    const days = typeof olderThanDays === 'number' ? olderThanDays : 30;
    const archived = await archiveDone(id, days);
    res.json({ archived });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to archive done tasks' });
  }
});

// POST /api/projects/:id/init
router.post('/:id/init', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    await initProject(id);
    res.json({
      id,
      name: id,
      workspacePath: path.join(config.workspace, id, '.kanban'),
      initialized: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to init project' });
  }
});

export default router;
