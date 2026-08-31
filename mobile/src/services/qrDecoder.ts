import pako from 'pako';
import { DebugBundle } from '../types';

export class QRDecoder {
  public static decode(payload: string): {
    bundle?: DebugBundle | import('../types').ArchitectureBundle | import('../types').GeneratorBundle | import('../types').TerminalBundle;
    isArchitecture?: boolean;
    isGenerator?: boolean;
    isTerminal?: boolean;
    error?: string;
  } {
    try {
      if (!payload) return { error: 'Empty payload' };
      const trimmed = payload.trim();

      const isArchPrefix = trimmed.startsWith('devqr://a/');
      const isGenPrefix = trimmed.startsWith('devqr://g/');
      const isTermPrefix = trimmed.startsWith('devqr://t/');
      let base64 = trimmed;
      if (trimmed.startsWith('devqr://b/')) {
        base64 = trimmed.replace('devqr://b/', '');
      } else if (trimmed.startsWith('devqr://a/')) {
        base64 = trimmed.replace('devqr://a/', '');
      } else if (trimmed.startsWith('devqr://g/')) {
        base64 = trimmed.replace('devqr://g/', '');
      } else if (trimmed.startsWith('devqr://t/')) {
        base64 = trimmed.replace('devqr://t/', '');
      } else if (trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        return {
          bundle: json,
          isArchitecture: json.mode === 'architecture',
          isGenerator: json.mode === 'generator',
          isTerminal: json.mode === 'terminal'
        };
      }

      // Base64url to Uint8Array
      base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const inflated = pako.inflate(bytes);
      const jsonStr = new TextDecoder().decode(inflated);
      const parsed = JSON.parse(jsonStr);

      // Check if terminal bundle
      if (isTermPrefix || parsed.mode === 'terminal') {
        const termNormalized: import('../types').TerminalBundle = {
          version: parsed.v || 1,
          sessionId: parsed.id || `TERM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          mode: 'terminal',
          createdAt: new Date().toISOString(),
          bridgeUrl: parsed.br || '',
          targetFolder: parsed.tf || 'Workspace',
          initialCommand: parsed.cmd || 'python main.py',
          project: {
            name: parsed.pr?.n || 'Workspace',
            framework: parsed.pr?.f || 'Custom',
            language: parsed.pr?.l || 'Shell'
          },
          environment: { platform: 'Node', os: 'Windows' }
        };
        return { bundle: termNormalized, isTerminal: true };
      }

      // Check if generator bundle
      if (isGenPrefix || parsed.mode === 'generator') {
        const genNormalized: import('../types').GeneratorBundle = {
          version: parsed.v || 1,
          sessionId: parsed.id || `GEN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          mode: 'generator',
          createdAt: new Date().toISOString(),
          bridgeUrl: parsed.br || '',
          targetFolder: parsed.tf || 'Workspace',
          suggestedLanguage: parsed.pr?.l || 'Python',
          project: {
            name: parsed.pr?.n || 'Workspace',
            framework: parsed.pr?.f || 'Custom',
            language: parsed.pr?.l || 'Python'
          },
          environment: { platform: 'Node', os: 'Windows' }
        };
        return { bundle: genNormalized, isGenerator: true };
      }

      // Check if architecture bundle
      if (isArchPrefix || parsed.mode === 'architecture') {
        const archNormalized: import('../types').ArchitectureBundle = {
          version: parsed.v || 1,
          sessionId: parsed.id || `ARCH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          mode: 'architecture',
          createdAt: new Date().toISOString(),
          bridgeUrl: parsed.br || '',
          project: {
            name: parsed.pr?.n || 'App',
            framework: parsed.pr?.f || 'Node',
            language: parsed.pr?.l || 'TS'
          },
          environment: { platform: 'Node', os: 'Windows' },
          dependencies: {},
          files: [],
          entryPoints: [],
          totalFiles: parsed.tf || 0,
          totalLines: parsed.tl || 0
        };
        return { bundle: archNormalized, isArchitecture: true };
      }

      // Check if it's compact format
      if (parsed.pr && parsed.err) {
        const normalized: DebugBundle = {
          version: parsed.v || 1,
          sessionId: parsed.id || `DVQR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          bridgeUrl: parsed.br || '',
          createdAt: new Date().toISOString(),
          project: {
            name: parsed.pr.n || 'App',
            framework: parsed.pr.f || 'Node',
            language: parsed.pr.l || 'TypeScript'
          },
          environment: {
            platform: parsed.env?.p || 'Android',
            os: parsed.env?.p || 'Windows',
            node: parsed.env?.n || '22'
          },
          error: {
            message: parsed.err.m || 'Error',
            stackTrace: parsed.err.s || ''
          },
          dependencies: parsed.deps || {},
          relevantFiles: (parsed.rf || []).map((f: any) => ({
            filePath: f.p,
            content: f.c
          })),
          sanitized: true
        };
        return { bundle: normalized, isArchitecture: false };
      }

      return { bundle: parsed, isArchitecture: parsed.mode === 'architecture' };
    } catch (err: any) {
      return { error: `Failed to decode QR code: ${err.message || 'Corrupted payload'}` };
    }
  }
}
