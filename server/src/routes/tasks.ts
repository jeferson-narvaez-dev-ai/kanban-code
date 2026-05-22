import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import {
  readColumn,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  readProjectMeta,
} from '../store/markdownStore';
import { COLUMNS, ColumnId, Task } from '../types';
import { config } from '../config';
import { triggerAgentForTask } from '../agent/taskAgent';
import { mergeTaskWorktree } from '../agent/worktreeManager';
import { writeNotification } from '../utils/notificationWriter';
import { kanbanWss } from '../index';

const execAsync = promisify(exec);

const router = Router({ mergeParams: true });

function isValidColumn(col: unknown): col is ColumnId {
  return typeof col === 'string' && (COLUMNS as string[]).includes(col);
}

// GET /api/projects/:projectId/tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const columns = await Promise.all(COLUMNS.map((col) => readColumn(projectId, col)));
    const tasks: Task[] = columns.flat();
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/projects/:projectId/tasks/column/:col
router.get('/column/:col', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const col = String(req.params['col']);
    if (!isValidColumn(col)) {
      res.status(400).json({ error: `Invalid column '${col}'. Valid columns: ${COLUMNS.join(', ')}` });
      return;
    }
    const tasks = await readColumn(projectId, col);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch column tasks' });
  }
});

// GET /api/projects/:projectId/tasks/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const id = String(req.params['id']);
    const columns = await Promise.all(COLUMNS.map((col) => readColumn(projectId, col)));
    const task = columns.flat().find((t) => t.id === id);
    if (!task) {
      res.status(404).json({ error: `Task '${id}' not found` });
      return;
    }
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/projects/:projectId/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const body = req.body as {
      title?: string;
      column?: string;
      priority?: Task['priority'];
      description?: string;
      epicId?: string;
    };

    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      res.status(400).json({ error: 'Missing required field: title' });
      return;
    }
    if (!isValidColumn(body.column)) {
      res.status(400).json({ error: `Missing or invalid field: column. Valid columns: ${COLUMNS.join(', ')}` });
      return;
    }

    const validPriorities: Task['priority'][] = ['high', 'medium', 'low'];
    const priority: Task['priority'] = validPriorities.includes(body.priority as Task['priority'])
      ? (body.priority as Task['priority'])
      : 'medium';

    const task = await createTask(projectId, body.column, {
      title: body.title.trim(),
      priority,
      description: body.description,
      epicId: body.epicId,
    });

    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /api/projects/:projectId/tasks/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const id = String(req.params['id']);
    const patch = req.body as Partial<Omit<Task, 'id' | 'column' | 'createdAt'>>;
    const task = await updateTask(projectId, id, patch);
    res.json(task);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/projects/:projectId/tasks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const id = String(req.params['id']);
    await deleteTask(projectId, id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/projects/:projectId/tasks/:id/move
router.post('/:id/move', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params['projectId']);
    const id = String(req.params['id']);
    const { toColumn, source } = req.body as { toColumn?: string; source?: 'user' | 'agent' };

    if (!isValidColumn(toColumn)) {
      res.status(400).json({ error: `Missing or invalid field: toColumn. Valid columns: ${COLUMNS.join(', ')}` });
      return;
    }

    // Test gate: run testCommands before allowing move to waiting-approval
    if (toColumn === 'waiting-approval') {
      const configFilePath = path.join(config.workspace, projectId, 'project-config.md');
      let testCommands: string[] = [];

      if (fsSync.existsSync(configFilePath)) {
        try {
          const raw = await fs.readFile(configFilePath, 'utf-8');
          const parsed = matter(raw);
          testCommands = (parsed.data.testCommands as string[] | undefined) ?? [];
        } catch {
          // If we can't read the config, skip the test gate
          testCommands = [];
        }
      }

      if (testCommands.length > 0) {
        // Resolve the project source path for running commands
        const meta = await readProjectMeta(projectId);
        const projectSourcePath = meta?.path
          ? path.resolve(meta.path.replace('~', os.homedir()))
          : process.cwd();

        const failedOutputs: string[] = [];
        for (const cmd of testCommands) {
          try {
            const { stdout, stderr } = await execAsync(cmd, {
              cwd: projectSourcePath,
              timeout: 120_000, // 2 min timeout per command
            });
            console.log(`[testGate] ${cmd} — passed`, stdout.slice(0, 200));
            void stderr; // may contain warnings; not a failure
          } catch (err: unknown) {
            const error = err as { stdout?: string; stderr?: string; message?: string };
            const output = [error.stdout, error.stderr, error.message]
              .filter(Boolean)
              .join('\n')
              .trim();
            failedOutputs.push(`$ ${cmd}\n${output}`);
          }
        }

        if (failedOutputs.length > 0) {
          const failureOutput = failedOutputs.join('\n\n---\n\n');
          // Write a notification about the failure
          try {
            await writeNotification(projectId, {
              type: 'error',
              title: `Tests failed before waiting-approval`,
              source: source === 'agent' ? 'agent' : 'system',
              taskId: id,
              body: `Test commands failed for task **${id}**. The task was NOT moved to \`waiting-approval\`.\n\n\`\`\`\n${failureOutput}\n\`\`\``,
            });
          } catch (notifErr) {
            console.error('[testGate] Failed to write notification', notifErr);
          }

          res.status(400).json({
            error: 'Tests failed — task not moved to waiting-approval',
            output: failureOutput,
          });
          return;
        }
      }
    }

    const task = await moveTask(projectId, id, toColumn);
    res.json(task);

    if (toColumn === 'in-progress' && source !== 'agent') {
      // Read agentMode from project-config.md (reuse the already-parsed config if available,
      // otherwise do a fresh read — only reaches here if toColumn !== 'waiting-approval')
      let agentMode: string = 'auto';
      const configFilePath = path.join(config.workspace, projectId, 'project-config.md');
      if (fsSync.existsSync(configFilePath)) {
        try {
          const raw = await fs.readFile(configFilePath, 'utf-8');
          const parsed = matter(raw);
          agentMode = (parsed.data.agentMode as string | undefined) ?? 'auto';
        } catch {
          // If we can't read the config, default to auto
        }
      }

      if (agentMode === 'auto') {
        triggerAgentForTask(projectId, task, kanbanWss).catch((err) => {
          console.error('[taskAgent] Failed to trigger agent for task', task.id, err);
        });
      } else {
        console.log(`[taskAgent] Skipped — project ${projectId} is in manual mode`);
      }
    }

    if (toColumn === 'done') {
      // Fire and forget — don't block the response
      mergeTaskWorktree(projectId, id).then((result) => {
        if (result.merged) {
          console.log(`[worktree] ${result.message}`);
        } else {
          console.warn(`[worktree] ${result.message}`);
        }
      }).catch((err) => {
        console.error('[worktree] Unexpected error', err);
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to move task' });
  }
});

export default router;
