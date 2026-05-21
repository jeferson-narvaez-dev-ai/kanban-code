import path from 'path';
import fs from 'fs-extra';

interface SkillFile {
  filename: string;
  dir: string;
  content: string;
}

// ─── Kanban user commands (.claude/commands/) ─────────────────────────────────

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

// ─── SDD user commands (.claude/commands/) — orchestrators only ──────────────

function buildSddCommands(): SkillFile[] {
  return [
    {
      dir: '.claude/commands',
      filename: 'sdd-init.md',
      content: `---
description: Initialize SDD context in this project
---
Load \`.claude/skills/sdd-init/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-new.md',
      content: `---
description: Start a new SDD change — explore + propose
---
**Arguments**: \`/sdd-new <change-name>\`

You are orchestrating a new SDD change. Run these two phases in order:

1. Load \`.claude/skills/sdd-explore/SKILL.md\` and run the exploration phase for the topic derived from the change name. Save findings to \`research/{change-name}.md\`.

2. Load \`.claude/skills/sdd-propose/SKILL.md\` and run the proposal phase for \`{change-name}\`. Use the exploration findings as input. Save to \`proposals/active/{change-name}.md\`.

Return:
\`\`\`
## Change Started: {change-name}

### Artifacts Created
- research/{change-name}.md
- proposals/active/{change-name}.md

### Next Steps
- /sdd-ff {change-name} — fast-forward to task breakdown
- /sdd-spec {change-name} — write behavioral specs only
\`\`\`
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-explore.md',
      content: `---
description: Explore a topic before committing to a change
---
**Arguments**: \`/sdd-explore <topic> [for: <change-name>]\`

Load \`.claude/skills/sdd-explore/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-propose.md',
      content: `---
description: Create a change proposal
---
**Arguments**: \`/sdd-propose <change-name>\`

Load \`.claude/skills/sdd-propose/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-spec.md',
      content: `---
description: Write behavioral specs for a change
---
**Arguments**: \`/sdd-spec <change-name>\`

Load \`.claude/skills/sdd-spec/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-design.md',
      content: `---
description: Write technical design for a change
---
**Arguments**: \`/sdd-design <change-name>\`

Load \`.claude/skills/sdd-design/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-tasks.md',
      content: `---
description: Break down a change into an implementation task list
---
**Arguments**: \`/sdd-tasks <change-name>\`

Load \`.claude/skills/sdd-tasks/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-apply.md',
      content: `---
description: Implement tasks from the change
---
**Arguments**: \`/sdd-apply <change-name> [phase: <N>]\`

Load \`.claude/skills/sdd-apply/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-verify.md',
      content: `---
description: Verify implementation against specs
---
**Arguments**: \`/sdd-verify <change-name>\`

Load \`.claude/skills/sdd-verify/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-archive.md',
      content: `---
description: Archive a completed change and sync specs
---
**Arguments**: \`/sdd-archive <change-name>\`

Load \`.claude/skills/sdd-archive/SKILL.md\` and follow its instructions.
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-ff.md',
      content: `---
description: Fast-forward SDD — spec → design → tasks in sequence
---
**Arguments**: \`/sdd-ff <change-name>\`

Prerequisites: \`proposals/active/{change-name}.md\` MUST exist. Run \`/sdd-new {change-name}\` first if it doesn't.

Run these phases IN ORDER, waiting for each to complete:

1. Load \`.claude/skills/sdd-spec/SKILL.md\` — write delta specs for \`{change-name}\`
2. Load \`.claude/skills/sdd-design/SKILL.md\` — write technical design for \`{change-name}\`
3. Load \`.claude/skills/sdd-tasks/SKILL.md\` — write task breakdown for \`{change-name}\`

Return:
\`\`\`
## Fast-Forward Complete: {change-name}

### Artifacts Created
- specs/changes/{change-name}/ (delta specs)
- design/{change-name}.md
- plans/active/{change-name}.md

### Next Step
/sdd-apply {change-name}
\`\`\`
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-continue.md',
      content: `---
description: Continue the next missing step in the SDD pipeline
---
**Arguments**: \`/sdd-continue <change-name>\`

## Dependency chain
\`\`\`
research/{n}.md → proposals/active/{n}.md → specs/changes/{n}/ + design/{n}.md → plans/active/{n}.md → [apply] → plans/{n}-verify.md → [archive]
\`\`\`

Check which artifacts exist for \`{change-name}\` and run the appropriate skill:
- Missing proposal → load \`.claude/skills/sdd-propose/SKILL.md\`
- Missing specs → load \`.claude/skills/sdd-spec/SKILL.md\`
- Missing design → load \`.claude/skills/sdd-design/SKILL.md\`
- Missing tasks → load \`.claude/skills/sdd-tasks/SKILL.md\`
- Tasks incomplete → load \`.claude/skills/sdd-apply/SKILL.md\`
- Missing verify → load \`.claude/skills/sdd-verify/SKILL.md\`
- All done → suggest \`/sdd-archive {change-name}\`
`,
    },
    {
      dir: '.claude/commands',
      filename: 'sdd-status.md',
      content: `---
description: Show the SDD pipeline status for a change or all active changes
---
**Arguments**: \`/sdd-status [change-name]\`

Check each artifact in the dependency chain and report status.

### If a change-name is provided:
| Phase | Artifact | Status |
|-------|----------|--------|
| Explore | \`research/{n}.md\` | ✅ Done / ❌ Missing |
| Propose | \`proposals/active/{n}.md\` | ✅ Done / ❌ Missing |
| Spec | \`specs/changes/{n}/\` | ✅ Done / ❌ Missing |
| Design | \`design/{n}.md\` | ✅ Done / ❌ Missing |
| Tasks | \`plans/active/{n}.md\` | ✅ Done (N/T complete) / ❌ Missing |
| Apply | all tasks \`[x]\`? | ✅ Done / 🔄 N/T |
| Verify | \`plans/{n}-verify.md\` | ✅ Done ({verdict}) / ❌ Missing |
| Archive | proposal in \`accepted/\`? | ✅ Done / ❌ Pending |

### If no change-name:
List all files in \`proposals/active/\` and \`plans/active/\` with their pipeline status.
Show next recommended action for each.
`,
    },
  ];
}

