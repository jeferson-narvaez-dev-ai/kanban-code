import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  const { messages, projectId } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    projectId?: string;
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

  try {
    const engine = process.env.AGENT_ENGINE || config.agentEngine;

    let agentModule;
    if (config.bedrock.mockMode) {
      agentModule = await import('../agent/mockAgent');
    } else if (engine === 'claude-code') {
      agentModule = await import('../agent/claudeCodeAgent');
    } else {
      agentModule = await import('../agent/bedrockAgent');
    }

    const result = await agentModule.chat({
      messages,
      projectId: projectId ?? config.currentProject,
      onToolCall: (name, input) => sendEvent('tool_call', { name, input }),
      onToolResult: (name, toolResult) => sendEvent('tool_result', { name, result: toolResult }),
    });

    sendEvent('message', { content: result.response, toolCallCount: result.toolCallCount });
    sendEvent('done', { toolCallCount: result.toolCallCount });
  } catch (err) {
    sendEvent('error', { message: err instanceof Error ? err.message : 'Unknown error' });
  } finally {
    res.end();
  }
});

export default router;
