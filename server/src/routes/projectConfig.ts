import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { config } from '../config';

const router = Router({ mergeParams: true });

function configFilePath(projectId: string): string {
  return path.join(config.workspace, projectId, 'project-config.md');
}

const DEFAULT_CONFIG = `---
setupCommands:
  - npm install
  - npm run build
testCommands:
  - npm test
  - npm run lint
agentMode: auto
setupInstructions: |
  Describe any manual setup steps here.
---

# Project Configuration

## Setup Commands
Run these before starting work on this project.

## Test Commands
These MUST pass before moving any task to \`waiting-approval\`.
`;

// GET /api/projects/:projectId/config
router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const filePath = configFilePath(projectId);

    let raw: string;
    if (!fsSync.existsSync(filePath)) {
      raw = DEFAULT_CONFIG;
    } else {
      raw = await fs.readFile(filePath, 'utf-8');
    }

    const parsed = matter(raw);
    res.json({
      setupCommands: (parsed.data.setupCommands as string[] | undefined) ?? [],
      testCommands: (parsed.data.testCommands as string[] | undefined) ?? [],
      agentMode: (parsed.data.agentMode as string | undefined) ?? 'auto',
      setupInstructions: (parsed.data.setupInstructions as string | undefined) ?? '',
      raw,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read project config' });
  }
});

// PUT /api/projects/:projectId/config
router.put('/', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const filePath = configFilePath(projectId);
    const { content } = req.body as { content?: string };

    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Missing required field: content' });
      return;
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');

    const parsed = matter(content);
    res.json({
      setupCommands: (parsed.data.setupCommands as string[] | undefined) ?? [],
      testCommands: (parsed.data.testCommands as string[] | undefined) ?? [],
      agentMode: (parsed.data.agentMode as string | undefined) ?? 'auto',
      setupInstructions: (parsed.data.setupInstructions as string | undefined) ?? '',
      raw: content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save project config' });
  }
});

export default router;
