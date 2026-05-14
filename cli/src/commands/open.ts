import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { createWorkspaceFiles, ensureGitignoreEntry, generateEnvFile } from './init.js';
import { installSkills } from './install-skills.js';

function resolveWorkspace(): string {
  const envWorkspace = process.env['KANBAN_WORKSPACE'];
  if (envWorkspace) return envWorkspace.replace(/^~/, os.homedir());
  return path.resolve(os.homedir(), '.kanban');
}

export async function runOpen(): Promise<void> {
  const cwd = process.cwd();
  const name = path.basename(cwd);
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const workspaceBase = resolveWorkspace();
  const projectWorkspacePath = path.resolve(workspaceBase, slug);

  console.log(chalk.bold.cyan(`\nKanban — Opening project: ${chalk.white(name)}\n`));
  console.log(chalk.gray(`  Source:    ${cwd}`));
  console.log(chalk.gray(`  Workspace: ${projectWorkspacePath.replace(os.homedir(), '~')}\n`));

  // 1. Create/verify harness workspace
  const spinner = ora('Setting up workspace harness...').start();
  try {
    const { created, skipped } = await createWorkspaceFiles(projectWorkspacePath, slug);
    spinner.succeed(chalk.green(`Workspace ready: ${created} created, ${skipped} already existed.`));
  } catch (err) {
    spinner.fail(chalk.red('Failed to create workspace.'));
    throw err;
  }

  // 2. Write meta.json with source path
  const metaPath = path.resolve(projectWorkspacePath, 'meta.json');
  const meta = {
    id: slug,
    name: slug,
    path: cwd,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(chalk.green(`  meta.json updated with source path.`));

  // 3. Install Claude skills into source project
  const skillsSpinner = ora('Installing Claude skills...').start();
  try {
    const count = await installSkills(cwd);
    skillsSpinner.succeed(chalk.green(`${count} skills installed in .claude/commands/`));
  } catch (err) {
    skillsSpinner.fail(chalk.red('Failed to install skills.'));
    throw err;
  }

  // 4. Generate .env.kanban if not present
  try {
    await generateEnvFile(cwd, slug, workspaceBase);
    await ensureGitignoreEntry(cwd, '.env.kanban');
  } catch {
    // non-fatal
  }

  // 5. Summary
  console.log(`
${chalk.green.bold('Project ready!')}

${chalk.blue('Project:')}   ${chalk.white(slug)}
${chalk.blue('Source:')}    ${chalk.white(cwd)}
${chalk.blue('Workspace:')} ${chalk.white(projectWorkspacePath.replace(os.homedir(), '~') + '/')}
${chalk.blue('Skills:')}    ${chalk.white(path.join(cwd, '.claude/commands/'))}

${chalk.bold('Open in browser:')} ${chalk.cyan('http://localhost:5173')}
`);
}
