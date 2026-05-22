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
Crea una nueva tarea en el tablero Kanban actual.

**Arguments**: \`/kanban-new-task [title] [priority:medium] [column:backlog] [epicId:] [role:] [goal:] [value:]\`

## Step 1: Resolve workspace
Read \`.env.kanban\` in the current working directory:
- Parse \`KANBAN_WORKSPACE\` and \`KANBAN_PROJECT\`
- \`harness_root = {KANBAN_WORKSPACE}/{KANBAN_PROJECT}/\` (expand \`~\` to home dir)
- \`tasks_dir = {harness_root}/tasks/\`
- If \`.env.kanban\` is missing, use \`./tasks/\` as fallback

## Step 2: Resolve epic (optional)
If an epic name or ID is provided:
- Look in \`{harness_root}/epics/\` for a file matching the slug or name
- If found, use the filename (without \`.md\`) as \`epicId\`
- If not found, leave \`epicId\` unset and note in the confirmation

## Step 3: Generate task ID
List all files in \`tasks/backlog/\`, \`tasks/in-progress/\`, \`tasks/waiting-approval/\`, \`tasks/review/\`, \`tasks/done/\`.
Find all \`TASK-NNN.md\` filenames. New ID = highest number + 1, zero-padded to 3 digits.
If no files exist anywhere, start at TASK-001.

## Step 4: Write task file
Create \`{tasks_dir}/{column}/TASK-{N}.md\`:
\`\`\`
---
title: {title}
priority: {priority}
createdAt: {ISO 8601 timestamp}
epicId: {epicId}       ← omit if not set
role: {role}           ← omit if not set
goal: {goal}           ← omit if not set
value: {value}         ← omit if not set
---
\`\`\`

If the column directory doesn't exist, create it first.

## Step 5: Confirm
Report: "✅ Created TASK-{N}: {title} in {column} (priority: {priority})"
If epicId was set, include: "(epic: {epicId})"
If user story was set, include: "As a {role}, I want to {goal}, so that {value}."

## Rules
- Each task is its own file: \`tasks/{column}/TASK-{N}.md\`
- NEVER append to a shared column file
- \`createdAt\` MUST be a valid ISO 8601 string
- \`priority\` defaults to \`medium\` if not specified
- \`column\` defaults to \`backlog\` if not specified; valid values: \`backlog\`, \`in-progress\`, \`waiting-approval\`, \`review\`, \`done\`
- Omit optional frontmatter keys (\`epicId\`, \`role\`, \`goal\`, \`value\`) if not provided
`,
    },
    {
      dir: '.claude/commands',
      filename: 'kanban-new-epic.md',
      content: `---
description: Crear una nueva épica en el proyecto Kanban
---
Crea una nueva épica para agrupar tareas relacionadas.

**Arguments**: \`/kanban-new-epic [name] [color:#a371f7] [description]\`

## Step 1: Resolve workspace
Read \`.env.kanban\` → \`harness_root = {KANBAN_WORKSPACE}/{KANBAN_PROJECT}/\`

## Step 2: Generate epic ID
Slugify the name: lowercase, replace spaces with \`-\`, remove special chars.
Check \`{harness_root}/epics/\` — if \`{slug}.md\` exists, append \`-2\`, \`-3\`, etc.

## Step 3: Write epic file
Create \`{harness_root}/epics/{slug}.md\`:
\`\`\`
---
name: {name}
description: {description}
color: {color}
createdAt: {ISO 8601 timestamp}
---
\`\`\`

## Step 4: Confirm
Report: "✅ Created epic '{name}' (ID: {slug})"

## Rules
- If \`epics/\` directory doesn't exist, create it first
- \`color\` defaults to \`#a371f7\` if not specified
- Omit \`description\` from frontmatter if not provided
`,
    },
    {
      dir: '.claude/commands',
      filename: 'kanban-move.md',
      content: `---
description: Mover una tarea entre columnas del tablero
---
Mueve la tarea especificada a otra columna del tablero Kanban.

**Arguments**: \`/kanban-move TASK-ID target-column\`
Valid columns: \`backlog\`, \`in-progress\`, \`waiting-approval\`, \`review\`, \`done\`

> **Note on agent mode**: The project may be configured with \`agentMode: manual\` in \`project-config.md\`.
> In manual mode the server does NOT auto-trigger the Claude agent when a task moves to \`in-progress\`.
> If you were invoked directly by the user (not by the automatic trigger), this is a manual-mode session.
> The same column-flow rules apply regardless of mode: \`in-progress → waiting-approval → done\`.

## Step 1: Resolve workspace
Read \`.env.kanban\` → \`tasks_dir = {KANBAN_WORKSPACE}/{KANBAN_PROJECT}/tasks/\`

## Step 2: Find the task file
Look for \`{tasks_dir}/{col}/TASK-ID.md\` in each of the 5 column directories.
Record the source column when found.

## Step 3: Pre-condition check before moving to waiting-approval
If the target column is \`waiting-approval\` and the source column is \`in-progress\`:
- Read the task file at \`{tasks_dir}/in-progress/TASK-ID.md\`
- Check whether the file body contains an \`## Implementation Notes\` section
- If it does NOT contain \`## Implementation Notes\`, write it now using the Bash tool with a heredoc or tee command before proceeding:
  \`\`\`bash
  tee -a {tasks_dir}/in-progress/TASK-ID.md <<'EOF'

## Implementation Notes

(add summary of what was implemented, files changed, and any important decisions)
EOF
  \`\`\`
- **NEVER move a task from \`in-progress\` to \`waiting-approval\` without first confirming that \`## Implementation Notes\` exists in the task file.** The reviewer depends on this to understand what was done.

## Step 3b: Run test commands before moving to waiting-approval
If the target column is \`waiting-approval\`:
- Read \`{KANBAN_WORKSPACE}/{KANBAN_PROJECT}/project-config.md\`
- Parse the \`testCommands\` list from the frontmatter
- Run each command in the project source directory (cwd of the project, not the harness)
- If any command fails:
  1. Load \`.claude/skills/sdd-notify/SKILL.md\` and write an error notification (type: error, taskId: TASK-ID)
  2. Do NOT move the task — report: "❌ Tests failed. Task not moved. See notifications."
- If all pass, continue to Step 4.

## Step 4: Move the file
- Read the task file content
- Add/replace \`updatedAt: {ISO timestamp}\` in the frontmatter
- Write to \`{tasks_dir}/{target-column}/TASK-ID.md\`
- Delete \`{tasks_dir}/{source-column}/TASK-ID.md\`

## Step 5: Confirm
Report: "✅ Moved TASK-ID from {source} → {target}"

## Rules
- If TASK-ID file is not found in any column, report: "❌ Task TASK-ID not found"
- If the target is the same as the source, skip: "ℹ️ Task already in {column}"
- If the target column directory doesn't exist, create it first
- Moving = write new + delete old (not a filesystem rename, to ensure correctness)
- Moving a task to \`in-progress\` triggers the agent automatically. If the task has a previous \`agentSessionId\`, the prior session context is reused.
- Moving a task to \`done\` triggers an automatic merge of \`task/{TASK-ID}\` into the default branch (\`main\`/\`master\`) and removes the worktree.
- **AGENTS: NEVER move a task directly from \`in-progress\` to \`done\`. The required flow is: \`in-progress\` → \`waiting-approval\` → \`done\`. Only a human reviewer moves a task to \`done\`.**
- **AGENTS: ALWAYS create a git worktree before making any code changes.** Run: \`git worktree add .worktrees/{TASK-ID} -b task/{TASK-ID}\` from the repo root. All work goes inside \`.worktrees/{TASK-ID}/\`.
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
flow/
notifications/
\`\`\`
Create \`project-config.md\` if it doesn't exist (use the template from harness docs):
\`\`\`
---
setupCommands:
  - {detected setup command}
testCommands:
  - {detected test command}
agentMode: auto
setupInstructions: |
  Describe any manual setup steps here.
---
\`\`\`

The \`agentMode\` field controls whether the server auto-triggers the Claude agent when a task moves to \`in-progress\`:
- \`auto\` (default) — agent is triggered automatically on every \`in-progress\` move
- \`manual\` — agent is NOT triggered automatically; the user must invoke the agent directly

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
| sdd-notify | .claude/skills/sdd-notify/SKILL.md | write notifications on failures/blockers |
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

## Worktree Workflow
Each task runs in an isolated git worktree at \`.worktrees/{TASK-ID}/\`.
This prevents parallel agents from conflicting on the same files.

\`\`\`bash
git worktree add .worktrees/{TASK-ID} -b task/{TASK-ID}
\`\`\`

The worktree stays until the PR/merge is reviewed. When an agent finishes or is blocked,
it documents notes in the task file and moves the card to \`waiting-approval\`.

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
Check \`epics/\` — if the change relates to an existing epic, note the \`epicId\` for use in proposals and board tasks.

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
**Epic**: {epic-id or "none"}

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
- Read \`research/{change-name}.md\` if it exists (note the \`epicId\` field if present)
- Read \`epics/\` — list available epics and check if this change belongs to one
- Read \`AGENTS.md\` and \`ARCHITECTURE.md\`
- Read any relevant existing specs in \`specs/\`

### Step 2: Check if proposal exists
If \`proposals/active/{change-name}.md\` already exists, READ and UPDATE it.

### Step 3: Write proposal
Create \`proposals/active/{change-name}.md\`:
\`\`\`markdown
# Proposal: {Change Title}

**Epic**: {epic-id or "none"}

## Intent
{What problem are we solving? Why?}

## User Stories
| Role | Goal | Value |
|------|------|-------|
| {role} | I want to {goal} | so that {value} |

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
- [ ] {measurable outcome — tied to user story value}
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

### Step 2: Read epic context
Check \`proposals/active/{change-name}.md\` for the \`**Epic**:\` field.
If an \`epicId\` is set, read \`epics/{epicId}.md\` to understand the epic's scope and user stories.

### Step 3: Write task file
If \`plans/active/{change-name}.md\` exists, READ and UPDATE it. Otherwise create it:
\`\`\`markdown
# Tasks: {Change Title}

**Change**: {change-name}
**Epic**: {epic-id or "none"}
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

### Step 4: Offer board card creation
After writing the plan, ask the user:
> "Do you want me to create kanban board cards for these tasks? I can run \`/kanban-new-task\` for each item, linking them to epic \`{epicId}\` with role/goal/value from the user stories."

If confirmed, for each plan item create a board card using the format:
\`\`\`
tasks/{column}/TASK-NNN.md
---
title: {task description}
priority: {derived from phase: Phase 1-2 = high, Phase 3-4 = medium, Phase 5 = low}
epicId: {epicId}
role: {role from proposal user stories}
goal: {goal from proposal user stories}
value: {value from proposal user stories}
createdAt: {ISO timestamp}
---
\`\`\`

### Step 5: Return phase/task table and next step.

## Rules
- NEVER write to \`tasks/\` — SDD plan tasks go to \`plans/active/{change-name}.md\` ONLY. The \`tasks/\` directory is reserved for kanban board cards (TASK-XXX format). Use \`/kanban-new-task\` if the user wants a card on the board.
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
  Uses an isolated git worktree per task to prevent parallel agent conflicts.
---

${shared}## Purpose

You are the APPLY (implementation) phase of SDD. Write actual code following specs and design.

## What to Do

### Step 0: Create git worktree (REQUIRED before touching any source files)
Determine the TASK-ID for this work (from the board card or task name).
From the repository root, create an isolated worktree:
\`\`\`bash
git worktree add .worktrees/{TASK-ID} -b task/{TASK-ID}
\`\`\`
All development work MUST happen inside \`.worktrees/{TASK-ID}/\`.
If the worktree already exists (branch already created), just \`cd\` into it.
**Do NOT delete the worktree after work — it stays until the PR/merge is reviewed.**

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
4. Write the code (inside \`.worktrees/{TASK-ID}/\`)
5. Mark task \`[x]\` in \`plans/active/{change-name}.md\`
6. If a matching board card exists in \`tasks/backlog/\` or \`tasks/in-progress/\`, move it to \`tasks/in-progress/\` (update \`updatedAt\`)

### Step 4: When all tasks are done OR you have questions/blockers

**NEVER move a task to \`waiting-approval\` without first writing \`## Implementation Notes\` to the task file. This is required — the reviewer depends on this to understand what was done.**

1. Write the following sections to the task file at \`tasks/in-progress/{TASK-ID}.md\` using the Bash tool with a heredoc or tee command — do not use the curl API for this:
\`\`\`bash
tee -a ~/.kanban/{projectId}/tasks/in-progress/{TASK-ID}.md <<'EOF'

## Implementation Notes

Brief summary of what was implemented, files changed, and any important decisions made.

## Questions for Review
- Question 1?
- Question 2?
(omit this section entirely if no questions)
EOF
\`\`\`
   - Replace the placeholder text with the actual summary and questions (or omit \`## Questions for Review\` if there are none).
   - The server automatically appends \`## Agent Runs\` with cost and token usage — you don't need to write this.
2. Move the task to \`waiting-approval\` via the Kanban API (only AFTER the file has been written):
\`\`\`bash
curl -X POST http://localhost:3001/api/projects/{projectId}/tasks/{taskId}/move \\
  -H "Content-Type: application/json" \\
  -d '{"toColumn":"waiting-approval","source":"agent"}'
\`\`\`
   Replace \`{projectId}\` and \`{taskId}\` with the actual values from \`.env.kanban\` or the board card.

### Step 5: Return summary
\`\`\`
## Implementation Progress: {change-name}

### Completed Tasks
- [x] {task description}

### Worktree
.worktrees/{TASK-ID}/ (branch: task/{TASK-ID})

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|

### Deviations from Design
{List or "None — matches design."}

### Remaining Tasks
- [ ] {next task}

### Status
{N}/{total} complete. Task moved to waiting-approval. {Notes or Questions if any.}
\`\`\`

## Rules
- ALWAYS create the git worktree (Step 0) before writing any code
- **NEVER skip the worktree step.** If \`git worktree add\` fails because the branch already exists, run \`git worktree add .worktrees/{TASK-ID} task/{TASK-ID}\` (without \`-b\`) to reuse it.
- ALWAYS read specs before implementing
- ALWAYS follow design decisions — don't deviate silently
- ALWAYS match existing code patterns
- ALWAYS document work and move to waiting-approval when done or blocked
- **NEVER move a task to \`waiting-approval\` without first writing \`## Implementation Notes\` to the task file.** This is required — the reviewer depends on this to understand what was done.
- **NEVER move a task to \`done\` yourself.** The flow is strictly: \`in-progress\` → \`waiting-approval\` → \`done\`. Only a human reviewer moves a task to \`done\`.
- Write the task file using the Bash tool with a heredoc or tee command — do not use the curl API for this.
- If this task was previously developed and sent back, you will receive the previous conversation as context. Review it before continuing.
- The server automatically appends \`## Agent Runs\` with cost and token usage — you don't need to write this section.
- If blocked, STOP, document in \`## Questions for Review\`, move to waiting-approval, and report
- Do NOT delete the worktree automatically — it remains until reviewed
- When the task is moved to **done** by the reviewer, the worktree branch is automatically merged into the default branch and the worktree is removed. Do NOT manually merge or delete the worktree.
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
| SDD Plan | \`plans/active/{change-name}.md\` |
| Verify Report | \`plans/{change-name}-verify.md\` |
| Epics | \`epics/{epic-id}.md\` |
| Board Cards | \`tasks/{column}/TASK-{NNN}.md\` |

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

## F. Epics & Board Cards

**Epics** group related board tasks. Stored as \`epics/{epic-id}.md\`:
\`\`\`
---
name: Epic Name
description: Optional description
color: '#a371f7'
createdAt: 2024-01-01T00:00:00.000Z
---
\`\`\`

**Board task** (frontmatter, one file per task in \`tasks/{column}/TASK-NNN.md\`):
\`\`\`
---
title: Task Title
priority: high|medium|low
createdAt: 2024-01-01T00:00:00.000Z
epicId: epic-id          ← links to epics/{epic-id}.md
role: persona            ← "As a {role}"
goal: what they want     ← "I want to {goal}"
value: business outcome  ← "so that {value}"
agentSessionId: uuid     ← auto-set by agent system; do not write manually
totalCostUsd: 0.00       ← cumulative agent cost; managed automatically
runCount: 0              ← number of agent runs; managed automatically
lastRunAt: ISO-date      ← last run timestamp; managed automatically
---

Optional description / acceptance criteria.
\`\`\`

**Valid columns**: \`backlog\` → \`in-progress\` → \`waiting-approval\` → \`review\` → \`done\`
- Each agent run on a task accumulates cost in \`totalCostUsd\` frontmatter
- Session history persists across re-triggers via \`agentSessionId\`

\`waiting-approval\` is set by agents when they finish work or need human input before proceeding.

**SDD plan tasks** (in \`plans/active/{change-name}.md\`) use checklist format (\`- [ ] 1.1 …\`) and are NOT board cards. Use \`/kanban-new-task\` to promote a plan item to a board card.
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
├── epics/                     ← Epic definition files
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
├── references/                ← External files provided by the user (PDF, CSV, Excel, TXT, images…). Read for context. Do NOT write generated files here.
├── flow/                      ← Generated files (specs, designs, proposals, implementation notes, diagrams, SDD artifacts). Write all agent-generated artifacts here.
├── AGENTS.md
└── ARCHITECTURE.md
\`\`\`

Source repository (alongside the harness):
\`\`\`
{source-repo}/
├── .worktrees/          ← git worktrees per task (gitignored)
│   └── {TASK-ID}/       ← Branch: task/{TASK-ID}
└── .gitignore           ← .worktrees/ is added automatically during harness setup
\`\`\`

> **Note**: \`.worktrees/\` is added to \`.gitignore\` automatically during harness setup.

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

## Epic Files

Epics are stored in \`epics/{epic-id}.md\` with YAML frontmatter:
\`\`\`
---
name: Epic Name
description: Optional description
color: '#a371f7'
createdAt: 2024-01-01T00:00:00.000Z
---
\`\`\`

## project-config.md Fields

| Field | Type | Description |
|-------|------|-------------|
| \`setupCommands\` | string[] | Run before starting work on the project |
| \`testCommands\` | string[] | MUST pass before moving a task to \`waiting-approval\` |
| \`agentMode\` | \`auto\` \| \`manual\` | Controls whether the server auto-triggers the Claude agent on task moves to \`in-progress\` |
| \`setupInstructions\` | string | Manual steps for agents and developers |

## Kanban Board Task Format

Each task is a separate file: \`tasks/{column}/TASK-{NNN}.md\`

\`\`\`
tasks/
  backlog/            ← one .md file per task
    TASK-001.md
    TASK-002.md
  in-progress/
    TASK-003.md
  waiting-approval/   ← agent completed work; awaiting human review
    TASK-004.md
  review/
  done/
\`\`\`

## Task User Story Fields

Task frontmatter supports user-story fields:
\`\`\`
---
title: Task Title
priority: medium
createdAt: 2024-01-01T00:00:00.000Z
epicId: user-auth
role: developer
goal: configure authentication
value: secure the application
agentSessionId: uuid    # auto-set by agent system
totalCostUsd: 0.00      # cumulative agent cost
runCount: 0             # number of agent runs
lastRunAt: ISO-date     # last run timestamp
---
\`\`\`

> **Note**: \`agentSessionId\`, \`totalCostUsd\`, \`runCount\`, and \`lastRunAt\` are managed automatically — do not set them manually.

### Task Body: Agent Runs Section

After each agent run the server automatically appends an \`## Agent Runs\` section to the task file:
\`\`\`markdown
## Agent Runs

### Run 1 — 2026-05-21T20:00:00.000Z
- Cost: $0.0812
- Tokens: 2 in / 5 out
- Duration: 45.2s
\`\`\`

### Key Rules
- Filename encodes the ID: \`TASK-{NNN}.md\` — 3-digit zero-padded number
- Directory encodes the column: \`tasks/{column}/\`
- Valid columns: \`backlog\`, \`in-progress\`, \`waiting-approval\`, \`review\`, \`done\`
- \`waiting-approval\` means an agent finished (or is blocked) and a human must review before proceeding
- \`title\` (required), \`priority\` (required: \`high\`/\`medium\`/\`low\`), \`createdAt\` (required ISO 8601)
- Moving a task = moving the file to another column directory (update \`updatedAt\` first)
- SDD plan tasks (\`plans/active/\`) use checklist format (\`- [ ] N.N description\`) and are NOT board cards
- Use \`/kanban-new-task\` to create a board card, \`/kanban-move TASK-ID column\` to move one
- Use \`/kanban-new-epic\` to create an epic grouping

## Worktree Workflow

Each task agent runs in an isolated git worktree to prevent parallel agents from conflicting on the same files.

\`\`\`bash
# Agent creates worktree before starting work
git worktree add .worktrees/{TASK-ID} -b task/{TASK-ID}

# All code changes happen inside .worktrees/{TASK-ID}/

# Worktree stays until PR/merge is reviewed — do NOT delete automatically
\`\`\`

The \`.worktrees/\` directory lives in the source repository root.
Each worktree corresponds to one board task and one git branch (\`task/{TASK-ID}\`).

### Automatic merge on done

When the task is moved to **done** by the reviewer, the worktree branch is automatically merged into the default branch and the worktree is removed.

- Do NOT manually merge or delete the worktree.
- The server handles \`git merge --no-ff task/{TASK-ID}\`, \`git worktree remove\`, and \`git branch -d\` automatically.
`,
    },
  ];
}

