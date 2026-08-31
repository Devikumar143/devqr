import http from 'http';
import os from 'os';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import pc from 'picocolors';
import { PatchApplier } from './patcher.js';
import { FixPatch, DebugBundle } from './types.js';
import { TerminalWebSocketServer } from './terminalServer.js';

export class LocalFixBridge {
  private server: http.Server | null = null;
  private terminalWsServer: TerminalWebSocketServer | null = null;
  private port: number = 9222;
  private currentBundle: DebugBundle | null = null;

  public static getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    const candidateIPs: { name: string; ip: string; priority: number }[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          let priority = 1;
          const lower = name.toLowerCase();
          const ip = iface.address;

          // Exclude known Windows hotspot / virtual adapters
          if (ip.startsWith('192.168.137.') || ip.startsWith('169.254.') || ip.startsWith('192.168.56.')) {
            priority = -10;
          } else if (lower === 'wi-fi' || lower === 'wifi' || lower === 'ethernet' || lower === 'en0' || lower === 'wlan0') {
            priority = 10;
          } else if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('eth')) {
            priority = 5;
          } else if (lower.includes('hotspot') || lower.includes('virtual') || lower.includes('vethernet')) {
            priority = -5;
          }

          candidateIPs.push({ name, ip, priority });
        }
      }
    }

    candidateIPs.sort((a, b) => b.priority - a.priority);

    if (candidateIPs.length > 0 && candidateIPs[0].priority > -10) {
      return candidateIPs[0].ip;
    }

    return '127.0.0.1';
  }

  private static async getFreePort(startingPort = 9222): Promise<number> {
    return new Promise((resolve) => {
      const tryPort = (port: number) => {
        const srv = net.createServer();
        srv.once('error', () => {
          tryPort(port + 1);
        });
        srv.once('listening', () => {
          srv.close(() => {
            resolve(port);
          });
        });
        srv.listen(port, '0.0.0.0');
      };
      tryPort(startingPort);
    });
  }

  public static scanWorkspaceFiles(dir: string, baseDir: string = dir, depth: number = 0): Array<{
    name: string;
    path: string;
    ext: string;
    size: number;
    runCmd: string;
  }> {
    if (depth > 3) return [];
    const results: Array<{ name: string; path: string; ext: string; size: number; runCmd: string }> = [];
    const IGNORE_DIRS = new Set(['node_modules', '.git', '.vscode', '.idea', 'dist', 'build', '__pycache__', '.venv', 'venv', 'env', '.expo', '.next']);
    const RUNNABLE_EXTS = new Set(['py', 'c', 'cpp', 'cc', 'js', 'ts', 'jsx', 'tsx', 'rs', 'go', 'sh', 'java', 'rb', 'php', 'html', 'json', 'txt', 'md']);

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name)) {
            results.push(...LocalFixBridge.scanWorkspaceFiles(fullPath, baseDir, depth + 1));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (RUNNABLE_EXTS.has(ext)) {
            let runCmd = `python -u "${relPath}"`;
            if (ext === 'py') runCmd = `python -u "${relPath}"`;
            else if (ext === 'js' || ext === 'jsx') runCmd = `node "${relPath}"`;
            else if (ext === 'ts' || ext === 'tsx') runCmd = `npx ts-node "${relPath}"`;
            else if (ext === 'c') runCmd = process.platform === 'win32' ? `gcc "${relPath}" -o app.exe && .\\app.exe` : `gcc "${relPath}" -o app_bin && ./app_bin`;
            else if (ext === 'cpp' || ext === 'cc') runCmd = process.platform === 'win32' ? `g++ "${relPath}" -o app.exe && .\\app.exe` : `g++ "${relPath}" -o app_bin && ./app_bin`;
            else if (ext === 'go') runCmd = `go run "${relPath}"`;
            else if (ext === 'rs') runCmd = process.platform === 'win32' ? `rustc "${relPath}" -o app.exe && .\\app.exe` : `rustc "${relPath}" -o app_bin && ./app_bin`;
            else if (ext === 'java') runCmd = `java "${relPath}"`;
            else if (ext === 'sh') runCmd = `bash "${relPath}"`;
            else if (ext === 'rb') runCmd = `ruby "${relPath}"`;
            else if (ext === 'php') runCmd = `php "${relPath}"`;

            let size = 0;
            try { size = fs.statSync(fullPath).size; } catch {}

            results.push({
              name: entry.name,
              path: relPath,
              ext,
              size,
              runCmd
            });
          }
        }
      }
    } catch {}

    return results;
  }

  public static scanDirectories(dir: string): Array<{ name: string; path: string; fullPath: string; isParent?: boolean }> {
    const results: Array<{ name: string; path: string; fullPath: string; isParent?: boolean }> = [];
    const IGNORE_DIRS = new Set(['node_modules', '.git', '.vscode', '.idea', 'dist', 'build', '__pycache__', '.venv', 'venv', 'env', '.expo', '.next']);

    // Parent directory
    const parent = path.dirname(dir);
    if (parent && parent !== dir) {
      results.push({
        name: `.. (Parent: ${path.basename(parent)})`,
        path: '..',
        fullPath: parent,
        isParent: true
      });
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !IGNORE_DIRS.has(entry.name)) {
          const fullPath = path.join(dir, entry.name);
          results.push({
            name: entry.name,
            path: entry.name,
            fullPath
          });
        }
      }
    } catch {}

    return results;
  }

  private currentArchBundle: import('./types.js').ArchitectureBundle | null = null;
  private currentGenBundle: import('./types.js').GeneratorBundle | null = null;

  public setBundle(bundle: DebugBundle) {
    this.currentBundle = bundle;
  }

  public setArchBundle(bundle: import('./types.js').ArchitectureBundle) {
    this.currentArchBundle = bundle;
  }

  public setGeneratorBundle(bundle: import('./types.js').GeneratorBundle) {
    this.currentGenBundle = bundle;
  }

  public async start(onPatchApplied?: (patch: FixPatch) => void): Promise<string> {
    const localIp = LocalFixBridge.getLocalIP();
    this.port = await LocalFixBridge.getFreePort(9222);

    this.server = http.createServer(async (req, res) => {
      // CORS headers for direct local phone communication
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === '/api/ping') {
        console.log(`  ${pc.green('✓')} ${pc.bold(pc.green('Phone connected to Bridge via Wi-Fi!'))} (Ready for 1-Click Auto-Fix)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'connected', localIp, port: this.port }));
        return;
      }

      // Serve full rich bundle metadata over LAN
      if (req.url === '/api/bundle') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.currentBundle || {}));
        return;
      }

      // Serve architecture blueprint bundle over LAN
      if (req.url === '/api/arch') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.currentArchBundle || {}));
        return;
      }

      // Serve AI app generator bundle over LAN
      if (req.url === '/api/generator') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.currentGenBundle || {
          mode: 'generator',
          targetFolder: process.cwd(),
          project: { name: path.basename(process.cwd()), language: 'Python', framework: 'Custom' }
        }));
        return;
      }

      // Serve list of runnable workspace files and directory structure
      if (req.url === '/api/files') {
        const files = LocalFixBridge.scanWorkspaceFiles(process.cwd());
        const directories = LocalFixBridge.scanDirectories(process.cwd());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          cwd: process.cwd(),
          folder: path.basename(process.cwd()),
          directories,
          files
        }));
        return;
      }

      // Change directory endpoint (CD)
      if (req.method === 'POST' && req.url === '/api/cd') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const targetPath = data.path;
            if (targetPath) {
              const newCwd = path.resolve(process.cwd(), targetPath);
              if (fs.existsSync(newCwd) && fs.statSync(newCwd).isDirectory()) {
                process.chdir(newCwd);
                console.log(`  ${pc.green('📁')} Directory changed from phone: ${pc.bold(pc.cyan(newCwd))}`);
                const files = LocalFixBridge.scanWorkspaceFiles(process.cwd());
                const directories = LocalFixBridge.scanDirectories(process.cwd());
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  cwd: process.cwd(),
                  folder: path.basename(process.cwd()),
                  directories,
                  files
                }));
                return;
              }
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Directory does not exist' }));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // Serve live full source code from laptop to phone
      if (req.url && req.url.startsWith('/api/file')) {
        try {
          const parsedUrl = new URL(req.url, `http://${localIp}:${this.port}`);
          const targetPath = parsedUrl.searchParams.get('path');
          if (targetPath) {
            const cleanPath = targetPath.replace(/^[ab]\//, '').replace(/^\/+/, '');
            const fullPath = path.resolve(process.cwd(), cleanPath);
            if (fs.existsSync(fullPath)) {
              const content = fs.readFileSync(fullPath, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ content, path: cleanPath }));
              return;
            }
          }
        } catch {}
      }

      // 1-Tap Undo / Rollback Endpoint (Single & Batch)
      if (req.method === 'POST' && req.url === '/api/undo') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const targetFiles = data.files || (data.file ? [data.file] : undefined);
            const revertRes = PatchApplier.revertBatch(targetFiles, process.cwd());

            if (revertRes.success) {
              console.log();
              console.log(pc.yellow('╭────────────────────────────────────────────────╮'));
              console.log(pc.yellow('│') + pc.bold(pc.yellow('     1-TAP ROLLBACK APPLIED FROM PHONE!         ')) + pc.yellow('│'));
              console.log(pc.yellow('╰────────────────────────────────────────────────╯'));
              console.log(`  ${pc.green('✓')} Reverted files: ${revertRes.restoredFiles.map(f => pc.cyan(f)).join(', ')}`);
              console.log();

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                message: `Reverted ${revertRes.restoredFiles.length} file(s) to original backup!`,
                restoredFiles: revertRes.restoredFiles
              }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'No safety backups (.devqr.bak) found to rollback.' }));
            }
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // Remote Test / Command Execution Endpoint
      if (req.method === 'POST' && req.url === '/api/run') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const cmd = data.command?.trim();

            if (!cmd) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'No command provided' }));
              return;
            }

            console.log();
            console.log(pc.cyan('╭────────────────────────────────────────────────╮'));
            console.log(pc.cyan('│') + pc.bold(pc.blue('     REMOTE TEST TRIGGERED FROM PHONE!          ')) + pc.cyan('│'));
            console.log(pc.cyan('╰────────────────────────────────────────────────╯'));
            console.log(`  ${pc.bold(pc.yellow(`$ ${cmd}`))}`);
            console.log();

            const startTime = Date.now();
            exec(cmd, { cwd: process.cwd(), timeout: 20000 }, (error, stdout, stderr) => {
              const durationMs = Date.now() - startTime;
              const exitCode = error ? (error.code ?? 1) : 0;
              const isPass = exitCode === 0;

              if (isPass) {
                console.log(pc.bold(pc.green(`✓ Test PASSED in ${durationMs}ms`)));
              } else {
                console.log(pc.bold(pc.red(`x Test FAILED (Exit code: ${exitCode})`)));
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                isPass,
                exitCode,
                stdout: stdout || '',
                stderr: stderr || (error ? error.message : ''),
                durationMs,
                command: cmd
              }));
            });
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // IDE Remote Cursor Beacon (VS Code / Cursor Jump)
      if (req.method === 'POST' && req.url === '/api/goto') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const targetFile = data.file || (this.currentBundle?.relevantFiles?.[0]?.filePath) || 'main.py';
            const cleanPath = targetFile.replace(/^[ab]\//, '').replace(/^\/+/, '');
            const fullPath = path.resolve(process.cwd(), cleanPath);
            const line = Number(data.line) || 1;
            const col = Number(data.col) || 1;

            console.log();
            console.log(pc.cyan('╭────────────────────────────────────────────────╮'));
            console.log(pc.cyan('│') + pc.bold(pc.magenta('     IDE CURSOR BEACON SIGNAL FROM PHONE!        ')) + pc.cyan('│'));
            console.log(pc.cyan('╰────────────────────────────────────────────────╯'));
            console.log(`  ${pc.green('✓')} Jumping editor cursor to: ${pc.yellow(cleanPath)}:${pc.cyan(line)}`);
            console.log();

            // Try 'code --goto', 'cursor --goto', or platform open
            const gotoArg = `"${fullPath}:${line}:${col}"`;
            exec(`code --goto ${gotoArg}`, (errCode) => {
              if (errCode) {
                exec(`cursor --goto ${gotoArg}`, (errCursor) => {
                  if (errCursor) {
                    const openCmd = process.platform === 'win32' ? `start "" "${fullPath}"` : process.platform === 'darwin' ? `open "${fullPath}"` : `xdg-open "${fullPath}"`;
                    exec(openCmd);
                  }
                });
              }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, file: cleanPath, line, col }));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // Create Full Source Code File & Push directly to Workspace/IDE
      if (req.method === 'POST' && req.url === '/api/create-file') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const targetFile = data.filePath;
            const content = data.content ?? '';
            const openInIDE = data.openInIDE !== false;

            if (!targetFile || !targetFile.trim()) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Target filePath is required' }));
              return;
            }

            const cleanPath = targetFile.replace(/^[ab]\//, '').replace(/^\/+/, '').trim();
            const fullPath = path.resolve(process.cwd(), cleanPath);

            // Ensure parent directory exists
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            // Create safety backup if file already exists
            let isNew = true;
            if (fs.existsSync(fullPath)) {
              isNew = false;
              const backupPath = `${fullPath}.devqr.bak`;
              fs.writeFileSync(backupPath, fs.readFileSync(fullPath, 'utf8'), 'utf8');
            }

            // Write full file content
            fs.writeFileSync(fullPath, content, 'utf8');
            const lineCount = content ? content.split('\n').length : 0;

            console.log();
            console.log(pc.cyan('╭────────────────────────────────────────────────╮'));
            console.log(pc.cyan('│') + pc.bold(pc.green(`     ${isNew ? 'NEW FILE CREATED' : 'FILE UPDATED'} FROM PHONE!             `)) + pc.cyan('│'));
            console.log(pc.cyan('╰────────────────────────────────────────────────╯'));
            console.log(`  ${pc.green('✓')} Target: ${pc.bold(pc.yellow(cleanPath))} (${lineCount} lines)`);

            // Open / focus in IDE if requested
            if (openInIDE) {
              const gotoArg = `"${fullPath}:1:1"`;
              exec(`code --goto ${gotoArg}`, (errCode) => {
                if (errCode) {
                  exec(`cursor --goto ${gotoArg}`, (errCursor) => {
                    if (errCursor) {
                      const openCmd = process.platform === 'win32' ? `start "" "${fullPath}"` : process.platform === 'darwin' ? `open "${fullPath}"` : `xdg-open "${fullPath}"`;
                      exec(openCmd);
                    }
                  });
                }
              });
              console.log(`  ${pc.green('✓')} IDE Beacon: Opened in ${pc.bold(pc.cyan('VS Code / Active Editor'))}`);
            }
            console.log();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              isNew,
              filePath: cleanPath,
              fullPath,
              lines: lineCount,
              openedInIDE: openInIDE
            }));
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      // Automated Regression Test File Writer & Runner
      if (req.method === 'POST' && req.url === '/api/test/write') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const targetFile = data.filePath || 'test_devqr_regression.py';
            const cleanPath = targetFile.replace(/^[ab]\//, '').replace(/^\/+/, '');
            const fullPath = path.resolve(process.cwd(), cleanPath);
            const content = data.content || '# DevQR Automated Regression Test\n';
            const runCmd = data.runCommand || (cleanPath.endsWith('.py') ? `python -m unittest ${cleanPath}` : `npm test`);

            // Ensure parent directory exists
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            // Write test file
            fs.writeFileSync(fullPath, content, 'utf8');

            console.log();
            console.log(pc.cyan('╭────────────────────────────────────────────────╮'));
            console.log(pc.cyan('│') + pc.bold(pc.green('     REGRESSION TEST WRITTEN FROM PHONE!        ')) + pc.cyan('│'));
            console.log(pc.cyan('╰────────────────────────────────────────────────╯'));
            console.log(`  ${pc.green('✓')} Saved test file: ${pc.yellow(cleanPath)} (${content.split('\n').length} lines)`);
            console.log(`  ${pc.bold(pc.cyan(`$ ${runCmd}`))}`);
            console.log();

            const startTime = Date.now();
            exec(runCmd, { cwd: process.cwd(), timeout: 25000 }, (error, stdout, stderr) => {
              const durationMs = Date.now() - startTime;
              const exitCode = error ? (error.code ?? 1) : 0;
              const isPass = exitCode === 0;

              if (isPass) {
                console.log(pc.bold(pc.green(`✓ Regression Test PASSED in ${durationMs}ms`)));
              } else {
                console.log(pc.bold(pc.red(`x Regression Test FAILED (Exit code: ${exitCode})`)));
              }
              console.log();

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                filePath: cleanPath,
                isPass,
                exitCode,
                stdout: stdout || '',
                stderr: stderr || (error ? error.message : ''),
                durationMs,
                command: runCmd
              }));
            });
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/api/apply') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body);

            // Multi-File Batch Patch Application
            if (Array.isArray(data.patches) && data.patches.length > 0) {
              console.log();
              console.log(pc.cyan('╭────────────────────────────────────────────────╮'));
              console.log(pc.cyan('│') + pc.bold(pc.green('   1-CLICK MULTI-FILE BATCH FIX RECEIVED!       ')) + pc.cyan('│'));
              console.log(pc.cyan('╰────────────────────────────────────────────────╯'));
              console.log(`  ${pc.green('✓')} Target Files (${data.patches.length}): ${data.patches.map((p: any) => pc.yellow(p.file)).join(', ')}`);
              console.log();

              const batchResult = PatchApplier.applyBatch({
                sessionId: data.sessionId || 'BATCH',
                patches: data.patches,
                verification: data.verification
              }, process.cwd());

              if (batchResult.success) {
                console.log(pc.bold(pc.green(`Successfully auto-patched all ${batchResult.appliedCount} files atomically!`)));
                if (data.verification) {
                  console.log(pc.bold(pc.yellow(`Verification command: ${pc.cyan(data.verification)}`)));
                }
                console.log();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  isBatch: true,
                  appliedCount: batchResult.appliedCount,
                  totalCount: batchResult.totalCount,
                  results: batchResult.results
                }));
              } else {
                console.log(pc.bold(pc.red(`Multi-file patch failed. Transaction rolled back atomically.`)));
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  isBatch: true,
                  error: 'Multi-file patch failed on one or more files. Atomic rollback executed.',
                  results: batchResult.results
                }));
              }
              return;
            }

            let patch: FixPatch | null = null;

            if (data.payload) {
              patch = PatchApplier.decodePatch(data.payload);
            } else if (data.file && data.patch) {
              patch = data;
            }

            if (!patch) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid patch payload' }));
              return;
            }

            console.log();
            console.log(pc.cyan('╭────────────────────────────────────────────────╮'));
            console.log(pc.cyan('│') + pc.bold(pc.green('      1-CLICK AUTO-FIX RECEIVED FROM PHONE!     ')) + pc.cyan('│'));
            console.log(pc.cyan('╰────────────────────────────────────────────────╯'));
            console.log();
            console.log(`  ${pc.green('✓')} Target File: ${pc.yellow(patch.file)}`);
            console.log(`  ${pc.green('✓')} Session ID: ${pc.cyan(patch.id)}`);
            console.log();

            const result = PatchApplier.applyPatch(patch, process.cwd(), data.fullContent);

            if (result.success) {
              console.log(pc.bold(pc.green(`Successfully auto-patched ${result.filePath}!`)));
              if (result.backupPath) {
                console.log(pc.gray(`   Safety backup created: ${result.backupPath}`));
              }
              if (patch.verification) {
                console.log();
                console.log(pc.bold(pc.yellow(`Verification command: ${pc.cyan(patch.verification)}`)));
              }
              console.log();

              if (onPatchApplied) onPatchApplied(patch);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                message: `Successfully auto-patched ${result.filePath}!`,
                file: result.filePath
              }));
            } else {
              console.log(pc.bold(pc.red(`Auto-fix failed: ${result.error}`)));
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: result.error }));
            }
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'DevQR Bridge Listening', localIp, port: this.port }));
      }
    });

    // Initialize Real-Time WebSocket Streaming Terminal Server
    this.terminalWsServer = new TerminalWebSocketServer(this.server);

    // Listen on 0.0.0.0 to accept connections from phone across WiFi
    this.server.listen(this.port, '0.0.0.0');
    return `http://${localIp}:${this.port}`;
  }

  public stop() {
    if (this.terminalWsServer) {
      this.terminalWsServer.close();
      this.terminalWsServer = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