// ─── SDD phase skills (.claude/skills/sdd-{phase}/SKILL.md) ──────────────────

function buildSddPhaseSkills(): SkillFile[] {
  const shared = `SKILL: Load \`.claude/skills/_shared/sdd-phase-common.md\` before starting.
SKILL: Load \`.claude/skills/_shared/openspec-convention.md\` before starting.

## Workspace Resolution (do this FIRST, before any file operations)

1. Look for \`.env.kanban\` in the current working directory
2. If found, parse it and extract \`KANBAN_WORKSPACE\` and \`KANBAN_PROJECT\`
3. Set \`harness_root = {KANBAN_WORKSPACE}/{KANBAN_PROJECT}/\`
   - Example: if \`KANBAN_WORKSPACE=~/.kanban\` and \`KANBAN_PROJECT=my-app\`, then \`harness_root = ~/.kanban/my-app/\`
   - Expand \`~\` to the actual home directory
4. If \`.env.kanban\` does NOT exist, use the current working directory as \`harness_root\` (fallback)
5. ALL artifact paths in this skill are relative to \`harness_root\`, NOT the current directory

`;

  return [
    {
      dir: '.claude/skills/sdd-init',
      filename: 'SKILL.md',
      content: `---
name: sdd-init
description: >
  Initialize SDD context in a kanban harness project. Detects stack, verifies harness structure,
  creates skill registry, and updates AGENTS.md with SDD documentation.
---

${shared}## Purpose

You are initializing SDD for the current kanban harness project.

## What to Do

### Step 1: Detect project context
Read \`AGENTS.md\`, \`ARCHITECTURE.md\`, and any \`package.json\`/\`go.mod\`/\`pyproject.toml\` to detect:
- Tech stack and runtime
- Test framework and commands
- Linting/formatting conventions

### Step 2: Verify harness structure
Confirm these directories exist (create if missing):
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

### Step 3: Write skill registry
Create \`.claude/skills/_shared/skill-registry.md\`:
\`\`\`markdown
# Skill Registry

## Project Context
- **Stack**: {detected stack}
- **Tests**: {test command}
- **Build**: {build command}

## Installed Skills
| Skill | Path | Trigger |
|-------|------|---------|
| sdd-explore | .claude/skills/sdd-explore/SKILL.md | /sdd-explore, /sdd-new |
| sdd-propose | .claude/skills/sdd-propose/SKILL.md | /sdd-propose, /sdd-new |
| sdd-spec | .claude/skills/sdd-spec/SKILL.md | /sdd-spec, /sdd-ff |
| sdd-design | .claude/skills/sdd-design/SKILL.md | /sdd-design, /sdd-ff |
| sdd-tasks | .claude/skills/sdd-tasks/SKILL.md | /sdd-tasks, /sdd-ff |
| sdd-apply | .claude/skills/sdd-apply/SKILL.md | /sdd-apply |
| sdd-verify | .claude/skills/sdd-verify/SKILL.md | /sdd-verify |
| sdd-archive | .claude/skills/sdd-archive/SKILL.md | /sdd-archive |
\`\`\`

### Step 4: Write CLAUDE.md
Create or update \`CLAUDE.md\` in the source project root (current working directory, NOT harness_root):

\`\`\`markdown
# CLAUDE.md — {project-name}

This file is auto-loaded by Claude Code at the start of every session.

## Project Context
- **Stack**: {detected stack}
- **Tests**: {test command}
- **Build**: {build command}
- **Lint**: {lint command if any}

## SDD Workflow
This project uses Spec-Driven Development. Skills are in \`.claude/skills/\`.

When asked to explore, analyze, document, propose, or implement any change:
1. Read \`.env.kanban\` to resolve harness root (KANBAN_WORKSPACE/KANBAN_PROJECT)
2. Load the appropriate skill from \`.claude/skills/sdd-{phase}/SKILL.md\`
3. All artifacts go to {harness_root}/ — never to the source repo

## Harness Artifact Locations
| Artifact | Path |
|----------|------|
| Research | {harness_root}/research/{topic}.md |
| Proposals | {harness_root}/proposals/active/{change}.md |
| Specs | {harness_root}/specs/changes/{change}/{domain}.md |
| Design | {harness_root}/design/{change}.md |
| Tasks | {harness_root}/plans/active/{change}.md |

## Available Commands
/sdd-explore, /sdd-new, /sdd-ff, /sdd-apply, /sdd-verify, /sdd-archive, /sdd-status

## Skill Registry
See \`.claude/skills/_shared/skill-registry.md\`
\`\`\`

### Step 5: Return summary
\`\`\`
## SDD Initialized

**Project**: {name}
**Stack**: {stack}
**Persistence**: kanban-harness (~/.kanban/{project}/)
**CLAUDE.md**: written ✅

### Next Steps
/sdd-new <change-name> or /sdd-explore <topic>
\`\`\`

## Rules
- NEVER create placeholder spec files
- ALWAYS detect the real tech stack
- Write CLAUDE.md in the SOURCE directory (cwd), not the harness
- If CLAUDE.md already exists, READ and UPDATE the SDD section only
`,
    },
    {
      dir: '.claude/skills/sdd-explore',
      filename: 'SKILL.md',
      content: `---
name: sdd-explore
description: >
  Explore and investigate a topic or feature. Read the codebase, compare approaches,
  and return a structured analysis. Optionally saves to research/{change-name}.md.
---

${shared}## Purpose

You are the EXPLORATION phase of SDD. Investigate the codebase and return a structured analysis.

## What to Do

### Step 1: Understand the request
Parse the topic/change-name. Is this a new feature, bug fix, or refactor?

### Step 2: Investigate the codebase
Read relevant files to understand:
- Current architecture and patterns
- Files and modules that would be affected
- Existing behavior related to the request
- Potential constraints or risks

### Step 3: Analyze options
If multiple approaches exist:
| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| Option A | ... | ... | Low/Med/High |

### Step 4: Write exploration note
If tied to a named change, write \`research/{change-name}.md\`:
\`\`\`markdown
# Exploration: {topic}

**Date**: {date}

## Current State
{how the system works today relevant to this topic}

## Affected Areas
- \`path/to/file\` — {why it's affected}

## Approaches
1. **{Name}** — {description}
   - Pros: ...  Cons: ...  Effort: Low/Medium/High

## Recommendation
{recommended approach and why}

## Risks
- {risk 1}
\`\`\`

### Step 5: Return structured analysis
Return the full analysis with recommendation and next step.

## Rules
- ALWAYS read real code, never guess
- DO NOT modify any existing code or files
- Keep analysis concise — recommendation + key findings
- Return envelope per sdd-phase-common.md Section D
`,
    },
    {
      dir: '.claude/skills/sdd-propose',
      filename: 'SKILL.md',
      content: `---
name: sdd-propose
description: >
  Create a change proposal with intent, scope, approach, risks, rollback plan,
  and success criteria. Saves to proposals/active/{change-name}.md.
---

${shared}## Purpose

You are the PROPOSAL phase of SDD. Create a structured proposal for a change.

## What to Do

### Step 1: Load context
- Read \`research/{change-name}.md\` if it exists
- Read \`AGENTS.md\` and \`ARCHITECTURE.md\`
- Read any relevant existing specs in \`specs/\`

### Step 2: Check if proposal exists
If \`proposals/active/{change-name}.md\` already exists, READ and UPDATE it.

### Step 3: Write proposal
Create \`proposals/active/{change-name}.md\`:
\`\`\`markdown
# Proposal: {Change Title}

## Intent
{What problem are we solving? Why?}

## Scope
### In Scope
- {deliverable 1}
### Out of Scope
- {what we're NOT doing}

## Approach
{High-level technical approach.}

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| \`path/to/area\` | New/Modified/Removed | {what changes} |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|

## Rollback Plan
{How to revert if something goes wrong.}

## Success Criteria
- [ ] {measurable outcome}
\`\`\`

### Step 4: Return summary with next step.

## Rules
- ALWAYS include rollback plan and success criteria
- Keep under 400 words — tables over prose
- Return envelope per sdd-phase-common.md Section D
`,
    },
    {
      dir: '.claude/skills/sdd-spec',
      filename: 'SKILL.md',
      content: `---
name: sdd-spec
description: >
  Write delta specs with RFC 2119 requirements and Given/When/Then scenarios.
  Saves to specs/changes/{change-name}/{domain}.md.
---

${shared}## Purpose

You are the SPEC phase of SDD. Write behavioral specifications (WHAT, not HOW).

## What to Do

### Step 1: Load proposal
Read \`proposals/active/{change-name}.md\` (REQUIRED). Extract Affected Areas to find domains.

### Step 2: Read existing specs
For each domain, check \`specs/{domain}/spec.md\` — your delta describes CHANGES to this.

### Step 3: Write delta specs
For each domain, create \`specs/changes/{change-name}/{domain}.md\`:

**If domain spec exists (delta format)**:
\`\`\`markdown
# Delta for {Domain}

## ADDED Requirements
### Requirement: {Name}
The system MUST {behavior}.
#### Scenario: {Happy path}
- GIVEN {precondition}
- WHEN {action}
- THEN {expected outcome}

## MODIFIED Requirements
### Requirement: {Name}
{New description}
(Previously: {what it was})

## REMOVED Requirements
### Requirement: {Name}
(Reason: {why})
\`\`\`

**If no domain spec (full spec format)**:
\`\`\`markdown
# {Domain} Specification
## Purpose
{description}
## Requirements
### Requirement: {Name}
The system MUST {behavior}.
#### Scenario: {Name}
- GIVEN {precondition}
- WHEN {action}
- THEN {outcome}
\`\`\`

### Step 4: Return table of domains, types, requirements, scenarios.

## Rules
- ALWAYS use Given/When/Then for scenarios
- ALWAYS use RFC 2119 keywords: MUST, SHALL, SHOULD, MAY
- Every requirement MUST have at least one scenario
- Include happy path AND edge cases
- DO NOT include implementation details
- Keep under 650 words
- Return envelope per sdd-phase-common.md Section D
`,
    },
    {
      dir: '.claude/skills/sdd-design',
      filename: 'SKILL.md',
      content: `---
name: sdd-design
description: >
  Create technical design document with architecture decisions, data flow, and file changes.
  Saves to design/{change-name}.md.
---

${shared}## Purpose

You are the DESIGN phase of SDD. Write HOW the change will be implemented.

## What to Do

### Step 1: Load context
- Read \`proposals/active/{change-name}.md\` (REQUIRED)
- Read \`specs/changes/{change-name}/\` if it exists
- Read the actual code files that will be affected

### Step 2: Check if design exists
If \`design/{change-name}.md\` exists, READ and UPDATE it.

### Step 3: Write design document
Create \`design/{change-name}.md\`:
\`\`\`markdown
# Design: {Change Title}

## Technical Approach
{Concise description of the overall strategy.}

## Architecture Decisions
### Decision: {Title}
**Choice**: {chosen}
**Alternatives considered**: {rejected}
**Rationale**: {why}

## Data Flow
    Component A ──→ Component B ──→ Component C

## File Changes
| File | Action | Description |
|------|--------|-------------|
| \`path/to/file\` | Create/Modify/Delete | {what and why} |

## Interfaces / Contracts
{New types, API contracts — use code blocks.}

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|

## Open Questions
- [ ] {unresolved question}
\`\`\`

### Step 4: Return summary (approach, decisions, files, open questions).

## Rules
- ALWAYS read actual codebase — never guess
- Every decision MUST have a rationale
- Follow the project's existing patterns
- Keep under 800 words
- Return envelope per sdd-phase-common.md Section D
`,
    },
    {
      dir: '.claude/skills/sdd-tasks',
      filename: 'SKILL.md',
      content: `---
name: sdd-tasks
description: >
  Break down a change into a phased, actionable task checklist.
  Saves to plans/active/{change-name}.md.
---

${shared}## Purpose

You are the TASKS phase of SDD. Create a concrete, ordered implementation task list.

## What to Do

### Step 1: Load context
- Read \`proposals/active/{change-name}.md\` (REQUIRED)
- Read \`specs/changes/{change-name}/\` (REQUIRED)
- Read \`design/{change-name}.md\` (REQUIRED)

### Step 2: Write task file
If \`plans/active/{change-name}.md\` exists, READ and UPDATE it. Otherwise create it:
\`\`\`markdown
# Tasks: {Change Title}

**Change**: {change-name}
**Status**: In Progress

## Phase 1: Foundation / Infrastructure
- [ ] 1.1 {Concrete action — what file, what change}
- [ ] 1.2 {Concrete action}

## Phase 2: Core Implementation
- [ ] 2.1 {Concrete action}

## Phase 3: Integration / Wiring
- [ ] 3.1 {Connect components, routes, wiring}

## Phase 4: Testing
- [ ] 4.1 Write tests for {scenario from spec}

## Phase 5: Cleanup (if needed)
- [ ] 5.1 {Docs, dead code}
\`\`\`

### Step 3: Return phase/task table and next step.

## Rules
- Each task MUST reference a concrete file path
- Ordered by dependency — Phase 1 before Phase 2
- Testing tasks reference specific spec scenarios
- Each task completable in ONE session
- Hierarchical numbering: 1.1, 1.2, 2.1, etc.
- NEVER write vague tasks like "implement feature"
- Keep under 530 words
- Return envelope per sdd-phase-common.md Section D
`,
    },
    {
      dir: '.claude/skills/sdd-apply',
      filename: 'SKILL.md',
      content: `---
name: sdd-apply
description: >
  Implement tasks from the change following specs and design strictly.
  Updates plans/active/{change-name}.md with [x] marks as tasks complete.
---

${shared}## Purpose

You are the APPLY (implementation) phase of SDD. Write actual code following specs and design.

## What to Do

### Step 1: Load context (REQUIRED before any code)
1. Read \`plans/active/{change-name}.md\` — task list
2. Read \`specs/changes/{change-name}/\` — acceptance criteria
3. Read \`design/{change-name}.md\` — approach constraints
4. Read actual source files affected — match existing patterns

### Step 2: Determine tasks to implement
If a phase was specified, implement only those tasks. Otherwise implement the next incomplete phase.

### Step 3: Implement
For each task:
1. Read relevant spec scenarios (acceptance criteria)
2. Read design decisions (constraints)
3. Read existing patterns (style guide)
4. Write the code
5. Mark task \`[x]\` in \`plans/active/{change-name}.md\`

### Step 4: Return summary
\`\`\`
## Implementation Progress: {change-name}

### Completed Tasks
- [x] {task description}

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|

### Deviations from Design
{List or "None — matches design."}

### Remaining Tasks
- [ ] {next task}

### Status
{N}/{total} complete. {Ready for next phase / Ready for verify / Blocked by X}
\`\`\`

## Rules
- ALWAYS read specs before implementing
- ALWAYS follow design decisions — don't deviate silently
- ALWAYS match existing code patterns
- If blocked, STOP and report — don't guess
- Return envelope per sdd-phase-common.md Section D
`,
    },
    {
      dir: '.claude/skills/sdd-verify',
      filename: 'SKILL.md',
      content: `---
name: sdd-verify
description: >
  Validate that implementation matches specs, design, and tasks. Runs tests, checks
  build, and produces a compliance matrix. Saves to plans/{change-name}-verify.md.
---

${shared}## Purpose

You are the VERIFY phase of SDD. Prove the implementation is complete and correct.

## What to Do

### Step 1: Load context
- Read \`plans/active/{change-name}.md\` — task completion
- Read \`specs/changes/{change-name}/\` — behavioral requirements
- Read \`design/{change-name}.md\` — design decisions
- Read actual implementation files

### Step 2: Check completeness
Count \`[x]\` vs \`[ ]\`. Flag incomplete core tasks as CRITICAL.

### Step 3: Check correctness (static)
For each spec requirement: search codebase for evidence. Flag CRITICAL if missing.

### Step 4: Run tests
Detect test runner (package.json scripts.test, Makefile, etc.) and execute.

### Step 5: Build & type check
Run build command. Flag CRITICAL if it fails.

### Step 6: Write report
Create \`plans/{change-name}-verify.md\`:
\`\`\`markdown
## Verification Report: {change-name}
**Date**: {date}

### Completeness
| Tasks total | Complete | Incomplete |
|-------------|----------|------------|

### Build & Tests
**Build**: ✅ / ❌  **Tests**: ✅ {N} passed / ❌ {N} failed

### Spec Compliance
| Requirement | Scenario | Status |
|-------------|----------|--------|
| {REQ} | {Scenario} | ✅ / ❌ / ⚠️ |

### Issues
**CRITICAL**: {List or "None"}
**WARNING**: {List or "None"}

### Verdict
{PASS / PASS WITH WARNINGS / FAIL}
\`\`\`

## Rules
- ALWAYS read actual source code
- Execute tests — static analysis alone is NOT verification
- DO NOT fix issues — only report them
- CRITICAL issues block /sdd-archive
- Return envelope per sdd-phase-common.md Section D
`,
    },
    {
      dir: '.claude/skills/sdd-archive',
      filename: 'SKILL.md',
      content: `---
name: sdd-archive
description: >
  Merge delta specs into source-of-truth specs and archive a completed change.
  Moves proposal to accepted/, plan to completed/.
---

${shared}## Purpose

You are the ARCHIVE phase of SDD. Complete the SDD cycle.

## What to Do

### Step 1: Check verify report
Read \`plans/{change-name}-verify.md\`. If CRITICAL issues exist, STOP — do NOT archive.

### Step 2: Sync delta specs to source of truth
For each file in \`specs/changes/{change-name}/\`:

**If \`specs/{domain}/spec.md\` exists**: Merge delta:
- ADDED → append requirements
- MODIFIED → replace matching requirements
- REMOVED → delete matching requirements
- PRESERVE all other requirements

**If no main spec**: Copy delta directly to \`specs/{domain}/spec.md\`

### Step 3: Archive artifacts
- \`proposals/active/{change-name}.md\` → \`proposals/accepted/{YYYY-MM-DD}-{change-name}.md\`
- \`plans/active/{change-name}.md\` → \`plans/completed/{YYYY-MM-DD}-{change-name}.md\`
- Keep \`design/{change-name}.md\` in place (permanent reference)
- Keep \`specs/changes/{change-name}/\` as audit trail

### Step 4: Return summary with specs synced and files archived.

## Rules
- NEVER archive with CRITICAL issues in verify report
- ALWAYS sync specs BEFORE archiving
- PRESERVE requirements not in the delta
- Warn before merging destructive deltas
- Return envelope per sdd-phase-common.md Section D
`,
    },
  ];
}

