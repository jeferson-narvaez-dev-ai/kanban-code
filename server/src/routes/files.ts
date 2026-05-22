import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { config } from '../config';

const router = Router({ mergeParams: true });

function resolveProjectRoot(projectId: string): string {
  return path.join(config.workspace, projectId);
}

function safePath(root: string, relPath: string): string | null {
  const resolved = path.resolve(root, relPath.replace(/^\//, ''));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

// GET /api/projects/:projectId/files?path=
// Lists directory entries. Returns { entries: [{name, type, path}] }
router.get('/', async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  const relPath = String(req.query['path'] || '');
  const root = resolveProjectRoot(projectId);
  const target = relPath ? safePath(root, relPath) : root;
  if (!target) { res.status(400).json({ error: 'Invalid path' }); return; }
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    const result = entries
      .filter(e => !e.name.startsWith('.') || e.name === 'tasks')
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        path: relPath ? `${relPath}/${e.name}` : e.name,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ path: relPath || '/', entries: result });
  } catch (err) {
    res.status(404).json({ error: `Cannot read path: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// GET /api/projects/:projectId/files/content?path=
// Returns file content as text
router.get('/content', async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  const relPath = String(req.query['path'] || '');
  if (!relPath) { res.status(400).json({ error: 'path query param required' }); return; }
  const root = resolveProjectRoot(projectId);
  const target = safePath(root, relPath);
  if (!target) { res.status(400).json({ error: 'Invalid path' }); return; }
  try {
    const content = await fs.readFile(target, 'utf-8');
    res.json({ path: relPath, content });
  } catch (err) {
    res.status(404).json({ error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// GET /api/projects/:projectId/files/raw?path=
// Serves a file as binary with correct Content-Type (for PDFs, images, etc.)
router.get('/raw', async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  const relPath = String(req.query['path'] || '');
  if (!relPath) { res.status(400).json({ error: 'path query param required' }); return; }
  const root = resolveProjectRoot(projectId);
  const target = safePath(root, relPath);
  if (!target) { res.status(400).json({ error: 'Invalid path' }); return; }
  try {
    const ext = path.extname(target).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
    };
    const contentType = mimeMap[ext] ?? 'application/octet-stream';
    const data = await fs.readFile(target);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(data);
  } catch (err) {
    res.status(404).json({ error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// PUT /api/projects/:projectId/files/content?path=
// Saves file content
router.put('/content', async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  const relPath = String(req.query['path'] || '');
  if (!relPath) { res.status(400).json({ error: 'path query param required' }); return; }
  const root = resolveProjectRoot(projectId);
  const target = safePath(root, relPath);
  if (!target) { res.status(400).json({ error: 'Invalid path' }); return; }
  const { content } = req.body as { content?: string };
  if (typeof content !== 'string') { res.status(400).json({ error: 'content string required' }); return; }
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
    res.json({ success: true, path: relPath });
  } catch (err) {
    res.status(500).json({ error: `Cannot write file: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// POST /api/projects/:projectId/files?path=&type=file|directory
// Creates a file or directory
router.post('/', async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  const relPath = String(req.query['path'] || '');
  const type = String(req.query['type'] || 'file');
  if (!relPath) { res.status(400).json({ error: 'path query param required' }); return; }
  const root = resolveProjectRoot(projectId);
  const target = safePath(root, relPath);
  if (!target) { res.status(400).json({ error: 'Invalid path' }); return; }
  try {
    if (type === 'directory') {
      await fs.mkdir(target, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, '', 'utf-8');
    }
    res.status(201).json({ success: true, path: relPath, type });
  } catch (err) {
    res.status(500).json({ error: `Cannot create: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// POST /api/projects/:projectId/files/upload
// Accepts multipart/form-data and saves files to references/ (external files only).
// references/ is reserved for user-provided external files (PDF, CSV, Excel, TXT, images, etc.).
// Agent-generated files (specs, designs, proposals, notes) belong in flow/ instead.
const upload = multer({ storage: multer.memoryStorage() });
router.post('/upload', upload.array('file'), async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  const root = resolveProjectRoot(projectId);
  const referencesDir = path.join(root, 'references');

  await fs.mkdir(referencesDir, { recursive: true });

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const savedFiles: string[] = [];
  for (const file of files) {
    const safeName = path.basename(file.originalname);
    const dest = path.join(referencesDir, safeName);
    await fs.writeFile(dest, file.buffer);
    savedFiles.push(`references/${safeName}`);
  }

  res.json({ uploaded: savedFiles });
});

// DELETE /api/projects/:projectId/files?path=
router.delete('/', async (req: Request, res: Response) => {
  const projectId = String(req.params['projectId']);
  const relPath = String(req.query['path'] || '');
  if (!relPath) { res.status(400).json({ error: 'path query param required' }); return; }
  const root = resolveProjectRoot(projectId);
  const target = safePath(root, relPath);
  if (!target) { res.status(400).json({ error: 'Invalid path' }); return; }
  const protectedPaths = ['tasks', 'meta.json', 'AGENTS.md', 'ARCHITECTURE.md'];
  if (protectedPaths.includes(relPath)) { res.status(403).json({ error: 'Cannot delete protected path' }); return; }
  try {
    await fs.rm(target, { recursive: true, force: true });
    res.json({ success: true, path: relPath });
  } catch (err) {
    res.status(500).json({ error: `Cannot delete: ${err instanceof Error ? err.message : String(err)}` });
  }
});

export default router;
