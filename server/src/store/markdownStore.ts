import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import matter from 'gray-matter';
import AsyncLock from 'async-lock';
import { Task, ColumnId, COLUMNS, Project } from '../types';
import { config } from '../config';

// --- Project metadata ---

export interface ProjectMeta {
  id: string;
  name: string;
  path?: string; // ruta al código fuente del proyecto
  createdAt: string;
}

function metaPath(projectId: string): string {
  return path.join(config.workspace, projectId, 'meta.json');
}

export async function readProjectMeta(projectId: string): Promise<ProjectMeta | null> {
  try {
    const content = await fs.readFile(metaPath(projectId), 'utf-8');
    return JSON.parse(content) as ProjectMeta;
  } catch {
    return null;
  }
}

export async function writeProjectMeta(meta: ProjectMeta): Promise<void> {
  const dir = path.join(config.workspace, meta.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(metaPath(meta.id), JSON.stringify(meta, null, 2), 'utf-8');
}

const lock = new AsyncLock();

// --- Task parsing ---

function generateTaskId(existing: string[]): string {
  const nums = existing
    .map(id => parseInt(id.replace('TASK-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `TASK-${String(next).padStart(3, '0')}`;
}

function parseTasksFromMarkdown(content: string, column: ColumnId): Task[] {
  const taskRegex = /^## (TASK-\d+): (.+?)$([\s\S]*?)(?=^## TASK-|$)/gm;
  const tasks: Task[] = [];
  let match;
  while ((match = taskRegex.exec(content)) !== null) {
    const [, id, title, body] = match;
    const parsed = matter(`---\n${body.trim()}\n---`);
    tasks.push({
      id,
      title: title.trim(),
      description: parsed.content.trim() || undefined,
      priority: (parsed.data.priority as Task['priority']) || 'medium',
      epicId: parsed.data.epicId,
      column,
      createdAt: parsed.data.createdAt || new Date().toISOString(),
      updatedAt: parsed.data.updatedAt,
    });
  }
  return tasks;
}

function taskToMarkdown(task: Task): string {
  const meta = [
    `priority: ${task.priority}`,
    `createdAt: ${task.createdAt}`,
    task.updatedAt ? `updatedAt: ${task.updatedAt}` : null,
    task.epicId ? `epicId: ${task.epicId}` : null,
  ].filter(Boolean).join('\n');

  return `## ${task.id}: ${task.title}\n\n${meta}\n\n${task.description || ''}\n`;
}

// --- File operations ---

function columnPath(projectId: string, column: ColumnId): string {
  return path.join(config.workspace, projectId, 'tasks', `${column}.md`);
}

export async function readColumn(projectId: string, column: ColumnId): Promise<Task[]> {
  const filePath = columnPath(projectId, column);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseTasksFromMarkdown(content, column);
  } catch {
    return [];
  }
}

export async function writeColumn(projectId: string, column: ColumnId, tasks: Task[]): Promise<void> {
  const filePath = columnPath(projectId, column);
  const tmpPath = `${filePath}.tmp`;
  const header = `# ${column.charAt(0).toUpperCase() + column.slice(1)}\n\n`;
  const content = header + tasks.map(taskToMarkdown).join('\n---\n\n');
  await lock.acquire(filePath, async () => {
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, filePath);
  });
}

export async function createTask(projectId: string, column: ColumnId, input: Omit<Task, 'id' | 'column' | 'createdAt'>): Promise<Task> {
  return lock.acquire(columnPath(projectId, column), async () => {
    const existing = await readColumn(projectId, column);
    const allIds = (await Promise.all(COLUMNS.map(c => readColumn(projectId, c)))).flat().map(t => t.id);
    const id = generateTaskId(allIds);
    const task: Task = { ...input, id, column, createdAt: new Date().toISOString() };
    await writeColumn(projectId, column, [...existing, task]);
    return task;
  });
}

export async function moveTask(projectId: string, taskId: string, toColumn: ColumnId): Promise<Task> {
  let found: Task | undefined;
  let fromColumn: ColumnId | undefined;
  for (const col of COLUMNS) {
    const tasks = await readColumn(projectId, col);
    const task = tasks.find(t => t.id === taskId);
    if (task) { found = task; fromColumn = col; break; }
  }
  if (!found || !fromColumn) throw new Error(`Task ${taskId} not found`);
  const updated: Task = { ...found, column: toColumn, updatedAt: new Date().toISOString() };
  const srcTasks = (await readColumn(projectId, fromColumn)).filter(t => t.id !== taskId);
  const dstTasks = [...(await readColumn(projectId, toColumn)), updated];
  await writeColumn(projectId, fromColumn, srcTasks);
  await writeColumn(projectId, toColumn, dstTasks);
  return updated;
}

export async function updateTask(projectId: string, taskId: string, patch: Partial<Omit<Task, 'id' | 'column' | 'createdAt'>>): Promise<Task> {
  for (const col of COLUMNS) {
    const tasks = await readColumn(projectId, col);
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
      await writeColumn(projectId, col, tasks);
      return tasks[idx];
    }
  }
  throw new Error(`Task ${taskId} not found`);
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  for (const col of COLUMNS) {
    const tasks = await readColumn(projectId, col);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const trashDir = path.join(config.workspace, projectId, 'tasks', '.trash');
      await fs.mkdir(trashDir, { recursive: true });
      const trashFile = path.join(trashDir, `${taskId}-${Date.now()}.md`);
      await fs.writeFile(trashFile, taskToMarkdown(task), 'utf-8');
      await writeColumn(projectId, col, tasks.filter(t => t.id !== taskId));
      return;
    }
  }
  throw new Error(`Task ${taskId} not found`);
}

