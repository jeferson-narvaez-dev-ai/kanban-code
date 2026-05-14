import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '../types';
import * as api from '../lib/api';

export function useProjects() {
  const qc = useQueryClient();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: api.getProjects,
    refetchInterval: 3000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['projects'] });

  const createProjectMutation = useMutation({
    mutationFn: (data: Omit<Project, 'createdAt'> & { createdAt?: string }) =>
      api.createProject(data),
    onSuccess: invalidate,
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: invalidate,
  });

  const openFolder = useCallback(async () => {
    let folderName: string | null = null;

    let localPath: string | undefined;

    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await (window as Window & typeof globalThis & {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        }).showDirectoryPicker();
        folderName = handle.name;
      } catch {
        // User cancelled or permission denied — do nothing
        return;
      }

      const promptedPath = window.prompt(
        `Local path for "${folderName}":`,
        `~/path/to/${folderName}`
      );
      // If user cancels the path prompt, still create the project but without a path
      localPath = promptedPath || undefined;
    } else {
      // Fallback for browsers that don't support File System Access API
      folderName = window.prompt('Enter a project name:');
      if (!folderName || folderName.trim() === '') return;
      folderName = folderName.trim();

      const promptedPath = window.prompt(
        `Local path for "${folderName}":`,
        `~/path/to/${folderName}`
      );
      localPath = promptedPath || undefined;
    }

    if (!folderName) return;

    createProjectMutation.mutate({
      id: crypto.randomUUID(),
      name: folderName,
      createdAt: new Date().toISOString(),
      path: localPath,
    });
  }, [createProjectMutation]);

  const deleteProject = useCallback(
    (id: string) => deleteProjectMutation.mutate(id),
    [deleteProjectMutation]
  );

  return { projects, openFolder, deleteProject };
}
