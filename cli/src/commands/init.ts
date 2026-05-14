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
    'design',
    'plans/active',
    'plans/completed',
    'references',
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

  // AGENTS.md
  const agentsMdPath = path.resolve(projectWorkspacePath, 'AGENTS.md');
  const agentsMdExists = await fs.pathExists(agentsMdPath);
  if (agentsMdExists) {
    skipped++;
  } else {
    const agentsMdContent = `# Agent Instructions

This file defines how AI agents should work with this project.

## Context
- Tasks are stored in \`tasks/\` as Markdown files
- Research notes go in \`research/\`
- Proposals (active) go in \`proposals/active/\`
- Accepted proposals move to \`proposals/accepted/\`
- Specs go in \`specs/\`
- Design decisions go in \`design/\`
- Plans go in \`plans/active/\` and \`plans/completed/\`
- Reference material goes in \`references/\`

## Working Guidelines
- Always read ARCHITECTURE.md before making structural changes
- Create tasks in the appropriate column in \`tasks/\`
- Document decisions in the appropriate folder
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
  const skillsSpinner = ora('Instalando skills en .claude/commands/...').start();

  try {
    const count = await installSkills(cwd);
    skillsSpinner.succeed(
      chalk.green(`Skills instalados: ${count} comandos en .claude/commands/.`)
    );
  } catch (error) {
    skillsSpinner.fail(chalk.red('Error al instalar skills.'));
    throw error;
  }

  // TASK-00D: Print summary
  const kanbanDir = path
    .resolve(workspaceBase, trimmedName)
    .replace(os.homedir(), '~');

  console.log(`
${chalk.green.bold('Proyecto')} ${chalk.white.bold(`"${trimmedName}"`)} ${chalk.green.bold('inicializado correctamente')}

${chalk.blue('Workspace:')}    ${chalk.white(kanbanDir + '/')}
${chalk.blue('Variables:')}    ${chalk.white('.env.kanban')} ${chalk.gray('(configura tus credenciales AWS)')}
${chalk.blue('Skills:')}       ${chalk.white('.claude/commands/')} ${chalk.gray('(10 comandos instalados)')}

${chalk.bold('Estructura creada:')}
  ${chalk.cyan('tasks/')}         backlog, in-progress, review, done
  ${chalk.cyan('research/')}      notas e investigación
  ${chalk.cyan('proposals/')}     propuestas activas y aceptadas
  ${chalk.cyan('specs/')}         especificaciones técnicas
  ${chalk.cyan('design/')}        decisiones de diseño
  ${chalk.cyan('plans/')}         planes activos y completados
  ${chalk.cyan('references/')}    material de referencia
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
