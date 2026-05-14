export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in-progress' | 'done';

export interface Project {
  id: string;       // crypto.randomUUID()
  name: string;     // from FileSystemDirectoryHandle.name
  createdAt: string;
  path?: string;    // local filesystem path for terminal cwd
}

export interface Epic {
  id: string;
  name: string;
  description?: string;
  color: string;  // hex accent color chosen at creation
  createdAt: string;
  projectIds: string[]; // projects linked to this epic
  path?: string;  // local filesystem path for terminal cwd
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  tags?: string[];
  createdAt: string;
  projectId?: string;      // which project this task belongs to (optional)
  epicId?: string;         // parent epic id
  parentProjectId?: string;
  contextType?: 'epic' | 'project';
  contextId?: string;
}

export interface Column {
  id: Status;
  title: string;
  tasks: Task[];
}
