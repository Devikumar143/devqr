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

export interface PerformanceInsight {
  timeComplexityBefore: string;
  timeComplexityAfter: string;
  spaceComplexity: string;
  bottleneck: string;
  optimizationNote: string;
}

export interface PostMortemReport {
  summary: string;
  markdown: string;
  actionItems: string[];
}

export interface MultiFileFix {
  filePath: string;
  fileRole: string;
  patch: string;
  summary: string;
}

export interface DebugAnalysis {
  rootCause: string;
  explanation: string;
  confidence: number;
  suggestedFix: string[];
  verification: string;
  codePatch?: string;
  patchFile?: string;
  multiFilePatches?: MultiFileFix[];
  category?: string;
  aiProviderUsed?: string;
  aiError?: string;
  performance?: PerformanceInsight;
  postMortem?: PostMortemReport;
}

export interface StoredSession {
  id: string;
  title: string;
  timestamp: number;
  bundle: DebugBundle;
  analysis?: DebugAnalysis;
  chatHistory?: { role: 'user' | 'assistant'; content: string; timestamp: number }[];
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

export interface FileResponsibility {
  file: string;
  role: string;
  layer: 'Presentation' | 'Business Logic' | 'Data / Storage' | 'Utility' | 'Configuration' | 'Core';
  summary: string;
}

export interface DataFlowStep {
  step: number;
  source: string;
  destination: string;
  description: string;
}

export interface DeadCodeItem {
  target: string;
  type: 'Unused File' | 'Unreferenced Function' | 'Dead Import';
  reason: string;
}

export interface DuplicateCodeItem {
  pattern: string;
  filesInvolved: string[];
  refactorRecommendation: string;
}

export interface SecurityHotspot {
  severity: 'High' | 'Medium' | 'Low';
  location: string;
  issue: string;
  recommendation: string;
}

export interface TechDebtAudit {
  score: number; // 0 - 100
  maintainabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  estimatedDebtHours: number;
  topRefactoringPriority: string;
}

export interface ArchitectureReport {
  pattern: string;
  summary: string;
  fileResponsibilities: FileResponsibility[];
  dataFlow: DataFlowStep[];
  deadCode: DeadCodeItem[];
  duplicateCode: DuplicateCodeItem[];
  securityIssues: SecurityHotspot[];
  techDebt: TechDebtAudit;
  aiProviderUsed?: string;
  aiError?: string;
}

export interface FixPatch {
  v: number;
  id: string;
  file: string;
  patch: string;
  verification?: string;
  createdAt: string;
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

