import { Router, Request, Response } from 'express';
import {
  readColumn,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
} from '../store/markdownStore';
import { COLUMNS, ColumnId, Task } from '../types';

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
    const { toColumn } = req.body as { toColumn?: string };

    if (!isValidColumn(toColumn)) {
      res.status(400).json({ error: `Missing or invalid field: toColumn. Valid columns: ${COLUMNS.join(', ')}` });
      return;
    }

    const task = await moveTask(projectId, id, toColumn);
    res.json(task);
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
