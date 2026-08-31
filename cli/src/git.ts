import { execSync } from 'node:child_process';
import { RecentChange } from './types.js';

export class GitInspector {
  public static getRecentChanges(cwd = process.cwd()): RecentChange[] {
    const changes: RecentChange[] = [];
    try {
      // Check if git repository
      execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });

      // Get status of modified files
      const statusOut = execSync('git status --short', { cwd, encoding: 'utf8' });
      const statusLines = statusOut.trim().split('\n').filter(Boolean);

      for (const line of statusLines.slice(0, 3)) {
        const file = line.slice(3).trim();
        changes.push({
          file,
          summary: `Modified uncommitted changes in ${file}`
        });
      }

      // If no uncommitted files, get the latest commit message and files
      if (changes.length === 0) {
        const commitMsg = execSync('git log -1 --pretty=%B', { cwd, encoding: 'utf8' }).trim();
        const commitFiles = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { cwd, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
        
        for (const file of commitFiles.slice(0, 2)) {
          changes.push({
            file,
            summary: `Latest commit "${commitMsg.slice(0, 40)}" affected ${file}`
          });
        }
      }
    } catch {
      // Not a git repo or git not in path, fallback cleanly
    }

    return changes;
  }
}
