import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import matter from 'gray-matter';
import { WebSocketServer, WebSocket } from 'ws';
import { createSession, appendMessages, getSession } from '../store/sessionStore';
import { Task, COLUMNS } from '../types';
import * as claudeCodeAgent from './claudeCodeAgent';
import * as store from '../store/markdownStore';
import { config } from '../config';

export const runningAgents = new Map<string, AbortController>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findTaskFile(projectId: string, taskId: string): Promise<string | null> {
  for (const col of COLUMNS) {
    const filePath = path.join(config.workspace, projectId, 'tasks', col, `${taskId}.md`);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // not in this column
    }
  }
  return null;
}

async function updateTaskCost(
  projectId: string,
  taskId: string,
  result: claudeCodeAgent.ClaudeCodeAgentResult
): Promise<void> {
  const filePath = await findTaskFile(projectId, taskId);
  if (!filePath) {
    console.warn(`[taskAgent] updateTaskCost: task file not found for ${taskId}`);
    return;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(raw);
    const frontmatter = parsed.data as Record<string, unknown>;
    let body = parsed.content;

    // Update frontmatter fields
    const prevCost = typeof frontmatter.totalCostUsd === 'number' ? frontmatter.totalCostUsd : 0;
    const prevRunCount = typeof frontmatter.runCount === 'number' ? frontmatter.runCount : 0;
    frontmatter.totalCostUsd = prevCost + (result.costUsd ?? 0);
    frontmatter.runCount = prevRunCount + 1;
    frontmatter.lastRunAt = new Date().toISOString();

    const runNumber = frontmatter.runCount as number;
    const costFormatted = `$${(result.costUsd ?? 0).toFixed(4)}`;
    const durationSec = result.durationMs != null ? (result.durationMs / 1000).toFixed(1) + 's' : 'N/A';
    const inputTok = result.inputTokens ?? 0;
    const outputTok = result.outputTokens ?? 0;
    // cached tokens aren't tracked separately in the result type — omit if not available
    const tokensLine = `- Tokens: ${inputTok} in / ${outputTok} out`;

    const runEntry = `\n### Run ${runNumber} — ${frontmatter.lastRunAt}\n- Cost: ${costFormatted}\n${tokensLine}\n- Duration: ${durationSec}\n`;

    const agentRunsHeading = '## Agent Runs';
    if (body.includes(agentRunsHeading)) {
      // Append new entry after the heading (insert before the next ## heading or at end)
      const headingIndex = body.indexOf(agentRunsHeading);
      const afterHeading = body.indexOf('\n## ', headingIndex + agentRunsHeading.length);
      if (afterHeading === -1) {
        // No subsequent ## section — append at the end
        body = body.trimEnd() + '\n' + runEntry;
      } else {
        body = body.slice(0, afterHeading) + '\n' + runEntry + body.slice(afterHeading);
      }
    } else {
      // Create the section
      body = body.trimEnd() + '\n\n' + agentRunsHeading + '\n' + runEntry;
    }

    const newContent = matter.stringify(body, frontmatter);
    await fs.writeFile(filePath, newContent, 'utf-8');
  } catch (err) {
    console.error('[taskAgent] updateTaskCost failed', err);
  }
}

// ---------------------------------------------------------------------------
// Main trigger
// ---------------------------------------------------------------------------

