import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcess, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import pc from 'picocolors';

export interface TerminalMessage {
  type: 'spawn' | 'stdin' | 'kill' | 'ping' | 'pong' | 'stdout' | 'stderr' | 'exit' | 'status' | 'error';
  sessionId?: string;
  command?: string;
  data?: string;
  code?: number;
  signal?: string;
  durationMs?: number;
  message?: string;
  pid?: number;
  initialInput?: string;
  cwd?: string;
}

interface SessionProcess {
  child: ChildProcess;
  sessionId: string;
  command: string;
  pid?: number;
  startTime: number;
}

export class TerminalWebSocketServer {
  private wss: WebSocketServer | null = null;
  // Key format: `${wsId}:${sessionId}` -> SessionProcess
  private activeSessions: Map<string, SessionProcess> = new Map();
  private wsIdCounter = 0;
  private wsIds: Map<WebSocket, string> = new Map();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.init();
  }

  private init() {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket) => {
      const wsId = `client-${++this.wsIdCounter}`;
      this.wsIds.set(ws, wsId);

      console.log();
      console.log(pc.cyan('╭────────────────────────────────────────────────╮'));
      console.log(pc.cyan('│') + pc.bold(pc.green('   PHONE CONNECTED TO LIVE STREAMING TERMINAL!   ')) + pc.cyan('│'));
      console.log(pc.cyan('╰────────────────────────────────────────────────╯'));
      console.log(`  ${pc.green('✓')} Multi-tab WebSocket session multiplexer ready [Client: ${wsId}]`);
      console.log();

      ws.send(JSON.stringify({
        type: 'status',
        sessionId: 'default',
        message: 'Connected to DevQR Real-Time Terminal Bridge (Multi-Session Enabled)',
        cwd: process.cwd()
      }));

      ws.on('message', (raw: string) => {
        try {
          const msg: TerminalMessage = JSON.parse(raw.toString());
          this.handleMessage(ws, msg);
        } catch (e: any) {
          ws.send(JSON.stringify({
            type: 'error',
            sessionId: 'default',
            message: `Invalid JSON message: ${e.message}`
          }));
        }
      });

      ws.on('close', () => {
        this.cleanupAllClientSessions(ws);
        this.wsIds.delete(ws);
      });

      ws.on('error', (err) => {
        console.warn('Terminal WS error:', err.message);
        this.cleanupAllClientSessions(ws);
        this.wsIds.delete(ws);
      });
    });
  }

  private getSessionKey(ws: WebSocket, sessionId?: string): string {
    const wsId = this.wsIds.get(ws) || 'client-unknown';
    return `${wsId}:${sessionId || 'default'}`;
  }

  private handleMessage(ws: WebSocket, msg: TerminalMessage) {
    const sessionId = msg.sessionId || 'default';
    const sessionKey = this.getSessionKey(ws, sessionId);

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', sessionId }));
      return;
    }

    if (msg.type === 'stdin') {
      const session = this.activeSessions.get(sessionKey);
      const inputData = msg.data ?? '';
      if (session && session.child && session.child.stdin && !session.child.killed) {
        console.log(`  ${pc.gray(`[Tab ${sessionId}] > ${inputData.trim()}`)}`);
        session.child.stdin.write(inputData);
      } else if (inputData.trim()) {
        // If no process active on this tab, spawn the command
        this.handleMessage(ws, { type: 'spawn', sessionId, command: inputData.trim() });
      }
      return;
    }

    if (msg.type === 'kill') {
      this.killSession(ws, sessionId, msg.signal);
      return;
    }

    if (msg.type === 'spawn') {
      const command = msg.command?.trim();
      if (!command) {
        ws.send(JSON.stringify({
          type: 'error',
          sessionId,
          message: 'No command specified'
        }));
        return;
      }

      // Handle direct 'cd' commands from mobile
      const cdMatch = command.match(/^cd(?:\s+(.*)|\.\.)$/i);
      if (cdMatch || command.toLowerCase() === 'cd') {
        const target = (cdMatch && cdMatch[1] ? cdMatch[1].trim() : (command.toLowerCase() === 'cd..' ? '..' : '')) || os.homedir();
        try {
          const newDir = path.resolve(process.cwd(), target.replace(/['"]/g, ''));
          if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
            process.chdir(newDir);
            console.log(`  ${pc.green('📁')} [Tab ${sessionId}] Directory changed to: ${pc.bold(pc.cyan(process.cwd()))}`);
            ws.send(JSON.stringify({
              type: 'status',
              sessionId,
              message: `Changed directory to: ${process.cwd()}`,
              cwd: process.cwd()
            }));
            ws.send(JSON.stringify({
              type: 'stdout',
              sessionId,
              data: `📁 ${process.cwd()}\n`
            }));
            ws.send(JSON.stringify({
              type: 'exit',
              sessionId,
              code: 0,
              durationMs: 10
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'stderr',
              sessionId,
              data: `cd: directory not found: ${target}\n`
            }));
            ws.send(JSON.stringify({
              type: 'exit',
              sessionId,
              code: 1,
              durationMs: 10
            }));
          }
        } catch (e: any) {
          ws.send(JSON.stringify({
            type: 'stderr',
            sessionId,
            data: `cd error: ${e.message}\n`
          }));
        }
        return;
      }

      // Terminate any previous process running on THIS specific tab
      this.killSession(ws, sessionId);

      console.log();
      console.log(pc.yellow('╭────────────────────────────────────────────────╮'));
      console.log(pc.yellow('│') + pc.bold(pc.blue(`   [TAB ${sessionId.toUpperCase()}] SPAWNED FROM PHONE   `)) + pc.yellow('│'));
      console.log(pc.yellow('╰────────────────────────────────────────────────╯'));
      console.log(`  ${pc.bold(pc.cyan(`$ ${command}`))}`);
      console.log();

      const startTime = Date.now();
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        FORCE_COLOR: '1'
      };

      // 1. Check if command is a compile-and-run chain (e.g. gcc/g++/clang/rustc ... && app)
      const compileRunMatch = command.match(/^(gcc|g\+\+|clang|clang\+\+|rustc)\s+(.*?)\s+-o\s+([^\s&]+)\s*&&\s*(.*)$/i);
      if (compileRunMatch) {
        const [, compiler, sourceArgs, outputBin, runCmd] = compileRunMatch;
        ws.send(JSON.stringify({
          type: 'status',
          sessionId,
          message: `Compiling with ${compiler}...`
        }));

        const compileCmd = `${compiler} ${sourceArgs} -o ${outputBin}`;
        exec(compileCmd, { cwd: process.cwd() }, (compileErr, compileStdout, compileStderr) => {
          if (compileErr) {
            if (compileStderr && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'stderr',
                sessionId,
                data: TerminalWebSocketServer.cleanAnsi(compileStderr)
              }));
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'exit',
                sessionId,
                code: compileErr.code || 1,
                durationMs: Date.now() - startTime
              }));
            }
            return;
          }

          if (compileStdout && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'stdout',
              sessionId,
              data: TerminalWebSocketServer.cleanAnsi(compileStdout)
            }));
          }

          // Clean executable path
          let binPath = outputBin.replace(/['"]/g, '');
          if (!binPath.startsWith('.') && !binPath.includes('/') && !binPath.includes('\\')) {
            binPath = process.platform === 'win32' ? `.\\${binPath}` : `./${binPath}`;
          }

          ws.send(JSON.stringify({
            type: 'status',
            sessionId,
            message: `Starting interactive binary: ${binPath}`
          }));

          try {
            const child = spawn(binPath, [], {
              shell: false,
              cwd: process.cwd(),
              env,
              stdio: ['pipe', 'pipe', 'pipe']
            });

            this.attachProcessListeners(ws, sessionId, child, startTime, binPath, msg.initialInput);
          } catch (binErr: any) {
            ws.send(JSON.stringify({
              type: 'error',
              sessionId,
              message: `Execution error: ${binErr.message}`
            }));
          }
        });
        return;
      }

      // 2. Direct spawn with shell bypass for interactive Python, Node, and binaries
      const parsed = TerminalWebSocketServer.parseCommand(command);
      try {
        const child = parsed.useShell
          ? spawn(command, {
              shell: true,
              cwd: process.cwd(),
              env,
              stdio: ['pipe', 'pipe', 'pipe']
            })
          : spawn(parsed.executable, parsed.args, {
              shell: false,
              cwd: process.cwd(),
              env,
              stdio: ['pipe', 'pipe', 'pipe']
            });

        this.attachProcessListeners(ws, sessionId, child, startTime, command, msg.initialInput);
      } catch (err: any) {
        ws.send(JSON.stringify({
          type: 'error',
          sessionId,
          message: `Spawn error: ${err.message}`
        }));
      }
    }
  }

  public static parseCommand(command: string): { executable: string; args: string[]; useShell: boolean } {
    const rawTokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    if (rawTokens.length === 0) {
      return { executable: command, args: [], useShell: true };
    }

    const execToken = (rawTokens[0] || '').replace(/^["']|["']$/g, '');
    const argsTokens = rawTokens.slice(1).map(t => t.replace(/^["']|["']$/g, ''));

    const DIRECT_EXECUTABLES = new Set([
      'python', 'python3', 'py',
      'node', 'ts-node', 'npx',
      'pytest', 'git', 'cargo',
      'go', 'ruby', 'php', 'bash', 'sh'
    ]);

    const execName = path.basename(execToken).toLowerCase().replace('.exe', '');
    const isDirect = DIRECT_EXECUTABLES.has(execName) || execToken.endsWith('.exe') || execToken.startsWith('.') || execToken.includes('/') || execToken.includes('\\');

    if (isDirect) {
      return {
        executable: execToken,
        args: argsTokens,
        useShell: false
      };
    }

    return {
      executable: command,
      args: [],
      useShell: true
    };
  }

  public static cleanAnsi(str: string): string {
    if (!str) return '';
    return str
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\[\[?[0-9;]*m/g, '')
      .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }

  private attachProcessListeners(
    ws: WebSocket,
    sessionId: string,
    child: ChildProcess,
    startTime: number,
    commandDisplay: string,
    initialInput?: string
  ) {
    const sessionKey = this.getSessionKey(ws, sessionId);
    this.activeSessions.set(sessionKey, {
      child,
      sessionId,
      command: commandDisplay,
      pid: child.pid,
      startTime
    });

    ws.send(JSON.stringify({
      type: 'status',
      sessionId,
      command: commandDisplay,
      pid: child.pid,
      message: `Process started (PID: ${child.pid})`
    }));

    if (initialInput && child.stdin) {
      const inputData = initialInput;
      setTimeout(() => {
        try {
          if (child.stdin && !child.killed) {
            console.log(`  ${pc.gray(`[Tab ${sessionId}] > ${inputData.trim()}`)}`);
            child.stdin.write(inputData + '\n');
          }
        } catch {}
      }, 80);
    }

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'stdout',
            sessionId,
            data: TerminalWebSocketServer.cleanAnsi(text)
          }));
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'stderr',
            sessionId,
            data: TerminalWebSocketServer.cleanAnsi(text)
          }));
        }
      });
    }

    child.on('error', (err: Error) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          sessionId,
          message: err.message
        }));
      }
      this.activeSessions.delete(sessionKey);
    });

    child.on('close', (code: number | null, signal: string | null) => {
      const durationMs = Date.now() - startTime;
      const exitCode = code ?? (signal ? 130 : 0);

      if (exitCode === 0) {
        console.log(`  ${pc.green('✓')} [Tab ${sessionId}] Completed cleanly in ${durationMs}ms`);
      } else {
        console.log(`  ${pc.red('x')} [Tab ${sessionId}] Exited with code ${exitCode} (${signal || 'terminated'})`);
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'exit',
          sessionId,
          code: exitCode,
          signal: signal || undefined,
          durationMs
        }));
      }
      this.activeSessions.delete(sessionKey);
    });
  }

  private killSession(ws: WebSocket, sessionId: string, signal: string = 'SIGINT') {
    const sessionKey = this.getSessionKey(ws, sessionId);
    const session = this.activeSessions.get(sessionKey);
    if (!session || !session.child || session.child.killed) return;

    if (process.platform === 'win32' && session.child.pid) {
      exec(`taskkill /pid ${session.child.pid} /T /F`, () => {});
    } else {
      try {
        session.child.kill(signal as NodeJS.Signals || 'SIGINT');
      } catch {}
    }
    this.activeSessions.delete(sessionKey);
  }

  private cleanupAllClientSessions(ws: WebSocket) {
    const wsId = this.wsIds.get(ws);
    if (!wsId) return;

    for (const [key, session] of this.activeSessions.entries()) {
      if (key.startsWith(`${wsId}:`)) {
        if (session.child && !session.child.killed) {
          if (process.platform === 'win32' && session.child.pid) {
            exec(`taskkill /pid ${session.child.pid} /T /F`, () => {});
          } else {
            try {
              session.child.kill('SIGTERM');
            } catch {}
          }
        }
        this.activeSessions.delete(key);
      }
    }
  }

  public close() {
    for (const [, session] of this.activeSessions.entries()) {
      if (session.child && !session.child.killed) {
        if (process.platform === 'win32' && session.child.pid) {
          exec(`taskkill /pid ${session.child.pid} /T /F`, () => {});
        } else {
          try {
            session.child.kill('SIGTERM');
          } catch {}
        }
      }
    }
    this.activeSessions.clear();
    try {
      this.wss?.close();
    } catch {}
  }
}
