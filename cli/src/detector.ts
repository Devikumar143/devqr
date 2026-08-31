import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { ProjectInfo, EnvironmentInfo } from './types.js';

export class ProjectDetector {
  public static detect(cwd = process.cwd()): { project: ProjectInfo; environment: EnvironmentInfo; dependencies: Record<string, string> } {
    let name = path.basename(cwd);
    let language = 'Python';
    let framework = 'Python';
    let expoVersion: string | undefined;
    let pythonVersion: string | undefined;
    const dependencies: Record<string, string> = {};

    const pkgPath = path.join(cwd, 'package.json');
    const reqPath = path.join(cwd, 'requirements.txt');
    const pyprojectPath = path.join(cwd, 'pyproject.toml');

    let hasPyFiles = false;
    let hasJsFiles = false;

    try {
      const files = fs.readdirSync(cwd);
      hasPyFiles = files.some(f => f.toLowerCase().endsWith('.py'));
      hasJsFiles = files.some(f => f.toLowerCase().endsWith('.js') || f.toLowerCase().endsWith('.ts') || f.toLowerCase().endsWith('.jsx') || f.toLowerCase().endsWith('.tsx'));
    } catch {}

    // 1. Check Python Project
    if (hasPyFiles || fs.existsSync(reqPath) || fs.existsSync(pyprojectPath) || name.toLowerCase().includes('py') || name.toLowerCase().includes('python')) {
      language = 'Python';
      framework = 'Python';

      if (fs.existsSync(reqPath)) {
        try {
          const reqText = fs.readFileSync(reqPath, 'utf8');
          const pyDeps = ['fastapi', 'django', 'flask', 'torch', 'tensorflow', 'pandas', 'numpy', 'pytest', 'sqlalchemy', 'celery'];
          for (const dep of pyDeps) {
            const match = reqText.match(new RegExp(`^${dep}([>=<~].*)?$`, 'im'));
            if (match) {
              dependencies[dep] = match[1] || 'latest';
              if (dep === 'fastapi') framework = 'FastAPI';
              else if (dep === 'django') framework = 'Django';
              else if (dep === 'flask') framework = 'Flask';
            }
          }
        } catch {}
      }

      // Check python runtime version
      try {
        const pyVer = execSync('python --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        pythonVersion = pyVer.replace('Python', '').trim();
      } catch {
        try {
          const pyVer = execSync('python3 --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
          pythonVersion = pyVer.replace('Python', '').trim();
        } catch {}
      }
    }
    // 2. Check Node / JS / TS Project
    else if (fs.existsSync(pkgPath) || hasJsFiles) {
      language = 'JavaScript';
      framework = 'Node.js';

      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name) name = pkg.name;

          const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          
          const keyDeps = ['react', 'react-native', 'expo', 'next', 'vite', 'typescript', 'express', '@angular/core', 'vue', 'tailwindcss'];
          for (const dep of keyDeps) {
            if (allDeps[dep]) dependencies[dep] = allDeps[dep];
          }

          if (allDeps['typescript'] || fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
            language = 'TypeScript';
          }

          if (allDeps['expo']) {
            framework = 'React Native (Expo)';
            expoVersion = allDeps['expo'];
          } else if (allDeps['react-native']) {
            framework = 'React Native';
          } else if (allDeps['next']) {
            framework = 'Next.js';
          } else if (allDeps['vite']) {
            framework = 'Vite / React';
          } else if (allDeps['express']) {
            framework = 'Express';
          } else if (allDeps['vue']) {
            framework = 'Vue.js';
          }
        } catch {}
      }
    }
    // 3. Check Gradle / Android
    else if (fs.existsSync(path.join(cwd, 'build.gradle')) || fs.existsSync(path.join(cwd, 'app/build.gradle'))) {
      framework = 'Android / Gradle';
      language = 'Kotlin / Java';
    }
    // 4. Check Rust
    else if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
      framework = 'Rust / Cargo';
      language = 'Rust';
    }
    // 5. Check Go
    else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
      framework = 'Go';
      language = 'Go';
    }

    const platform = os.platform() === 'win32' ? 'Windows' : os.platform() === 'darwin' ? 'macOS' : 'Linux';
    const nodeVersion = process.version.replace('v', '');

    return {
      project: {
        name,
        language,
        framework
      },
      environment: {
        platform: framework.includes('React Native') ? 'Android' : platform,
        os: platform,
        node: nodeVersion,
        expo: expoVersion,
        runtime: language === 'Python' ? `Python ${pythonVersion || '3.11'}` : `Node.js ${nodeVersion}`
      },
      dependencies
    };
  }

  public static scanRepositoryStructure(root = process.cwd()): { files: import('./types.js').FileStructureNode[]; entryPoints: string[]; totalFiles: number; totalLines: number } {
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.expo', '__pycache__', '.venv', 'venv', '.next', 'out', 'coverage']);
    const allowedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.json', '.html', '.css', '.java', '.kt']);
    const resultFiles: import('./types.js').FileStructureNode[] = [];
    const entryPoints: string[] = [];
    let totalLines = 0;

    function walk(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(root, fullPath).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
              walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (allowedExts.has(ext)) {
              try {
                const stat = fs.statSync(fullPath);
                if (stat.size > 200000) continue; // Skip huge generated files
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');
                totalLines += lines.length;

                // Extract imports
                const imports: string[] = [];
                const exports: string[] = [];

                // JS/TS imports & exports
                const jsImportMatches = content.matchAll(/(?:import\s+(?:.*?\s+from\s+)?['"](.*?)['"]|require\(['"](.*?)['"]\))/g);
                for (const m of jsImportMatches) {
                  const target = m[1] || m[2];
                  if (target && !imports.includes(target)) imports.push(target);
                }

                const jsExportMatches = content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var|type|interface)\s+([a-zA-Z0-9_$]+)/g);
                for (const m of jsExportMatches) {
                  if (m[1] && !exports.includes(m[1])) exports.push(m[1]);
                }

                // Python imports & functions
                const pyImportMatches = content.matchAll(/(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/g);
                for (const m of pyImportMatches) {
                  const target = m[1] || m[2];
                  if (target && !imports.includes(target)) imports.push(target);
                }

                const pyDefMatches = content.matchAll(/(?:def|class)\s+([a-zA-Z0-9_]+)\s*\(/g);
                for (const m of pyDefMatches) {
                  if (m[1] && !exports.includes(m[1])) exports.push(m[1]);
                }

                const isEntry = /^(index\.[a-z]+|main\.[a-z]+|app\.[a-z]+|server\.[a-z]+)$/i.test(entry.name);
                if (isEntry) entryPoints.push(relPath);

                resultFiles.push({
                  path: relPath,
                  name: entry.name,
                  lines: lines.length,
                  sizeBytes: stat.size,
                  imports: imports.slice(0, 10),
                  exports: exports.slice(0, 10),
                  isEntry
                });
              } catch {}
            }
          }
        }
      } catch {}
    }

    walk(root);

    return {
      files: resultFiles.slice(0, 50),
      entryPoints,
      totalFiles: resultFiles.length,
      totalLines
    };
  }
}
