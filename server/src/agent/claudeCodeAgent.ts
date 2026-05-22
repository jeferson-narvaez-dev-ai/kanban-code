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
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
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
  sessionId?: string;
  signal?: AbortSignal;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onText?: (text: string) => void;
}

export interface ClaudeCodeAgentResult {
  response: string;
  toolCallCount: number;
  costUsd?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

// ---------------------------------------------------------------------------
// Agent implementation
// ---------------------------------------------------------------------------

export async function chat(options: ClaudeCodeAgentOptions): Promise<ClaudeCodeAgentResult> {
  const { messages, projectId, onToolCall, onToolResult, onText, signal } = options;

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
Workspace: ${config.workspace}/${projectId}/
Project source path: ${projectPath}

## Kanban REST API (use Bash + curl to call these endpoints)
Base URL: http://localhost:${config.port}/api

- List tasks:   GET  /projects/${projectId}/tasks
- Create task:  POST /projects/${projectId}/tasks
  body: {"title":"...","column":"backlog","priority":"medium","description":"..."}
- Move task:    POST /projects/${projectId}/tasks/{taskId}/move
  body: {"toColumn":"waiting-approval","source":"agent"}   ← always include source:"agent"
- Update task:  PATCH /projects/${projectId}/tasks/{taskId}
  body: {"title":"...","priority":"high"}
- Delete task:  DELETE /projects/${projectId}/tasks/{taskId}
- Archive done: POST /projects/${projectId}/archive-done

Columns: backlog | in-progress | waiting-approval | review | done
Priorities: high | medium | low

Column flow: backlog → in-progress → waiting-approval → done
- Move to **waiting-approval** (with source:"agent") when you finish a task or have questions/blockers.
- NEVER move a task to done yourself — that is the human's decision after review.
- Always include "source":"agent" in move requests so the server does not re-trigger the agent.

## Task File Format
Task files (tasks/{column}/TASK-NNN.md) contain YAML frontmatter with these fields:
- title, priority, createdAt, epicId, role, goal, value — set by users/agents
- agentSessionId — set automatically by the system when the agent first runs; identifies the Claude session
- totalCostUsd, runCount, lastRunAt — updated automatically after each agent run; do not write these manually
The server automatically appends an "## Agent Runs" section after each run with cost and token details — you do not need to write this section yourself.
Write "## Implementation Notes" and optionally "## Questions" in the task body to document your work.

## Session Continuity
If this task was previously in development and sent back to in-progress, you will receive the prior conversation history as context. Review it before continuing work.

## Project File Structure
- \`references/\`  → external files provided by the user (PDF, CSV, Excel, TXT, images…). Read these for context. Do NOT write generated files here.
- \`flow/\`         → generated files (specs, designs, proposals, implementation notes, diagrams). Write all your generated artifacts here.

## Project Config
Project setup and test commands are in: ${config.workspace}/${projectId}/project-config.md
Read this file before starting work. Run testCommands and verify they pass before moving to waiting-approval.

## Notifications
Write important events (failures, blockers, warnings) to the notifications folder using the sdd-notify skill or by writing directly to:
  ${config.workspace}/${projectId}/notifications/{timestamp}-{slug}.md
Format: markdown with frontmatter (type, title, source: "agent", taskId, read: false, createdAt).
- type: error (blocks progress) | warning (not blocking) | info (milestone/FYI)
- slug = first 5 words of title, lowercased, spaces → dashes

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

    if (signal) {
      signal.addEventListener('abort', () => {
        proc.kill('SIGTERM');
      });
    }

    let responseText = '';
    let toolCallCount = 0;
    let buffer = '';
    let costUsd: number | undefined;
    let durationMs: number | undefined;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

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
        costUsd = result.total_cost_usd;
        durationMs = result.duration_ms;
        inputTokens = result.usage?.input_tokens;
        outputTokens = result.usage?.output_tokens;
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

      resolve({ response: responseText, toolCallCount, costUsd, durationMs, inputTokens, outputTokens });
    });
  });
}
