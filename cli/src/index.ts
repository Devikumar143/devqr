#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { ProjectDetector } from './detector.js';
import { GitInspector } from './git.js';
import { SecretSanitizer } from './sanitizer.js';
import { BundleCompressor } from './compressor.js';
import { DebugBundle, RelevantFile, TerminalBundle } from './types.js';
import { LocalFixBridge } from './bridge.js';

const program = new Command();

program
  .name('devqr')
  .description('DevQR — Laptop Errors. Phone Intelligence. (Zero Cloud Backend)')
  .version('1.0.0');

function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = 'DVQR-';
  for (let i = 0; i < 5; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// Inspect workspace for common log files if no error is directly passed
function findRecentLogFile(): { filePath: string; content: string } | null {
  const commonLogs = [
    'npm-debug.log',
    'yarn-error.log',
    '.expo/logs.log',
    'build.log',
    'error.log'
  ];

  for (const logName of commonLogs) {
    const fullPath = path.join(process.cwd(), logName);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8').trim();
        if (content) return { filePath: logName, content: content.slice(-1500) };
      } catch {}
    }
  }
  return null;
}

// Read piped stdin (e.g. npm test | devqr)
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => { resolve(data.trim()); });
    setTimeout(() => resolve(data.trim()), 500);
  });
}

export function printDevQRBanner(subtitle = 'Laptop Errors. Phone Intelligence.', tag?: string) {
  console.log();
  console.log(pc.cyan('  ┌──────┐') + pc.bold(pc.white('  DEV')) + pc.bold(pc.cyan('QR')) + (tag ? pc.cyan(` [${tag}]`) : ''));
  console.log(pc.cyan('  │ ▣  ▣ │') + pc.dim(`  ${subtitle}`));
  console.log(pc.cyan('  │ <⚡> │') + pc.gray('  Zero Cloud Backend • Portable AI Debugging'));
  console.log(pc.cyan('  └──────┘'));
  console.log();
}

