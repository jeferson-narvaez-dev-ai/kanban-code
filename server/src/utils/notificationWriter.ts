import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

export interface NotificationOptions {
  type: 'error' | 'warning' | 'info';
  title: string;
  source: 'agent' | 'system' | 'user';
  taskId?: string;
  body: string;
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-')
    .slice(0, 40);
}

function toTimestamp(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

export async function writeNotification(
  projectId: string,
  opts: NotificationOptions
): Promise<void> {
  const notificationsDir = path.join(config.workspace, projectId, 'notifications');
  await fs.mkdir(notificationsDir, { recursive: true });

  const timestamp = toTimestamp();
  const slug = toSlug(opts.title);
  const filename = `${timestamp}-${slug}.md`;
  const filePath = path.join(notificationsDir, filename);

  const frontmatter: Record<string, string> = {
    type: opts.type,
    title: JSON.stringify(opts.title),
    source: opts.source,
    read: 'false',
    createdAt: new Date().toISOString(),
  };
  if (opts.taskId) {
    frontmatter.taskId = opts.taskId;
  }

  const lines = ['---'];
  lines.push(`type: ${frontmatter.type}`);
  lines.push(`title: ${frontmatter.title}`);
  lines.push(`source: ${frontmatter.source}`);
  if (opts.taskId) lines.push(`taskId: ${opts.taskId}`);
  lines.push(`read: false`);
  lines.push(`createdAt: ${frontmatter.createdAt}`);
  lines.push('---');
  lines.push('');
  lines.push(opts.body);

  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
}
