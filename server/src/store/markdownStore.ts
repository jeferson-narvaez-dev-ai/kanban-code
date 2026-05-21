import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import matter from 'gray-matter';
import AsyncLock from 'async-lock';
import { Task, ColumnId, COLUMNS, Project, Epic } from '../types';
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

// --- Task ID generation ---

function generateTaskId(existing: string[]): string {
  const nums = existing
    .map(id => parseInt(id.replace('TASK-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `TASK-${String(next).padStart(3, '0')}`;
}

// --- File path helpers ---

function taskDirPath(projectId: string, column: ColumnId): string {
  return path.join(config.workspace, projectId, 'tasks', column);
}

function taskFilePath(projectId: string, column: ColumnId, taskId: string): string {
  return path.join(config.workspace, projectId, 'tasks', column, `${taskId}.md`);
}

function parseTaskFile(content: string, taskId: string, column: ColumnId): Task {
  const parsed = matter(content);
  return {
    id: taskId,
    title: parsed.data.title ?? taskId,
    description: parsed.content.trim() || undefined,
    priority: (parsed.data.priority as Task['priority']) || 'medium',
    epicId: parsed.data.epicId,
    column,
    createdAt: parsed.data.createdAt || new Date().toISOString(),
    updatedAt: parsed.data.updatedAt,
    role: parsed.data.role,
    goal: parsed.data.goal,
    value: parsed.data.value,
  };
}

function taskToFileContent(task: Task): string {
  const frontmatterObj: Record<string, unknown> = {
    title: task.title,
    priority: task.priority,
    createdAt: task.createdAt,
  };
  if (task.updatedAt) frontmatterObj.updatedAt = task.updatedAt;
  if (task.epicId) frontmatterObj.epicId = task.epicId;
  if (task.role) frontmatterObj.role = task.role;
  if (task.goal) frontmatterObj.goal = task.goal;
  if (task.value) frontmatterObj.value = task.value;
  return matter.stringify(task.description || '', frontmatterObj);
}

// --- File operations ---

export async function readColumn(projectId: string, column: ColumnId): Promise<Task[]> {
  const dir = taskDirPath(projectId, column);
  try {
    const entries = await fs.readdir(dir);
    const taskFiles = entries.filter(e => /^TASK-\d+\.md$/.test(e));
    // Sort by task number ascending
    taskFiles.sort((a, b) => {
      const numA = parseInt(a.replace('TASK-', '').replace('.md', ''), 10);
      const numB = parseInt(b.replace('TASK-', '').replace('.md', ''), 10);
      return numA - numB;
    });
    const tasks: Task[] = [];
    for (const file of taskFiles) {
      const taskId = file.replace('.md', '');
      const filePath = path.join(dir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      tasks.push(parseTaskFile(content, taskId, column));
    }
    return tasks;
  } catch {
    return [];
  }
}

export async function createTask(projectId: string, column: ColumnId, input: Omit<Task, 'id' | 'column' | 'createdAt'>): Promise<Task> {
  const dir = taskDirPath(projectId, column);
  await fs.mkdir(dir, { recursive: true });

  return lock.acquire(dir, async () => {
    const allIds = (await Promise.all(COLUMNS.map(c => readColumn(projectId, c)))).flat().map(t => t.id);
    const id = generateTaskId(allIds);
    const task: Task = { ...input, id, column, createdAt: new Date().toISOString() };
    const filePath = taskFilePath(projectId, column, id);
    await fs.writeFile(filePath, taskToFileContent(task), 'utf-8');
    return task;
  });
}

export async function moveTask(projectId: string, taskId: string, toColumn: ColumnId): Promise<Task> {
  let fromColumn: ColumnId | undefined;
  for (const col of COLUMNS) {
    const fp = taskFilePath(projectId, col, taskId);
    if (fsSync.existsSync(fp)) {
      fromColumn = col;
      break;
    }
  }
  if (!fromColumn) throw new Error(`Task ${taskId} not found`);

  const srcPath = taskFilePath(projectId, fromColumn, taskId);
  const dstPath = taskFilePath(projectId, toColumn, taskId);

  return lock.acquire([srcPath, dstPath].sort().join('|'), async () => {
    const content = await fs.readFile(srcPath, 'utf-8');
    const task = parseTaskFile(content, taskId, fromColumn as ColumnId);
    const updated: Task = { ...task, column: toColumn, updatedAt: new Date().toISOString() };
    await fs.mkdir(taskDirPath(projectId, toColumn), { recursive: true });
    await fs.writeFile(dstPath, taskToFileContent(updated), 'utf-8');
    await fs.unlink(srcPath);
    return updated;
  });
}

export async function updateTask(projectId: string, taskId: string, patch: Partial<Omit<Task, 'id' | 'column' | 'createdAt'>>): Promise<Task> {
  for (const col of COLUMNS) {
    const fp = taskFilePath(projectId, col, taskId);
    if (fsSync.existsSync(fp)) {
      return lock.acquire(fp, async () => {
        const content = await fs.readFile(fp, 'utf-8');
        const task = parseTaskFile(content, taskId, col);
        const updated: Task = { ...task, ...patch, updatedAt: new Date().toISOString() };
        await fs.writeFile(fp, taskToFileContent(updated), 'utf-8');
        return updated;
      });
    }
  }
  throw new Error(`Task ${taskId} not found`);
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  for (const col of COLUMNS) {
    const fp = taskFilePath(projectId, col, taskId);
    if (fsSync.existsSync(fp)) {
      const trashDir = path.join(config.workspace, projectId, 'tasks', '.trash');
      await fs.mkdir(trashDir, { recursive: true });
      const trashFile = path.join(trashDir, `${taskId}-${Date.now()}.md`);
      const content = await fs.readFile(fp, 'utf-8');
      await fs.writeFile(trashFile, content, 'utf-8');
      await fs.unlink(fp);
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

  for (const task of toArchive) {
    const srcPath = taskFilePath(projectId, 'done', task.id);
    const archiveFile = path.join(archiveDir, `${task.id}.md`);
    const content = await fs.readFile(srcPath, 'utf-8');
    await fs.writeFile(archiveFile, content, 'utf-8');
    await fs.unlink(srcPath);
  }

  return toArchive.length;
}

// --- Epic store ---

function epicPath(projectId: string, epicId: string): string {
  return path.join(config.workspace, projectId, 'epics', `${epicId}.md`);
}

function epicDirPath(projectId: string): string {
  return path.join(config.workspace, projectId, 'epics');
}

export async function listEpics(projectId: string): Promise<Epic[]> {
  const dir = epicDirPath(projectId);
  try {
    const entries = await fs.readdir(dir);
    const epicFiles = entries.filter(e => e.endsWith('.md'));
    const epics: Epic[] = [];
    for (const file of epicFiles) {
      const epicId = file.replace('.md', '');
      const content = await fs.readFile(path.join(dir, file), 'utf-8');
      const parsed = matter(content);
      epics.push({
        id: epicId,
        name: parsed.data.name ?? epicId,
        description: parsed.data.description,
        color: parsed.data.color ?? '#a371f7',
        createdAt: parsed.data.createdAt || new Date().toISOString(),
        updatedAt: parsed.data.updatedAt,
      });
    }
    return epics;
  } catch {
    return [];
  }
}

export async function createEpic(projectId: string, data: Omit<Epic, 'createdAt'>): Promise<Epic> {
  const dir = epicDirPath(projectId);
  await fs.mkdir(dir, { recursive: true });
  const createdAt = new Date().toISOString();
  const epic: Epic = { ...data, createdAt };
  const frontmatterObj: Record<string, unknown> = {
    name: epic.name,
    color: epic.color,
    createdAt,
  };
  if (epic.description) frontmatterObj.description = epic.description;
  const content = matter.stringify('', frontmatterObj);
  await fs.writeFile(epicPath(projectId, epic.id), content, 'utf-8');
  return epic;
}

export async function updateEpic(projectId: string, epicId: string, patch: Partial<Omit<Epic, 'id' | 'createdAt'>>): Promise<Epic> {
  const fp = epicPath(projectId, epicId);
  const content = await fs.readFile(fp, 'utf-8');
  const parsed = matter(content);
  const existing: Epic = {
    id: epicId,
    name: parsed.data.name ?? epicId,
    description: parsed.data.description,
    color: parsed.data.color ?? '#a371f7',
    createdAt: parsed.data.createdAt || new Date().toISOString(),
    updatedAt: parsed.data.updatedAt,
  };
  const updated: Epic = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const frontmatterObj: Record<string, unknown> = {
    name: updated.name,
    color: updated.color,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
  if (updated.description) frontmatterObj.description = updated.description;
  await fs.writeFile(fp, matter.stringify('', frontmatterObj), 'utf-8');
  return updated;
}

export async function deleteEpic(projectId: string, epicId: string): Promise<void> {
  const fp = epicPath(projectId, epicId);
  await fs.unlink(fp);
}

export async function listProjects(): Promise<Project[]> {
  try {
    const entries = await fs.readdir(config.workspace, { withFileTypes: true });
    const projects = await Promise.all(
      entries.filter(e => e.isDirectory()).map(async (entry): Promise<Project> => {
        const backlogDir = path.join(config.workspace, entry.name, 'tasks', 'backlog');
        let initialized = false;
        try {
          const stat = await fs.stat(backlogDir);
          initialized = stat.isDirectory();
        } catch {
          // tasks/backlog/ does not exist — project is not initialized
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
    path.join(projectRoot, 'tasks', '.trash'),
    path.join(projectRoot, 'epics'),
    path.join(projectRoot, 'research'),
    path.join(projectRoot, 'proposals', 'active'),
    path.join(projectRoot, 'proposals', 'accepted'),
    path.join(projectRoot, 'specs'),
    path.join(projectRoot, 'specs', 'changes'),
    path.join(projectRoot, 'design'),
    path.join(projectRoot, 'plans', 'active'),
    path.join(projectRoot, 'plans', 'completed'),
    path.join(projectRoot, 'references'),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Create column directories in tasks/
  for (const col of COLUMNS) {
    await fs.mkdir(path.join(projectRoot, 'tasks', col), { recursive: true });
  }

  // Create AGENTS.md if not present
  const agentsFile = path.join(projectRoot, 'AGENTS.md');
  if (!fsSync.existsSync(agentsFile)) {
    await fs.writeFile(agentsFile, `# Agent Instructions

This file defines how AI agents should work with this project.

## Harness Structure
- \`tasks/\` — Kanban board columns (one directory per column, one .md file per task)
- \`research/\` — Exploration notes and investigations
- \`proposals/active/\` — Active change proposals
- \`proposals/accepted/\` — Accepted/archived proposals
- \`specs/\` — Source-of-truth behavioral specs
- \`specs/changes/\` — Delta specs per active change
- \`design/\` — Technical design documents (ADRs)
- \`plans/active/\` — Implementation task lists (SDD tasks)
- \`plans/completed/\` — Completed plans
- \`references/\` — Reference material

## SDD Workflow (Spec-Driven Development)
Use these slash commands to manage changes:
- \`/sdd-new <change-name>\` — Start a new change (explore + propose)
- \`/sdd-ff <change-name>\` — Fast-forward: spec → design → tasks
- \`/sdd-apply <change-name>\` — Implement tasks
- \`/sdd-verify <change-name>\` — Verify implementation
- \`/sdd-archive <change-name>\` — Archive completed change
- \`/sdd-status [change-name]\` — Check pipeline status
- \`/sdd-continue <change-name>\` — Resume next missing step

## Dependency Chain
\`explore → propose → spec+design → tasks → apply → verify → archive\`

## Working Guidelines
- Always read ARCHITECTURE.md before making structural changes
- Create tasks in the appropriate column in \`tasks/\`
- Document decisions in the appropriate folder
- Use SDD for any substantial change (new feature, refactor, bug fix with broad impact)
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
