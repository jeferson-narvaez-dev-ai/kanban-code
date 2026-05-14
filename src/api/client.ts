import axios from 'axios';
import type { Task, Project, ColumnId } from '../../shared/types';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const getProjects = (): Promise<Project[]> =>
  client.get<Project[]>('/projects').then((r) => r.data);

export const getProject = (id: string): Promise<Project> =>
  client.get<Project>(`/projects/${id}`).then((r) => r.data);

export const createProject = (id: string): Promise<Project> =>
  client.post<Project>('/projects', { id }).then((r) => r.data);

export const initProject = (id: string): Promise<Project> =>
  client.post<Project>(`/projects/${id}/init`).then((r) => r.data);

export const deleteProject = (id: string): Promise<void> =>
  client.delete(`/projects/${id}`).then(() => undefined);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const getTasks = (projectId: string): Promise<Task[]> =>
  client
    .get<Task[]>(`/projects/${projectId}/tasks`)
    .then((r) => r.data);

export const getColumnTasks = (
  projectId: string,
  column: ColumnId,
): Promise<Task[]> =>
  client
    .get<Task[]>(`/projects/${projectId}/tasks/column/${column}`)
    .then((r) => r.data);

export const createTask = (
  projectId: string,
  task: Omit<Task, 'id' | 'createdAt'>,
): Promise<Task> =>
  client
    .post<Task>(`/projects/${projectId}/tasks`, task)
    .then((r) => r.data);

export const updateTask = (
  projectId: string,
  id: string,
  patch: Partial<Task>,
): Promise<Task> =>
  client
    .patch<Task>(`/projects/${projectId}/tasks/${id}`, patch)
    .then((r) => r.data);

export const deleteTask = (projectId: string, id: string): Promise<void> =>
  client
    .delete(`/projects/${projectId}/tasks/${id}`)
    .then(() => undefined);

export const moveTask = (
  projectId: string,
  id: string,
  toColumn: ColumnId,
): Promise<Task> =>
  client
    .post<Task>(`/projects/${projectId}/tasks/${id}/move`, { toColumn })
    .then((r) => r.data);
