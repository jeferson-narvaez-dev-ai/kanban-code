import path from 'path';
import fs from 'fs-extra';

interface SkillFile {
  filename: string;
  content: string;
}

function buildSkillFiles(): SkillFile[] {
  return [
    {
      filename: 'kanban-new-task.md',
      content: `---
description: Crear una nueva tarea en el tablero Kanban
---
Crea una nueva tarea en el backlog del proyecto Kanban actual.

Usa la herramienta create_task del agente para crear la tarea con:
- Título: $ARGUMENTS
- Columna destino: backlog
- Prioridad: medium (default)

Confirma al usuario la tarea creada con su ID y ubicación.
`,
    },
    {
      filename: 'kanban-move.md',
      content: `---
description: Mover una tarea entre columnas del tablero
---
Mueve la tarea especificada a otra columna del tablero Kanban.

Formato: /kanban-move TASK-ID columna-destino
Columnas válidas: backlog, in-progress, review, done

Usa la herramienta move_task del agente. Confirma el movimiento al usuario.
`,
    },
    {
      filename: 'kanban-board.md',
      content: `---
description: Ver el estado actual del tablero Kanban
---
Muestra el estado actual del tablero Kanban del proyecto.

Usa list_tasks para cada columna y presenta un resumen en formato tabla:
- Columna | Cantidad de tareas | Últimas 3 tareas por nombre

Muestra también el proyecto activo y la ruta del workspace.
`,
    },
    {
      filename: 'kanban-agent.md',
      content: `---
description: Abrir chat con el agente Kanban de Amazon Bedrock
---
Inicia una conversación con el agente Kanban conectado a Amazon Bedrock.

El agente tiene acceso a las siguientes herramientas:
- create_task, update_task, move_task, delete_task
- list_tasks, get_task, list_projects, create_project

Puedes pedirle al agente que organice tu backlog, cree múltiples tareas,
mueva tareas según criterios, o responda preguntas sobre el estado del proyecto.

Mensaje inicial: $ARGUMENTS
`,
    },
  ];
}

export async function installSkills(cwd: string): Promise<number> {
  const claudeCommandsDir = path.resolve(cwd, '.claude', 'commands');

  await fs.ensureDir(claudeCommandsDir);

  const skillFiles = buildSkillFiles();

  for (const skill of skillFiles) {
    const filePath = path.resolve(claudeCommandsDir, skill.filename);
    await fs.writeFile(filePath, skill.content, 'utf8');
  }

  return skillFiles.length;
}
