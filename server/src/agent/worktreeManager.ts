import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import * as store from '../store/markdownStore';

const execFileAsync = promisify(execFile);

export async function mergeTaskWorktree(projectId: string, taskId: string): Promise<{ merged: boolean; branch: string; message: string }> {
  const meta = await store.readProjectMeta(projectId);
  const projectPath = meta?.path
    ? path.resolve(meta.path.replace('~', os.homedir()))
    : null;

  if (!projectPath) {
    return { merged: false, branch: '', message: 'Project path not found' };
  }

  const worktreePath = path.join(projectPath, '.worktrees', taskId);

  // Check if worktree exists
  try { await fs.access(worktreePath); } catch {
    return { merged: false, branch: '', message: `Worktree not found at ${worktreePath}` };
  }

  const taskBranch = `task/${taskId}`;

  try {
    // Get the current default branch of the main repo (main or master)
    let defaultBranch = 'main';
    try {
      const { stdout } = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'], { cwd: projectPath });
      defaultBranch = stdout.trim().replace('origin/', '');
    } catch {
      // fallback: try to detect main vs master
      try {
        await execFileAsync('git', ['rev-parse', '--verify', 'main'], { cwd: projectPath });
        defaultBranch = 'main';
      } catch {
        defaultBranch = 'master';
      }
    }

    // Make sure we're on the default branch in the main worktree
    await execFileAsync('git', ['checkout', defaultBranch], { cwd: projectPath });

    // Merge the task branch
    await execFileAsync('git', ['merge', '--no-ff', taskBranch, '-m', `Merge task/${taskId} into ${defaultBranch}`], { cwd: projectPath });

    // Remove the worktree
    await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], { cwd: projectPath });

    // Delete the task branch
    await execFileAsync('git', ['branch', '-d', taskBranch], { cwd: projectPath });

    return { merged: true, branch: defaultBranch, message: `Merged ${taskBranch} into ${defaultBranch} and removed worktree` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { merged: false, branch: taskBranch, message: `Merge failed: ${msg}` };
  }
}
