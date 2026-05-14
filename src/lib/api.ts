import axios from 'axios';
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

export const createProject = (data: { id: string; name?: string }) =>
  api.post('/projects', { id: data.id }).then(r => r.data);

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`);

export const initProject = (id: string) =>
  api.post(`/projects/${id}/init`).then(r => r.data);

// --- Epics (sin backend real, retorna vacío para no romper la UI) ---

export const getEpics = (): Promise<Epic[]> => Promise.resolve([]);

export const createEpic = (_data: { id: string; name: string; description?: string; color: string; projectIds?: string[] }): Promise<Epic> =>
  Promise.reject(new Error('Epics not supported in Markdown mode'));

export const updateEpic = (_id: string, _data: Partial<Epic>): Promise<Epic> =>
  Promise.reject(new Error('Epics not supported in Markdown mode'));

export const deleteEpic = (_id: string) => Promise.resolve();

// --- Tasks (nuevo backend Markdown) ---

export const getTasks = (_contextType: 'epic' | 'project', contextId: string): Promise<Task[]> =>
  api.get<Array<{ id: string; title: string; priority: string; column: string; createdAt: string; description?: string }>>
    (`/projects/${contextId}/tasks`)
    .then(r => r.data.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority as Task['priority'],
      status: (t.column === 'in-progress' ? 'in-progress' : t.column === 'done' ? 'done' : 'todo') as Task['status'],
      createdAt: t.createdAt,
      description: t.description,
    } as Task)));

export const createTask = (data: Omit<Task, 'id' | 'createdAt'> & { contextType: 'epic' | 'project'; contextId: string }) =>
  api.post<Task>(`/projects/${data.contextId}/tasks`, {
    title: data.title,
    column: data.status === 'in-progress' ? 'in-progress' : data.status === 'done' ? 'done' : 'backlog',
    priority: data.priority,
    description: data.description,
  }).then(r => r.data);

export const updateTask = (id: string, data: Partial<Task> & { contextId?: string }) =>
  api.patch<Task>(`/projects/${data.contextId ?? ''}/tasks/${id}`, data).then(r => r.data);

export const moveTask = (projectId: string, id: string, column: string) =>
  api.post<Task>(`/projects/${projectId}/tasks/${id}/move`, { toColumn: column }).then(r => r.data);

export const deleteTask = (projectId: string, id: string) =>
  api.delete(`/projects/${projectId}/tasks/${id}`);