export async function triggerAgentForTask(
  projectId: string,
  task: Task,
  wss?: WebSocketServer
): Promise<void> {
  // --- Feature 2: check for existing session in task frontmatter ---
  const inProgressPath = path.join(config.workspace, projectId, 'tasks', 'in-progress', `${task.id}.md`);
  let existingSessionId: string | undefined;
  let historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  try {
    const rawTask = await fs.readFile(inProgressPath, 'utf-8');
    const parsedTask = matter(rawTask);
    const fm = parsedTask.data as Record<string, unknown>;
    if (typeof fm.agentSessionId === 'string') {
      existingSessionId = fm.agentSessionId;
    }
  } catch {
    // File may not be readable yet — proceed with new session
  }

  let sessionId: string;

  if (existingSessionId) {
    const existingSession = await getSession(projectId, existingSessionId);
    if (existingSession) {
      // Reuse the existing session
      sessionId = existingSessionId;
      historyMessages = existingSession.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    } else {
      // Session was deleted — create a new one
      sessionId = crypto.randomUUID();
      const sessionName = `Agent: ${task.title}`;
      await createSession(projectId, sessionId, sessionName);
    }
  } else {
    // No prior session — create a new one
    sessionId = crypto.randomUUID();
    const sessionName = `Agent: ${task.title}`;
    await createSession(projectId, sessionId, sessionName);
  }

  // Persist session ID to the task frontmatter (task is still in in-progress at this point)
  try {
    const rawTask = await fs.readFile(inProgressPath, 'utf-8');
    const parsedTask = matter(rawTask);
    const fm = parsedTask.data as Record<string, unknown>;
    fm.agentSessionId = sessionId;
    await fs.writeFile(inProgressPath, matter.stringify(parsedTask.content, fm), 'utf-8');
  } catch (err) {
    console.warn('[taskAgent] Could not persist agentSessionId to task file', err);
  }

  // Resolve project path (same as claudeCodeAgent.ts)
  const meta = await store.readProjectMeta(projectId);
  const projectPath = meta?.path
    ? path.resolve(meta.path.replace('~', os.homedir()))
    : process.cwd();

  // Kanban directory for this project
  const kanbanDir = path.join(config.workspace, projectId);

  // Build initial prompt
  const lines: string[] = [`You are working on task ${task.id}: ${task.title}`];

  if (task.role && task.goal && task.value) {
    lines.push('');
    lines.push(`As a ${task.role}, I want to ${task.goal}, so that ${task.value}.`);
  } else if (task.role || task.goal || task.value) {
    const parts: string[] = [];
    if (task.role) parts.push(`Role: ${task.role}`);
    if (task.goal) parts.push(`Goal: ${task.goal}`);
    if (task.value) parts.push(`Value: ${task.value}`);
    lines.push('');
    lines.push(parts.join('. '));
  }

  if (task.description) {
    lines.push('');
    lines.push('## Description');
    lines.push(task.description);
  }

  if (task.epicId) {
    lines.push('');
    lines.push(`This task belongs to epic: ${task.epicId}`);
  }

  lines.push('');
  lines.push('## Your Workflow');
  lines.push('');
  lines.push('1. **Create a git worktree** for this task before making any changes:');
  lines.push('   ```bash');
  lines.push(`   cd ${projectPath}`);
  lines.push(`   git worktree add .worktrees/${task.id} -b task/${task.id}`);
  lines.push('   ```');
  lines.push(`   Do all development work inside \`.worktrees/${task.id}/\`.`);
  lines.push('');
  lines.push('2. **Implement the task** described above.');
  lines.push('');
  lines.push('3. **When finished or if you have questions**, before stopping:');
  lines.push(`   a. Append your work summary to the task file. The file is at:`);
  lines.push(`      \`${kanbanDir}/tasks/in-progress/${task.id}.md\``);
  lines.push('');
  lines.push('      Add a section like:');
  lines.push('      ```markdown');
  lines.push('      ## Implementation Notes');
  lines.push('      {summary of what was done}');
  lines.push('');
  lines.push('      ## Questions');
  lines.push('      {any questions or blockers — omit section if none}');
  lines.push('      ```');
  lines.push('      Use the Bash tool to write this directly to the file.');
  lines.push('');
  lines.push('   b. Move the task to waiting-approval:');
  lines.push('      ```bash');
  lines.push(
    `      curl -s -X POST http://localhost:${config.port}/api/projects/${projectId}/tasks/${task.id}/move \\`
  );
  lines.push('        -H "Content-Type: application/json" \\');
  lines.push('        -d \'{"toColumn":"waiting-approval","source":"agent"}\'');
  lines.push('      ```');
  lines.push('');
  lines.push('4. **Do NOT** delete the worktree — it stays for review.');

  const prompt = lines.join('\n');

  // Broadcast session:created to all connected WS clients
  if (wss) {
    const event = JSON.stringify({
      type: 'session:created',
      sessionId,
      projectId,
      taskId: task.id,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(event);
      }
    });
  }

  function broadcast(payload: object) {
    if (!wss) return;
    const msg = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  }

  const abortController = new AbortController();
  runningAgents.set(sessionId, abortController);

  // Build messages array: history + optional re-trigger note + new prompt
  const reRunNote: Array<{ role: 'user' | 'assistant'; content: string }> =
    historyMessages.length > 0
      ? [
          {
            role: 'user' as const,
            content:
              '[Task re-triggered: the task was reviewed and sent back to development. Continue from where you left off.]',
          },
        ]
      : [];

  const agentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...historyMessages,
    ...reRunNote,
    { role: 'user', content: prompt },
  ];

  let result: claudeCodeAgent.ClaudeCodeAgentResult | null = null;
  try {
    // Fire agent — stream text/tool events to all WS clients in real time
    result = await claudeCodeAgent.chat({
      messages: agentMessages,
      projectId,
      sessionId,
      signal: abortController.signal,
      onText: (text) => broadcast({ type: 'agent:text', sessionId, projectId, text }),
      onToolCall: (name, input) => broadcast({ type: 'agent:tool', sessionId, projectId, name, input }),
    });
  } finally {
    runningAgents.delete(sessionId);
    broadcast({
      type: 'agent:done',
      sessionId,
      projectId,
      costUsd: result?.costUsd,
      durationMs: result?.durationMs,
      inputTokens: result?.inputTokens,
      outputTokens: result?.outputTokens,
    });
  }

  if (result) {
    await appendMessages(projectId, sessionId, [
      { role: 'user', content: prompt, timestamp: new Date().toISOString() },
      { role: 'assistant', content: result.response, timestamp: new Date().toISOString() },
    ]).catch((err) => {
      console.error('[taskAgent] Failed to persist messages', err);
    });

    // Feature 1: update cumulative cost in task file
    await updateTaskCost(projectId, task.id, result).catch((err) => {
      console.error('[taskAgent] updateTaskCost error', err);
    });
  }
}
