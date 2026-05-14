import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
}

function sessionsDir(projectId: string): string {
  return path.join(config.workspace, projectId, 'sessions');
}

function sessionPath(projectId: string, sessionId: string): string {
  return path.join(sessionsDir(projectId), `${sessionId}.json`);
}

export async function listSessions(projectId: string): Promise<Omit<Session, 'messages'>[]> {
  const dir = sessionsDir(projectId);
  try {
    const entries = await fs.readdir(dir);
    const sessions = await Promise.all(
      entries.filter(e => e.endsWith('.json')).map(async (file) => {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        const s = JSON.parse(content) as Session;
        return { id: s.id, name: s.name, createdAt: s.createdAt, updatedAt: s.updatedAt };
      })
    );
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getSession(projectId: string, sessionId: string): Promise<Session | null> {
  try {
    const content = await fs.readFile(sessionPath(projectId, sessionId), 'utf-8');
    return JSON.parse(content) as Session;
  } catch {
    return null;
  }
}

export async function createSession(projectId: string, id: string, name: string): Promise<Session> {
  const dir = sessionsDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const session: Session = {
    id,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  await fs.writeFile(sessionPath(projectId, id), JSON.stringify(session, null, 2), 'utf-8');
  return session;
}

export async function appendMessages(
  projectId: string,
  sessionId: string,
  messages: SessionMessage[]
): Promise<void> {
  const session = await getSession(projectId, sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  session.messages.push(...messages);
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(sessionPath(projectId, sessionId), JSON.stringify(session, null, 2), 'utf-8');
}

export async function deleteSession(projectId: string, sessionId: string): Promise<void> {
  await fs.unlink(sessionPath(projectId, sessionId));
}

export async function renameSession(
  projectId: string,
  sessionId: string,
  name: string
): Promise<void> {
  const session = await getSession(projectId, sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  session.name = name;
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(sessionPath(projectId, sessionId), JSON.stringify(session, null, 2), 'utf-8');
}
