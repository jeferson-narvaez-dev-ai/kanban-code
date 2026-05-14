import * as store from '../store/markdownStore';
import { COLUMNS } from '../../../shared/types';
import { AgentChatOptions, AgentChatResult } from './bedrockAgent';

export async function chat(options: AgentChatOptions): Promise<AgentChatResult> {
  const lastMessage = options.messages[options.messages.length - 1]?.content ?? '';
  const projectId = options.projectId ?? '';

  // Respuestas simuladas basadas en keywords
  if (/listar|list|mostrar|show|board|tablero/i.test(lastMessage)) {
    const tasks = (await Promise.all(COLUMNS.map(c => store.readColumn(projectId, c)))).flat();
    return {
      response: `[MOCK] Proyecto "${projectId}" tiene ${tasks.length} tareas: ${tasks.map(t => `${t.id} (${t.column})`).join(', ') || 'ninguna'}`,
      toolCallCount: 1,
    };
  }

  if (/crear|create|nueva|new/i.test(lastMessage)) {
    return {
      response: `[MOCK] Para crear tareas reales, configura AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY en .env.kanban y reinicia el servidor con BEDROCK_MOCK=false`,
      toolCallCount: 0,
    };
  }

  return {
    response: `[MOCK MODE] Servidor sin credenciales Bedrock. Mensaje recibido: "${lastMessage}". Configura .env.kanban para usar el agente real.`,
    toolCallCount: 0,
  };
}
