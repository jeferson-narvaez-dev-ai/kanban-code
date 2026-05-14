import axios from 'axios';
import type { Epic, Project, Status, Task } from '../types';

const api = axios.create({ baseURL: '/api' });

// Projects
export const getProjects = () =>
  api.get<Project[]>('/projects').then(r => r.data);

export const createProject = (data: Omit<Project, 'createdAt'> & { createdAt?: string }) =>
  api.post<Project>('/projects', data).then(r => r.data);

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`);

// Epics
export const getEpics = () =>
  api.get<Epic[]>('/epics').then(r => r.data);

export const createEpic = (data: { id: string; name: string; description?: string; color: string; projectIds?: string[] }) =>
  api.post<Epic>('/epics', data).then(r => r.data);

export const updateEpic = (id: string, data: Partial<Epic>) =>
  api.put<Epic>(`/epics/${id}`, data).then(r => r.data);

export const deleteEpic = (id: string) =>
  api.delete(`/epics/${id}`);

// Tasks
export const getTasks = (contextType: 'epic' | 'project', contextId: string) =>
  api.get<Task[]>('/tasks', { params: { contextType, contextId } }).then(r => r.data);

export const createTask = (data: Omit<Task, 'id' | 'createdAt'> & { contextType: 'epic' | 'project'; contextId: string }) =>
  api.post<Task>('/tasks', data).then(r => r.data);

export const updateTask = (id: string, data: Partial<Task>) =>
  api.put<Task>(`/tasks/${id}`, data).then(r => r.data);

export const moveTask = (id: string, status: Status) =>
  api.patch<Task>(`/tasks/${id}/move`, { status }).then(r => r.data);

export const deleteTask = (id: string) =>
  api.delete(`/tasks/${id}`);
