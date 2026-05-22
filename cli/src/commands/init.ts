import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { buildEnvTemplate } from '../templates/env.template.js';
import { installSkills } from './install-skills.js';

interface InitAnswers {
  projectName: string;
}

interface OverwriteAnswer {
  overwrite: boolean;
}

const COLUMNS: ReadonlyArray<{ filename: string; header: string }> = [
  { filename: 'backlog.md', header: '# Backlog' },
  { filename: 'in-progress.md', header: '# In Progress' },
  { filename: 'review.md', header: '# Review' },
  { filename: 'done.md', header: '# Done' },
];

function resolveWorkspace(): string {
  const envWorkspace = process.env['KANBAN_WORKSPACE'];
  if (envWorkspace) {
    return envWorkspace.replace(/^~/, os.homedir());
  }
  return path.resolve(os.homedir(), '.kanban');
}

function resolveDefaultProjectName(): string {
  return path.basename(process.cwd());
}

export async function createWorkspaceFiles(
  projectWorkspacePath: string,
  projectName: string
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // tasks/ with column markdown files
  const tasksDir = path.resolve(projectWorkspacePath, 'tasks');
  await fs.ensureDir(tasksDir);

  for (const column of COLUMNS) {
    const filePath = path.resolve(tasksDir, column.filename);
    const exists = await fs.pathExists(filePath);

    if (exists) {
      skipped++;
    } else {
      const content = `${column.header}\n\n<!-- tasks -->\n`;
      await fs.writeFile(filePath, content, 'utf8');
      created++;
    }
  }

  // Directories with .gitkeep
  const emptyDirs = [
    'research',
    'proposals/active',
    'proposals/accepted',
    'specs',
    'specs/changes',
    'design',
    'plans/active',
    'plans/completed',
    'references',
    'flow',
    'notifications',
  ];

  for (const dir of emptyDirs) {
    const dirPath = path.resolve(projectWorkspacePath, dir);
    await fs.ensureDir(dirPath);
    const keepFile = path.resolve(dirPath, '.gitkeep');
    const exists = await fs.pathExists(keepFile);
    if (!exists) {
      await fs.writeFile(keepFile, '', 'utf8');
      created++;
    } else {
      skipped++;
    }
  }

  // project-config.md
  const projectConfigPath = path.resolve(projectWorkspacePath, 'project-config.md');
  const projectConfigExists = await fs.pathExists(projectConfigPath);
  if (projectConfigExists) {
    skipped++;
  } else {
    const projectConfigContent = `---
setupCommands:
  - npm install
  - npm run build
testCommands:
  - npm test
  - npm run lint
setupInstructions: |
  Describe any manual setup steps here.
---

# Project Configuration

## Setup Commands
Run these before starting work on this project.

## Test Commands
These MUST pass before moving any task to \`waiting-approval\`.
`;
    await fs.writeFile(projectConfigPath, projectConfigContent, 'utf8');
    created++;
  }

  // AGENTS.md
  const agentsMdPath = path.resolve(projectWorkspacePath, 'AGENTS.md');
  const agentsMdExists = await fs.pathExists(agentsMdPath);
  if (agentsMdExists) {
    skipped++;
  } else {
    const agentsMdContent = `# Agent Instructions

This file defines how AI agents should work with this project.

## Harness Structure
- \`tasks/\` — Kanban board columns (backlog.md, in-progress.md, review.md, done.md)
- \`research/\` — Exploration notes and investigations
- \`proposals/active/\` — Active change proposals
- \`proposals/accepted/\` — Accepted/archived proposals
- \`specs/\` — Source-of-truth behavioral specs
- \`specs/changes/\` — Delta specs per active change
- \`design/\` — Technical design documents (ADRs)
- \`plans/active/\` — Implementation task lists (SDD tasks)
- \`plans/completed/\` — Completed plans
- \`references/\` — External files provided by the user (PDF, CSV, Excel, TXT, images). Do NOT write generated files here.
- \`flow/\` — Agent-generated files: specs, designs, proposals, implementation notes, diagrams

## SDD Workflow (Spec-Driven Development)
Use these slash commands to manage changes:
- \`/sdd-new <change-name>\` — Start a new change (explore + propose)
- \`/sdd-ff <change-name>\` — Fast-forward: spec → design → tasks
- \`/sdd-apply <change-name>\` — Implement tasks
- \`/sdd-verify <change-name>\` — Verify implementation
- \`/sdd-archive <change-name>\` — Archive completed change
- \`/sdd-status [change-name]\` — Check pipeline status
- \`/sdd-continue <change-name>\` — Resume next missing step

## Dependency Chain
\`\`\`
research/ → proposals/active/ → specs/changes/ + design/ → plans/active/ → apply → verify → archive
\`\`\`

## Working Guidelines
- Always read ARCHITECTURE.md before making structural changes
- Create tasks in the appropriate column in \`tasks/\`
- Document decisions in the appropriate folder
- Use SDD for any substantial change (new feature, refactor, bug fix with broad impact)
`;
    await fs.writeFile(agentsMdPath, agentsMdContent, 'utf8');
    created++;
  }

  // ARCHITECTURE.md
  const architectureMdPath = path.resolve(projectWorkspacePath, 'ARCHITECTURE.md');
  const architectureMdExists = await fs.pathExists(architectureMdPath);
  if (architectureMdExists) {
    skipped++;
  } else {
    const architectureMdContent = `# Architecture

Document the high-level architecture of this project here.

## Overview

## Key Decisions

## Tech Stack
`;
    await fs.writeFile(architectureMdPath, architectureMdContent, 'utf8');
    created++;
  }

  // meta.json
  const metaJsonPath = path.resolve(projectWorkspacePath, 'meta.json');
  const metaJsonExists = await fs.pathExists(metaJsonPath);
  if (metaJsonExists) {
    skipped++;
  } else {
    const meta = {
      id: projectName,
      name: projectName,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(metaJsonPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
    created++;
  }

  return { created, skipped };
}

export async function ensureGitignoreEntry(cwd: string, entry: string): Promise<void> {
  const gitignorePath = path.resolve(cwd, '.gitignore');
  const exists = await fs.pathExists(gitignorePath);

  if (!exists) {
    await fs.writeFile(gitignorePath, `${entry}\n`, 'utf8');
    return;
  }

  const content = await fs.readFile(gitignorePath, 'utf8');
  const lines = content.split('\n');
  const alreadyPresent = lines.some((line) => line.trim() === entry);

  if (!alreadyPresent) {
    const newContent = content.endsWith('\n')
      ? `${content}${entry}\n`
      : `${content}\n${entry}\n`;
    await fs.writeFile(gitignorePath, newContent, 'utf8');
  }
}

export async function writeClaudeMd(cwd: string, projectId: string, workspaceBase: string): Promise<void> {
  const claudeMdPath = path.resolve(cwd, 'CLAUDE.md');
  const harnessRoot = path.join(workspaceBase, projectId).replace(os.homedir(), '~');

  const content = `# CLAUDE.md — ${projectId}

This file is auto-loaded by Claude Code at the start of every session.

## SDD Workflow

This project uses **Spec-Driven Development**. Skills are installed in \`.claude/skills/\`.

When asked to explore, analyze, document, propose, or implement any change:
1. Read \`.env.kanban\` to resolve the harness root (\`KANBAN_WORKSPACE/KANBAN_PROJECT\`)
2. Load the appropriate skill from \`.claude/skills/sdd-{phase}/SKILL.md\`
3. All artifacts (research, proposals, specs, design, plans) go to \`${harnessRoot}/\` — never to the source repo

## Harness Artifact Locations

| Artifact | Path |
|----------|------|
| Research / Exploration | \`${harnessRoot}/research/{topic}.md\` |
| Proposals | \`${harnessRoot}/proposals/active/{change}.md\` |
| Delta Specs | \`${harnessRoot}/specs/changes/{change}/{domain}.md\` |
| Source-of-truth Specs | \`${harnessRoot}/specs/{domain}/spec.md\` |
| Technical Design | \`${harnessRoot}/design/{change}.md\` |
| Task Plans | \`${harnessRoot}/plans/active/{change}.md\` |
| Verify Reports | \`${harnessRoot}/plans/{change}-verify.md\` |

## Available SDD Commands

| Command | What it does |
|---------|-------------|
| \`/sdd-init\` | Detect stack, update this file with project context |
| \`/sdd-explore <topic>\` | Investigate and document a topic |
| \`/sdd-new <change>\` | Start a change: explore + propose |
| \`/sdd-ff <change>\` | Fast-forward: spec → design → tasks |
| \`/sdd-apply <change>\` | Implement tasks |
| \`/sdd-verify <change>\` | Validate implementation vs specs |
| \`/sdd-archive <change>\` | Merge specs and archive |
| \`/sdd-status\` | Show pipeline status for all active changes |

## Skill Registry

See \`.claude/skills/_shared/skill-registry.md\` for available skills.
Run \`/sdd-init\` to regenerate with detected stack information.

## Project

- **ID**: ${projectId}
- **Harness**: ${harnessRoot}/
- **Skills**: .claude/skills/
- **Commands**: .claude/commands/
`;

  await fs.writeFile(claudeMdPath, content, 'utf8');
}

export async function generateEnvFile(
  cwd: string,
  projectName: string,
  workspace: string
): Promise<void> {
  const envPath = path.resolve(cwd, '.env.kanban');
  const exists = await fs.pathExists(envPath);

  if (exists) {
    const { overwrite } = await inquirer.prompt<OverwriteAnswer>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: chalk.yellow('.env.kanban ya existe. ¿Deseas sobreescribirlo?'),
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.gray('  .env.kanban conservado sin cambios.'));
      return;
    }
  }

  const rawWorkspace = workspace.replace(os.homedir(), '~');
  const envContent = buildEnvTemplate(projectName, rawWorkspace);
  await fs.writeFile(envPath, envContent, 'utf8');
}

