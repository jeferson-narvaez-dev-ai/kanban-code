import {
  BedrockRuntimeClient,
  ConverseCommand,
  Message,
  Tool,
  ToolResultBlock,
  ToolResultContentBlock,
  ToolResultStatus,
} from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config';
import * as store from '../store/markdownStore';
import { ColumnId, COLUMNS } from '../types';

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
  {
    toolSpec: {
      name: 'list_directory',
      description: 'Lista archivos y directorios en el proyecto. Úsalo para explorar la estructura del código fuente.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            subpath: { type: 'string', description: 'Subdirectorio relativo al proyecto (opcional, default: raíz)' },
          },
          required: ['projectId'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'read_file',
      description: 'Lee el contenido de un archivo del proyecto. Úsalo para entender el código y crear tareas relevantes.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            filePath: { type: 'string', description: 'Ruta relativa al archivo dentro del proyecto' },
            maxLines: { type: 'number', description: 'Máximo de líneas a leer (default: 200)' },
          },
          required: ['projectId', 'filePath'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'search_in_files',
      description: 'Busca texto o patrones en los archivos del proyecto. Útil para encontrar TODOs, FIXMEs, funciones, etc.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            pattern: { type: 'string', description: 'Texto o patrón a buscar' },
            glob: { type: 'string', description: 'Patrón glob de archivos (ej: "**/*.go", "**/*.ts"). Default: todos los archivos de texto' },
            maxResults: { type: 'number', description: 'Máximo de resultados (default: 20)' },
          },
          required: ['projectId', 'pattern'],
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
    case 'list_directory': {
      const meta = await store.readProjectMeta(input.projectId as string);
      if (!meta?.path) return { error: 'Project has no path configured. Set the project path first.' };

      const expandedPath = (meta.path as string).replace('~', os.homedir());
      const subpath = (input.subpath as string) || '';
      const targetPath = path.join(expandedPath, subpath);

      if (!targetPath.startsWith(expandedPath)) return { error: 'Path traversal not allowed' };

      try {
        const entries = await fsPromises.readdir(targetPath, { withFileTypes: true });
        const result = entries
          .filter(e => !e.name.startsWith('.') || e.name === '.kanban')
          .map(e => ({
            name: e.name,
            type: e.isDirectory() ? 'directory' : 'file',
            path: path.join(subpath, e.name),
          }))
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        return { path: subpath || '/', entries: result, total: result.length };
      } catch (err) {
        return { error: `Cannot read directory: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    case 'read_file': {
      const meta = await store.readProjectMeta(input.projectId as string);
      if (!meta?.path) return { error: 'Project has no path configured.' };

      const expandedPath = (meta.path as string).replace('~', os.homedir());
      const filePath = path.join(expandedPath, input.filePath as string);

      if (!filePath.startsWith(expandedPath)) return { error: 'Path traversal not allowed' };

      try {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const maxLines = (input.maxLines as number) || 200;
        const truncated = lines.length > maxLines;
        return {
          filePath: input.filePath,
          content: truncated
            ? lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`
            : content,
          lines: lines.length,
          truncated,
        };
      } catch (err) {
        return { error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    case 'search_in_files': {
      const meta = await store.readProjectMeta(input.projectId as string);
      if (!meta?.path) return { error: 'Project has no path configured.' };

      const expandedPath = (meta.path as string).replace('~', os.homedir());
      const pattern = input.pattern as string;
      const maxResults = (input.maxResults as number) || 20;

      const { execSync } = await import('child_process');
      try {
        const globPattern = (input.glob as string) || '';
        const includeFlag = globPattern ? `--include="${globPattern}"` : '';
        const cmd = `grep -rn ${includeFlag} --max-count=3 -l "${pattern.replace(/"/g, '\\"')}" "${expandedPath}" 2>/dev/null | head -${maxResults}`;
        const files = execSync(cmd, { encoding: 'utf-8', timeout: 5000 })
          .trim()
          .split('\n')
          .filter(Boolean);

        const results = await Promise.all(
          files.slice(0, maxResults).map(async (file) => {
            try {
              const matchCmd = `grep -n "${pattern.replace(/"/g, '\\"')}" "${file}" 2>/dev/null | head -5`;
              const matches = execSync(matchCmd, { encoding: 'utf-8', timeout: 2000 }).trim();
              return {
                file: file.replace(expandedPath + '/', ''),
                matches: matches.split('\n').filter(Boolean),
              };
            } catch {
              return { file: file.replace(expandedPath + '/', ''), matches: [] };
            }
          })
        );

        return { pattern, results, total: results.length };
      } catch {
        return { pattern, results: [], total: 0, note: 'Search returned no results' };
      }
    }
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

  const awsProfile = process.env.AWS_PROFILE;
  const client = new BedrockRuntimeClient({
    region: config.aws.region,
    credentials: awsProfile
      ? fromIni({ profile: awsProfile })
      : config.aws.accessKeyId
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
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
