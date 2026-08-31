import { checkbox, input, confirm } from '@inquirer/prompts';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { GitInspector } from './git.js';
import { RelevantFile } from './types.js';

export interface PickedContext {
  errorMessage: string;
  stackTrace?: string;
  files: RelevantFile[];
  sanitize: boolean;
}

export class ContextPicker {
  public static async promptInteractive(defaultError?: string): Promise<PickedContext> {
    console.log();
    console.log(pc.cyan('  ┌──────┐') + pc.bold(pc.white('  DEV')) + pc.bold(pc.cyan('QR')) + pc.cyan(' [INTERACTIVE PICKER]'));
    console.log(pc.cyan('  │ ▣  ▣ │') + pc.dim('  Select files & details to bundle into QR'));
    console.log(pc.cyan('  │ <⚡> │') + pc.gray('  Zero Cloud Backend • Portable AI Debugging'));
    console.log(pc.cyan('  └──────┘'));
    console.log();

    // 1. Error Message prompt
    const errorMessage = await input({
      message: 'Enter error message or issue description:',
      default: defaultError || 'Debugging session'
    });

    // 2. Discover all project source files
    const fileMap = new Map<string, { fullPath: string; mtime: number; size: number }>();

    const walkDir = (dir: string, depth = 0) => {
      if (depth > 3) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const name = entry.name;
          if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build' || name.endsWith('.bak')) {
            continue;
          }
          const full = path.join(dir, name);
          if (entry.isFile()) {
            if (/\.(py|ts|tsx|js|jsx|json|java|kt|go|rs|cpp|c|cs|html|css)$/i.test(name)) {
              const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
              const stat = fs.statSync(full);
              fileMap.set(rel, { fullPath: full, mtime: stat.mtimeMs, size: stat.size });
            }
          } else if (entry.isDirectory()) {
            walkDir(full, depth + 1);
          }
        }
      } catch {}
    };

    walkDir(process.cwd());

    // Sort files: most recently modified first
    const sortedFiles = Array.from(fileMap.entries()).sort((a, b) => b[1].mtime - a[1].mtime);

    const candidateChoices: { name: string; value: string; checked: boolean }[] = [];
    sortedFiles.slice(0, 20).forEach(([relPath, info], index) => {
      candidateChoices.push({
        name: `${index === 0 ? pc.bold(pc.green(relPath)) : pc.cyan(relPath)} ${pc.gray(`(${info.size} bytes)`)}`,
        value: relPath,
        // Auto-check the most recently modified file so user can just press Enter
        checked: index === 0
      });
    });

    let selectedFiles: string[] = [];

    if (candidateChoices.length > 0) {
      selectedFiles = await checkbox({
        message: 'Select source file(s) to attach (Space to toggle, Enter to confirm):',
        choices: candidateChoices
      });
    }

    // 3. Confirm sanitization
    const sanitize = await confirm({
      message: 'Enable automatic secret & API key sanitization?',
      default: true
    });

    const files: RelevantFile[] = [];
    for (const filePath of selectedFiles) {
      try {
        const full = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(full)) {
          const content = fs.readFileSync(full, 'utf8');
          files.push({
            filePath,
            content: content.slice(0, 2000)
          });
        }
      } catch {}
    }

    return {
      errorMessage,
      files,
      sanitize
    };
  }
}