// ─── SDD shared conventions (.claude/skills/_shared/) ────────────────────────

function buildSddSharedFiles(): SkillFile[] {
  return [
    {
      dir: '.claude/skills/_shared',
      filename: 'sdd-phase-common.md',
      content: `# SDD Phase — Common Protocol

Sub-agents MUST load this alongside their phase-specific SKILL.md.

Executor boundary: every SDD phase agent is an EXECUTOR, not an orchestrator. Do the work yourself. Do NOT launch sub-agents.

## A. Skill Loading

Check for \`SKILL: Load\` instructions in your launch prompt and load those files first.
If not provided, check \`.claude/skills/_shared/skill-registry.md\` for the project context.

## B. Workspace Resolution (ALWAYS do this before any file operation)

1. Look for \`.env.kanban\` in the current working directory
2. If found, parse \`KANBAN_WORKSPACE\` and \`KANBAN_PROJECT\`
3. \`harness_root = {KANBAN_WORKSPACE}/{KANBAN_PROJECT}/\` (expand \`~\` to home dir)
4. If \`.env.kanban\` not found, \`harness_root = ./\` (current directory fallback)
5. ALL artifact paths below are relative to \`harness_root\`

## C. Artifact Paths (relative to harness_root)

| Artifact | Path |
|----------|------|
| Exploration | \`research/{change-name}.md\` |
| Proposal | \`proposals/active/{change-name}.md\` |
| Delta Specs | \`specs/changes/{change-name}/{domain}.md\` |
| Source Specs | \`specs/{domain}/spec.md\` |
| Design | \`design/{change-name}.md\` |
| Tasks | \`plans/active/{change-name}.md\` |
| Verify Report | \`plans/{change-name}-verify.md\` |

## D. Artifact Persistence

Every phase MUST write its artifact to \`harness_root/{path}\` above.
If a file already exists, READ first and UPDATE — never overwrite blindly.

## E. Return Envelope

Every phase MUST return:
- \`status\`: \`success\`, \`partial\`, or \`blocked\`
- \`executive_summary\`: 1-3 sentence summary
- \`artifacts\`: list of absolute paths written
- \`next_recommended\`: the next SDD phase
- \`risks\`: risks discovered, or "None"
`,
    },
    {
      dir: '.claude/skills/_shared',
      filename: 'openspec-convention.md',
      content: `# Kanban Harness Convention

This project uses a kanban harness layout. All SDD artifacts live in the project harness (not \`openspec/\`).

## Directory Structure

\`\`\`
{harness-root}/
├── tasks/                     ← Kanban board columns
├── research/                  ← Exploration notes
├── proposals/
│   ├── active/                ← Active proposals
│   └── accepted/              ← Archived proposals (YYYY-MM-DD prefix)
├── specs/
│   ├── {domain}/spec.md       ← Source-of-truth specs
│   └── changes/
│       └── {change-name}/     ← Delta specs per change
│           └── {domain}.md
├── design/                    ← Technical design docs
├── plans/
│   ├── active/                ← Implementation task lists
│   └── completed/             ← Done plans (YYYY-MM-DD prefix)
├── references/
├── AGENTS.md
└── ARCHITECTURE.md
\`\`\`

## Path Mapping

| Standard openspec | Kanban harness |
|-------------------|----------------|
| \`openspec/changes/{n}/exploration.md\` | \`research/{n}.md\` |
| \`openspec/changes/{n}/proposal.md\` | \`proposals/active/{n}.md\` |
| \`openspec/changes/{n}/specs/{d}/spec.md\` | \`specs/changes/{n}/{d}.md\` |
| \`openspec/changes/{n}/design.md\` | \`design/{n}.md\` |
| \`openspec/changes/{n}/tasks.md\` | \`plans/active/{n}.md\` |
| \`openspec/changes/{n}/verify-report.md\` | \`plans/{n}-verify.md\` |
| \`openspec/specs/{domain}/spec.md\` | \`specs/{domain}/spec.md\` |
| \`openspec/changes/archive/\` | \`proposals/accepted/\` + \`plans/completed/\` |
`,
    },
  ];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function installSkills(cwd: string): Promise<number> {
  const allFiles = [
    ...buildKanbanCommands(),
    ...buildSddCommands(),
    ...buildSddPhaseSkills(),
    ...buildSddSharedFiles(),
  ];

  for (const skill of allFiles) {
    const targetDir = path.resolve(cwd, skill.dir);
    await fs.ensureDir(targetDir);
    const filePath = path.resolve(targetDir, skill.filename);
    await fs.writeFile(filePath, skill.content, 'utf8');
  }

  return allFiles.length;
}
