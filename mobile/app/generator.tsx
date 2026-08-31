import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GeneratorBundle } from '../src/types';
import { QRDecoder } from '../src/services/qrDecoder';
import { CloudAIEngine } from '../src/services/aiEngine';
import {
  SparklesIcon,
  TerminalIcon,
  CheckCircleIcon,
  CopyIcon,
  FlashIcon,
  ChevronRightIcon,
  CloseIcon,
  BugIcon,
  ShieldCheckIcon
} from '../src/components/SvgIcons';
import { BottomAlert } from '../src/components/BottomAlert';
import { InteractiveTerminalModal } from '../src/components/InteractiveTerminalModal';

export default function AppGeneratorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rawPayload = params.payload as string;

  const [bundle, setBundle] = useState<GeneratorBundle | null>(null);
  const [folderPath, setFolderPath] = useState<string>('Custom Workspace');
  const [bridgeUrl, setBridgeUrl] = useState<string>('http://127.0.0.1:9222');
  const [targetLang, setTargetLang] = useState<string>('Python');
  
  // Prompt & Code States
  const [prompt, setPrompt] = useState<string>('');
  const [fileName, setFileName] = useState<string>('main.py');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationPhase, setGenerationPhase] = useState<string>('Ready to synthesize');
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showLiveTerminal, setShowLiveTerminal] = useState<boolean>(false);
  const [runOutput, setRunOutput] = useState<{ isPass?: boolean; stdout?: string; stderr?: string; durationMs?: number } | null>(null);

  const detectLangFromPromptOrFile = (promptText: string, file: string): { name: string; ext: string; badge: string } => {
    const ext = file.split('.').pop()?.toLowerCase() || '';
    if (ext === 'c') return { name: 'C', ext: '.c', badge: '🅲 C' };
    if (ext === 'cpp' || ext === 'cc') return { name: 'C++', ext: '.cpp', badge: '⚡ C++' };
    if (ext === 'py') return { name: 'Python', ext: '.py', badge: '🐍 Python' };
    if (ext === 'js') return { name: 'JavaScript', ext: '.js', badge: '🟡 JavaScript' };
    if (ext === 'ts' || ext === 'tsx') return { name: 'TypeScript', ext: '.ts', badge: '🔵 TypeScript' };
    if (ext === 'rs') return { name: 'Rust', ext: '.rs', badge: '🦀 Rust' };
    if (ext === 'go') return { name: 'Go', ext: '.go', badge: '🐹 Go' };
    if (ext === 'java') return { name: 'Java', ext: '.java', badge: '☕ Java' };
    if (ext === 'cs') return { name: 'C#', ext: '.cs', badge: '🔷 C#' };
    if (ext === 'rb') return { name: 'Ruby', ext: '.rb', badge: '💎 Ruby' };
    if (ext === 'php') return { name: 'PHP', ext: '.php', badge: '🐘 PHP' };
    if (ext === 'sh') return { name: 'Bash', ext: '.sh', badge: '🐚 Bash' };
    if (ext === 'html') return { name: 'HTML', ext: '.html', badge: '🌐 HTML' };

    const p = promptText.toLowerCase();
    if (/\b(c\+\+|cpp)\b/.test(p)) return { name: 'C++', ext: '.cpp', badge: '⚡ C++' };
    if (/\b(c language|in c|write c|c code|c program)\b/.test(p)) return { name: 'C', ext: '.c', badge: '🅲 C' };
    if (/\b(python|py|django|flask|fastapi)\b/.test(p)) return { name: 'Python', ext: '.py', badge: '🐍 Python' };
    if (/\b(typescript|ts|nextjs)\b/.test(p)) return { name: 'TypeScript', ext: '.ts', badge: '🔵 TypeScript' };
    if (/\b(javascript|js|node|express)\b/.test(p)) return { name: 'JavaScript', ext: '.js', badge: '🟡 JavaScript' };
    if (/\b(rust|cargo)\b/.test(p)) return { name: 'Rust', ext: '.rs', badge: '🦀 Rust' };
    if (/\b(golang|go language|in go)\b/.test(p)) return { name: 'Go', ext: '.go', badge: '🐹 Go' };
    if (/\b(java|spring)\b/.test(p)) return { name: 'Java', ext: '.java', badge: '☕ Java' };
    if (/\b(c#|csharp|\.net)\b/.test(p)) return { name: 'C#', ext: '.cs', badge: '🔷 C#' };
    if (/\b(ruby|rails)\b/.test(p)) return { name: 'Ruby', ext: '.rb', badge: '💎 Ruby' };
    if (/\b(php|laravel)\b/.test(p)) return { name: 'PHP', ext: '.php', badge: '🐘 PHP' };
    if (/\b(bash|shell|script)\b/.test(p)) return { name: 'Bash', ext: '.sh', badge: '🐚 Bash' };
    if (/\b(html|css|web page)\b/.test(p)) return { name: 'HTML', ext: '.html', badge: '🌐 HTML' };
    return { name: 'Custom Code', ext: '', badge: '✨ AI Polyglot' };
  };

  const getRunCmd = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'py';
    if (ext === 'c') return `gcc ${fileName} -o app.exe && .\\app.exe`;
    if (ext === 'cpp' || ext === 'cc') return `g++ ${fileName} -o app.exe && .\\app.exe`;
    if (ext === 'py') return `python -u ${fileName}`;
    if (ext === 'js') return `node ${fileName}`;
    if (ext === 'ts') return `npx ts-node ${fileName}`;
    if (ext === 'go') return `go run ${fileName}`;
    if (ext === 'rs') return `rustc ${fileName} -o app.exe && .\\app.exe`;
    if (ext === 'java') return `java ${fileName}`;
    if (ext === 'cs') return `dotnet run`;
    if (ext === 'rb') return `ruby ${fileName}`;
    if (ext === 'php') return `php ${fileName}`;
    if (ext === 'sh') return `bash ${fileName}`;
    if (ext === 'html') return `start ${fileName}`;
    return `python -u ${fileName}`;
  };

  const handleOpenLiveTerminal = async () => {
    if (generatedCode.trim()) {
      try {
        const targetUrl = bridgeUrl.replace(/\/+$/, '');
        await fetch(`${targetUrl}/api/create-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: fileName.trim(),
            content: generatedCode,
            openInIDE: true
          })
        });
      } catch {}
    }
    setShowLiveTerminal(true);
  };

  // Alert State
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type?: 'error' | 'success' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: ''
  });

  const appTemplates = [
    {
      label: '🐍 Python Guessing Game',
      fileName: 'guess_game.py',
      prompt: 'Create an interactive Python number guessing game with 3 difficulty levels, secret random number, hint system, high score leaderboard, and ANSI colored terminal output.'
    },
    {
      label: '🅲 C Snake Game',
      fileName: 'main.c',
      prompt: 'Create a standalone C console snake game with score tracking, speed increments, collision detection, and clear game over screen.'
    },
    {
      label: '🟡 Node REST API',
      fileName: 'server.js',
      prompt: 'Create a lightweight Node.js HTTP REST API server with in-memory CRUD operations for items, JSON validation, and error logging.'
    },
    {
      label: '🦀 Rust CLI Tool',
      fileName: 'main.rs',
      prompt: 'Create an interactive Rust command-line tool with argument parsing, colorized output, and file stats calculation.'
    },
    {
      label: '🐹 Go Web Server',
      fileName: 'main.go',
      prompt: 'Create a concurrent Go HTTP server with health check route, JSON API endpoints, and graceful shutdown.'
    },
    {
      label: '📊 CSV Data Analyzer',
      fileName: 'data_analyzer.py',
      prompt: 'Create a Python data analytics CLI that parses CSV files, computes summary statistics (mean, median, variance), detects anomalies, and outputs ASCII distribution charts.'
    },
    {
      label: '🔐 JWT Auth & Security Module',
      fileName: 'src/auth/jwtService.ts',
      prompt: 'Create a TypeScript JWT token management and permission verification class with access/refresh token rotation, payload signing, and bcrypt password hashing helpers.'
    }
  ];

  useEffect(() => {
    if (rawPayload) {
      const decoded = QRDecoder.decode(rawPayload);
      if (decoded.bundle && (decoded.bundle as any).mode === 'generator') {
        const gen = decoded.bundle as GeneratorBundle;
        setBundle(gen);
        if (gen.targetFolder) setFolderPath(gen.targetFolder);
        if (gen.bridgeUrl) setBridgeUrl(gen.bridgeUrl);
        if (gen.suggestedLanguage) setTargetLang(gen.suggestedLanguage);
        if (gen.project?.language) setTargetLang(gen.project.language);
      }
    }
  }, [rawPayload]);

  const handleSelectTemplate = async (tpl: typeof appTemplates[0]) => {
    setFileName(tpl.fileName);
    setPrompt(tpl.prompt);
    try {
      Haptics.selectionAsync();
    } catch {}

    // Auto-synthesize code for the selected template
    try {
      const detected = detectLangFromPromptOrFile(tpl.prompt, tpl.fileName);
      const context = `Target Workspace Folder: ${folderPath}\nTarget Language: ${detected.name}\nSuggested File: ${tpl.fileName}`;
      const res = await CloudAIEngine.generateNewFileCode(tpl.prompt, tpl.fileName, context);
      if (res.content) {
        setGeneratedCode(res.content);
        setExplanation(res.explanation);
        if (res.filePath) setFileName(res.filePath);
      }
    } catch {}
  };

  const handleGenerateApp = async () => {
    if (!prompt.trim()) {
      setAlertState({
        visible: true,
        type: 'info',
        title: 'Requirement Required',
        message: 'Please describe the application or feature you want to build.'
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(15);
    setGenerationPhase('Analyzing requirements & system architecture...');
    setRunOutput(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev < 40) {
          setGenerationPhase('Structuring imports, types & configuration...');
          return prev + 12;
        } else if (prev < 75) {
          setGenerationPhase('Writing core logic & interactive functions...');
          return prev + 10;
        } else if (prev < 92) {
          setGenerationPhase('Validating syntax & code formatting...');
          return prev + 4;
        }
        return prev;
      });
    }, 180);

    try {
      const detected = detectLangFromPromptOrFile(prompt.trim(), fileName.trim());
      const context = `Target Workspace Folder: ${folderPath}\nTarget Language: ${detected.name}\nSuggested File: ${fileName.trim()}`;
      const res = await CloudAIEngine.generateNewFileCode(prompt.trim(), fileName.trim(), context);

      clearInterval(progressInterval);
      setGenerationProgress(100);
      const lines = res.content.split('\n').length;
      setGenerationPhase(`Complete: ${lines} lines written!`);

      if (res.content) {
        setGeneratedCode(res.content);
        setExplanation(res.explanation);
        if (res.filePath) setFileName(res.filePath);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      setGenerationProgress(0);
      setAlertState({
        visible: true,
        type: 'error',
        title: 'AI Generation Failed',
        message: e.message || 'Could not synthesize code. Check your AI key in Settings.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePushToIDE = async () => {
    if (!generatedCode.trim()) {
      setAlertState({
        visible: true,
        type: 'info',
        title: 'No Code to Push',
        message: 'Generate or write code before pushing to your laptop.'
      });
      return;
    }

    setIsPushing(true);
    try {
      const targetUrl = bridgeUrl.replace(/\/+$/, '');
      const res = await fetch(`${targetUrl}/api/create-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: fileName.trim(),
          content: generatedCode,
          openInIDE: true
        })
      });

      const data = await res.json();
      if (data.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setAlertState({
          visible: true,
          type: 'success',
          title: 'Code Pushed to Laptop!',
          message: `Saved ${fileName} (${data.lines} lines) and opened in your active IDE (VS Code / Cursor).`
        });
      } else {
        setAlertState({
          visible: true,
          type: 'error',
          title: 'Push Error',
          message: data.error || 'Failed to save file on laptop.'
        });
      }
    } catch (err: any) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Wi-Fi Bridge Unreachable',
        message: `Could not reach laptop bridge at ${bridgeUrl}. Ensure devqr CLI is running on your laptop.`
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleRunOnLaptop = async () => {
    setIsRunning(true);
    setRunOutput(null);
    try {
      const targetUrl = bridgeUrl.replace(/\/+$/, '');
      const ext = fileName.split('.').pop()?.toLowerCase() || 'py';
      let runCmd = `python ${fileName}`;
      if (ext === 'js') runCmd = `node ${fileName}`;
      else if (ext === 'ts') runCmd = `npx ts-node ${fileName}`;
      else if (ext === 'go') runCmd = `go run ${fileName}`;
      else if (ext === 'rs') runCmd = `rustc ${fileName} -o app_bin && ./app_bin`;
      else if (ext === 'java') runCmd = `java ${fileName}`;
      else if (ext === 'cpp' || ext === 'cc') runCmd = `g++ ${fileName} -o app_bin && ./app_bin`;
      else if (ext === 'cs') runCmd = `dotnet run`;
      else if (ext === 'rb') runCmd = `ruby ${fileName}`;
      else if (ext === 'php') runCmd = `php ${fileName}`;
      else if (ext === 'sh') runCmd = `bash ${fileName}`;
      else if (ext === 'html') runCmd = `start ${fileName}`;

      const res = await fetch(`${targetUrl}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: runCmd })
      });

      const data = await res.json();
      setRunOutput(data);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (err: any) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Remote Run Error',
        message: err.message || 'Failed to trigger remote script execution.'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const [isFixing, setIsFixing] = useState<boolean>(false);
  const [fixResult, setFixResult] = useState<{
    fixedCode: string;
    rootCause: string;
    explanation: string;
    diffSnippet: string;
    verificationCmd: string;
  } | null>(null);

  const handleAutoFixError = async () => {
    const errorOutput = (runOutput?.stderr || runOutput?.stdout || '').trim();
    if (!errorOutput) {
      setAlertState({
        visible: true,
        type: 'info',
        title: 'No Error Detected',
        message: 'The terminal execution ran without fatal crashes.'
      });
      return;
    }

    setIsFixing(true);
    setFixResult(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    try {
      const res = await CloudAIEngine.fixTerminalError(
        fileName.trim(),
        generatedCode,
        errorOutput,
        `Folder: ${folderPath}`
      );

      if (res.fixedCode) {
        setGeneratedCode(res.fixedCode);
        setFixResult(res);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (e: any) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Auto-Fix Error',
        message: e.message || 'Could not synthesize fix. Check API key in settings.'
      });
    } finally {
      setIsFixing(false);
    }
  };

  const handleApplyFixAndReRun = async () => {
    await handlePushToIDE();
    setTimeout(() => {
      handleRunOnLaptop();
    }, 400);
  };

  const lineCount = generatedCode ? generatedCode.split('\n').length : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Navigation Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>&lt; Home</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <SparklesIcon size={15} color="#0284c7" style={{ marginRight: 6 }} />
            <Text style={styles.headerTitle}>AI APP & CODE STUDIO</Text>
          </View>
          <Text style={styles.headerSub} numberOfLines={1}>
            {folderPath}
          </Text>
        </View>

        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LAN READY</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Connected Workspace Card */}
        <View style={styles.workspaceCard}>
          <View style={styles.workspaceRow}>
            <TerminalIcon size={18} color="#0284c7" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.workspaceLabel}>CONNECTED LAPTOP WORKSPACE</Text>
              <Text style={styles.workspacePath} numberOfLines={1}>{folderPath}</Text>
            </View>
          </View>
          <Text style={styles.bridgeInfoText}>
            Bridge: <Text style={styles.cyanText}>{bridgeUrl}</Text> • Instant 1-tap push to VS Code
          </Text>
        </View>

        {/* Quick App Presets */}
        <Text style={styles.sectionLabel}>CHOOSE OR BUILD AN APPLICATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
          {appTemplates.map((tpl, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.presetChip, prompt === tpl.prompt && styles.presetChipActive]}
              onPress={() => handleSelectTemplate(tpl)}
              activeOpacity={0.8}
            >
              <Text style={[styles.presetText, prompt === tpl.prompt && styles.presetTextActive]}>
                {tpl.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Requirements Box */}
        <View style={styles.requirementsCard}>
          <View style={styles.reqHeaderRow}>
            <Text style={styles.sectionLabel}>YOUR REQUIREMENTS / APP SPECIFICATION</Text>
            <View style={styles.langBadge}>
              <Text style={styles.langBadgeText}>{detectLangFromPromptOrFile(prompt, fileName).badge}</Text>
            </View>
          </View>
          <TextInput
            style={styles.reqInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Describe what you want to build (e.g. 'Create a Python number guessing game with high scores and difficulty levels')..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
          />

          <View style={styles.fileConfigRow}>
            <Text style={styles.fileConfigLabel}>File Target:</Text>
            <TextInput
              style={styles.fileNameInput}
              value={fileName}
              onChangeText={setFileName}
              placeholder="e.g. main.py or app.ts"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* AI Generator Button */}
          <TouchableOpacity
            style={[styles.generateBtn, isGenerating && styles.btnDisabled]}
            onPress={handleGenerateApp}
            disabled={isGenerating}
            activeOpacity={0.85}
          >
            {isGenerating ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.generateBtnText}>Synthesizing Complete Code...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <SparklesIcon size={16} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.generateBtnText}>GENERATE FULL CODE WITH AI</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Real-Time Code Generation Progress Bar & Volume Tracker */}
          {(isGenerating || generatedCode.length > 0) && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressPhaseText}>
                  {isGenerating ? generationPhase : `✓ Code Synthesis Complete (${lineCount} lines written)`}
                </Text>
                <Text style={styles.progressPercentText}>
                  {isGenerating ? `${Math.min(100, Math.max(15, generationProgress))}%` : '100%'}
                </Text>
              </View>

              {/* Animated Progress Track */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: isGenerating ? `${Math.min(100, Math.max(15, generationProgress))}%` : '100%' },
                    !isGenerating && styles.progressBarComplete
                  ]}
                />
              </View>

              {/* Code Statistics & Volume */}
              <View style={styles.progressMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>LINES WRITTEN</Text>
                  <Text style={styles.metricValue}>{lineCount} lines</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>CODE SIZE</Text>
                  <Text style={styles.metricValue}>{(generatedCode.length / 1024).toFixed(1)} KB</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>TARGET RUNTIME</Text>
                  <Text style={styles.metricValue}>{detectLangFromPromptOrFile(prompt, fileName).name}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Code Studio Output */}
        {generatedCode.length > 0 && (
          <View style={styles.codeSection}>
            <View style={styles.codeHeaderRow}>
              <View style={styles.codeTab}>
                <TerminalIcon size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                <Text style={styles.codeTabText}>{fileName}</Text>
                <Text style={styles.codeLinesBadge}>{lineCount} lines</Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => {
                  Share.share({ message: generatedCode, title: fileName });
                }}
                activeOpacity={0.7}
              >
                <CopyIcon size={13} color="#94a3b8" style={{ marginRight: 4 }} />
                <Text style={styles.copyBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            {explanation ? (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationText}>💡 {explanation}</Text>
              </View>
            ) : null}

            <View style={styles.codeContainer}>
              <TextInput
                style={styles.codeInput}
                value={generatedCode}
                onChangeText={setGeneratedCode}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
              />
            </View>

            {/* Action Buttons: Push to IDE & Live Streaming REPL */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.pushBtn, isPushing && styles.btnDisabled]}
                onPress={handlePushToIDE}
                disabled={isPushing}
                activeOpacity={0.85}
              >
                {isPushing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={styles.btnRow}>
                    <FlashIcon size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.pushBtnText}>PUSH & OPEN IN IDE</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liveReplBtn}
                onPress={handleOpenLiveTerminal}
                activeOpacity={0.85}
              >
                <View style={styles.btnRow}>
                  <TerminalIcon size={15} color="#38bdf8" style={{ marginRight: 6 }} />
                  <Text style={styles.liveReplBtnText}>LIVE REPL</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.runBtn, isRunning && styles.btnDisabled]}
                onPress={handleRunOnLaptop}
                disabled={isRunning}
                activeOpacity={0.85}
              >
                {isRunning ? (
                  <ActivityIndicator size="small" color="#0369a1" />
                ) : (
                  <View style={styles.btnRow}>
                    <TerminalIcon size={14} color="#0369a1" style={{ marginRight: 6 }} />
                    <Text style={styles.runBtnText}>QUICK RUN</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Remote Execution & In-Window Terminal Debugger */}
            {runOutput && (
              <View style={styles.terminalConsole}>
                <View style={styles.consoleHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TerminalIcon size={14} color={runOutput.isPass ? '#4ade80' : '#f87171'} style={{ marginRight: 6 }} />
                    <Text style={[styles.consoleTitle, !runOutput.isPass && styles.consoleTitleError]}>
                      {runOutput.isPass ? '✓ Execution Completed Successfully' : 'x Execution Finished with Errors'} ({runOutput.durationMs}ms)
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, runOutput.isPass ? styles.statusBadgePass : styles.statusBadgeFail]}>
                    <Text style={[styles.statusBadgeText, runOutput.isPass ? styles.statusTextPass : styles.statusTextFail]}>
                      {runOutput.isPass ? 'PASS' : 'ERROR'}
                    </Text>
                  </View>
                </View>

                {/* Terminal Output Log */}
                <ScrollView style={styles.consoleScroll} nestedScrollEnabled>
                  <Text style={styles.consoleText}>
                    {runOutput.stdout || runOutput.stderr || 'Command executed with no output.'}
                  </Text>
                </ScrollView>

                {/* In-Window AI Debugger Section for Terminal Errors */}
                {(!runOutput.isPass || Boolean(runOutput.stderr) || /(?:error|exception|traceback|syntaxerror|typeerror|valueerror)/i.test(runOutput.stdout || '')) && (
                  <View style={styles.debugSessionCard}>
                    <View style={styles.debugAlertHeader}>
                      <BugIcon size={16} color="#ef4444" style={{ marginRight: 6 }} />
                      <Text style={styles.debugAlertTitle}>Terminal Error Detected</Text>
                    </View>
                    <Text style={styles.debugAlertSub}>
                      DevQR AI can inspect this crash trace, pinpoint the faulty line in {fileName}, and repair the code automatically.
                    </Text>

                    {/* Auto-Fix Trigger Button */}
                    <TouchableOpacity
                      style={[styles.autoFixBtn, isFixing && styles.btnDisabled]}
                      onPress={handleAutoFixError}
                      disabled={isFixing}
                      activeOpacity={0.85}
                    >
                      {isFixing ? (
                        <View style={styles.btnRow}>
                          <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                          <Text style={styles.autoFixBtnText}>Analyzing Error & Synthesizing Fix...</Text>
                        </View>
                      ) : (
                        <View style={styles.btnRow}>
                          <SparklesIcon size={16} color="#ffffff" style={{ marginRight: 8 }} />
                          <Text style={styles.autoFixBtnText}>1-CLICK AI AUTO-FIX TERMINAL ERROR</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* AI Fix Diagnosis & Verification Result */}
                {fixResult && (
                  <View style={styles.fixResultCard}>
                    <View style={styles.fixResultHeader}>
                      <CheckCircleIcon size={16} color="#16a34a" style={{ marginRight: 6 }} />
                      <Text style={styles.fixResultTitle}>AI Fix Synthesized</Text>
                    </View>

                    <View style={styles.rootCauseBox}>
                      <Text style={styles.rootCauseLabel}>🔍 ROOT CAUSE:</Text>
                      <Text style={styles.rootCauseText}>{fixResult.rootCause}</Text>
                    </View>

                    <Text style={styles.fixExplanation}>{fixResult.explanation}</Text>

                    {fixResult.diffSnippet ? (
                      <View style={styles.diffBox}>
                        <Text style={styles.diffTitle}>CODE DIFF:</Text>
                        <Text style={styles.diffCode}>{fixResult.diffSnippet}</Text>
                      </View>
                    ) : null}

                    {/* Apply & Re-Run Action */}
                    <TouchableOpacity
                      style={styles.applyAndReRunBtn}
                      onPress={handleApplyFixAndReRun}
                      activeOpacity={0.85}
                    >
                      <View style={styles.btnRow}>
                        <FlashIcon size={16} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.applyAndReRunBtnText}>PUSH FIX & RE-RUN ON LAPTOP</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Interactive Streaming Terminal REPL Modal */}
      <InteractiveTerminalModal
        visible={showLiveTerminal}
        bridgeUrl={bridgeUrl}
        initialCommand={getRunCmd()}
        fileName={fileName}
        onClose={() => setShowLiveTerminal(false)}
        onAutoFixError={(errorOutput) => {
          setShowLiveTerminal(false);
          setRunOutput({ stdout: errorOutput, stderr: errorOutput, isPass: false, durationMs: 0 });
          handleAutoFixError();
        }}
      />

      {/* Alert Modal */}
      <BottomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  backBtnText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginRight: 5,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  workspaceCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  workspaceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  workspacePath: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  bridgeInfoText: {
    fontSize: 11,
    color: '#64748b',
  },
  cyanText: {
    color: '#0284c7',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  langScroll: {
    marginBottom: 14,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginRight: 8,
  },
  langChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  langChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  langChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  langChipTextActive: {
    color: '#0369a1',
    fontWeight: '900',
  },
  presetsScroll: {
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  presetChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  presetTextActive: {
    color: '#0369a1',
    fontWeight: '800',
  },
  requirementsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 18,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  langBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  langBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  reqInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
    lineHeight: 18,
  },
  fileConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  fileConfigLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginRight: 8,
  },
  fileNameInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0f172a',
  },
  generateBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  generateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  progressContainer: {
    marginTop: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressPhaseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
    flex: 1,
    marginRight: 6,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0284c7',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 3,
  },
  progressBarComplete: {
    backgroundColor: '#10b981',
  },
  progressMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  codeSection: {
    marginTop: 4,
    marginBottom: 30,
  },
  codeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  codeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090d16',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeTabText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  codeLinesBadge: {
    color: '#38bdf8',
    fontSize: 10,
    marginLeft: 6,
    fontWeight: '600',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  copyBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  explanationBox: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 3,
    borderLeftColor: '#0284c7',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 17,
  },
  codeContainer: {
    backgroundColor: '#090d16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    minHeight: 220,
    maxHeight: 380,
    marginBottom: 14,
  },
  codeInput: {
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  pushBtn: {
    flex: 1.2,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  pushBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveReplBtn: {
    flex: 1.1,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2,
  },
  liveReplBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  runBtn: {
    flex: 0.9,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runBtnText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '800',
  },
  terminalConsole: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 4,
  },
  consoleHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 6,
    marginBottom: 8,
  },
  consoleTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4ade80',
  },
  consoleTitleError: {
    color: '#f87171',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgePass: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusBadgeFail: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  statusTextPass: {
    color: '#4ade80',
  },
  statusTextFail: {
    color: '#f87171',
  },
  consoleScroll: {
    maxHeight: 160,
  },
  consoleText: {
    color: '#f8fafc',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },

  /* In-Window Debug Session Styles */
  debugSessionCard: {
    marginTop: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  debugAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  debugAlertTitle: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  debugAlertSub: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  autoFixBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  autoFixBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* Fix Result & Diagnosis Card */
  fixResultCard: {
    marginTop: 12,
    backgroundColor: '#090d16',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 12,
  },
  fixResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fixResultTitle: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rootCauseBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  rootCauseLabel: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  rootCauseText: {
    color: '#f8fafc',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  fixExplanation: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  diffBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  diffTitle: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
  },
  diffCode: {
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 15,
  },
  applyAndReRunBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  applyAndReRunBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
