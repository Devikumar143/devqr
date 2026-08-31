export interface ProjectInfo {
  name: string;
  language: string;
  framework: string;
  repoUrl?: string;
  branch?: string;
}

export interface EnvironmentInfo {
  platform: string;
  os: string;
  node?: string;
  expo?: string;
  runtime?: string;
  packageManager?: string;
  extraEnv?: Record<string, string>;
}

export interface ErrorInfo {
  message: string;
  stackTrace?: string;
  errorCode?: string;
  componentStack?: string;
}

export interface RelevantFile {
  filePath: string;
  content: string;
  language?: string;
  highlightLines?: number[];
}

export interface RecentChange {
  file: string;
  summary: string;
  diffSnippet?: string;
}

export interface DebugBundle {
  version: number;
  sessionId: string;
  createdAt: string;
  project: ProjectInfo;
  environment: EnvironmentInfo;
  error: ErrorInfo;
  dependencies?: Record<string, string>;
  recentChanges?: RecentChange[];
  relevantFiles?: RelevantFile[];
  sanitized?: boolean;
  notes?: string;
  bridgeUrl?: string;
}

export interface FixPatch {
  v?: number;
  id?: string;
  file: string;
  patch: string;
  fullContent?: string;
  verification?: string;
  createdAt?: string;
}

export interface MultiFilePatch {
  sessionId?: string;
  patches: FixPatch[];
  verification?: string;
}

export interface BatchPatchResult {
  success: boolean;
  appliedCount: number;
  totalCount: number;
  results: { file: string; success: boolean; error?: string }[];
  rolledBack?: boolean;
}

export interface FileStructureNode {
  path: string;
  name: string;
  lines: number;
  sizeBytes: number;
  imports: string[];
  exports?: string[];
  isEntry?: boolean;
}

export interface ArchitectureBundle {
  version: number;
  sessionId: string;
  createdAt: string;
  mode: 'architecture';
  project: ProjectInfo;
  environment: EnvironmentInfo;
  dependencies: Record<string, string>;
  files: FileStructureNode[];
  entryPoints: string[];
  totalFiles: number;
  totalLines: number;
  bridgeUrl?: string;
}

export interface GeneratorBundle {
  version: number;
  sessionId: string;
  createdAt: string;
  mode: 'generator';
  project: ProjectInfo;
  environment: EnvironmentInfo;
  targetFolder: string;
  suggestedLanguage?: string;
  bridgeUrl?: string;
}

export interface TerminalBundle {
  version: number;
  sessionId: string;
  createdAt: string;
  mode: 'terminal';
  project: ProjectInfo;
  environment: EnvironmentInfo;
  targetFolder: string;
  initialCommand?: string;
  bridgeUrl?: string;
}

