import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Bot, Send, X, Wrench, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { WsEvent } from '../../shared/types';
import clsx from 'clsx';
import { getSession } from '../lib/api';

interface Props {
  projectId: string;
  sessionId?: string;
  initialMessages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
}

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

interface ToolActivity {
  name: string;
  input: Record<string, unknown>;
}

interface SseToolCallData {
  name: string;
  input: Record<string, unknown>;
}

interface SseMessageData {
  content: string;
  toolCallCount?: number;
}

interface SseErrorData {
  message: string;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n');
  let event = 'message';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      data = line.slice('data:'.length).trim();
    }
  }

  if (!data) return null;
  return { event, data };
}

export function AgentChat({ projectId, sessionId, initialMessages }: Props) {
  // Track the previous sessionId to reset state when it changes (derived state pattern)
  const [prevSessionId, setPrevSessionId] = useState<string | undefined>(sessionId);

  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages.map(m => ({ role: m.role, content: m.content }));
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<{ usd: number; durationMs?: number; inputTokens?: number; outputTokens?: number } | null>(null);

  // Derived state: reset messages when sessionId changes (render-phase setState, React-safe pattern)
  if (prevSessionId !== sessionId) {
    setPrevSessionId(sessionId);
    const mapped = (initialMessages && initialMessages.length > 0)
      ? initialMessages.map(m => ({ role: m.role, content: m.content }))
      : [];
    setMessages(mapped);
    setError(null);
    setToolActivity(null);
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Listen for background agent streaming events over WebSocket
  useEffect(() => {
    if (!sessionId) return;

    const wsUrl = (import.meta.env.VITE_WS_URL as string | undefined) || 'ws://localhost:3001/ws';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent;
        if ('sessionId' in data && data.sessionId !== sessionId) return;

        if (data.type === 'agent:text') {
          setLoading(true);
          setMessages(prev => {
            // Accumulate text into the last assistant message if it exists and is streaming
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && last.content.endsWith('…')) {
              return [...prev.slice(0, -1), { role: 'assistant', content: last.content.slice(0, -1) + data.text }];
            }
            return [...prev, { role: 'assistant', content: data.text }];
          });
          setToolActivity(null);
        } else if (data.type === 'agent:tool') {
          setLoading(true);
          setMessages(prev => [...prev, {
            role: 'tool',
            content: '',
            toolName: data.name,
            toolInput: data.input,
          }]);
          setToolActivity({ name: data.name, input: data.input });
        } else if (data.type === 'agent:done') {
          setLoading(false);
          setToolActivity(null);
          if (data.costUsd != null) {
            setLastCost({ usd: data.costUsd, durationMs: data.durationMs, inputTokens: data.inputTokens, outputTokens: data.outputTokens });
          }
        }
      } catch {
        // ignore malformed
      }
    };

    return () => ws.close();
  }, [sessionId]);

  // Scroll to bottom whenever messages or tool activity change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolActivity]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    const newMessages: Message[] = [...messages, userMessage];

    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);
    setToolActivity(null);

    abortRef.current = new AbortController();

    // Filter out tool messages before sending to API (API only accepts user/assistant)
    const apiMessages = newMessages
      .filter((m): m is Message & { role: 'user' | 'assistant' } => m.role !== 'tool')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, projectId, sessionId }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE blocks are separated by double newlines
        const blocks = buffer.split('\n\n');
        // Keep the last (possibly incomplete) block in the buffer
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed) continue;

          const parsed = parseSseBlock(trimmed);
          if (!parsed) continue;

          const { event, data } = parsed;

          if (event === 'tool_call') {
            const payload = JSON.parse(data) as SseToolCallData;
            setToolActivity({ name: payload.name, input: payload.input });
          } else if (event === 'message') {
            const payload = JSON.parse(data) as SseMessageData;
            const assistantMessage: Message = {
              role: 'assistant',
              content: payload.content,
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setToolActivity(null);
          } else if (event === 'done') {
            setToolActivity(null);
            setLoading(false);
          } else if (event === 'error') {
            const payload = JSON.parse(data) as SseErrorData;
            setError(payload.message);
            setToolActivity(null);
            setLoading(false);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled — no error display
      } else {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(message);
      }
    } finally {
      setLoading(false);
      setToolActivity(null);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function handleStop() {
    if (!sessionId) return;
    await fetch('/api/agent/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    setLoading(false);
    setToolActivity(null);
  }

  async function handleRefresh() {
    if (!sessionId) return;
    try {
      const full = await getSession(projectId, sessionId);
      setMessages(full.messages.map(m => ({ role: m.role, content: m.content })));
    } catch { /* ignore */ }
  }

  function formatToolInput(input: Record<string, unknown>): string {
    const entries = Object.entries(input);
    if (entries.length === 0) return '';
    return entries
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
      .join(', ');
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1f6feb] flex-shrink-0">
          <Bot size={15} className="text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#e6edf3] leading-tight">
            Agente Kanban
          </p>
          <p className="text-[10px] text-[#8b949e] leading-tight">
            Claude Agent SDK
          </p>
        </div>
        {lastCost && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#8b949e] flex-shrink-0" title={`Input: ${lastCost.inputTokens ?? '?'} tokens · Output: ${lastCost.outputTokens ?? '?'} tokens · Duration: ${lastCost.durationMs ? (lastCost.durationMs / 1000).toFixed(1) + 's' : '?'}`}>
            <span className="text-[#3fb950] font-medium">${lastCost.usd.toFixed(4)}</span>
          </div>
        )}
        {!loading && sessionId && (
          <button
            onClick={() => void handleRefresh()}
            className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
            aria-label="Refresh session messages"
            title="Refresh"
          >
            <RefreshCw size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#161b22] border border-[#30363d]">
              <Bot size={22} className="text-[#8b949e]" aria-hidden="true" />
            </div>
            <p className="text-sm text-[#8b949e] max-w-xs leading-relaxed">
              Pregunta al agente sobre tus tareas, epics o proyectos. Puede crear, mover y actualizar elementos del tablero.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          if (msg.role === 'tool') {
            return (
              <div key={idx} className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2d2a00] border border-[#4d4400] text-[#e3b341] text-xs">
                  <Wrench size={11} className="flex-shrink-0" aria-hidden="true" />
                  <span className="font-semibold">{msg.toolName}</span>
                  {msg.toolInput && Object.keys(msg.toolInput).length > 0 && (
                    <span className="text-[#d29922] truncate max-w-[300px]">
                      ({formatToolInput(msg.toolInput)})
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              className={clsx(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'max-w-[85%] bg-[#1f6feb] text-white rounded-br-sm break-words'
                    : 'max-w-[90%] bg-[#21262d] text-[#e6edf3] border border-[#30363d] rounded-bl-sm'
                )}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode; className?: string }) =>
                        inline ? (
                          <code className="bg-[#161b22] border border-[#30363d] rounded px-1 py-0.5 text-[#e6edf3] font-mono text-xs" {...props}>{children}</code>
                        ) : (
                          <pre className="bg-[#161b22] border border-[#30363d] rounded-md p-3 my-2 overflow-x-auto">
                            <code className="text-[#e6edf3] font-mono text-xs" {...props}>{children}</code>
                          </pre>
                        ),
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="text-[#e6edf3]">{children}</li>,
                      h1: ({ children }) => <h1 className="text-base font-bold text-[#e6edf3] mb-2 mt-3">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-bold text-[#e6edf3] mb-1.5 mt-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold text-[#e6edf3] mb-1 mt-2">{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold text-[#e6edf3]">{children}</strong>,
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#58a6ff] hover:underline">{children}</a>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-[#30363d] pl-3 text-[#8b949e] my-2">{children}</blockquote>,
                      hr: () => <hr className="border-[#30363d] my-3" />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          );
        })}

        {/* Tool activity indicator */}
        {toolActivity && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-[#2d2a00] border border-[#4d4400] text-[#e3b341] text-xs leading-relaxed">
              <Wrench
                size={12}
                className="flex-shrink-0 mt-0.5 animate-spin"
                aria-hidden="true"
              />
              <span>
                <span className="font-semibold">{toolActivity.name}</span>
                {formatToolInput(toolActivity.input) && (
                  <span className="text-[#d29922] ml-1">
                    ({formatToolInput(toolActivity.input)})
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Loading dots while waiting for first chunk */}
        {loading && !toolActivity && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl rounded-bl-sm bg-[#21262d] border border-[#30363d]">
              <span className="flex gap-1 items-center h-4">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-[#8b949e] animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-[#3d0f0f] border border-[#6e1a1a] text-[#ffa198] text-xs leading-relaxed">
              <X size={12} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer input */}
      <div className="flex-shrink-0 px-4 py-3 bg-[#161b22] border-t border-[#30363d]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            rows={1}
            aria-label="Chat input"
            className={clsx(
              'flex-1 resize-none bg-[#0d1117] text-[#e6edf3] text-sm placeholder-[#484f58]',
              'border border-[#30363d] rounded-lg px-3 py-2 leading-relaxed',
              'focus:outline-none focus:ring-1 focus:ring-[#58a6ff] focus:border-[#58a6ff]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'max-h-32 overflow-y-auto'
            )}
            style={{ height: 'auto', minHeight: '38px' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />

          {loading ? (
            abortRef.current ? (
              <button
                onClick={handleCancel}
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-[#21262d] border border-[#30363d] text-[#f85149] hover:bg-[#3d0f0f] hover:border-[#6e1a1a] transition-colors focus:outline-none focus:ring-1 focus:ring-[#f85149]"
                aria-label="Cancel request"
                title="Cancel"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : (
              <button
                onClick={() => void handleStop()}
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-[#21262d] border border-[#30363d] text-[#f85149] hover:bg-[#3d0f0f] hover:border-[#6e1a1a] transition-colors focus:outline-none focus:ring-1 focus:ring-[#f85149]"
                aria-label="Stop agent"
                title="Stop"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )
          ) : (
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim()}
              className={clsx(
                'flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-[#58a6ff]',
                input.trim()
                  ? 'bg-[#1f6feb] hover:bg-[#388bfd] text-white'
                  : 'bg-[#21262d] border border-[#30363d] text-[#484f58] cursor-not-allowed'
              )}
              aria-label="Send message"
              title="Send"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-[#484f58] text-center">
          Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
