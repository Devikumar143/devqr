import fs from 'fs';
import path from 'path';
import pako from 'pako';
import { FixPatch, MultiFilePatch, BatchPatchResult } from './types.js';

export class PatchApplier {
  public static revertPatch(
    filePath: string,
    workspaceDir: string = process.cwd()
  ): { success: boolean; filePath: string; error?: string } {
    try {
      const cleanPath = filePath.replace(/^[ab]\//, '').replace(/^\/+/, '');
      let fullPath = path.resolve(workspaceDir, cleanPath);
      let backupPath = `${fullPath}.devqr.bak`;

      if (!fs.existsSync(backupPath)) {
        const baseName = path.basename(cleanPath);
        const candidate = path.resolve(workspaceDir, `${baseName}.devqr.bak`);
        if (fs.existsSync(candidate)) {
          backupPath = candidate;
          fullPath = path.resolve(workspaceDir, baseName);
        }
      }

      if (!fs.existsSync(backupPath)) {
        return { success: false, filePath: cleanPath, error: 'No safety backup (.devqr.bak) found to rollback.' };
      }

      const originalContent = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(fullPath, originalContent, 'utf8');
      try {
        fs.unlinkSync(backupPath);
      } catch {}

      return { success: true, filePath: cleanPath };
    } catch (err: any) {
      return { success: false, filePath, error: err.message };
    }
  }

  public static decodePatch(payload: string): FixPatch | null {
    try {
      let raw = payload.trim();
      if (raw.startsWith('devqr://patch/')) {
        raw = raw.replace('devqr://patch/', '');
      }

      // Base64url to Uint8Array
      raw = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (raw.length % 4) {
        raw += '=';
      }

      const binary = Buffer.from(raw, 'base64');
      const inflated = pako.inflate(binary);
      const jsonStr = new TextDecoder().decode(inflated);
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  public static applyPatch(
    patch: FixPatch,
    workspaceDir: string = process.cwd(),
    directFullContent?: string
  ): {
    success: boolean;
    filePath: string;
    backupPath?: string;
    linesChanged: number;
    error?: string;
  } {
    try {
      const cleanPath = patch.file.replace(/^[ab]\//, '').replace(/^\/+/, '');
      let fullPath = path.resolve(workspaceDir, cleanPath);

      // Check if file is in parent workspace directory or relative
      if (!fs.existsSync(fullPath)) {
        const parentCandidate = path.resolve(workspaceDir, '..', cleanPath);
        if (fs.existsSync(parentCandidate)) {
          fullPath = parentCandidate;
        } else {
          // If still not found, search current directory for same basename
          const baseName = path.basename(cleanPath);
          try {
            const files = fs.readdirSync(workspaceDir);
            const found = files.find(f => f.toLowerCase() === baseName.toLowerCase());
            if (found) fullPath = path.resolve(workspaceDir, found);
          } catch {}
        }
      }

      let backupPath: string | undefined;

      // 1. Direct Full Content Application (100% reliable)
      if (directFullContent && directFullContent.trim()) {
        if (fs.existsSync(fullPath)) {
          const rawContent = fs.readFileSync(fullPath, 'utf8');
          backupPath = `${fullPath}.devqr.bak`;
          fs.writeFileSync(backupPath, rawContent, 'utf8');
        } else {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        }

        fs.writeFileSync(fullPath, directFullContent, 'utf8');
        return {
          success: true,
          filePath: cleanPath,
          backupPath,
          linesChanged: directFullContent.split('\n').length
        };
      }

      // 2. Diff-based Application
      const diffLines = patch.patch.replace(/\r\n/g, '\n').split('\n');
      const removedLines: string[] = [];
      const addedLines: string[] = [];

      for (const line of diffLines) {
        if (line.startsWith('-') && !line.startsWith('---')) {
          removedLines.push(line.substring(1));
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          addedLines.push(line.substring(1));
        }
      }

      let linesChanged = 0;

      if (fs.existsSync(fullPath)) {
        const rawContent = fs.readFileSync(fullPath, 'utf8');
        const isCRLF = rawContent.includes('\r\n');

        // Create safety backup
        backupPath = `${fullPath}.devqr.bak`;
        fs.writeFileSync(backupPath, rawContent, 'utf8');

        // Normalize to LF for robust matching
        let content = rawContent.replace(/\r\n/g, '\n');

        // Try exact block replacement
        if (removedLines.length > 0 && addedLines.length > 0) {
          const targetBlock = removedLines.join('\n');
          const replacementBlock = addedLines.join('\n');

          if (content.includes(targetBlock)) {
            content = content.replace(targetBlock, replacementBlock);
            linesChanged = removedLines.length + addedLines.length;
          } else {
            // Line-by-line replacement
            const fileLines = content.split('\n');
            let modified = false;

            for (let r = 0; r < removedLines.length; r++) {
              const targetTrimmed = removedLines[r].trim();
              const replacementTrimmed = addedLines[r] ? addedLines[r].trim() : '';

              if (targetTrimmed) {
                let matchedIndex = fileLines.findIndex(l => l.trim() === targetTrimmed);
                if (matchedIndex === -1 && targetTrimmed.length > 3) {
                  matchedIndex = fileLines.findIndex(l => l.includes(targetTrimmed) || targetTrimmed.includes(l.trim()));
                }

                if (matchedIndex !== -1) {
                  const leadingWhitespace = fileLines[matchedIndex].match(/^\s*/)?.[0] || '';
                  fileLines[matchedIndex] = replacementTrimmed ? `${leadingWhitespace}${replacementTrimmed}` : '';
                  linesChanged++;
                  modified = true;
                }
              }
            }

            if (modified) {
              content = fileLines.join('\n');
            }
          }
        }

        if (linesChanged > 0) {
          const finalContent = isCRLF ? content.replace(/\n/g, '\r\n') : content;
          fs.writeFileSync(fullPath, finalContent, 'utf8');
        } else if (addedLines.length > 0) {
          // If no line matched, write the fixed code directly
          fs.writeFileSync(fullPath, addedLines.join('\n'), 'utf8');
          linesChanged = addedLines.length;
        }
      } else {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        const newContent = addedLines.length > 0 ? addedLines.join('\n') : patch.patch;
        fs.writeFileSync(fullPath, newContent, 'utf8');
        linesChanged = addedLines.length || 1;
      }

      return {
        success: true,
        filePath: cleanPath,
        backupPath,
        linesChanged
      };
    } catch (err: any) {
      return {
        success: false,
        filePath: patch.file,
        linesChanged: 0,
        error: err.message || 'Failed to write patch to file.'
      };
    }
  }

  public static applyBatch(
    multiPatch: MultiFilePatch,
    workspaceDir: string = process.cwd()
  ): BatchPatchResult {
    const results: { file: string; success: boolean; error?: string }[] = [];
    const modifiedFiles: string[] = [];

    for (const patch of multiPatch.patches) {
      const res = this.applyPatch(patch, workspaceDir, patch.fullContent);
      results.push({
        file: patch.file,
        success: res.success,
        error: res.error
      });

      if (res.success) {
        modifiedFiles.push(patch.file);
      } else {
        // Atomic rollback: If any single file patch fails, revert all previously modified files!
        for (const modFile of modifiedFiles) {
          this.revertPatch(modFile, workspaceDir);
        }
        return {
          success: false,
          appliedCount: 0,
          totalCount: multiPatch.patches.length,
          results,
          rolledBack: true
        };
      }
    }

    return {
      success: true,
      appliedCount: modifiedFiles.length,
      totalCount: multiPatch.patches.length,
      results,
      rolledBack: false
    };
  }

  public static revertBatch(
    files?: string[],
    workspaceDir: string = process.cwd()
  ): { success: boolean; restoredFiles: string[] } {
    const restoredFiles: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const res = this.revertPatch(file, workspaceDir);
        if (res.success) restoredFiles.push(file);
      }
    } else {
      // Find and revert all .devqr.bak files in workspaceDir
      try {
        const findBackups = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isFile() && entry.name.endsWith('.devqr.bak')) {
              const original = full.replace(/\.devqr\.bak$/, '');
              const res = this.revertPatch(original, workspaceDir);
              if (res.success) restoredFiles.push(path.relative(workspaceDir, original));
            } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              findBackups(full);
            }
          }
        };
        findBackups(workspaceDir);
      } catch {}
    }

    return {
      success: restoredFiles.length > 0,
      restoredFiles
    };
  }
}
