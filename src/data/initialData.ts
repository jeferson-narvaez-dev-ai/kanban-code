import type { Column } from '../types';

export const initialColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    tasks: [
      {
        id: 'task-1',
        title: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing and deployment.',
        priority: 'high',
        status: 'todo',
        tags: ['devops', 'infra'],
        createdAt: '2026-04-20T10:00:00Z',
      },
      {
        id: 'task-2',
        title: 'Design database schema',
        description: 'Define entity relationships for the new user module.',
        priority: 'medium',
        status: 'todo',
        tags: ['backend', 'database'],
        createdAt: '2026-04-21T09:30:00Z',
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    tasks: [
      {
        id: 'task-3',
        title: 'Build Kanban board UI',
        description: 'Implement drag-and-drop kanban board with React and @dnd-kit.',
        priority: 'high',
        status: 'in-progress',
        tags: ['frontend', 'react'],
        createdAt: '2026-04-22T08:00:00Z',
      },
      {
        id: 'task-4',
        title: 'Write unit tests for auth',
        description: 'Cover login, logout, and token refresh flows with Jest.',
        priority: 'medium',
        status: 'in-progress',
        tags: ['testing'],
        createdAt: '2026-04-23T11:00:00Z',
      },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [
      {
        id: 'task-5',
        title: 'Project scaffolding',
        description: 'Initialize repo, configure Vite, TypeScript, and Tailwind CSS.',
        priority: 'low',
        status: 'done',
        tags: ['setup'],
        createdAt: '2026-04-18T14:00:00Z',
      },
      {
        id: 'task-6',
        title: 'Define API contract',
        description: 'Document REST endpoints and request/response shapes for frontend.',
        priority: 'medium',
        status: 'done',
        tags: ['backend', 'docs'],
        createdAt: '2026-04-19T16:00:00Z',
      },
    ],
  },
];
