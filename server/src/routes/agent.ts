import { Router, Request, Response } from 'express';
import { config } from '../config';
import { getSession, appendMessages } from '../store/sessionStore';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  const { messages, projectId, sessionId } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    projectId?: string;
    sessionId?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const resolvedProjectId = projectId ?? config.currentProject;

  try {
    const engine = process.env.AGENT_ENGINE || config.agentEngine;

    // Build message list: prepend history from session if sessionId is provided
    let fullMessages = messages;
    if (sessionId && resolvedProjectId) {
      const session = await getSession(resolvedProjectId, sessionId);
      if (session && session.messages.length > 0) {
        const history = session.messages.map(({ role, content }) => ({ role, content }));
        fullMessages = [...history, ...messages];
      }
    }

    let agentModule;
    if (config.bedrock.mockMode) {
      agentModule = await import('../agent/mockAgent');
    } else if (engine === 'claude-code') {
      agentModule = await import('../agent/claudeCodeAgent');
    } else {
      agentModule = await import('../agent/bedrockAgent');
    }

    const result = await agentModule.chat({
      messages: fullMessages,
      projectId: resolvedProjectId,
      onToolCall: (name, input) => sendEvent('tool_call', { name, input }),
      onToolResult: (name, toolResult) => sendEvent('tool_result', { name, result: toolResult }),
    });

    // Persist the new exchange to the session if sessionId is provided
    if (sessionId && resolvedProjectId) {
      const now = new Date().toISOString();
      const newMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content, timestamp: now })),
        { role: 'assistant' as const, content: result.response, timestamp: new Date().toISOString() },
      ];
      await appendMessages(resolvedProjectId, sessionId, newMessages).catch(() => {
        // Non-fatal: session may not exist yet if client forgot to create it
      });
    }

    sendEvent('message', { content: result.response, toolCallCount: result.toolCallCount });
    sendEvent('done', { toolCallCount: result.toolCallCount });
  } catch (err) {
    sendEvent('error', { message: err instanceof Error ? err.message : 'Unknown error' });
  } finally {
    res.end();
  }
});

router.post('/stop', async (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' });
    return;
  }

  const { runningAgents } = await import('../agent/taskAgent');
  const controller = runningAgents.get(sessionId);
  if (controller) {
    controller.abort();
    res.json({ stopped: true });
  } else {
    res.json({ stopped: false, reason: 'not found' });
  }
});

export default router;
