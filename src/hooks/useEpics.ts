import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Epic } from '../types';
import * as api from '../lib/api';

export function useEpics() {
  const qc = useQueryClient();

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ['epics'],
    queryFn: api.getEpics,
    refetchInterval: 3000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['epics'] });

  const createEpicMutation = useMutation({
    mutationFn: (data: { id: string; name: string; description?: string; color: string; projectIds?: string[]; path?: string }) =>
      api.createEpic(data),
    onSuccess: invalidate,
  });

  const updateEpicMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Epic> }) =>
      api.updateEpic(id, updates),
    onSuccess: invalidate,
  });

  const deleteEpicMutation = useMutation({
    mutationFn: (id: string) => api.deleteEpic(id),
    onSuccess: invalidate,
  });

  const createEpic = useCallback(
    (name: string, description: string | undefined, color: string, path?: string) => {
      const newEpic = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description?.trim() || undefined,
        color,
        projectIds: [],
        path,
      };
      createEpicMutation.mutate(newEpic);
    },
    [createEpicMutation]
  );

  const updateEpic = useCallback(
    (id: string, updates: Partial<Epic>) => updateEpicMutation.mutate({ id, updates }),
    [updateEpicMutation]
  );

  const deleteEpic = useCallback(
    (id: string) => deleteEpicMutation.mutate(id),
    [deleteEpicMutation]
  );

  return { epics, createEpic, updateEpic, deleteEpic };
}