// ─── sdd-notify skill ─────────────────────────────────────────────────────────

function buildSddNotifySkill(): SkillFile[] {
  return [
    {
      dir: '.claude/skills/sdd-notify',
      filename: 'SKILL.md',
      content: `---
name: sdd-notify
version: 1.0.0
description: Write a structured notification to the project notifications folder
---

# sdd-notify

Use this skill whenever something important happens that the user should see: setup failures, test failures, blockers, warnings, or informational milestones.

## When to use
- Setup or install commands fail
- Tests fail before moving to waiting-approval
- You encounter a blocker you can't resolve
- You want to flag a warning or info for the human reviewer

## Steps

1. Read \`.env.kanban\` → get \`KANBAN_WORKSPACE\` and \`KANBAN_PROJECT\`
2. Set \`notifications_dir = {KANBAN_WORKSPACE}/{KANBAN_PROJECT}/notifications/\`
3. Create a notification file named \`{timestamp}-{slug}.md\` where:
   - \`timestamp\` = current UTC time as \`YYYYMMDD-HHmmss\`
   - \`slug\` = first 5 words of title, lowercased, spaces → dashes
4. Write the file with this frontmatter:

\`\`\`markdown
---
type: error | warning | info
title: "Your notification title"
source: agent
taskId: TASK-XXX  (if applicable)
read: false
createdAt: {ISO 8601 timestamp}
---

Detailed explanation of what happened, what you tried, and what the user should do.
\`\`\`

5. Call the notifications API to trigger a refresh (optional — the server watches the folder):
   \`\`\`bash
   curl -s -X POST http://localhost:3001/api/projects/\${KANBAN_PROJECT}/notifications/refresh || true
   \`\`\`

## Notification types
- \`error\` — something failed and blocks progress
- \`warning\` — something is wrong but not blocking
- \`info\` — milestone, FYI, or status update
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
    ...buildSddNotifySkill(),
  ];

  for (const skill of allFiles) {
    const targetDir = path.resolve(cwd, skill.dir);
    await fs.ensureDir(targetDir);
    const filePath = path.resolve(targetDir, skill.filename);
    await fs.writeFile(filePath, skill.content, 'utf8');
  }

  return allFiles.length;
}
