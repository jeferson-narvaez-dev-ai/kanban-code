import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Terminal, X } from 'lucide-react';
import { initProject } from '../api/client';
import type { Project } from '../../shared/types';

interface InitProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function InitProjectModal({ project, onClose }: InitProjectModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInit() {
    setLoading(true);
    setError(null);
    try {
      await initProject(project.id);
      await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo inicializar el proyecto. Inténtalo de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="init-project-title"
    >
      <div className="w-full max-w-md mx-4 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <h2
            id="init-project-title"
            className="text-[#e6edf3] font-semibold text-base"
          >
            Inicializar proyecto
          </h2>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-[#8b949e] text-sm">
            El proyecto{' '}
            <span className="text-[#e6edf3] font-medium">{project.name}</span>{' '}
            aun no ha sido inicializado. Ejecuta el siguiente comando en el
            directorio del proyecto o usa el boton de abajo.
          </p>

          {/* CLI instruction */}
          <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-md px-4 py-3">
            <Terminal
              size={14}
              className="text-[#8b949e] flex-shrink-0"
              aria-hidden="true"
            />
            <code className="text-sm text-[#58a6ff] font-mono select-all">
              npx kanban init
            </code>
          </div>

          <p className="text-[#484f58] text-xs">
            Esto creara la carpeta{' '}
            <code className="text-[#8b949e]">.kanban/</code> con la estructura
            necesaria para gestionar las tareas del proyecto.
          </p>

          {/* Error message */}
          {error && (
            <p className="text-[#f85149] text-sm bg-[#f85149]/10 border border-[#f85149]/30 rounded-md px-3 py-2" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#30363d]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-[#8b949e] hover:text-[#e6edf3] bg-transparent border border-[#30363d] hover:border-[#8b949e] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleInit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043]/50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#3fb950] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <span
                  className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
                Inicializando...
              </>
            ) : (
              'Inicializar ahora'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
