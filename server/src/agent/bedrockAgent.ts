import {
  BedrockRuntimeClient,
  ConverseCommand,
  Message,
  Tool,
  ToolResultBlock,
  ToolResultContentBlock,
  ToolResultStatus,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config';
import * as store from '../store/markdownStore';
import { ColumnId, COLUMNS } from '../../../shared/types';

// Tool definitions para Bedrock
const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'list_projects',
      description: 'Lista todos los proyectos disponibles en el workspace',
      inputSchema: { json: { type: 'object', properties: {}, required: [] } },
    },
  },
  {
    toolSpec: {
      name: 'list_tasks',
      description: 'Lista las tareas de una columna específica o todas las columnas de un proyecto',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'ID del proyecto' },
            column: {
              type: 'string',
              enum: ['backlog', 'in-progress', 'review', 'done', 'all'],
              description: 'Columna a listar, o "all" para todas',
            },
          },
          required: ['projectId'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'create_task',
      description: 'Crea una nueva tarea en el tablero',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            column: { type: 'string', enum: ['backlog', 'in-progress', 'review', 'done'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            epicId: { type: 'string' },
          },
          required: ['projectId', 'title'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'move_task',
      description: 'Mueve una tarea a otra columna',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            taskId: { type: 'string' },
            toColumn: { type: 'string', enum: ['backlog', 'in-progress', 'review', 'done'] },
          },
          required: ['projectId', 'taskId', 'toColumn'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'update_task',
      description: 'Actualiza los campos de una tarea existente',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            taskId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['projectId', 'taskId'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'delete_task',
      description: 'Elimina una tarea del tablero (la mueve a .trash/)',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            taskId: { type: 'string' },
          },
          required: ['projectId', 'taskId'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'get_task',
      description: 'Obtiene los detalles de una tarea por su ID',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            taskId: { type: 'string' },
          },
          required: ['projectId', 'taskId'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'create_project',
      description: 'Crea e inicializa un nuevo proyecto en el workspace',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Slug del proyecto (sin espacios)' },
          },
          required: ['projectId'],
        },
      },
    },
  },
];

// Executor: mapea tool name → función del markdownStore
async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_projects':
      return store.listProjects();
    case 'list_tasks': {
      const projectId = input.projectId as string;
      const column = (input.column as string) || 'all';
      if (column === 'all') {
        const results = await Promise.all(COLUMNS.map(c => store.readColumn(projectId, c)));
        return results.flat();
      }
      return store.readColumn(projectId, column as ColumnId);
    }
    case 'create_task':
      return store.createTask(
        input.projectId as string,
        (input.column as ColumnId) || 'backlog',
        {
          title: input.title as string,
          description: input.description as string | undefined,
          priority: (input.priority as 'high' | 'medium' | 'low') || 'medium',
          epicId: input.epicId as string | undefined,
        }
      );
    case 'move_task':
      return store.moveTask(
        input.projectId as string,
        input.taskId as string,
        input.toColumn as ColumnId
      );
    case 'update_task':
      return store.updateTask(input.projectId as string, input.taskId as string, {
        title: input.title as string | undefined,
        description: input.description as string | undefined,
        priority: input.priority as 'high' | 'medium' | 'low' | undefined,
      });
    case 'delete_task':
      await store.deleteTask(input.projectId as string, input.taskId as string);
      return { success: true, taskId: input.taskId };
    case 'get_task': {
      const projectId = input.projectId as string;
      const taskId = input.taskId as string;
      for (const col of COLUMNS) {
        const tasks = await store.readColumn(projectId, col);
        const found = tasks.find(t => t.id === taskId);
        if (found) return found;
      }
      throw new Error(`Task ${taskId} not found`);
    }
    case 'create_project':
      await store.initProject(input.projectId as string);
      return { success: true, projectId: input.projectId };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export interface AgentChatOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  projectId?: string;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
}

export interface AgentChatResult {
  response: string;
  toolCallCount: number;
}

export async function chat(options: AgentChatOptions): Promise<AgentChatResult> {
  const { messages, projectId, onToolCall, onToolResult } = options;

  const client = new BedrockRuntimeClient({
    region: config.aws.region,
    credentials: config.aws.accessKeyId
      ? {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        }
      : undefined, // usa credenciales del entorno/IAM role si no están en config
  });

  const systemPrompt = [
    'Eres un asistente de gestión de proyectos para el tablero Kanban.',
    'Ayudas a organizar tareas, crear items en el backlog, mover tareas entre columnas y responder preguntas sobre el estado del proyecto.',
    projectId ? `Proyecto activo: ${projectId}.` : '',
    'Cuando el usuario pida crear, mover o listar tareas, usa las herramientas disponibles.',
    'Responde siempre en el mismo idioma que el usuario.',
  ]
    .filter(Boolean)
    .join(' ');

  const conversationMessages: Message[] = messages.map(m => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  let toolCallCount = 0;

  // Tool-use loop
  while (true) {
    const command = new ConverseCommand({
      modelId: config.bedrock.modelId,
      system: [{ text: systemPrompt }],
      messages: conversationMessages,
      toolConfig: { tools: TOOLS },
    });

    const response = await client.send(command);
    const stopReason = response.stopReason;
    const outputMessage = response.output?.message;

    if (!outputMessage) throw new Error('No output from Bedrock');

    conversationMessages.push(outputMessage);

    if (stopReason === 'end_turn') {
      const textBlock = outputMessage.content?.find(
        (b): b is { text: string } =>
          'text' in b && typeof (b as { text: string }).text === 'string'
      );
      return { response: textBlock?.text ?? '', toolCallCount };
    }

    if (stopReason === 'tool_use') {
      const toolResultBlocks: ToolResultBlock[] = [];

      for (const block of outputMessage.content ?? []) {
        if (!('toolUse' in block) || !block.toolUse) continue;
        const { toolUseId, name, input } = block.toolUse;
        if (!name || !toolUseId) continue;

        toolCallCount++;
        const toolInput = (input ?? {}) as Record<string, unknown>;
        onToolCall?.(name, toolInput);

        let result: unknown;
        let isError = false;
        try {
          result = await executeTool(name, toolInput);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
          isError = true;
        }

        onToolResult?.(name, result);

        const contentBlock: ToolResultContentBlock = { text: JSON.stringify(result) };
        const toolResultBlock: ToolResultBlock = {
          toolUseId,
          content: [contentBlock],
          status: isError ? ToolResultStatus.ERROR : ToolResultStatus.SUCCESS,
        };
        toolResultBlocks.push(toolResultBlock);
      }

      conversationMessages.push({
        role: 'user',
        content: toolResultBlocks.map(tr => ({ toolResult: tr })),
      });
    }
  }
}
