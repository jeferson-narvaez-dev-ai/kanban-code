import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import * as store from '../store/markdownStore';
import { config } from '../config';

// ---------------------------------------------------------------------------
// Stream-JSON message types emitted by `claude -p --output-format stream-json`
// ---------------------------------------------------------------------------

interface StreamSystemMessage {
  type: 'system';
  subtype: string;
}

interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
}

interface StreamAssistantMessage {
  type: 'assistant';
  message: {
    content: ContentBlock[];
  };
}

interface StreamToolResultMessage {
  type: 'tool_result';
  tool_use_id?: string;
  content?: unknown;
}

interface StreamResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  result?: string;
  is_error?: boolean;
}

type StreamMessage =
  | StreamSystemMessage
  | StreamAssistantMessage
  | StreamToolResultMessage
  | StreamResultMessage
  | { type: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ClaudeCodeAgentOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  projectId?: string;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onText?: (text: string) => void;
}

export interface ClaudeCodeAgentResult {
  response: string;
  toolCallCount: number;
}

// ---------------------------------------------------------------------------
// Agent implementation
// ---------------------------------------------------------------------------

export async function chat(options: ClaudeCodeAgentOptions): Promise<ClaudeCodeAgentResult> {
  const { messages, projectId, onToolCall, onToolResult, onText } = options;

  // Resolve project path
  const meta = projectId ? await store.readProjectMeta(projectId) : null;
  const projectPath = meta?.path
    ? path.resolve(meta.path.replace('~', os.homedir()))
    : process.cwd();

  // Build Kanban context block for the system prompt append
  const kanbanContext = projectId
    ? `
## Kanban Context
You are managing tasks for project: **${projectId}**
Workspace: ${config.workspace}/${projectId}/.kanban/
Project source path: ${projectPath}

## Kanban REST API (use Bash + curl to call these endpoints)
Base URL: http://localhost:${config.port}/api

- List tasks:   GET  /projects/${projectId}/tasks
- Create task:  POST /projects/${projectId}/tasks
  body: {"title":"...","column":"backlog","priority":"medium","description":"..."}
- Move task:    POST /projects/${projectId}/tasks/{taskId}/move
  body: {"toColumn":"in-progress"}
- Update task:  PATCH /projects/${projectId}/tasks/{taskId}
  body: {"title":"...","priority":"high"}
- Delete task:  DELETE /projects/${projectId}/tasks/{taskId}
- Archive done: POST /projects/${projectId}/archive-done

Columns: backlog | in-progress | review | done
Priorities: high | medium | low

When the user asks you to create, move, or manage tasks → use curl to call the API.
When the user asks you to explore the project → use Read/Grep/Glob on: ${projectPath}
`
    : '';

  const systemAppend = `You are a Kanban project management assistant with full access to the filesystem and terminal.${kanbanContext}
Always respond in the same language as the user.
When exploring code, be thorough — read relevant files before making recommendations.
When creating tasks, make them specific and actionable.`;

  // Build the prompt: include conversation history as plain text prefix
  const lastUserMessage = messages[messages.length - 1]?.content ?? '';
  const history = messages
    .slice(0, -1)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = history
    ? `Previous conversation:\n${history}\n\nUser: ${lastUserMessage}`
    : lastUserMessage;

  // Resolve claude binary: env override > common install paths > PATH
  const claudeBin =
    process.env.CLAUDE_BIN ||
    (() => {
      const candidates = [
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        `${os.homedir()}/.local/bin/claude`,
      ];
      const { execSync } = require('child_process') as typeof import('child_process');
      for (const p of candidates) {
        try { execSync(`test -x "${p}"`); return p; } catch { /* try next */ }
      }
      return 'claude'; // fallback to PATH
    })();

  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--append-system-prompt', systemAppend,
    fullPrompt,
  ];

  return new Promise<ClaudeCodeAgentResult>((resolve, reject) => {
    const proc = spawn(claudeBin, args, {
      cwd: projectPath,
      env: {
        ...process.env,
        // Ensure the child process inherits PATH so `claude` is findable
        PATH: process.env.PATH,
      },
    });

    let responseText = '';
    let toolCallCount = 0;
    let buffer = '';

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let msg: StreamMessage;
      try {
        msg = JSON.parse(trimmed) as StreamMessage;
      } catch {
        // Not JSON — skip (e.g. stderr mixed in)
        return;
      }

      if (msg.type === 'assistant') {
        const assistant = msg as StreamAssistantMessage;
        for (const block of assistant.message.content) {
          if (block.type === 'text' && block.text) {
            responseText += block.text;
            onText?.(block.text);
          } else if (block.type === 'tool_use' && block.name) {
            toolCallCount++;
            const input = (block.input ?? {}) as Record<string, unknown>;
            onToolCall?.(block.name, input);
          }
        }
      } else if (msg.type === 'tool_result') {
        const tr = msg as StreamToolResultMessage;
        const resultContent =
          typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content);
        onToolResult?.('tool', resultContent);
      } else if (msg.type === 'result') {
        const result = msg as StreamResultMessage;
        if (result.is_error) {
          reject(new Error(`Claude Code process error: ${result.result ?? 'unknown'}`));
          return;
        }
        // result.result contains the final text answer
        if (result.result && responseText === '') {
          responseText = result.result;
          onText?.(result.result);
        }
      }
    };

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      // Keep last partial line in buffer
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        processLine(line);
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      // Log stderr but don't fail (claude writes debug info there)
      process.stderr.write(`[claudeCodeAgent] ${chunk.toString()}`);
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });

    proc.on('close', (code) => {
      // Flush any remaining buffered content
      if (buffer.trim()) {
        processLine(buffer.trim());
        buffer = '';
      }

      if (code !== 0 && responseText === '') {
        reject(new Error(`Claude Code exited with code ${code}`));
        return;
      }

      resolve({ response: responseText, toolCallCount });
    });
  });
}
