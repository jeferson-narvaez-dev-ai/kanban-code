export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in-progress' | 'waiting-approval' | 'done';

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
  role?: string;           // "As a {role}"
  goal?: string;           // "I want to {goal}"
  value?: string;          // "so that {value}"
}

export interface Column {
  id: Status;
  title: string;
  tasks: Task[];
}
