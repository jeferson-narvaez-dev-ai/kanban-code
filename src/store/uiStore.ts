import { Store } from '@tanstack/store';

interface UIState {
  view: 'home' | 'epic' | 'project';
  activeEpicId: string | null;
  activeProjectId: string | null;
  filterPriority: 'all' | 'high' | 'medium' | 'low';
  showTerminal: boolean;
}

export const uiStore = new Store<UIState>({
  view: 'home',
  activeEpicId: null,
  activeProjectId: null,
  filterPriority: 'all',
  showTerminal: false,
});

export function navigateToEpic(epicId: string) {
  uiStore.setState(s => ({ ...s, view: 'epic', activeEpicId: epicId }));
}

export function navigateToProject(projectId: string) {
  uiStore.setState(s => ({ ...s, view: 'project', activeProjectId: projectId }));
}

export function navigateHome() {
  uiStore.setState(s => ({ ...s, view: 'home', activeEpicId: null, activeProjectId: null }));
}

export function setFilterPriority(p: UIState['filterPriority']) {
  uiStore.setState(s => ({ ...s, filterPriority: p }));
}

export function toggleTerminal() {
  uiStore.setState(s => ({ ...s, showTerminal: !s.showTerminal }));
}
