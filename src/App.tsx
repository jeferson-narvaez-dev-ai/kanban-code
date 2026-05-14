import { useStore } from '@tanstack/react-store';
import { useQuery } from '@tanstack/react-query';
import { uiStore, navigateToEpic, navigateToProject, navigateHome } from './store/uiStore';
import { getEpics, getProjects } from './lib/api';
import { useProjects } from './hooks/useProjects';
import { useEpics } from './hooks/useEpics';
import { KanbanBoard } from './components/KanbanBoard';
import { HomeScreen } from './components/HomeScreen';

function App() {
  const { view, activeEpicId, activeProjectId } = useStore(uiStore);

  const { data: epics = [] } = useQuery({
    queryKey: ['epics'],
    queryFn: getEpics,
    refetchInterval: 3000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    refetchInterval: 3000,
  });

  const { openFolder } = useProjects();
  const { createEpic } = useEpics();

  if (view === 'epic' && activeEpicId) {
    const epic = epics.find((e) => e.id === activeEpicId);
    return (
      <KanbanBoard
        mode="epic"
        epicId={activeEpicId}
        epicName={epic?.name ?? 'Epic'}
        epicColor={epic?.color}
        epicPath={epic?.path}
        projects={projects}
        onNavigateHome={navigateHome}
      />
    );
  }

  if (view === 'project' && activeProjectId) {
    const project = projects.find((p) => p.id === activeProjectId);
    return (
      <KanbanBoard
        mode="project"
        projectId={activeProjectId}
        projectName={project?.name ?? 'Project'}
        projects={projects}
        onNavigateHome={navigateHome}
      />
    );
  }

  return (
    <HomeScreen
      epics={epics}
      projects={projects}
      onNavigateEpic={navigateToEpic}
      onNavigateProject={navigateToProject}
      onCreateEpic={createEpic}
      onOpenFolder={openFolder}
    />
  );
}

export default App;