export async function runInit(): Promise<void> {
  const cwd = process.cwd();

  console.log(chalk.bold.cyan('\nKanban Code — Inicializar proyecto\n'));

  const { projectName } = await inquirer.prompt<InitAnswers>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Nombre del proyecto:',
      default: resolveDefaultProjectName(),
      validate: (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return 'El nombre del proyecto no puede estar vacío.';
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
          return 'El nombre solo puede contener letras, números, guiones y guiones bajos.';
        }
        return true;
      },
    },
  ]);

  const trimmedName = projectName.trim();
  const workspaceBase = resolveWorkspace();
  const projectWorkspacePath = path.resolve(workspaceBase, trimmedName);

  // TASK-00A: Create workspace files
  const spinner = ora('Creando workspace harness...').start();

  try {
    const { created, skipped } = await createWorkspaceFiles(projectWorkspacePath, trimmedName);

    if (skipped > 0 && created === 0) {
      spinner.info(
        chalk.yellow(
          `Workspace ya existente: ${skipped} archivo(s) conservados sin cambios.`
        )
      );
    } else {
      spinner.succeed(
        chalk.green(
          `Workspace creado: ${created} archivo(s) nuevos${skipped > 0 ? `, ${skipped} ya existían` : ''}.`
        )
      );
    }
  } catch (error) {
    spinner.fail(chalk.red('Error al crear el workspace.'));
    throw error;
  }

  // TASK-00B: Generate .env.kanban
  const envSpinner = ora('Generando .env.kanban...').start();
  envSpinner.stop();

  try {
    await generateEnvFile(cwd, trimmedName, workspaceBase);
    await ensureGitignoreEntry(cwd, '.env.kanban');
    console.log(chalk.green('  .env.kanban generado y añadido a .gitignore.'));
  } catch (error) {
    console.log(chalk.red('  Error al generar .env.kanban.'));
    throw error;
  }

  // TASK-00C: Install skills
  const skillsSpinner = ora('Instalando skills en .claude/...').start();

  try {
    const count = await installSkills(cwd);
    skillsSpinner.succeed(
      chalk.green(`Skills instalados: ${count} archivos en .claude/.`)
    );
  } catch (error) {
    skillsSpinner.fail(chalk.red('Error al instalar skills.'));
    throw error;
  }

  // TASK-00D: Write CLAUDE.md
  try {
    await writeClaudeMd(cwd, trimmedName, workspaceBase);
    console.log(chalk.green('  CLAUDE.md escrito — Claude Code cargará el contexto SDD automáticamente.'));
  } catch {
    // non-fatal
  }

  // TASK-00E: Print summary
  const kanbanDir = path
    .resolve(workspaceBase, trimmedName)
    .replace(os.homedir(), '~');

  console.log(`
${chalk.green.bold('Proyecto')} ${chalk.white.bold(`"${trimmedName}"`)} ${chalk.green.bold('inicializado correctamente')}

${chalk.blue('Workspace:')}    ${chalk.white(kanbanDir + '/')}
${chalk.blue('Variables:')}    ${chalk.white('.env.kanban')} ${chalk.gray('(configura tus credenciales AWS)')}
${chalk.blue('Skills:')}       ${chalk.white('.claude/commands/ + .claude/skills/')} ${chalk.gray('(kanban + SDD instalados)')}

${chalk.bold('Estructura creada:')}
  ${chalk.cyan('tasks/')}         backlog, in-progress, review, done
  ${chalk.cyan('research/')}      notas e investigación
  ${chalk.cyan('proposals/')}     propuestas activas y aceptadas
  ${chalk.cyan('specs/')}         especificaciones técnicas
  ${chalk.cyan('design/')}        decisiones de diseño
  ${chalk.cyan('plans/')}         planes activos y completados
  ${chalk.cyan('references/')}    archivos externos del usuario (PDF, CSV, Excel…)
  ${chalk.cyan('flow/')}          archivos generados por el agente (specs, diseños…)
  ${chalk.cyan('notifications/')} notificaciones del agente (errores, avisos, info)
  ${chalk.cyan('project-config.md')} comandos de setup y tests
  ${chalk.cyan('AGENTS.md')}      instrucciones para el agente
  ${chalk.cyan('ARCHITECTURE.md')} arquitectura del proyecto

${chalk.bold('Próximos pasos:')}
  ${chalk.yellow('1.')} Edita ${chalk.cyan('.env.kanban')} con tus credenciales de AWS Bedrock
  ${chalk.yellow('2.')} Inicia el servidor: ${chalk.cyan('npm run dev:server')}
  ${chalk.yellow('3.')} Inicia el frontend: ${chalk.cyan('npm run dev')}
  ${chalk.yellow('4.')} O usa los comandos en Claude Code:
       ${chalk.cyan('/kanban-board')}   Ver el tablero
       ${chalk.cyan('/kanban-agent')}   Chatear con el agente
`);
}