export async function archiveDone(projectId: string, olderThanDays = 30): Promise<number> {
  const tasks = await readColumn(projectId, 'done');
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const toArchive = tasks.filter(t => {
    const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : new Date(t.createdAt).getTime();
    return updated < cutoff;
  });
  if (toArchive.length === 0) return 0;

  const archiveDir = path.join(config.workspace, projectId, 'tasks', 'archive');
  await fs.mkdir(archiveDir, { recursive: true });
  const archiveFile = path.join(archiveDir, `done-${new Date().toISOString().split('T')[0]}.md`);
  const content = `# Archived ${new Date().toISOString()}\n\n` + toArchive.map(taskToMarkdown).join('\n---\n\n');
  await fs.writeFile(archiveFile, content, 'utf-8');

  const remaining = tasks.filter(t => !toArchive.find(a => a.id === t.id));
  await writeColumn(projectId, 'done', remaining);
  return toArchive.length;
}

export async function listProjects(): Promise<Project[]> {
  try {
    const entries = await fs.readdir(config.workspace, { withFileTypes: true });
    const projects = await Promise.all(
      entries.filter(e => e.isDirectory()).map(async (entry): Promise<Project> => {
        const tasksPath = path.join(config.workspace, entry.name, 'tasks');
        let initialized = false;
        try {
          await fs.access(path.join(tasksPath, 'backlog.md'));
          initialized = true;
        } catch {
          // tasks/backlog.md does not exist — project is not initialized
        }
        const meta = await readProjectMeta(entry.name);
        return {
          id: entry.name,
          name: meta?.name ?? entry.name,
          workspacePath: path.join(config.workspace, entry.name),
          initialized,
          path: meta?.path,
        };
      })
    );
    return projects;
  } catch {
    return [];
  }
}

export async function initProject(projectId: string, meta?: Partial<ProjectMeta>): Promise<void> {
  const projectRoot = path.join(config.workspace, projectId);

  // Create all harness directories
  const dirs = [
    path.join(projectRoot, 'tasks'),
    path.join(projectRoot, 'research'),
    path.join(projectRoot, 'proposals', 'active'),
    path.join(projectRoot, 'proposals', 'accepted'),
    path.join(projectRoot, 'specs'),
    path.join(projectRoot, 'design'),
    path.join(projectRoot, 'plans', 'active'),
    path.join(projectRoot, 'plans', 'completed'),
    path.join(projectRoot, 'references'),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Create column files in tasks/
  for (const col of COLUMNS) {
    const filePath = path.join(projectRoot, 'tasks', `${col}.md`);
    if (!fsSync.existsSync(filePath)) {
      const label = col.charAt(0).toUpperCase() + col.slice(1);
      await fs.writeFile(filePath, `# ${label}\n\n<!-- tasks -->\n`, 'utf-8');
    }
  }

  // Create AGENTS.md if not present
  const agentsFile = path.join(projectRoot, 'AGENTS.md');
  if (!fsSync.existsSync(agentsFile)) {
    await fs.writeFile(agentsFile, `# Agent Instructions

This file defines how AI agents should work with this project.

## Context
- Tasks are stored in \`tasks/\` as Markdown files
- Research notes go in \`research/\`
- Proposals (active) go in \`proposals/active/\`
- Accepted proposals move to \`proposals/accepted/\`
- Specs go in \`specs/\`
- Design decisions go in \`design/\`
- Plans go in \`plans/active/\` and \`plans/completed/\`
- Reference material goes in \`references/\`

## Working Guidelines
- Always read ARCHITECTURE.md before making structural changes
- Create tasks in the appropriate column in \`tasks/\`
- Document decisions in the appropriate folder
`, 'utf-8');
  }

  // Create ARCHITECTURE.md if not present
  const archFile = path.join(projectRoot, 'ARCHITECTURE.md');
  if (!fsSync.existsSync(archFile)) {
    await fs.writeFile(archFile, `# Architecture

Document the high-level architecture of this project here.

## Overview

## Key Decisions

## Tech Stack
`, 'utf-8');
  }

  await writeProjectMeta({
    id: projectId,
    name: meta?.name ?? projectId,
    path: meta?.path,
    createdAt: meta?.createdAt ?? new Date().toISOString(),
  });
}
