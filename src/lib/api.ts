import axios from 'axios';
import type { Epic as SharedEpic } from '../../shared/types';
import type { Epic, Project, Task } from '../types';

const api = axios.create({ baseURL: '/api' });

// --- Projects (nuevo backend Markdown) ---

export const getProjects = () =>
  api.get<Array<{ id: string; name: string; initialized: boolean; taskCount?: number }>>('/projects')
    .then(r => r.data.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: new Date().toISOString(), // el nuevo backend no guarda createdAt
    } as Project)));

export const createProject = (data: { id: string; name?: string; path?: string }) =>
  api.post('/projects', { id: data.id, name: data.name, path: data.path }).then(r => r.data);

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`);

export const initProject = (id: string) =>
  api.post(`/projects/${id}/init`).then(r => r.data);

// --- Epics ---

export const getEpics = (): Promise<Epic[]> => Promise.resolve([]);

export const listEpics = (projectId: string) =>
  api.get<SharedEpic[]>(`/projects/${projectId}/epics`).then(r => r.data);

export const createEpic = (projectId: string, data: { id: string; name: string; description?: string; color: string }) =>
  api.post<SharedEpic>(`/projects/${projectId}/epics`, data).then(r => r.data);

export const updateEpic = (projectId: string, epicId: string, data: Partial<Omit<SharedEpic, 'id' | 'createdAt'>>) =>
  api.patch<SharedEpic>(`/projects/${projectId}/epics/${epicId}`, data).then(r => r.data);

export const deleteEpic = (projectId: string, epicId: string) =>
  api.delete(`/projects/${projectId}/epics/${epicId}`);

// --- Tasks (nuevo backend Markdown) ---

export const getTasks = (_contextType: 'epic' | 'project', contextId: string): Promise<Task[]> =>
  api.get<Array<{ id: string; title: string; priority: string; column: string; createdAt: string; updatedAt?: string; description?: string; epicId?: string; role?: string; goal?: string; value?: string; tags?: string[] }>>
    (`/projects/${contextId}/tasks`)
    .then(r => r.data.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority as Task['priority'],
      status: (['in-progress', 'done', 'waiting-approval'].includes(t.column) ? t.column : 'todo') as Task['status'],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      description: t.description,
      epicId: t.epicId,
      role: t.role,
      goal: t.goal,
      value: t.value,
      tags: t.tags,
    } as Task)));

export const createTask = (data: Omit<Task, 'id' | 'createdAt'> & { contextType: 'epic' | 'project'; contextId: string }) =>
  api.post<Task>(`/projects/${data.contextId}/tasks`, {
    title: data.title,
    column: data.status === 'in-progress' ? 'in-progress' : data.status === 'done' ? 'done' : data.status === 'waiting-approval' ? 'waiting-approval' : 'backlog',
    priority: data.priority,
    description: data.description,
    epicId: data.epicId,
    role: data.role,
    goal: data.goal,
    value: data.value,
    tags: data.tags,
  }).then(r => r.data);

export const updateTask = (id: string, data: Partial<Task> & { contextId?: string }) =>
  api.patch<Task>(`/projects/${data.contextId ?? ''}/tasks/${id}`, data).then(r => r.data);

export const moveTask = (projectId: string, id: string, column: string) =>
  api.post<Task>(`/projects/${projectId}/tasks/${id}/move`, { toColumn: column }).then(r => r.data);

export const deleteTask = (projectId: string, id: string) =>
  api.delete(`/projects/${projectId}/tasks/${id}`);

// --- Files API ---

export const listFiles = (projectId: string, filePath?: string) =>
  api.get<{ path: string; entries: Array<{ name: string; type: 'file' | 'directory'; path: string }> }>(
    `/projects/${projectId}/files`,
    { params: filePath ? { path: filePath } : {} }
  ).then(r => r.data);

export const getFileContent = (projectId: string, filePath: string) =>
  api.get<{ path: string; content: string }>(
    `/projects/${projectId}/files/content`,
    { params: { path: filePath } }
  ).then(r => r.data);

export const saveFileContent = (projectId: string, filePath: string, content: string) =>
  api.put(`/projects/${projectId}/files/content`, { content }, { params: { path: filePath } }).then(r => r.data);

export const createFile = (projectId: string, filePath: string, type: 'file' | 'directory' = 'file') =>
  api.post(`/projects/${projectId}/files`, null, { params: { path: filePath, type } }).then(r => r.data);

export const deleteFile = (projectId: string, filePath: string) =>
  api.delete(`/projects/${projectId}/files`, { params: { path: filePath } }).then(r => r.data);

export const setupHarness = (projectId: string) =>
  api.post<{ success: boolean; commandsDir: string; skills: Array<{ filename: string; status: string }> }>(
    `/projects/${projectId}/harness`
  ).then(r => r.data);

// --- Sessions ---
export interface ChatSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSessionFull extends ChatSession {
  messages: ChatMessage[];
}

export const listSessions = (projectId: string) =>
  api.get<ChatSession[]>(`/projects/${projectId}/sessions`).then(r => r.data);

export const createSession = (projectId: string, id: string, name?: string) =>
  api.post<ChatSession>(`/projects/${projectId}/sessions`, { id, name }).then(r => r.data);

export const getSession = (projectId: string, sessionId: string) =>
  api.get<ChatSessionFull>(`/projects/${projectId}/sessions/${sessionId}`).then(r => r.data);

export const deleteSession = (projectId: string, sessionId: string) =>
  api.delete(`/projects/${projectId}/sessions/${sessionId}`).then(r => r.data);

export const renameSession = (projectId: string, sessionId: string, name: string) =>
  api.patch(`/projects/${projectId}/sessions/${sessionId}`, { name }).then(r => r.data);