async function runDevQR(options: any) {
  if (!options.json) {
    printDevQRBanner('Laptop Errors. Phone Intelligence.');
  }

  // 1. Detect project & runtime
  if (!options.json) {
    console.log(pc.bold(pc.blue('🔍 Detecting project...')));
  }
  const { project, environment, dependencies } = ProjectDetector.detect();
  if (!options.json) {
    console.log(`  ${pc.green('✓')} ${project.name} (${project.framework}) detected`);
  }

  // 2. Detect environment
  if (!options.json) {
    console.log();
    console.log(pc.bold(pc.blue('🔍 Detecting environment...')));
    console.log(`  ${pc.green('✓')} ${environment.platform} / ${environment.os}`);
    if (environment.node) console.log(`  ${pc.green('✓')} Node.js ${environment.node}`);
  }

  // 3. Collect Error & Context
  if (!options.json) {
    console.log();
    console.log(pc.bold(pc.blue('🔍 Collecting error...')));
  }

  let errorMessage = options.error || '';
  let stackTrace = options.stack || '';
  let recentChanges = GitInspector.getRecentChanges();
  let relevantFiles: RelevantFile[] = [];

  // Check interactive picker option
  if (options.interactive) {
    try {
      const { ContextPicker } = await import('./picker.js');
      const picked = await ContextPicker.promptInteractive(errorMessage);
      errorMessage = picked.errorMessage;
      if (picked.files.length > 0) {
        relevantFiles = picked.files;
      }
      options.noSanitize = !picked.sanitize;
    } catch (err: any) {
      if (err.name === 'ExitPromptError' || err.message?.includes('SIGINT') || err.message?.includes('force closed')) {
        console.log();
        console.log(pc.gray('Interactive session cancelled.'));
        process.exit(0);
      }
      throw err;
    }
  }

  // Check piped stdin if no error argument
  if (!errorMessage && !options.interactive) {
    const stdinContent = await readStdin();
    if (stdinContent) {
      errorMessage = stdinContent.slice(-400);
      stackTrace = stdinContent.slice(-1000);
    }
  }

  // Check file option
  if (options.file && fs.existsSync(options.file)) {
    try {
      const fileContent = fs.readFileSync(options.file, 'utf8');
      relevantFiles.push({
        filePath: options.file,
        content: fileContent.slice(0, 1500)
      });
      if (!errorMessage) {
        errorMessage = `Error context from file: ${options.file}`;
      }
    } catch {}
  }

  // Check recent log file if no error argument provided
  if (!errorMessage) {
    const logFound = findRecentLogFile();
    if (logFound) {
      errorMessage = logFound.content.slice(-400);
      stackTrace = logFound.content.slice(-800);
      relevantFiles.push({
        filePath: logFound.filePath,
        content: logFound.content
      });
    } else if (recentChanges.length > 0) {
      errorMessage = `Workspace issue in ${project.name} on branch '${project.branch || 'main'}'`;
      stackTrace = `Recent git modifications: ${recentChanges.map(c => c.file).join(', ')}`;
    } else {
      errorMessage = `Debugging session for ${project.name} (${project.framework})`;
      stackTrace = `Runtime: ${environment.platform}, Node ${environment.node || '22'}`;
    }
  }

  // If relevant files not yet set, parse stack trace for file paths (e.g. Python traceback or Node stack)
  if (relevantFiles.length === 0 && (stackTrace || errorMessage)) {
    const combined = `${errorMessage}\n${stackTrace}`;
    const pyMatch = combined.match(/File ["']([^"']+\.py)["']/i) || combined.match(/["']([^"']+\.py)["']/i);
    const tsMatch = combined.match(/\(([^)]+\.(?:ts|tsx|js|jsx)):\d+:\d+\)/i) || combined.match(/at .*\s+([^:\s]+\.(?:ts|tsx|js|jsx)):\d+/i);
    const targetFile = pyMatch ? pyMatch[1] : tsMatch ? tsMatch[1] : null;

    if (targetFile) {
      const relCandidate = path.isAbsolute(targetFile) ? path.relative(process.cwd(), targetFile) : targetFile;
      const fullPath = path.resolve(process.cwd(), relCandidate);
      if (fs.existsSync(fullPath)) {
        try {
          relevantFiles.push({
            filePath: relCandidate,
            content: fs.readFileSync(fullPath, 'utf8').slice(0, 1500)
          });
        } catch {}
      }
    }
  }

  // If git modified files exist, attach the top changed file
  if (relevantFiles.length === 0 && recentChanges.length > 0) {
    const topChange = recentChanges[0].file;
    const fullPath = path.join(process.cwd(), topChange);
    if (fs.existsSync(fullPath)) {
      try {
        relevantFiles.push({
          filePath: topChange,
          content: fs.readFileSync(fullPath, 'utf8').slice(0, 1000)
        });
      } catch {}
    }
  }

  // Fallback: Find the most recently modified source file in directory (.py, .ts, .js, .tsx, .jsx)
  if (relevantFiles.length === 0) {
    try {
      const allFiles = fs.readdirSync(process.cwd());
      const codeFiles = allFiles
        .filter(f => !f.startsWith('.') && !f.endsWith('.bak') && !f.endsWith('.png') && !f.endsWith('.log'))
        .filter(f => /\.(py|ts|tsx|js|jsx|pyw)$/i.test(f))
        .map(f => ({
          name: f,
          mtime: fs.statSync(path.join(process.cwd(), f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (codeFiles.length > 0) {
        const topFile = codeFiles[0].name;
        const fileContent = fs.readFileSync(path.join(process.cwd(), topFile), 'utf8');
        relevantFiles.push({
          filePath: topFile,
          content: fileContent.slice(0, 2000)
        });
        if (!errorMessage) {
          errorMessage = `Debugging session for ${topFile}`;
        }
      }
    } catch {}
  }

  if (!options.json) {
    console.log(`  ${pc.green('✓')} Error: ${pc.red(errorMessage.slice(0, 70))}${errorMessage.length > 70 ? '...' : ''}`);
    if (stackTrace) {
      console.log(`  ${pc.green('✓')} Stack trace parsed (${stackTrace.split('\n').length} lines)`);
    }
  }

  // 4. Inspect project context
  if (!options.json) {
    console.log();
    console.log(pc.bold(pc.blue('🔍 Inspecting project...')));
    console.log(`  ${pc.green('✓')} Dependencies (${Object.keys(dependencies).length} key packages)`);
    console.log(`  ${pc.green('✓')} Recent Git changes (${recentChanges.length} modified files)`);
    if (relevantFiles.length > 0) {
      console.log(`  ${pc.green('✓')} Attached source: ${pc.cyan(relevantFiles[0].filePath)} (${relevantFiles[0].content.length} chars)`);
    } else {
      console.log(`  ${pc.yellow('!')} No source files attached`);
    }
  }

  // 5. Build raw bundle
  const sessionId = generateSessionId();
  let bundle: DebugBundle = {
    version: 1,
    sessionId,
    createdAt: new Date().toISOString(),
    project,
    environment,
    error: {
      message: errorMessage,
      stackTrace
    },
    dependencies,
    recentChanges,
    relevantFiles,
    sanitized: false
  };

  // 6. Sanitization
  if (!options.noSanitize) {
    if (!options.json) {
      console.log();
      console.log(pc.bold(pc.blue('[SANITIZING] Sanitizing sensitive data...')));
    }
    bundle = SecretSanitizer.sanitizeBundle(bundle);
    if (!options.json) {
      console.log(`  ${pc.green('✓')} API keys removed`);
      console.log(`  ${pc.green('✓')} Tokens removed`);
      console.log(`  ${pc.green('✓')} Passwords removed`);
      console.log(`  ${pc.green('✓')} .env values removed`);
      console.log(`  ${pc.green('✓')} Private keys removed`);
    }
  }

  // 7. Start Local Real-Time Fix Bridge
  const { LocalFixBridge } = await import('./bridge.js');
  const bridge = new LocalFixBridge();
  const bridgeUrl = await bridge.start();
  bundle.bridgeUrl = bridgeUrl;
  bridge.setBundle(bundle);

  // 8. Compress and generate QR
  const { qrPayload, originalBytes, compressedBytes, ratio } = BundleCompressor.compress(bundle);

  if (!options.json) {
    console.log();
    console.log(pc.bold(pc.blue('[BUNDLE] Creating Debug Bundle...')));
    console.log(`  ${pc.green('✓')} Bundle created: ${pc.cyan(sessionId)} (${originalBytes}B -> ${pc.green(compressedBytes + 'B')}, ${pc.green(`-${ratio}%`)})`);
    console.log(`  ${pc.green('✓')} Real-Time Fix Bridge: ${pc.cyan(bridgeUrl)} (Zero-cloud LAN direct)`);
    console.log();

    // Generate high-res image backup on disk
    const qrImagePath = path.join(process.cwd(), 'devqr-qr.png');
    try {
      await QRCode.toFile(qrImagePath, qrPayload, {
        width: 380,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch {}

    console.log(pc.bold(pc.yellow('Scan this QR using DevQR Mobile (Zero-cloud direct transfer):')));
    console.log();

    // Render clean compact terminal QR string
    try {
      const qrAscii = await QRCode.toString(qrPayload, {
        type: 'terminal',
        small: true,
        margin: 1
      });
      console.log(qrAscii);
    } catch (err) {
      console.log(pc.red('Terminal QR rendering error. View image below:'));
    }

    console.log();
    console.log(`${pc.bold('QR Image saved to:')} ${pc.underline(pc.cyan(qrImagePath))}`);
    console.log(pc.gray(`Raw QR Payload: ${qrPayload.slice(0, 65)}...`));
    console.log();
    console.log(pc.green('Tip: Open DevQR Mobile, scan QR, and tap "1-CLICK AUTO FIX" on your phone.'));
    console.log(pc.gray('   (DevQR is actively listening for 1-click phone auto-fix signals...)'));
    console.log();
  } else {
    console.log(JSON.stringify({ bundle, qrPayload, sessionId, compressedBytes }, null, 2));
  }
}

async function runArchMode(options: any) {
  if (!options.json) {
    printDevQRBanner('Codebase Blueprint & Health Studio', 'ARCHITECTURE');
  }

  const { project, environment, dependencies } = ProjectDetector.detect();
  const { files, entryPoints, totalFiles, totalLines } = ProjectDetector.scanRepositoryStructure();

  const sessionId = generateSessionId();
  const archBundle: import('./types.js').ArchitectureBundle = {
    version: 1,
    sessionId,
    createdAt: new Date().toISOString(),
    mode: 'architecture',
    project,
    environment,
    dependencies,
    files,
    entryPoints,
    totalFiles,
    totalLines
  };

  // Start bridge
  const { LocalFixBridge } = await import('./bridge.js');
  const bridge = new LocalFixBridge();
  const bridgeUrl = await bridge.start();
  archBundle.bridgeUrl = bridgeUrl;
  bridge.setArchBundle(archBundle);

  // Compress into QR
  const { qrPayload, originalBytes, compressedBytes, ratio } = BundleCompressor.compress(archBundle as any);

  if (!options.json) {
    console.log(pc.bold(pc.blue('[REPOSITORY AUDIT] Completed repository scan:')));
    console.log(`  ${pc.green('✓')} Project: ${pc.cyan(project.name)} (${project.framework})`);
    console.log(`  ${pc.green('✓')} Scanned: ${pc.yellow(totalFiles + ' files')} (${pc.yellow(totalLines + ' lines of code')})`);
    console.log(`  ${pc.green('✓')} Entry Points: ${pc.cyan(entryPoints.join(', ') || 'Auto-detected')}`);
    console.log(`  ${pc.green('✓')} LAN Bridge: ${pc.cyan(bridgeUrl)}`);
    console.log();

    console.log(pc.bold(pc.yellow('Scan this QR using DevQR Mobile for Code Architecture Studio:')));
    console.log();

    try {
      const qrAscii = await QRCode.toString(qrPayload, {
        type: 'terminal',
        small: true,
        margin: 1
      });
      console.log(qrAscii);
    } catch (err) {
      console.log(pc.red('Terminal QR rendering error.'));
    }

    console.log();
    console.log(pc.green('Tip: Open DevQR Mobile, scan QR, and explore Architecture, Dependencies & Dead Code.'));
    console.log();
  } else {
    console.log(JSON.stringify(archBundle, null, 2));
  }
}

async function runGeneratorMode(options: any) {
  if (!options.json) {
    printDevQRBanner('AI App & File Studio (Custom Folder Generator)', 'APP GENERATOR');
  }

  const { project, environment, dependencies } = ProjectDetector.detect();
  const folderName = path.basename(process.cwd());
  const sessionId = generateSessionId();

  const genBundle: import('./types.js').GeneratorBundle = {
    version: 1,
    sessionId,
    createdAt: new Date().toISOString(),
    mode: 'generator',
    project: {
      name: folderName || project.name || 'Workspace',
      framework: project.framework || 'Custom',
      language: options.lang || project.language || 'Python'
    },
    environment,
    targetFolder: process.cwd(),
    suggestedLanguage: options.lang || project.language || 'Python'
  };

  // Start LAN Fix & Creation Bridge
  const { LocalFixBridge } = await import('./bridge.js');
  const bridge = new LocalFixBridge();
  const bridgeUrl = await bridge.start();
  genBundle.bridgeUrl = bridgeUrl;
  bridge.setGeneratorBundle(genBundle);

  // Compress into QR
  const { qrPayload, originalBytes, compressedBytes, ratio } = BundleCompressor.compress(genBundle as any);

  if (!options.json) {
    console.log(pc.bold(pc.blue('[AI STUDIO READY] Connected custom folder to DevQR Studio:')));
    console.log(`  ${pc.green('✓')} Target Directory: ${pc.bold(pc.yellow(process.cwd()))}`);
    console.log(`  ${pc.green('✓')} Detected Environment: ${pc.cyan(project.language || 'Python')} / ${pc.cyan(environment.os)}`);
    console.log(`  ${pc.green('✓')} Real-Time LAN Bridge: ${pc.cyan(bridgeUrl)}`);
    console.log();

    console.log(pc.bold(pc.yellow('Scan this QR with DevQR Mobile to generate and push your app/files:')));
    console.log();

    // Render terminal QR string
    try {
      const qrAscii = await QRCode.toString(qrPayload, {
        type: 'terminal',
        small: true,
        margin: 1
      });
      console.log(qrAscii);
    } catch (err) {
      console.log(pc.red('Terminal QR rendering error.'));
    }

    console.log();
    console.log(pc.cyan('Tip: Point DevQR Mobile at this QR code.'));
    console.log(pc.white('   1. Describe your requirements on phone (e.g. "Create a Python number guessing game")'));
    console.log(pc.white('   2. Tap [ Push to Laptop & Open in IDE ] to scaffold files & open in VS Code / Cursor!'));
    console.log();
    console.log(pc.gray('   (DevQR is actively listening for incoming files & remote run requests...)'));
    console.log();
  } else {
    console.log(JSON.stringify(genBundle, null, 2));
  }
}

async function runTerminalMode(options: any) {
  const folderName = path.basename(process.cwd());

  let initialCommand = options.command;
  if (!initialCommand) {
    try {
      const files = fs.readdirSync(process.cwd()).filter(f => !f.startsWith('.'));
      const cFiles = files.filter(f => f.endsWith('.c') || f.endsWith('.cpp'));
      const pyFiles = files.filter(f => f.endsWith('.py'));
      const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));

      if (cFiles.length > 0) {
        const target = cFiles.find(f => f.toLowerCase().includes('main')) || cFiles[0];
        initialCommand = process.platform === 'win32'
          ? `gcc "${target}" -o app.exe && .\\app.exe`
          : `gcc "${target}" -o app_bin && ./app_bin`;
      } else if (pyFiles.length > 0) {
        const target = pyFiles.find(f => f.toLowerCase().includes('main') || f.toLowerCase().includes('app')) || pyFiles[0];
        initialCommand = `python -u "${target}"`;
      } else if (files.includes('package.json')) {
        initialCommand = 'npm test';
      } else if (jsFiles.length > 0) {
        const target = jsFiles.find(f => f.toLowerCase().includes('index') || f.toLowerCase().includes('main') || f.toLowerCase().includes('app')) || jsFiles[0];
        initialCommand = target.endsWith('.ts') ? `npx ts-node "${target}"` : `node "${target}"`;
      } else if (files.includes('Cargo.toml')) {
        initialCommand = 'cargo run';
      } else if (files.includes('go.mod')) {
        initialCommand = 'go run .';
      } else {
        initialCommand = 'python -u main.py';
      }
    } catch {
      initialCommand = 'python -u main.py';
    }
  }

  const bridge = new LocalFixBridge();
  const bridgeUrl = await bridge.start();

  const termBundle: TerminalBundle = {
    version: 1,
    sessionId: `TERM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    mode: 'terminal',
    project: {
      name: folderName,
      language: 'Shell',
      framework: 'CLI'
    },
    environment: {
      platform: 'Node',
      os: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'
    },
    targetFolder: process.cwd(),
    initialCommand,
    bridgeUrl
  };

  const { qrPayload } = BundleCompressor.compress(termBundle as any);

  if (!options.json) {
    console.log();
    console.log(pc.cyan('╭─────────────────────────────────────────────────────────────╮'));
    console.log(pc.cyan('│') + pc.bold(pc.green('       DEVQR LIVE STREAMING TERMINAL & REPL BRIDGE           ')) + pc.cyan('│'));
    console.log(pc.cyan('╰─────────────────────────────────────────────────────────────╯'));
    console.log(`  ${pc.green('✓')} Workspace: ${pc.bold(pc.yellow(process.cwd()))}`);
    console.log(`  ${pc.green('✓')} LAN Bridge: ${pc.bold(pc.cyan(bridgeUrl))}`);
    console.log(`  ${pc.green('✓')} WebSocket: ${pc.bold(pc.cyan(bridgeUrl.replace('http://', 'ws://')))}`);
    console.log(`  ${pc.green('✓')} Default Command: ${pc.bold(pc.magenta(initialCommand))}`);
    console.log();

    try {
      const qrAscii = await QRCode.toString(qrPayload, {
        type: 'terminal',
        small: true,
        margin: 1
      });
      console.log(qrAscii);
    } catch (err) {
      console.log(pc.red('Terminal QR rendering error.'));
    }

    console.log();
    console.log(pc.cyan('Tip: Point DevQR Mobile at this QR code.'));
    console.log(pc.white('   1. Instant bidirectional streaming terminal connects over LAN WebSocket!'));
    console.log(pc.white('   2. Type inputs, answers, numbers & interactive CLI commands directly from your phone.'));
    console.log(pc.white('   3. Run tests (npm test, pytest, python, node, etc.) without generating any code!'));
    console.log();
    console.log(pc.gray('   (DevQR Terminal Bridge is running & streaming live...)'));
    console.log();
  } else {
    console.log(JSON.stringify(termBundle, null, 2));
  }
}

// Command: devqr (default)
program
  .option('-f, --file <path>', 'Single source file to review and inspect')
  .option('-e, --error <msg>', 'Error message or review specification')
  .option('-s, --stack <trace>', 'Stack trace')
  .option('-i, --interactive', 'Interactively pick project files to include in QR payload')
  .option('-g, --generator', 'Launch AI App & File Generator Studio')
  .option('--no-sanitize', 'Skip sensitive information sanitization')
  .option('--json', 'Output raw bundle JSON payload without QR graphic')
  .action(async (options) => {
    if (options.generator) {
      await runGeneratorMode(options);
    } else {
      await runDevQR(options);
    }
  });

// Command: devqr review / check / audit (Single File Code Review)
program
  .command('review [file]')
  .alias('check')
  .alias('audit')
  .description('Perform a single file AI code review, quality audit, and bug detection')
  .option('-e, --error <message>', 'Specific review concern or instructions')
  .option('-i, --interactive', 'Interactive file picker')
  .action(async (file, opts) => {
    const targetFile = file || opts.file;
    await runDevQR({
      ...opts,
      file: targetFile,
      error: opts.error || (targetFile ? `Code review and quality inspection for: ${targetFile}` : '')
    });
  });

// Command: devqr gen / new / create (AI App & File Generator Studio)
program
  .command('gen')
  .alias('new')
  .alias('create')
  .description('Launch AI App & File Studio to build new code files from phone into this folder')
  .option('-l, --lang <language>', 'Target programming language (e.g. python, typescript, rust, go)')
  .option('--json', 'Output raw JSON bundle')
  .action(async (opts) => runGeneratorMode(opts));

// Command: devqr term / repl / shell / run / test (Live Streaming Interactive Terminal without generating code)
program
  .command('term [cmd...]')
  .alias('repl')
  .alias('shell')
  .alias('run')
  .alias('test')
  .description('Launch live streaming terminal & interactive mobile REPL to test without generating anything')
  .option('-c, --command <cmd>', 'Command to execute in live terminal')
  .option('--json', 'Output raw JSON bundle')
  .action(async (cmdArr, opts) => {
    const rawCmd = Array.isArray(cmdArr) && cmdArr.length > 0 ? cmdArr.join(' ') : opts.command;
    await runTerminalMode({ ...opts, command: rawCmd });
  });

// Command: devqr arch (Code Architecture Blueprint & Health)
program
  .command('arch')
  .description('Scan repository architecture, dependency graph, and code health')
  .option('--json', 'Output raw JSON bundle')
  .action(async (opts) => runArchMode(opts));

// Command: devqr scan
program
  .command('scan')
  .description('Scan project logs, git changes, and generate debugging QR')
  .option('-i, --interactive', 'Interactive terminal context and file picker')
  .option('-e, --error <message>', 'Error message')
  .option('-f, --file <path>', 'Source file')
  .action((opts) => runDevQR(opts));

// Command: devqr collect
program
  .command('collect')
  .description('Collect and sanitize debug context without rendering QR')
  .action(() => runDevQR({ json: true }));

// Command: devqr apply (Reverse Fix Transfer: Phone -> Laptop)
program
  .command('apply [payload]')
  .description('Apply an AI Fix Patch received from DevQR Mobile to your workspace')
  .action(async (payload) => {
    let rawPayload = payload;

    if (!rawPayload) {
      const stdinContent = await readStdin();
      if (stdinContent) rawPayload = stdinContent;
    }

    if (!rawPayload) {
      console.log(pc.red('Error: No patch payload provided. Provide via argument or stdin.'));
      console.log(pc.gray('Usage: devqr apply "devqr://patch/..." or copy fix code from phone.'));
      process.exit(1);
    }

    printDevQRBanner('Phone AI -> Laptop Workspace', 'REVERSE PATCH');

    const { PatchApplier } = await import('./patcher.js');
    const patch = PatchApplier.decodePatch(rawPayload);

    if (!patch) {
      console.log(pc.red('Error: Failed to decode patch payload. Invalid format.'));
      process.exit(1);
    }

    console.log();
    console.log(pc.bold(pc.blue('[PATCH] Information:')));
    console.log(`  ${pc.green('✓')} Session ID: ${pc.cyan(patch.id)}`);
    console.log(`  ${pc.green('✓')} Target File: ${pc.yellow(patch.file)}`);
    if (patch.verification) {
      console.log(`  ${pc.green('✓')} Verification Command: ${pc.cyan(patch.verification)}`);
    }
    console.log();
    console.log(pc.bold(pc.magenta('Code Diff Preview:')));
    const diffLines = patch.patch.split('\n');
    for (const line of diffLines) {
      if (line.startsWith('-')) {
        console.log(pc.red(line));
      } else if (line.startsWith('+')) {
        console.log(pc.green(line));
      } else {
        console.log(pc.gray(line));
      }
    }
    console.log();

    const result = PatchApplier.applyPatch(patch);

    if (result.success) {
      console.log(pc.bold(pc.green(`Successfully applied patch to ${result.filePath}!`)));
      if (result.backupPath) {
        console.log(pc.gray(`   Safety backup saved: ${result.backupPath}`));
      }
      if (patch.verification) {
        console.log();
        console.log(pc.bold(pc.yellow(`Run verification: ${pc.cyan(patch.verification)}`)));
      }
      console.log();
    } else {
      console.log(pc.bold(pc.red(`Failed to apply patch: ${result.error}`)));
      console.log();
    }
  });

program.parse(process.argv);
