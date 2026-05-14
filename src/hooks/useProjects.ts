import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '../types';
import * as api from '../lib/api';

export function useProjects() {
  const qc = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: api.getProjects,
    refetchInterval: 3000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['projects'] });

  const createProjectMutation = useMutation({
    mutationFn: ({ name, path }: { name: string; path?: string }) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      return api.createProject({ id: slug, name, path });
    },
    onSuccess: invalidate,
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: invalidate,
  });

  const openFolder = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const createProject = useCallback((name: string, path?: string) => {
    createProjectMutation.mutate({ name, path });
  }, [createProjectMutation]);

  const deleteProject = useCallback(
    (id: string) => deleteProjectMutation.mutate(id),
    [deleteProjectMutation]
  );

  return { projects, openFolder, createProject, showCreateModal, setShowCreateModal, deleteProject };
}
