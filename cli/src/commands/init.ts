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

async function createWorkspaceFiles(
  projectWorkspacePath: string
): Promise<{ created: number; skipped: number }> {
  const kanbanDir = path.resolve(projectWorkspacePath, '.kanban');
  await fs.ensureDir(kanbanDir);

  let created = 0;
  let skipped = 0;

  for (const column of COLUMNS) {
    const filePath = path.resolve(kanbanDir, column.filename);
    const exists = await fs.pathExists(filePath);

    if (exists) {
      skipped++;
    } else {
      const content = `${column.header}\n\n<!-- tasks -->\n`;
      await fs.writeFile(filePath, content, 'utf8');
      created++;
    }
  }

  return { created, skipped };
}

async function ensureGitignoreEntry(cwd: string, entry: string): Promise<void> {
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

async function generateEnvFile(
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
  const spinner = ora('Creando workspace y archivos .kanban/...').start();

  try {
    const { created, skipped } = await createWorkspaceFiles(projectWorkspacePath);

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
    .resolve(workspaceBase, trimmedName, '.kanban')
    .replace(os.homedir(), '~');

  console.log(`
${chalk.green.bold('Proyecto')} ${chalk.white.bold(`"${trimmedName}"`)} ${chalk.green.bold('inicializado correctamente')}

${chalk.blue('Workspace:')}    ${chalk.white(kanbanDir + '/')}
${chalk.blue('Variables:')}    ${chalk.white('.env.kanban')} ${chalk.gray('(configura tus credenciales AWS)')}
${chalk.blue('Skills:')}       ${chalk.white('.claude/commands/')} ${chalk.gray('(4 comandos instalados)')}

${chalk.bold('Próximos pasos:')}
  ${chalk.yellow('1.')} Edita ${chalk.cyan('.env.kanban')} con tus credenciales de AWS Bedrock
  ${chalk.yellow('2.')} Inicia el servidor: ${chalk.cyan('npm run dev:server')}
  ${chalk.yellow('3.')} Inicia el frontend: ${chalk.cyan('npm run dev')}
  ${chalk.yellow('4.')} O usa los comandos en Claude Code:
       ${chalk.cyan('/kanban-board')}   Ver el tablero
       ${chalk.cyan('/kanban-agent')}   Chatear con el agente
`);
}
