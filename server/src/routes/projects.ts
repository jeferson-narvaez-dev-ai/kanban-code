import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '../config';
import { listProjects, initProject, readColumn, archiveDone, readProjectMeta } from '../store/markdownStore';
import { COLUMNS } from '../types';

const router = Router();

function buildClaudeMd(projectName: string, projectId: string, harnessRoot: string): string {
  return `# CLAUDE.md — ${projectName}

This file is auto-loaded by Claude Code at the start of every session.

## SDD Workflow

This project uses **Spec-Driven Development**. Skills are installed in \`.claude/skills/\`.

When asked to explore, analyze, document, propose, or implement any change:
1. Read \`.env.kanban\` to resolve the harness root (\`KANBAN_WORKSPACE/KANBAN_PROJECT\`)
2. Load the appropriate skill from \`.claude/skills/sdd-{phase}/SKILL.md\`
3. All artifacts (research, proposals, specs, design, plans) go to \`${harnessRoot}/\` — never to the source repo

## Harness Artifact Locations

| Artifact | Path |
|----------|------|
| Research / Exploration | \`${harnessRoot}/research/{topic}.md\` |
| Proposals | \`${harnessRoot}/proposals/active/{change}.md\` |
| Delta Specs | \`${harnessRoot}/specs/changes/{change}/{domain}.md\` |
| Source-of-truth Specs | \`${harnessRoot}/specs/{domain}/spec.md\` |
| Technical Design | \`${harnessRoot}/design/{change}.md\` |
| Task Plans | \`${harnessRoot}/plans/active/{change}.md\` |
| Verify Reports | \`${harnessRoot}/plans/{change}-verify.md\` |

## Available SDD Commands

| Command | What it does |
|---------|-------------|
| \`/sdd-init\` | Detect stack, create skill registry, update this file |
| \`/sdd-explore <topic>\` | Investigate and document a topic |
| \`/sdd-new <change>\` | Start a change: explore + propose |
| \`/sdd-ff <change>\` | Fast-forward: spec → design → tasks |
| \`/sdd-apply <change>\` | Implement tasks |
| \`/sdd-verify <change>\` | Validate implementation vs specs |
| \`/sdd-archive <change>\` | Merge specs and archive |
| \`/sdd-status\` | Show pipeline status for all active changes |

## Skill Registry

See \`.claude/skills/_shared/skill-registry.md\` for available skills and project context.
Run \`/sdd-init\` to regenerate with detected stack information.

## Project

- **ID**: ${projectId}
- **Harness**: ${harnessRoot}/
- **Skills**: .claude/skills/
- **Commands**: .claude/commands/
`;
}


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

    const { getSkillFiles } = await import('../utils/skillTemplates');
    const skills = getSkillFiles();

    const results: Array<{ filename: string; status: 'created' | 'updated' }> = [];
    for (const skill of skills) {
      const targetDir = path.join(sourcePath, skill.dir);
      await fs.mkdir(targetDir, { recursive: true });
      const filePath = path.join(targetDir, skill.filename);
      await fs.writeFile(filePath, skill.content, 'utf-8');
      results.push({ filename: `${skill.dir}/${skill.filename}`, status: 'created' });
    }

    // Write CLAUDE.md so Claude Code auto-loads SDD context on every session
    const claudeMdPath = path.join(sourcePath, 'CLAUDE.md');
    const projectName = meta.name ?? id;
    const harnessRoot = `~/.kanban/${id}`;
    const claudeMdContent = buildClaudeMd(projectName, id, harnessRoot);
    await fs.writeFile(claudeMdPath, claudeMdContent, 'utf-8');
    results.push({ filename: 'CLAUDE.md', status: 'created' });

    // Write .env.kanban if not present so SDD skills can resolve harness_root
    const envKanbanPath = path.join(sourcePath, '.env.kanban');
    let envExists = false;
    try { await fs.access(envKanbanPath); envExists = true; } catch { /* not found */ }
    if (!envExists) {
      const kanbanWorkspace = path.join(os.homedir(), '.kanban').replace(os.homedir(), '~');
      const envContent = `KANBAN_WORKSPACE=${kanbanWorkspace}\nKANBAN_PROJECT=${id}\nAWS_REGION=us-east-1\nAWS_ACCESS_KEY_ID=\nAWS_SECRET_ACCESS_KEY=\nBEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0\n`;
      await fs.writeFile(envKanbanPath, envContent, 'utf-8');
      results.push({ filename: '.env.kanban', status: 'created' });

      // Add .env.kanban to .gitignore
      const gitignorePath = path.join(sourcePath, '.gitignore');
      try {
        let gitignore = '';
        try { gitignore = await fs.readFile(gitignorePath, 'utf-8'); } catch { /* no .gitignore yet */ }
        if (!gitignore.split('\n').some(l => l.trim() === '.env.kanban')) {
          await fs.writeFile(gitignorePath, gitignore + (gitignore.endsWith('\n') ? '' : '\n') + '.env.kanban\n', 'utf-8');
        }
      } catch { /* non-fatal */ }
    }

    const commandsDir = path.join(sourcePath, '.claude', 'commands');
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
