export interface Epic {
  id: string;           // slug, e.g. "user-auth"
  name: string;
  description?: string;
  color: string;        // hex
  createdAt: string;
  updatedAt?: string;
}

export interface Task {
  id: string;           // TASK-001, TASK-002, etc.
  title: string;
  description?: string;
  epicId?: string;
  priority: 'high' | 'medium' | 'low';
  column: ColumnId;
  createdAt: string;    // ISO date string
  updatedAt?: string;
  role?: string;        // "As a {role}"
  goal?: string;        // "I want to {goal}"
  value?: string;       // "so that {value}"
}

export type ColumnId = 'backlog' | 'in-progress' | 'review' | 'done';

export const COLUMNS: ColumnId[] = ['backlog', 'in-progress', 'review', 'done'];

export interface Project {
  id: string;           // slug del nombre
  name: string;
  workspacePath: string; // ruta absoluta al directorio .kanban/
  initialized: boolean;
  taskCount?: number;
}

export interface Column {
  id: ColumnId;
  label: string;
  tasks: Task[];
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WsColumnChanged {
  type: 'column:changed';
  projectId: string;
  column: ColumnId;
  timestamp: string;
}

export interface WsConnected {
  type: 'connected';
  message: string;
}

export interface WsSessionCreated {
  type: 'session:created';
  sessionId: string;
  projectId: string;
  taskId: string;
}

export interface WsAgentText {
  type: 'agent:text';
  sessionId: string;
  projectId: string;
  text: string;
}

export interface WsAgentTool {
  type: 'agent:tool';
  sessionId: string;
  projectId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface WsAgentDone {
  type: 'agent:done';
  sessionId: string;
  projectId: string;
  costUsd?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export type WsEvent = WsColumnChanged | WsConnected | WsSessionCreated | WsAgentText | WsAgentTool | WsAgentDone;
