import path from 'path';
import fs from 'fs-extra';

interface SkillFile {
  filename: string;
  dir: string;
  content: string;
}

// ─── Kanban workflow commands ─────────────────────────────────────────────────

function buildKanbanCommands(): SkillFile[] {
  return [
    {
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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
      dir: '.claude/commands',
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

// ─── SDD shared convention files ─────────────────────────────────────────────

function buildSddSharedFiles(): SkillFile[] {
  return [
    {
      dir: '.claude/skills/_shared',
      filename: 'sdd-phase-common.md',
      content: `# SDD Phase — Common Protocol

Sub-agents MUST load this alongside their phase-specific SKILL.md.

Executor boundary: every SDD phase agent is an EXECUTOR, not an orchestrator. Do the phase work yourself.

## A. Skill Loading

Check for \`SKILL: Load\` instructions in your launch prompt. If present, load those exact skill files.
If neither was provided, check for \`.claude/skills/_shared/skill-registry.md\` in the project root.

## B. Artifact Retrieval

For openspec/harness mode, read artifacts from these harness paths:
| Artifact | Path |
|----------|------|
| Exploration | \`research/{change-name}.md\` |
| Proposal | \`proposals/active/{change-name}.md\` |
| Delta Specs | \`specs/changes/{change-name}/{domain}.md\` |
| Source Specs | \`specs/{domain}/spec.md\` |
| Design | \`design/{change-name}.md\` |
| Tasks | \`plans/active/{change-name}.md\` |
| Verify Report | \`plans/{change-name}-verify.md\` |

## C. Artifact Persistence

Every phase that produces an artifact MUST write it to the corresponding harness path above.
If a file already exists, READ it first and UPDATE it (don't overwrite blindly).

## D. Return Envelope

Every phase MUST return:
- \`status\`: \`success\`, \`partial\`, or \`blocked\`
- \`executive_summary\`: 1-3 sentence summary
- \`artifacts\`: list of files written
- \`next_recommended\`: the next SDD phase to run
- \`risks\`: risks discovered, or "None"
`,
    },
    {
      dir: '.claude/skills/_shared',
      filename: 'openspec-convention.md',
      content: `# Kanban Harness — OpenSpec Convention

## Directory Structure

This project uses a kanban harness layout instead of the standard \`openspec/\` directory.

\`\`\`
{harness-root}/
├── tasks/                     ← Kanban board columns (backlog.md, etc.)
├── research/                  ← Exploration notes ({change-name}.md)
├── proposals/
│   ├── active/                ← Active proposals ({change-name}.md)
│   └── accepted/              ← Accepted / merged proposals
├── specs/
│   ├── {domain}/spec.md       ← Source of truth specs
│   └── changes/
│       └── {change-name}/     ← Delta specs per change
│           └── {domain}.md
├── design/                    ← Technical design docs ({change-name}.md)
├── plans/
│   ├── active/                ← Implementation task lists ({change-name}.md)
│   └── completed/             ← Done plans
├── references/                ← Reference material
├── AGENTS.md                  ← Agent working guidelines
└── ARCHITECTURE.md            ← High-level architecture
\`\`\`

## Path Mapping (vs standard openspec)

| Standard openspec path | Kanban harness path |
|------------------------|---------------------|
| \`openspec/changes/{n}/exploration.md\` | \`research/{n}.md\` |
| \`openspec/changes/{n}/proposal.md\` | \`proposals/active/{n}.md\` |
| \`openspec/changes/{n}/specs/{d}/spec.md\` | \`specs/changes/{n}/{d}.md\` |
| \`openspec/changes/{n}/design.md\` | \`design/{n}.md\` |
| \`openspec/changes/{n}/tasks.md\` | \`plans/active/{n}.md\` |
| \`openspec/changes/{n}/verify-report.md\` | \`plans/{n}-verify.md\` |
| \`openspec/specs/{domain}/spec.md\` | \`specs/{domain}/spec.md\` |
| \`openspec/changes/archive/\` | \`proposals/accepted/\` + \`plans/completed/\` |

## Config

The harness config lives at \`AGENTS.md\` (agent guidelines) and \`ARCHITECTURE.md\` (tech context).

## Writing Rules

- Always check if the target file exists before writing — UPDATE don't overwrite
- Mark completed tasks with \`[x]\` in \`plans/active/{change-name}.md\`
- When archiving: move proposal to \`proposals/accepted/\`, merge delta specs into source specs, move plan to \`plans/completed/\`
`,
    },
  ];
}

// ─── SDD slash commands ───────────────────────────────────────────────────────

function buildSddCommands(): SkillFile[] {
  return [
    // sdd-init
    {
      dir: '.claude/commands',
      filename: 'sdd-init.md',
      content: `---
description: Initialize Spec-Driven Development context in this kanban harness project
---
You are initializing SDD for the current kanban harness project.

## What to do

1. **Detect project context**: Read \`AGENTS.md\`, \`ARCHITECTURE.md\`, and any \`package.json\`/\`go.mod\`/\`pyproject.toml\` to detect the tech stack, test framework, and conventions.

2. **Verify harness structure**: Confirm these directories exist (create if missing):
   \`\`\`
   research/
   proposals/active/
   proposals/accepted/
   specs/
   specs/changes/
   design/
   plans/active/
   plans/completed/
   references/
   \`\`\`

3. **Create skill registry**: Write \`.claude/skills/_shared/skill-registry.md\` with:
   - List of all installed commands from \`.claude/commands/\`
   - Detected project context (stack, test framework, conventions)

4. **Update AGENTS.md**: Add an SDD section that documents:
   - How to use the SDD workflow (\`/sdd-new\`, \`/sdd-ff\`, etc.)
   - The path mapping (research/, proposals/, specs/, design/, plans/)
   - The dependency chain: explore → propose → spec+design → tasks → apply → verify → archive

5. **Return summary**:
   \`\`\`
   ## SDD Initialized

   **Project**: {project name}
   **Stack**: {detected stack}
   **Persistence**: kanban-harness (openspec variant)

   ### Next Steps
   Ready for /sdd-new <change-name> or /sdd-explore <topic>
   \`\`\`

## Rules
- NEVER create placeholder spec files
- ALWAYS detect the real tech stack, don't guess
- Keep AGENTS.md SDD section under 30 lines
`,
    },

    // sdd-explore
    {
      dir: '.claude/commands',
      filename: 'sdd-explore.md',
      content: `---
description: Explore and investigate a topic or feature before committing to a change
---
You are the EXPLORATION phase of SDD. Investigate the codebase and return a structured analysis.

**Arguments**: \`/sdd-explore <topic> [for: <change-name>]\`

## What to do

### Step 1: Understand the request
Parse the topic from \$ARGUMENTS. Is this a new feature, bug fix, or refactor? What domain does it touch?

### Step 2: Investigate the codebase
Read relevant files to understand:
- Current architecture and patterns
- Files and modules that would be affected
- Existing behavior related to the request
- Potential constraints or risks

### Step 3: Analyze options
If multiple approaches exist, compare them:
| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Option A | ... | ... | Low/Med/High |

### Step 4: Write exploration note
If a change name was provided (e.g., "for: add-dark-mode"), write to \`research/{change-name}.md\`:
\`\`\`markdown
# Exploration: {topic}

**Date**: {date}
**Change**: {change-name}

## Current State
{how the system works today}

## Affected Areas
- \`path/to/file\` — {why it's affected}

## Approaches
1. **{Name}** — {description}
   - Pros: ...
   - Cons: ...
   - Effort: Low/Medium/High

## Recommendation
{recommended approach and why}

## Risks
- {risk 1}
\`\`\`

If no change name, return the analysis inline only.

### Step 5: Return summary
Return the analysis to the user with a clear recommendation and next step.

## Rules
- ALWAYS read real code, never guess about the codebase
- DO NOT modify any existing code or files
- Keep analysis concise — recommendation + key findings, not a novel
`,
    },

    // sdd-propose
    {
      dir: '.claude/commands',
      filename: 'sdd-propose.md',
      content: `---
description: Create a change proposal with intent, scope, and approach
---
You are the PROPOSAL phase of SDD. Create a structured proposal for a change.

**Arguments**: \`/sdd-propose <change-name>\`

## What to do

### Step 1: Load context
- Read \`research/{change-name}.md\` if it exists (exploration output)
- Read \`AGENTS.md\` and \`ARCHITECTURE.md\` for project context
- Read any relevant existing specs in \`specs/\`

### Step 2: Check if proposal exists
If \`proposals/active/{change-name}.md\` already exists, READ it first and UPDATE it.

### Step 3: Write proposal
Create \`proposals/active/{change-name}.md\`:

\`\`\`markdown
# Proposal: {Change Title}

## Intent
{What problem are we solving? Why does this need to happen?}

## Scope

### In Scope
- {deliverable 1}
- {deliverable 2}

### Out of Scope
- {what we're NOT doing}

## Approach
{High-level technical approach. Reference exploration recommendation if available.}

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| \`path/to/area\` | New/Modified/Removed | {what changes} |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| {risk} | Low/Med/High | {mitigation} |

## Rollback Plan
{How to revert if something goes wrong.}

## Success Criteria
- [ ] {measurable outcome 1}
- [ ] {measurable outcome 2}
\`\`\`

### Step 4: Return summary
\`\`\`
## Proposal Created

**Change**: {change-name}
**File**: proposals/active/{change-name}.md

- **Intent**: {one-line}
- **Scope**: {N deliverables}
- **Risk Level**: Low/Medium/High

### Next Step
Ready for /sdd-spec {change-name} or /sdd-design {change-name}
\`\`\`

## Rules
- ALWAYS include a rollback plan
- ALWAYS include success criteria
- Keep proposal under 400 words — use tables over prose
- Use concrete file paths in Affected Areas
`,
    },

    // sdd-spec
    {
      dir: '.claude/commands',
      filename: 'sdd-spec.md',
      content: `---
description: Write delta specs with requirements and Given/When/Then scenarios
---
You are the SPEC phase of SDD. Write behavioral specifications for a change.

**Arguments**: \`/sdd-spec <change-name>\`

## What to do

### Step 1: Load proposal
Read \`proposals/active/{change-name}.md\` (REQUIRED). Extract the "Affected Areas" to determine which domains are touched.

### Step 2: Read existing specs
For each domain from Affected Areas, check if \`specs/{domain}/spec.md\` exists. Read it to understand current behavior — your delta specs describe CHANGES to this behavior.

### Step 3: Write delta specs
For each affected domain, create \`specs/changes/{change-name}/{domain}.md\`:

**If domain spec exists (delta format)**:
\`\`\`markdown
# Delta for {Domain}

## ADDED Requirements

### Requirement: {Name}
The system MUST/SHALL/SHOULD {behavior}.

#### Scenario: {Happy path}
- GIVEN {precondition}
- WHEN {action}
- THEN {expected outcome}

#### Scenario: {Edge case}
- GIVEN {precondition}
- WHEN {action}
- THEN {expected outcome}

## MODIFIED Requirements

### Requirement: {Existing Name}
{New description}
(Previously: {what it was})

## REMOVED Requirements

### Requirement: {Name}
(Reason: {why removed})
\`\`\`

**If no domain spec exists (full spec format)**:
\`\`\`markdown
# {Domain} Specification

## Purpose
{High-level description}

## Requirements

### Requirement: {Name}
The system MUST/SHALL/SHOULD {behavior}.

#### Scenario: {Name}
- GIVEN {precondition}
- WHEN {action}
- THEN {outcome}
\`\`\`

### Step 4: Return summary
| Domain | Type | Requirements | Scenarios |
|--------|------|-------------|-----------|
| {domain} | Delta/New | {N added/modified/removed} | {total} |

## Rules
- ALWAYS use Given/When/Then format for scenarios
- ALWAYS use RFC 2119 keywords: MUST, SHALL, SHOULD, MAY
- Every requirement MUST have at least one scenario
- Include happy path AND edge cases
- DO NOT include implementation details — specs describe WHAT, not HOW
- Keep spec artifact under 650 words
`,
    },

    // sdd-design
    {
      dir: '.claude/commands',
      filename: 'sdd-design.md',
      content: `---
description: Create technical design document with architecture decisions
---
You are the DESIGN phase of SDD. Write HOW the change will be implemented.

**Arguments**: \`/sdd-design <change-name>\`

## What to do

### Step 1: Load context
- Read \`proposals/active/{change-name}.md\` (REQUIRED)
- Read \`specs/changes/{change-name}/\` if it exists
- Read the actual code files that will be affected (from Affected Areas)

### Step 2: Check if design exists
If \`design/{change-name}.md\` already exists, READ it first and UPDATE it.

### Step 3: Write design document
Create \`design/{change-name}.md\`:

\`\`\`markdown
# Design: {Change Title}

## Technical Approach
{Concise description of the overall technical strategy.}

## Architecture Decisions

### Decision: {Title}
**Choice**: {what we chose}
**Alternatives considered**: {what we rejected}
**Rationale**: {why this choice}

## Data Flow
{Describe how data moves through the system. ASCII diagrams when helpful.}

    Component A ──→ Component B ──→ Component C

## File Changes
| File | Action | Description |
|------|--------|-------------|
| \`path/to/new-file\` | Create | {what this file does} |
| \`path/to/existing\` | Modify | {what changes and why} |

## Interfaces / Contracts
{New interfaces, API contracts, type definitions. Use code blocks.}

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | {what} | {how} |
| Integration | {what} | {how} |

## Open Questions
- [ ] {unresolved technical question}
\`\`\`

### Step 4: Return summary
- **Approach**: {one-line}
- **Key Decisions**: {N decisions}
- **Files Affected**: {N new, M modified}
- **Open Questions**: {list or "None"}

## Rules
- ALWAYS read the actual codebase before designing — never guess
- Every decision MUST have a rationale
- Use the project's ACTUAL patterns and conventions
- Keep design under 800 words
`,
    },

    // sdd-tasks
    {
      dir: '.claude/commands',
      filename: 'sdd-tasks.md',
      content: `---
description: Break down a change into an actionable implementation task checklist
---
You are the TASKS phase of SDD. Create a concrete implementation task list.

**Arguments**: \`/sdd-tasks <change-name>\`

## What to do

### Step 1: Load context
- Read \`proposals/active/{change-name}.md\` (REQUIRED)
- Read \`specs/changes/{change-name}/\` (REQUIRED)
- Read \`design/{change-name}.md\` (REQUIRED)

### Step 2: Write task file
If \`plans/active/{change-name}.md\` already exists, READ and UPDATE it.
Otherwise create \`plans/active/{change-name}.md\`:

\`\`\`markdown
# Tasks: {Change Title}

**Change**: {change-name}
**Status**: In Progress

## Phase 1: Foundation / Infrastructure
- [ ] 1.1 {Concrete action — what file, what change}
- [ ] 1.2 {Concrete action}

## Phase 2: Core Implementation
- [ ] 2.1 {Concrete action}
- [ ] 2.2 {Concrete action}

## Phase 3: Integration / Wiring
- [ ] 3.1 {Connect components, routes, UI wiring}

## Phase 4: Testing
- [ ] 4.1 Write tests for {scenario from spec}
- [ ] 4.2 Write tests for {scenario from spec}

## Phase 5: Cleanup (if needed)
- [ ] 5.1 {Documentation, dead code removal}
\`\`\`

### Step 3: Return summary
| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1 | {N} | Foundation |
| Phase 2 | {N} | Implementation |
| Phase 3 | {N} | Integration |
| Phase 4 | {N} | Testing |
| **Total** | {N} | |

**Next Step**: Ready for /sdd-apply {change-name}

## Rules
- Each task MUST reference a concrete file path
- Tasks MUST be ordered by dependency — Phase 1 before Phase 2
- Testing tasks should reference specific spec scenarios
- Each task should be completable in ONE session
- Use hierarchical numbering: 1.1, 1.2, 2.1, etc.
- NEVER write vague tasks like "implement feature" or "add tests"
- Keep task list under 530 words
`,
    },

    // sdd-apply
    {
      dir: '.claude/commands',
      filename: 'sdd-apply.md',
      content: `---
description: Implement tasks from the change following specs and design
---
You are the APPLY (implementation) phase of SDD.

**Arguments**: \`/sdd-apply <change-name> [phase: <1|2|3|...>]\`

## What to do

### Step 1: Load context (REQUIRED before any code)
1. Read \`plans/active/{change-name}.md\` — get task list
2. Read \`specs/changes/{change-name}/\` — these are your acceptance criteria
3. Read \`design/{change-name}.md\` — this constrains your approach
4. Read the actual source code files affected — match existing patterns

### Step 2: Determine which tasks to implement
If a phase was specified, implement only those tasks.
If no phase specified, implement the next incomplete phase.

### Step 3: Implement
For each task:
1. Read relevant spec scenarios (acceptance criteria)
2. Read design decisions (constraints)
3. Read existing code patterns (style guide)
4. Write the code
5. Mark task complete in \`plans/active/{change-name}.md\` (change \`[ ]\` to \`[x]\`)

### Step 4: Update task file
Update \`plans/active/{change-name}.md\` with \`[x]\` marks for completed tasks.

### Step 5: Return summary
\`\`\`
## Implementation Progress

**Change**: {change-name}

### Completed Tasks
- [x] {task 1.1}
- [x] {task 1.2}

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| \`path/to/file\` | Created/Modified | {brief description} |

### Deviations from Design
{List deviations, or "None — implementation matches design."}

### Remaining Tasks
- [ ] {next task}

### Status
{N}/{total} tasks complete. {Ready for next phase / Ready for verify / Blocked by X}
\`\`\`

## Rules
- ALWAYS read specs before implementing
- ALWAYS follow the design decisions — don't freelance a different approach
- ALWAYS match existing code patterns
- If the design is wrong or incomplete, NOTE IT — don't silently deviate
- If a task is blocked by something unexpected, STOP and report back
`,
    },

    // sdd-verify
    {
      dir: '.claude/commands',
      filename: 'sdd-verify.md',
      content: `---
description: Validate that implementation matches specs, design, and tasks
---
You are the VERIFY phase of SDD. Prove the implementation is complete and correct.

**Arguments**: \`/sdd-verify <change-name>\`

## What to do

### Step 1: Load context
- Read \`plans/active/{change-name}.md\` — check task completion
- Read \`specs/changes/{change-name}/\` — behavioral requirements
- Read \`design/{change-name}.md\` — design decisions
- Read the actual implementation files

### Step 2: Check completeness
Count \`[x]\` vs \`[ ]\` in the task file. Flag incomplete core tasks as CRITICAL.

### Step 3: Check correctness (static)
For each spec requirement and scenario:
- Search codebase for implementation evidence
- Is the GIVEN precondition handled?
- Is the WHEN action implemented?
- Is the THEN outcome produced?
- Flag CRITICAL if requirement is missing

### Step 4: Run tests (if test infrastructure exists)
Detect the test runner (package.json scripts.test, Makefile, etc.) and execute tests.
Capture pass/fail/skip counts and any failures.

### Step 5: Build & type check
Run the build command. Flag CRITICAL if build fails.

### Step 6: Write verification report
Create \`plans/{change-name}-verify.md\`:

\`\`\`markdown
## Verification Report

**Change**: {change-name}
**Date**: {date}

### Completeness
| Tasks total | Tasks complete | Tasks incomplete |
|-------------|----------------|------------------|
| {N} | {N} | {N} |

### Build & Tests
**Build**: ✅ Passed / ❌ Failed
**Tests**: ✅ {N} passed / ❌ {N} failed / ⚠️ {N} skipped

### Spec Compliance
| Requirement | Scenario | Status |
|-------------|----------|--------|
| {REQ} | {Scenario} | ✅ Compliant / ❌ Missing / ⚠️ Partial |

### Issues

**CRITICAL** (must fix before archive): {List or "None"}
**WARNING** (should fix): {List or "None"}
**SUGGESTION**: {List or "None"}

### Verdict
{PASS / PASS WITH WARNINGS / FAIL}
\`\`\`

## Rules
- ALWAYS read actual source code — don't trust summaries
- Static analysis alone is NOT verification — execute tests when possible
- DO NOT fix issues — only report them
- CRITICAL issues must be fixed before /sdd-archive
`,
    },

    // sdd-archive
    {
      dir: '.claude/commands',
      filename: 'sdd-archive.md',
      content: `---
description: Merge delta specs to source of truth and archive a completed change
---
You are the ARCHIVE phase of SDD. Complete the SDD cycle.

**Arguments**: \`/sdd-archive <change-name>\`

## What to do

### Step 1: Check verify report
Read \`plans/{change-name}-verify.md\`. If it contains CRITICAL issues, STOP and report them — do NOT archive.

### Step 2: Sync delta specs to source of truth
For each delta spec in \`specs/changes/{change-name}/\`:

**If \`specs/{domain}/spec.md\` exists**: Merge the delta:
- ADDED requirements → append to main spec
- MODIFIED requirements → replace matching requirement
- REMOVED requirements → delete matching requirement
- PRESERVE all other requirements

**If \`specs/{domain}/spec.md\` does NOT exist**: Copy the delta spec directly to \`specs/{domain}/spec.md\`

### Step 3: Archive artifacts
Move completed artifacts:
- \`proposals/active/{change-name}.md\` → \`proposals/accepted/{YYYY-MM-DD}-{change-name}.md\`
- \`plans/active/{change-name}.md\` → \`plans/completed/{YYYY-MM-DD}-{change-name}.md\`
- Keep \`design/{change-name}.md\` in place (design docs are permanent reference)
- Keep delta specs in \`specs/changes/{change-name}/\` as audit trail

### Step 4: Return summary
\`\`\`
## Change Archived

**Change**: {change-name}
**Date**: {YYYY-MM-DD}

### Specs Synced
| Domain | Action | Details |
|--------|--------|---------|
| {domain} | Created/Updated | {N added, M modified} |

### Archived
- proposals/accepted/{date}-{change-name}.md ✅
- plans/completed/{date}-{change-name}.md ✅

### SDD Cycle Complete
Ready for the next change.
\`\`\`

## Rules
- NEVER archive with CRITICAL issues in the verify report
- ALWAYS sync delta specs BEFORE moving to archive
- When merging, PRESERVE requirements not mentioned in the delta
- The audit trail is permanent — never delete archived changes
- Warn before merging destructive deltas (large removals)
`,
    },

    // sdd-new (orchestrator)
    {
      dir: '.claude/commands',
      filename: 'sdd-new.md',
      content: `---
description: Start a new SDD change — runs explore then propose
---
You are orchestrating a new SDD change. Run the explore and propose phases.

**Arguments**: \`/sdd-new <change-name>\`

The change name should be a kebab-case slug describing the change (e.g., \`add-dark-mode\`, \`refactor-auth\`).

## What to do

1. **Explore**: Follow the instructions in \`.claude/commands/sdd-explore.md\` for the change topic derived from {change-name}. Save findings to \`research/{change-name}.md\`.

2. **Propose**: Follow the instructions in \`.claude/commands/sdd-propose.md\` for \`{change-name}\`. Use the exploration findings as input. Save to \`proposals/active/{change-name}.md\`.

3. **Return summary**:
\`\`\`
## Change Started

**Change**: {change-name}

### Artifacts Created
- research/{change-name}.md (exploration)
- proposals/active/{change-name}.md (proposal)

### Next Steps
- /sdd-spec {change-name} — write behavioral specs
- /sdd-design {change-name} — write technical design
- /sdd-ff {change-name} — fast-forward to full task breakdown
\`\`\`
`,
    },

    // sdd-ff (fast-forward)
    {
      dir: '.claude/commands',
      filename: 'sdd-ff.md',
      content: `---
description: Fast-forward SDD — runs propose → spec → design → tasks in sequence
---
You are fast-forwarding through the SDD pipeline for an existing change.

**Arguments**: \`/sdd-ff <change-name>\`

Prerequisites: \`proposals/active/{change-name}.md\` MUST exist. Run \`/sdd-new {change-name}\` first if it doesn't.

## What to do

Run these phases IN ORDER, waiting for each to complete before starting the next:

1. **Spec** (\`sdd-spec\`): Follow instructions in \`.claude/commands/sdd-spec.md\` for \`{change-name}\`.
2. **Design** (\`sdd-design\`): Follow instructions in \`.claude/commands/sdd-design.md\` for \`{change-name}\`.
3. **Tasks** (\`sdd-tasks\`): Follow instructions in \`.claude/commands/sdd-tasks.md\` for \`{change-name}\`.

After all three phases complete, return:

\`\`\`
## Fast-Forward Complete

**Change**: {change-name}

### Artifacts Created
- specs/changes/{change-name}/ (delta specs)
- design/{change-name}.md (technical design)
- plans/active/{change-name}.md (task breakdown)

### Next Step
Run /sdd-apply {change-name} to start implementation.
\`\`\`
`,
    },

    // sdd-continue
    {
      dir: '.claude/commands',
      filename: 'sdd-continue.md',
      content: `---
description: Continue the next missing SDD artifact in the dependency chain
---
You are continuing an in-progress SDD change by identifying and creating the next missing artifact.

**Arguments**: \`/sdd-continue <change-name>\`

## Dependency chain

\`\`\`
research/{n}.md → proposals/active/{n}.md → specs/changes/{n}/ + design/{n}.md → plans/active/{n}.md → apply → plans/{n}-verify.md → archive
\`\`\`

## What to do

### Step 1: Check which artifacts exist
For \`{change-name}\`, check in order:
1. \`proposals/active/{change-name}.md\` — proposal
2. \`specs/changes/{change-name}/\` — delta specs
3. \`design/{change-name}.md\` — technical design
4. \`plans/active/{change-name}.md\` — tasks
5. All tasks in plans file marked \`[x]\` — apply complete
6. \`plans/{change-name}-verify.md\` — verify report

### Step 2: Identify the next missing artifact
The first missing artifact in the chain is the next step.

### Step 3: Run the appropriate phase
- Missing proposal → follow \`sdd-propose.md\`
- Missing specs → follow \`sdd-spec.md\`
- Missing design → follow \`sdd-design.md\`
- Missing tasks → follow \`sdd-tasks.md\`
- Tasks incomplete → follow \`sdd-apply.md\`
- Missing verify → follow \`sdd-verify.md\`
- All done → ready for \`/sdd-archive\`

Return what was done and what comes next.
`,
    },

    // sdd-status
    {
      dir: '.claude/commands',
      filename: 'sdd-status.md',
      content: `---
description: Show the SDD pipeline status for a change or all active changes
---
Show the current status of the SDD pipeline.

**Arguments**: \`/sdd-status [change-name]\`

## What to do

### If a change-name is provided:
Check each artifact in the dependency chain and report status:

| Phase | Artifact | Status |
|-------|----------|--------|
| Explore | \`research/{n}.md\` | ✅ Done / ❌ Missing |
| Propose | \`proposals/active/{n}.md\` | ✅ Done / ❌ Missing |
| Spec | \`specs/changes/{n}/\` | ✅ Done / ❌ Missing |
| Design | \`design/{n}.md\` | ✅ Done / ❌ Missing |
| Tasks | \`plans/active/{n}.md\` | ✅ Done (N/T complete) / ❌ Missing |
| Apply | tasks complete? | ✅ Done / 🔄 {N}/{T} |
| Verify | \`plans/{n}-verify.md\` | ✅ Done ({verdict}) / ❌ Missing |
| Archive | proposal in accepted/? | ✅ Done / ❌ Pending |

### If no change-name is provided:
List all active changes (files in \`proposals/active/\` and \`plans/active/\`) with their pipeline status.

Show **next recommended action** for each active change.
`,
    },
  ];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function installSkills(cwd: string): Promise<number> {
  const kanbanCommands = buildKanbanCommands();
  const sddSharedFiles = buildSddSharedFiles();
  const sddCommands = buildSddCommands();

  const allFiles = [...kanbanCommands, ...sddSharedFiles, ...sddCommands];

  for (const skill of allFiles) {
    const targetDir = path.resolve(cwd, skill.dir);
    await fs.ensureDir(targetDir);
    const filePath = path.resolve(targetDir, skill.filename);
    await fs.writeFile(filePath, skill.content, 'utf8');
  }

  return allFiles.length;
}
