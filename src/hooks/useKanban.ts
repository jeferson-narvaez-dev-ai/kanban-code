import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Column, Status, Task } from '../types';
import * as api from '../lib/api';

interface UseKanbanOptions {
  mode: 'epic' | 'project';
  id: string;
}

export function useKanban({ mode, id }: UseKanbanOptions) {
  const qc = useQueryClient();
  const contextType = mode;

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', contextType, id],
    queryFn: () => api.getTasks(contextType, id),
    refetchInterval: 3000,
  });

  const columns: Column[] = [
    { id: 'todo', title: 'To Do', tasks: tasks.filter(t => t.status === 'todo') },
    { id: 'in-progress', title: 'In Progress', tasks: tasks.filter(t => t.status === 'in-progress') },
    { id: 'waiting-approval', title: 'Waiting Approval', tasks: tasks.filter(t => t.status === 'waiting-approval') },
    { id: 'done', title: 'Done', tasks: tasks.filter(t => t.status === 'done') },
  ];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks', contextType, id] });

  const addTaskMutation = useMutation({
    mutationFn: (payload: { status: Status; taskData: Omit<Task, 'id' | 'createdAt'> }) =>
      api.createTask({
        ...payload.taskData,
        status: payload.status,
        contextType,
        contextId: id,
      }),
    onSuccess: invalidate,
  });

  const editTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) =>
      api.updateTask(taskId, { ...updates, contextId: id }),
    onSuccess: invalidate,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteTask(id, taskId),
    onSuccess: invalidate,
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, toStatus }: { taskId: string; toStatus: Status }) =>
      api.moveTask(id, taskId, toStatus),
    onSuccess: invalidate,
  });

  return {
    columns,
    addTask: (status: Status, taskData: Omit<Task, 'id' | 'createdAt'>) =>
      addTaskMutation.mutate({ status, taskData }),
    editTask: (taskId: string, updates: Partial<Task>) =>
      editTaskMutation.mutate({ taskId, updates }),
    deleteTask: (taskId: string) => deleteTaskMutation.mutate(taskId),
    moveTask: (taskId: string, toStatus: Status) =>
      moveTaskMutation.mutate({ taskId, toStatus }),
  };
}
