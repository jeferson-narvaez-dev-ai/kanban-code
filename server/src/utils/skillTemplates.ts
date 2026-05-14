export interface SkillFile {
  filename: string;
  content: string;
}

export function getSkillFiles(): SkillFile[] {
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
    {
      filename: 'kanban-research.md',
      content: `---
description: Añadir una nota de investigación al proyecto
---
Crea una nueva nota de investigación en \`research/\` del proyecto Kanban activo.

Usa la siguiente estructura para el archivo \`research/{slug}.md\`:
\`\`\`
# {título}

**Fecha:** {fecha}
**Contexto:** {contexto}

## Hallazgos

{contenido}

## Referencias
\`\`\`

Nombre del archivo: convierte el argumento a slug (minúsculas, guiones).
Argumento: $ARGUMENTS
`,
    },
    {
      filename: 'kanban-proposal.md',
      content: `---
description: Crear una propuesta técnica en el proyecto
---
Crea una nueva propuesta técnica en \`proposals/active/\` del proyecto Kanban activo.

Estructura del archivo \`proposals/active/{slug}.md\`:
\`\`\`
# Propuesta: {título}

**Estado:** Activa
**Fecha:** {fecha}
**Autor:** {autor}

## Problema

## Solución Propuesta

## Alternativas Consideradas

## Impacto

## Próximos Pasos
\`\`\`

Argumento: $ARGUMENTS
`,
    },
    {
      filename: 'kanban-spec.md',
      content: `---
description: Crear una especificación técnica en el proyecto
---
Crea una nueva especificación técnica en \`specs/\` del proyecto Kanban activo.

Estructura del archivo \`specs/{slug}.md\`:
\`\`\`
# Spec: {título}

**Estado:** Draft
**Fecha:** {fecha}

## Resumen

## Requerimientos

### Funcionales

### No Funcionales

## Diseño de API / Interfaz

## Consideraciones de Seguridad

## Plan de Implementación
\`\`\`

Argumento: $ARGUMENTS
`,
    },
    {
      filename: 'kanban-design.md',
      content: `---
description: Documentar una decisión de diseño (ADR)
---
Crea un Architecture Decision Record (ADR) en \`design/\` del proyecto Kanban activo.

Estructura del archivo \`design/adr-{numero}-{slug}.md\`:
\`\`\`
# ADR-{numero}: {título}

**Estado:** Propuesto
**Fecha:** {fecha}

## Contexto

## Decisión

## Consecuencias

### Positivas

### Negativas

## Alternativas Rechazadas
\`\`\`

Argumento: $ARGUMENTS
`,
    },
    {
      filename: 'kanban-plan.md',
      content: `---
description: Crear un plan de implementación en el proyecto
---
Crea un nuevo plan de implementación en \`plans/active/\` del proyecto Kanban activo.

Estructura del archivo \`plans/active/{slug}.md\`:
\`\`\`
# Plan: {título}

**Estado:** Activo
**Fecha inicio:** {fecha}
**Fecha objetivo:**

## Objetivo

## Tareas
- [ ]

## Riesgos

## Métricas de Éxito
\`\`\`

Argumento: $ARGUMENTS
`,
    },
    {
      filename: 'kanban-explore.md',
      content: `---
description: Explorar y analizar el código del proyecto para generar tareas
---
Explora el código fuente del proyecto Kanban activo y genera tareas relevantes.

Pasos:
1. Usa list_directory para ver la estructura del proyecto
2. Usa read_file para leer archivos clave (README, main entry points, config)
3. Usa search_in_files para encontrar TODOs, FIXMEs, y patrones de interés
4. Genera un resumen de hallazgos
5. Propone tareas concretas para el backlog basadas en el análisis

Foco del análisis: $ARGUMENTS
`,
    },
  ];
}
