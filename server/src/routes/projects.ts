import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '../config';
import { listProjects, initProject, readColumn, archiveDone, readProjectMeta } from '../store/markdownStore';
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
      workspacePath: path.join(config.workspace, projectId),
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
      workspacePath: path.join(config.workspace, id),
      initialized: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to init project' });
  }
});

// POST /api/projects/:id/harness
// Installs Claude slash-command skills into the project's source code .claude/commands/
router.post('/:id/harness', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const meta = await readProjectMeta(id);
    if (!meta?.path) {
      res.status(400).json({ error: 'Project has no source path configured. Set the project path first.' });
      return;
    }

    const sourcePath = meta.path.replace('~', os.homedir());

    // Verify the source path exists
    try {
      await fs.access(sourcePath);
    } catch {
      res.status(400).json({ error: `Source path does not exist: ${meta.path}` });
      return;
    }

    const commandsDir = path.join(sourcePath, '.claude', 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    const { getSkillFiles } = await import('../utils/skillTemplates');
    const skills = getSkillFiles();

    const results: Array<{ filename: string; status: 'created' | 'updated' }> = [];
    for (const skill of skills) {
      const filePath = path.join(commandsDir, skill.filename);
      await fs.writeFile(filePath, skill.content, 'utf-8');
      results.push({ filename: skill.filename, status: 'created' });
    }

    res.json({
      success: true,
      commandsDir: commandsDir.replace(os.homedir(), '~'),
      skills: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to install harness skills' });
  }
});

export default router;
