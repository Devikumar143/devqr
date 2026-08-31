import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  FlatList,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { TerminalBundle } from '../src/types';
import { QRDecoder } from '../src/services/qrDecoder';
import {
  TerminalIcon,
  SparklesIcon,
  BugIcon,
  CloseIcon
} from '../src/components/SvgIcons';
import { BottomAlert } from '../src/components/BottomAlert';

interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'status' | 'stdin' | 'exit' | 'error';
  text: string;
  time: string;
}

interface WorkspaceFile {
  name: string;
  path: string;
  ext: string;
  size: number;
  runCmd: string;
}

interface WorkspaceDirectory {
  name: string;
  path: string;
  fullPath: string;
  isParent?: boolean;
}

interface TerminalTab {
  id: string;
  name: string;
  command: string;
  logs: LogEntry[];
  isRunning: boolean;
  hasError: boolean;
  exitInfo: { code: number; signal?: string; durationMs: number } | null;
  inputText: string;
}

const cleanAnsi = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[\[?[0-9;]*m/g, '')
    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '');
};

export default function TerminalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rawPayload = params.payload as string;

  const [bridgeUrl, setBridgeUrl] = useState<string>('http://127.0.0.1:9222');
  const [folderPath, setFolderPath] = useState<string>('Custom Workspace');
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Multi-Tab Terminal State
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: 'tab-1',
      name: 'Tab 1',
      command: 'python -u main.py',
      logs: [],
      isRunning: false,
      hasError: false,
      exitInfo: null,
      inputText: ''
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  // File & Directory Explorer States
  const [showFilePicker, setShowFilePicker] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'files' | 'dirs'>('dirs');
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [workspaceDirs, setWorkspaceDirs] = useState<WorkspaceDirectory[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [fileSearch, setFileSearch] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');

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

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const stdinInputRef = useRef<TextInput | null>(null);
  const activeTabIdRef = useRef<string>(activeTabId);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const PRESET_COMMANDS = [
    { label: '🐍 Python App', cmd: 'python -u main.py' },
    { label: '🧪 PyTest', cmd: 'pytest -v' },
    { label: '🟢 NPM Test', cmd: 'npm test' },
    { label: '📦 Node Run', cmd: 'node index.js' },
    { label: '🦀 Cargo Run', cmd: 'cargo run' },
    { label: '🐹 Go Run', cmd: 'go run .' },
    { label: '📊 Git Status', cmd: 'git status -s' }
  ];

  useEffect(() => {
    let initialCmd = 'python -u main.py';
    let bUrl = 'http://127.0.0.1:9222';
    let folder = 'Custom Workspace';

    if (rawPayload) {
      const decoded = QRDecoder.decode(rawPayload);
      if (decoded.bundle) {
        const b = decoded.bundle as TerminalBundle;
        if (b.bridgeUrl) bUrl = b.bridgeUrl;
        if (b.targetFolder) folder = b.targetFolder;
        if (b.initialCommand) initialCmd = b.initialCommand;
      }
    }

    setBridgeUrl(bUrl);
    setFolderPath(folder);

    setTabs([
      {
        id: 'tab-1',
        name: 'Tab 1',
        command: initialCmd,
        logs: [],
        isRunning: false,
        hasError: false,
        exitInfo: null,
        inputText: ''
      }
    ]);

    connectAndRun(initialCmd, 'tab-1', bUrl);

    return () => {
      cleanupWs();
    };
  }, [rawPayload]);

  const cleanupWs = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const getWsUrl = (httpUrl: string): string => {
    const clean = httpUrl.replace(/\/+$/, '');
    if (clean.startsWith('https://')) {
      return clean.replace('https://', 'wss://');
    }
    return clean.replace('http://', 'ws://');
  };

  const connectAndRun = (cmdToRun: string, targetTabId?: string, overrideBridgeUrl?: string, initialInput?: string) => {
    const tabId = targetTabId || activeTabIdRef.current;
    const targetUrl = overrideBridgeUrl || bridgeUrl;
    const wsUrl = getWsUrl(targetUrl);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Update tab state to running
    setTabs(prev => prev.map(tab => {
      if (tab.id === tabId) {
        // Auto derive a smart tab name from command
        let smartName = tab.name;
        if (smartName.startsWith('Tab ') || smartName === 'New Tab') {
          const match = cmdToRun.match(/(?:python|node|gcc|g\+\+|cargo|go|sh|bash)?\s*["']?([^"'\s]+)["']?/i);
          if (match && match[1]) {
            smartName = match[1].split(/[/\\]/).pop() || tab.name;
          }
        }

        return {
          ...tab,
          name: smartName,
          command: cmdToRun,
          isRunning: true,
          exitInfo: null,
          hasError: false,
          logs: [
            {
              id: Math.random().toString(),
              type: 'status',
              text: `Spawning [${smartName}]: $ ${cmdToRun}${initialInput ? ` (Input: ${initialInput})` : ''}`,
              time: now
            }
          ]
        };
      }
      return tab;
    }));

    // If WebSocket is already open, just send spawn request with sessionId
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'spawn',
          sessionId: tabId,
          command: cmdToRun,
          initialInput
        })
      );
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}

        ws.send(
          JSON.stringify({
            type: 'spawn',
            sessionId: tabId,
            command: cmdToRun,
            initialInput
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const currentFocusedId = activeTabIdRef.current;
          const msgSessionId = msg.sessionId || currentFocusedId;

          if (msg.cwd) {
            setFolderPath(msg.cwd);
          }

          if (msg.type === 'stdout') {
            const cleanedText = cleanAnsi(msg.data);
            const isErrorTrace = /(?:Traceback \(most recent call last\)|Error:|Exception:|SyntaxError:|TypeError:|ValueError:)/i.test(cleanedText);

            setTabs(prev => prev.map(tab => {
              if (tab.id === msgSessionId || (msgSessionId === 'default' && tab.id === currentFocusedId)) {
                return {
                  ...tab,
                  hasError: isErrorTrace ? true : tab.hasError,
                  logs: [
                    ...tab.logs,
                    {
                      id: Math.random().toString(),
                      type: 'stdout',
                      text: cleanedText,
                      time
                    }
                  ]
                };
              }
              return tab;
            }));
          } else if (msg.type === 'stderr') {
            const cleanedText = cleanAnsi(msg.data);
            setTabs(prev => prev.map(tab => {
              if (tab.id === msgSessionId || (msgSessionId === 'default' && tab.id === currentFocusedId)) {
                return {
                  ...tab,
                  hasError: true,
                  logs: [
                    ...tab.logs,
                    {
                      id: Math.random().toString(),
                      type: 'stderr',
                      text: cleanedText,
                      time
                    }
                  ]
                };
              }
              return tab;
            }));
          } else if (msg.type === 'status') {
            setTabs(prev => prev.map(tab => {
              if (tab.id === msgSessionId || (msgSessionId === 'default' && tab.id === currentFocusedId)) {
                return {
                  ...tab,
                  logs: [
                    ...tab.logs,
                    {
                      id: Math.random().toString(),
                      type: 'status',
                      text: msg.message,
                      time
                    }
                  ]
                };
              }
              return tab;
            }));
          } else if (msg.type === 'exit') {
            setTabs(prev => prev.map(tab => {
              if (tab.id === msgSessionId || (msgSessionId === 'default' && tab.id === currentFocusedId)) {
                return {
                  ...tab,
                  isRunning: false,
                  exitInfo: {
                    code: msg.code,
                    signal: msg.signal,
                    durationMs: msg.durationMs
                  },
                  hasError: msg.code !== 0 ? true : tab.hasError,
                  logs: [
                    ...tab.logs,
                    {
                      id: Math.random().toString(),
                      type: 'exit',
                      text: `Process finished with exit code ${msg.code} in ${msg.durationMs}ms`,
                      time
                    }
                  ]
                };
              }
              return tab;
            }));

            try {
              if (msg.code === 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
            } catch {}
          } else if (msg.type === 'error') {
            setTabs(prev => prev.map(tab => {
              if (tab.id === msgSessionId || (msgSessionId === 'default' && tab.id === currentFocusedId)) {
                return {
                  ...tab,
                  hasError: true,
                  isRunning: false,
                  logs: [
                    ...tab.logs,
                    {
                      id: Math.random().toString(),
                      type: 'error',
                      text: `Terminal Error: ${msg.message}`,
                      time
                    }
                  ]
                };
              }
              return tab;
            }));
          }
        } catch (err) {
          console.warn('WS parse error:', err);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setTabs(prev => prev.map(tab => ({
          ...tab,
          isRunning: false,
          logs: [
            ...tab.logs,
            {
              id: Math.random().toString(),
              type: 'error',
              text: `Could not connect to WebSocket bridge at ${wsUrl}. Verify devqr is running on laptop.`,
              time: new Date().toLocaleTimeString()
            }
          ]
        })));
      };

      ws.onclose = () => {
        setIsConnected(false);
        setTabs(prev => prev.map(tab => ({ ...tab, isRunning: false })));
      };
    } catch (e: any) {
      setIsConnected(false);
      setTabs(prev => prev.map(tab => ({
        ...tab,
        isRunning: false,
        logs: [
          ...tab.logs,
          {
            id: Math.random().toString(),
            type: 'error',
            text: `WebSocket initialization error: ${e.message}`,
            time: new Date().toLocaleTimeString()
          }
        ]
      })));
    }
  };

  const handleSendInput = (textToSend?: string) => {
    const focusedId = activeTabIdRef.current;
    const currentTab = tabs.find(t => t.id === focusedId) || activeTab;
    const text = textToSend !== undefined ? textToSend : currentTab.inputText;
    const trimmed = text.trim();

    // 1. If active tab process is running, send directly to its stdin
    if (currentTab.isRunning && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'stdin',
          sessionId: currentTab.id,
          data: text + '\n'
        })
      );

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTabs(prev => prev.map(t => {
        if (t.id === currentTab.id) {
          return {
            ...t,
            inputText: textToSend === undefined ? '' : t.inputText,
            logs: [
              ...t.logs,
              {
                id: Math.random().toString(),
                type: 'stdin',
                text: `> ${text}`,
                time
              }
            ]
          };
        }
        return t;
      }));

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      return;
    }

    // 2. If process is idle or stopped:
    if (textToSend !== undefined) {
      setTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, inputText: t.inputText + textToSend } : t));
      return;
    }

    // If user explicitly submitted via SEND button or Enter key:
    if (trimmed) {
      connectAndRun(trimmed, currentTab.id);
      setTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, command: trimmed, inputText: '' } : t));
    } else if (currentTab.command.trim()) {
      // Enter re-runs the current tab command
      connectAndRun(currentTab.command.trim(), currentTab.id);
    }
  };

  const handleSendCtrlC = () => {
    const focusedId = activeTabIdRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'kill',
          sessionId: focusedId,
          signal: 'SIGINT'
        })
      );
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  };

  const handleClearLogs = () => {
    const focusedId = activeTabIdRef.current;
    setTabs(prev => prev.map(t => {
      if (t.id === focusedId) {
        return {
          ...t,
          logs: [],
          hasError: false,
          exitInfo: null
        };
      }
      return t;
    }));
  };

  // Tab Operations
  const handleAddNewTab = () => {
    const nextNum = tabs.length + 1;
    const newId = `tab-${Date.now()}`;
    const newTab: TerminalTab = {
      id: newId,
      name: `Tab ${nextNum}`,
      command: 'python -u main.py',
      logs: [],
      isRunning: false,
      hasError: false,
      exitInfo: null,
      inputText: ''
    };

    activeTabIdRef.current = newId;
    setActiveTabId(newId);
    setTabs(prev => [...prev, newTab]);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const handleCloseTab = (tabIdToClose: string) => {
    if (tabs.length === 1) {
      Alert.alert("Terminal Tab", "You must keep at least one active terminal tab.");
      return;
    }

    // Kill running process on this tab if active
    const target = tabs.find(t => t.id === tabIdToClose);
    if (target && target.isRunning && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'kill',
          sessionId: tabIdToClose,
          signal: 'SIGKILL'
        })
      );
    }

    const remaining = tabs.filter(t => t.id !== tabIdToClose);
    setTabs(remaining);

    if (activeTabIdRef.current === tabIdToClose) {
      const nextActive = remaining[0].id;
      activeTabIdRef.current = nextActive;
      setActiveTabId(nextActive);
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleSelectPreset = (cmdText: string) => {
    const focusedId = activeTabIdRef.current;
    setTabs(prev => prev.map(t => t.id === focusedId ? { ...t, command: cmdText } : t));
    connectAndRun(cmdText, focusedId);
  };

  // Fetch runnable workspace files & directories from laptop bridge
  const fetchWorkspaceFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const targetUrl = bridgeUrl.replace(/\/+$/, '');
      const res = await fetch(`${targetUrl}/api/files`);
      if (res.ok) {
        const data = await res.json();
        if (data.cwd) setFolderPath(data.cwd);
        if (data.files && Array.isArray(data.files)) {
          setWorkspaceFiles(data.files);
        }
        if (data.directories && Array.isArray(data.directories)) {
          setWorkspaceDirs(data.directories);
        }
      }
    } catch (err) {
      console.warn('Could not fetch files from bridge:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Change active directory via bridge API
  const handleChangeDirectory = async (targetDirPath: string) => {
    setIsLoadingFiles(true);
    try {
      const targetUrl = bridgeUrl.replace(/\/+$/, '');
      const res = await fetch(`${targetUrl}/api/cd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetDirPath })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cwd) setFolderPath(data.cwd);
        if (data.files) setWorkspaceFiles(data.files);
        if (data.directories) setWorkspaceDirs(data.directories);

        const cFile = data.files?.find((f: any) => f.ext === 'c' || f.ext === 'cpp');
        const pyFile = data.files?.find((f: any) => f.ext === 'py');
        const jsFile = data.files?.find((f: any) => f.ext === 'js' || f.ext === 'ts');

        let newCmd = activeTab.command;
        if (cFile) newCmd = cFile.runCmd;
        else if (pyFile) newCmd = pyFile.runCmd;
        else if (jsFile) newCmd = jsFile.runCmd;

        setTabs(prev => prev.map(t => {
          if (t.id === activeTab.id) {
            return {
              ...t,
              command: newCmd,
              logs: [
                ...t.logs,
                {
                  id: Math.random().toString(),
                  type: 'status',
                  text: `📁 Changed working directory to: ${data.cwd}`,
                  time: new Date().toLocaleTimeString()
                }
              ]
            };
          }
          return t;
        }));

        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }
    } catch (err) {
      console.warn('Error changing directory:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleOpenFilePicker = (tab: 'files' | 'dirs' = 'dirs') => {
    setActiveModalTab(tab);
    setShowFilePicker(true);
    fetchWorkspaceFiles();
  };

  const handleSelectAndRunFile = (fileItem: WorkspaceFile) => {
    setSelectedFileName(fileItem.name);
    setShowFilePicker(false);
    const focusedId = activeTabIdRef.current;
    connectAndRun(fileItem.runCmd, focusedId);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const getFileBadge = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'c':
      case 'cpp':
      case 'cc':
        return { emoji: '🅲', color: '#0284c7', bg: '#e0f2fe' };
      case 'py':
        return { emoji: '🐍', color: '#16a34a', bg: '#dcfce7' };
      case 'js':
      case 'jsx':
        return { emoji: '🟨', color: '#ca8a04', bg: '#fef08a' };
      case 'ts':
      case 'tsx':
        return { emoji: '🟦', color: '#2563eb', bg: '#dbeafe' };
      case 'rs':
        return { emoji: '🦀', color: '#ea580c', bg: '#ffedd5' };
      case 'go':
        return { emoji: '🐹', color: '#0891b2', bg: '#cffafe' };
      case 'sh':
        return { emoji: '⚡', color: '#475569', bg: '#f1f5f9' };
      case 'java':
        return { emoji: '☕', color: '#b91c1c', bg: '#fee2e2' };
      default:
        return { emoji: '📄', color: '#475569', bg: '#f1f5f9' };
    }
  };

  const filteredFiles = workspaceFiles.filter(f =>
    f.name.toLowerCase().includes(fileSearch.toLowerCase()) ||
    f.path.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredDirs = workspaceDirs.filter(d =>
    d.name.toLowerCase().includes(fileSearch.toLowerCase()) ||
    d.path.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const displayFolderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || folderPath;
  const anyRunning = tabs.some(t => t.isRunning);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Modern Top Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backBtnText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => handleOpenFilePicker('dirs')}
          activeOpacity={0.7}
        >
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconWrap}>
              <TerminalIcon size={14} color="#0284c7" />
            </View>
            <Text style={styles.headerTitle}>Live Multi-Tab REPL</Text>
          </View>
          <View style={styles.dirPill}>
            <Text style={styles.dirPillText} numberOfLines={1}>
              📁 {displayFolderName} <Text style={{ color: '#0284c7', fontSize: 10 }}>▾</Text>
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.statusBadge, isConnected ? styles.badgeConnected : styles.badgeDisconnected]}>
          <View style={[styles.statusDot, isConnected ? (anyRunning ? styles.dotConnected : styles.dotIdle) : styles.dotDisconnected]} />
          <Text style={[styles.statusText, isConnected ? (anyRunning ? styles.textConnected : styles.textIdle) : styles.textDisconnected]}>
            {isConnected ? (anyRunning ? 'RUNNING' : 'IDLE') : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Multi-Tab Navigation Bar */}
      <View style={styles.tabsNavBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsNavContent}>
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => {
                  setActiveTabId(tab.id);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                }}
                activeOpacity={0.8}
              >
                {/* Status Dot */}
                <View style={[
                  styles.tabDot,
                  tab.isRunning ? styles.tabDotRunning : (tab.hasError ? styles.tabDotError : styles.tabDotIdle)
                ]} />

                <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]} numberOfLines={1}>
                  {tab.name || `Tab ${idx + 1}`}
                </Text>

                {/* Close Tab Button */}
                {tabs.length > 1 && (
                  <TouchableOpacity
                    style={styles.closeTabBtn}
                    onPress={() => handleCloseTab(tab.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.closeTabText}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Add New Tab Button */}
          <TouchableOpacity
            style={styles.addTabBtn}
            onPress={handleAddNewTab}
            activeOpacity={0.8}
          >
            <Text style={styles.addTabBtnText}>+ New Tab</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Preset Command & File/Dir Selector Chips */}
        <View style={styles.presetsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsContent}>
            {/* 1-Tap Browse Directory Chip */}
            <TouchableOpacity
              style={styles.pickDirChip}
              onPress={() => handleOpenFilePicker('dirs')}
              activeOpacity={0.8}
            >
              <Text style={styles.pickDirChipText}>
                📁 Folders ({workspaceDirs.length})
              </Text>
            </TouchableOpacity>

            {/* 1-Tap Pick File Chip */}
            <TouchableOpacity
              style={styles.pickFileChip}
              onPress={() => handleOpenFilePicker('files')}
              activeOpacity={0.8}
            >
              <Text style={styles.pickFileChipText}>
                {selectedFileName ? `📄 ${selectedFileName}` : `📄 Files (${workspaceFiles.length})`}
              </Text>
            </TouchableOpacity>

            {PRESET_COMMANDS.map((preset, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.presetChip, activeTab.command === preset.cmd && styles.presetChipActive]}
                onPress={() => handleSelectPreset(preset.cmd)}
                activeOpacity={0.8}
              >
                <Text style={[styles.presetChipText, activeTab.command === preset.cmd && styles.presetChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Command Execution Bar for Active Tab */}
        <View style={styles.commandBar}>
          <View style={styles.commandInputWrap}>
            <Text style={styles.promptSymbol}>$</Text>
            <TextInput
              style={styles.commandInput}
              value={activeTab.command}
              onChangeText={(text) => {
                setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, command: text } : t));
              }}
              placeholder="Command to run (e.g. gcc main.c)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => connectAndRun(activeTab.command, activeTabIdRef.current)}
            />
          </View>
          <TouchableOpacity
            style={[styles.runBtn, activeTab.isRunning && styles.runBtnDisabled]}
            onPress={() => connectAndRun(activeTab.command, activeTabIdRef.current)}
            disabled={activeTab.isRunning}
            activeOpacity={0.85}
          >
            {activeTab.isRunning ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.runBtnText}>EXEC</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Mac-Style Sleek Terminal Window Card for Active Tab */}
        <View style={styles.terminalContainer}>
          <View style={styles.terminalWindowCard}>
            {/* Mac Terminal Titlebar */}
            <View style={styles.terminalTitleBar}>
              <View style={styles.macDotsRow}>
                <View style={[styles.macDot, styles.dotRed]} />
                <View style={[styles.macDot, styles.dotYellow]} />
                <View style={[styles.macDot, styles.dotGreen]} />
              </View>
              <Text style={styles.terminalTitleBarText} numberOfLines={1}>
                {activeTab.name} • {displayFolderName}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => handleOpenFilePicker('dirs')} style={styles.browseDirBtn} activeOpacity={0.7}>
                  <Text style={styles.browseDirBtnText}>Folders</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleOpenFilePicker('files')} style={styles.browseFileBtn} activeOpacity={0.7}>
                  <Text style={styles.browseFileBtnText}>Files</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClearLogs} style={styles.clearBtn} activeOpacity={0.7}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Terminal Output Logs for Active Tab - Tap to Focus */}
            <ScrollView
              ref={scrollRef}
              style={styles.terminalScroll}
              contentContainerStyle={styles.terminalContent}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={true}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <Pressable
                style={styles.terminalPressable}
                onPress={() => {
                  stdinInputRef.current?.focus();
                }}
              >
                {activeTab.logs.map((log) => {
                  let colorStyle = styles.logStdout;
                  if (log.type === 'stderr' || log.type === 'error') colorStyle = styles.logStderr;
                  else if (log.type === 'status') colorStyle = styles.logStatus;
                  else if (log.type === 'stdin') colorStyle = styles.logStdin;
                  else if (log.type === 'exit') colorStyle = styles.logExit;

                  return (
                    <Text key={log.id} style={[styles.logText, colorStyle]}>
                      {log.text}
                    </Text>
                  );
                })}

                {/* Live active typing prompt inside terminal window */}
                <View style={styles.activeLineRow}>
                  <Text style={styles.activeLinePrompt}>&gt; </Text>
                  <Text style={styles.activeLineText}>{activeTab.inputText}</Text>
                  <Text style={styles.cursorText}>▌</Text>
                </View>
              </Pressable>
            </ScrollView>

            {/* Error Alert Bar inside Terminal */}
            {activeTab.hasError && !activeTab.isRunning && (
              <View style={styles.errorAlertBar}>
                <View style={styles.errorAlertLeft}>
                  <BugIcon size={14} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text style={styles.errorAlertText} numberOfLines={1}>
                    {activeTab.exitInfo ? `Exit code ${activeTab.exitInfo.code}` : 'Exception detected in stream'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.pickFileSmallBtn}
                    onPress={() => handleOpenFilePicker('dirs')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.pickFileSmallBtnText}>📁 Folders</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pickFileSmallBtn}
                    onPress={() => handleOpenFilePicker('files')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.pickFileSmallBtnText}>📄 Files</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.aiFixBtn}
                    onPress={() => {
                      setAlertState({
                        visible: true,
                        type: 'info',
                        title: 'Error Diagnostic',
                        message: activeTab.logs.filter(l => l.type === 'stderr' || l.type === 'error' || l.type === 'stdout').map(l => l.text).join('\n')
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <SparklesIcon size={12} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.aiFixBtnText}>Inspect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Quick Shortcut Keys Bar */}
        <View style={styles.quickKeysRow}>
          <TouchableOpacity
            style={styles.quickKey}
            onPress={() => handleSendInput('1')}
            activeOpacity={0.7}
          >
            <Text style={styles.quickKeyText}>1</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickKey}
            onPress={() => handleSendInput('2')}
            activeOpacity={0.7}
          >
            <Text style={styles.quickKeyText}>2</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickKey}
            onPress={() => handleSendInput('3')}
            activeOpacity={0.7}
          >
            <Text style={styles.quickKeyText}>3</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickKey}
            onPress={() => handleSendInput('y')}
            activeOpacity={0.7}
          >
            <Text style={styles.quickKeyText}>y</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickKey}
            onPress={() => handleSendInput('n')}
            activeOpacity={0.7}
          >
            <Text style={styles.quickKeyText}>n</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickKey}
            onPress={() => handleSendInput('')}
            activeOpacity={0.7}
          >
            <Text style={styles.quickKeyText}>[Enter]</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickKey, styles.ctrlCKey]}
            onPress={handleSendCtrlC}
            activeOpacity={0.7}
          >
            <Text style={styles.ctrlCText}>Ctrl+C</Text>
          </TouchableOpacity>
        </View>

        {/* Interactive Stdin & Command Input Bar */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.stdinPrompt}>&gt;</Text>
          <TextInput
            ref={stdinInputRef}
            style={styles.stdinInput}
            value={activeTab.inputText}
            onChangeText={(text) => {
              setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, inputText: text } : t));
            }}
            placeholder={activeTab.isRunning ? "Type input (1, y, text) & tap SEND..." : "Type command or input & tap SEND..."}
            placeholderTextColor="#94a3b8"
            editable={true}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => handleSendInput()}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => handleSendInput()}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>SEND</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Workspace Directory & File Explorer Modal */}
      <Modal
        visible={showFilePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.fileModalContainer, { paddingBottom: insets.bottom + 16 }]}>
            {/* Modal Header */}
            <View style={styles.fileModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalHeaderIconWrap}>
                  <TerminalIcon size={16} color="#0284c7" />
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.fileModalTitle}>Workspace Explorer</Text>
                  <Text style={styles.fileModalSub} numberOfLines={1}>
                    📁 {folderPath}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowFilePicker(false)}
                activeOpacity={0.7}
              >
                <CloseIcon size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Modal Tabs: Folders vs Files */}
            <View style={styles.modalTabBar}>
              <TouchableOpacity
                style={[styles.modalTab, activeModalTab === 'dirs' && styles.modalTabActive]}
                onPress={() => setActiveModalTab('dirs')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalTabText, activeModalTab === 'dirs' && styles.modalTabTextActive]}>
                  📁 Folders ({workspaceDirs.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTab, activeModalTab === 'files' && styles.modalTabActive]}
                onPress={() => setActiveModalTab('files')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalTabText, activeModalTab === 'files' && styles.modalTabTextActive]}>
                  📄 Runnable Files ({workspaceFiles.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.fileSearchWrap}>
              <Text style={styles.fileSearchIcon}>🔍</Text>
              <TextInput
                style={styles.fileSearchInput}
                value={fileSearch}
                onChangeText={setFileSearch}
                placeholder={activeModalTab === 'dirs' ? "Search folders (e.g. Day-1, src)..." : "Search files (e.g. main.c, test.py)..."}
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {fileSearch ? (
                <TouchableOpacity onPress={() => setFileSearch('')} activeOpacity={0.7}>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Content List */}
            {isLoadingFiles ? (
              <View style={styles.fileLoadingCenter}>
                <ActivityIndicator size="large" color="#0284c7" />
                <Text style={styles.fileLoadingText}>Exploring workspace from laptop...</Text>
              </View>
            ) : activeModalTab === 'dirs' ? (
              /* DIRECTORIES TAB */
              filteredDirs.length === 0 ? (
                <View style={styles.fileEmptyCenter}>
                  <Text style={styles.fileEmptyEmoji}>📁</Text>
                  <Text style={styles.fileEmptyTitle}>No subdirectories</Text>
                  <Text style={styles.fileEmptySub}>
                    You are in: {displayFolderName}
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshFilesBtn}
                    onPress={fetchWorkspaceFiles}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.refreshFilesBtnText}>🔄 Refresh Workspace</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={filteredDirs}
                  keyExtractor={(item) => item.fullPath}
                  contentContainerStyle={styles.fileListContent}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.dirItemCard, item.isParent && styles.parentDirCard]}
                      onPress={() => handleChangeDirectory(item.path)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.dirIconBadge}>
                        <Text style={{ fontSize: 16 }}>{item.isParent ? '⬆' : '📁'}</Text>
                      </View>

                      <View style={styles.fileItemInfo}>
                        <Text style={styles.fileItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.fileItemPath} numberOfLines={1}>
                          {item.fullPath}
                        </Text>
                      </View>

                      <View style={styles.openDirPill}>
                        <Text style={styles.openDirPillText}>
                          {item.isParent ? 'GO UP ⬆' : 'OPEN ➔'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )
            ) : (
              /* FILES TAB */
              filteredFiles.length === 0 ? (
                <View style={styles.fileEmptyCenter}>
                  <Text style={styles.fileEmptyEmoji}>📂</Text>
                  <Text style={styles.fileEmptyTitle}>No runnable files in this folder</Text>
                  <Text style={styles.fileEmptySub}>
                    Switch to the "Folders" tab to navigate to Day-1, Day-2, or other directories.
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshFilesBtn}
                    onPress={() => setActiveModalTab('dirs')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.refreshFilesBtnText}>📁 Switch to Folders</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={filteredFiles}
                  keyExtractor={(item) => item.path}
                  contentContainerStyle={styles.fileListContent}
                  renderItem={({ item }) => {
                    const badge = getFileBadge(item.ext);
                    return (
                      <TouchableOpacity
                        style={styles.fileItemCard}
                        onPress={() => handleSelectAndRunFile(item)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.fileExtBadge, { backgroundColor: badge.bg }]}>
                          <Text style={{ fontSize: 14 }}>{badge.emoji}</Text>
                        </View>

                        <View style={styles.fileItemInfo}>
                          <Text style={styles.fileItemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.fileItemPath} numberOfLines={1}>
                            {item.path}
                          </Text>
                          <Text style={styles.fileItemCmd} numberOfLines={1}>
                            $ {item.runCmd}
                          </Text>
                        </View>

                        <View style={styles.runFilePill}>
                          <Text style={styles.runFilePillText}>RUN ▶</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )
            )}
          </View>
        </View>
      </Modal>

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
    backgroundColor: '#f8fafc'
  },
  keyboardAvoid: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  backArrow: {
    color: '#0284c7',
    fontSize: 20,
    fontWeight: '800',
    marginRight: 4,
    marginTop: -2
  },
  backBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '700'
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  dirPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  dirPillText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1
  },
  badgeConnected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  },
  badgeDisconnected: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  dotConnected: {
    backgroundColor: '#16a34a'
  },
  dotIdle: {
    backgroundColor: '#0284c7'
  },
  dotDisconnected: {
    backgroundColor: '#94a3b8'
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  textConnected: {
    color: '#15803d'
  },
  textIdle: {
    color: '#0284c7'
  },
  textDisconnected: {
    color: '#64748b'
  },

  // Multi-Tab Nav Bar
  tabsNavBar: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6
  },
  tabsNavContent: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center'
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 160
  },
  tabPillActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  tabDotRunning: {
    backgroundColor: '#16a34a'
  },
  tabDotError: {
    backgroundColor: '#dc2626'
  },
  tabDotIdle: {
    backgroundColor: '#94a3b8'
  },
  tabPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1
  },
  tabPillTextActive: {
    color: '#0369a1',
    fontWeight: '800'
  },
  closeTabBtn: {
    marginLeft: 6,
    padding: 2,
    borderRadius: 4
  },
  closeTabText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  addTabBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  addTabBtnText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '800'
  },

  presetsRow: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8
  },
  presetsContent: {
    paddingHorizontal: 14,
    gap: 6
  },
  pickDirChip: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#16a34a'
  },
  pickDirChipText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '800'
  },
  pickFileChip: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#0284c7'
  },
  pickFileChipText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '800'
  },
  presetChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  presetChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7'
  },
  presetChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700'
  },
  presetChipTextActive: {
    color: '#ffffff'
  },

  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8
  },
  commandInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  promptSymbol: {
    color: '#0284c7',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 6
  },
  commandInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 0
  },
  runBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  runBtnDisabled: {
    opacity: 0.5
  },
  runBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  terminalContainer: {
    flex: 1,
    padding: 12
  },
  terminalWindowCard: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  terminalTitleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#1f2937'
  },
  macDotsRow: {
    flexDirection: 'row',
    gap: 6
  },
  macDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5
  },
  dotRed: { backgroundColor: '#ef4444' },
  dotYellow: { backgroundColor: '#eab308' },
  dotGreen: { backgroundColor: '#22c55e' },
  terminalTitleBarText: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  browseDirBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#166534'
  },
  browseDirBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700'
  },
  browseFileBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#0369a1'
  },
  browseFileBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700'
  },
  clearBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#1f2937'
  },
  clearBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700'
  },

  terminalScroll: {
    flex: 1
  },
  terminalContent: {
    padding: 12,
    paddingBottom: 20
  },
  terminalPressable: {
    minHeight: 180,
    width: '100%'
  },
  activeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  activeLinePrompt: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  activeLineText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  logText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18
  },
  logStdout: {
    color: '#f1f5f9'
  },
  logStderr: {
    color: '#f87171',
    fontWeight: '600'
  },
  logStatus: {
    color: '#38bdf8',
    fontStyle: 'italic'
  },
  logStdin: {
    color: '#fbbf24',
    fontWeight: 'bold'
  },
  logExit: {
    color: '#4ade80',
    fontWeight: 'bold',
    marginTop: 6
  },
  cursorRow: {
    marginTop: 2
  },
  cursorText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold'
  },

  errorAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#450a0a',
    borderTopWidth: 1,
    borderColor: '#7f1d1d',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  errorAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  errorAlertText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600'
  },
  pickFileSmallBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  pickFileSmallBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  aiFixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  aiFixBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700'
  },

  quickKeysRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    gap: 6
  },
  quickKey: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1
  },
  quickKeyText: {
    color: '#1e293b',
    fontSize: 11,
    fontWeight: '700'
  },
  ctrlCKey: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5'
  },
  ctrlCText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800'
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0'
  },
  stdinPrompt: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8
  },
  stdinInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  sendBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 8
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
    opacity: 0.6
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end'
  },
  fileModalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 16
  },
  fileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalHeaderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fileModalTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800'
  },
  fileModalSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },

  modalTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3
  },
  modalTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  modalTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2
  },
  modalTabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700'
  },
  modalTabTextActive: {
    color: '#0284c7',
    fontWeight: '800'
  },

  fileSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  fileSearchIcon: {
    marginRight: 8,
    fontSize: 13
  },
  fileSearchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    padding: 0
  },

  fileListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 8
  },
  dirItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  parentDirCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1'
  },
  dirIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  openDirPill: {
    backgroundColor: '#16a34a',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  openDirPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },

  fileItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  fileExtBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  fileItemInfo: {
    flex: 1,
    marginRight: 8
  },
  fileItemName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800'
  },
  fileItemPath: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  fileItemCmd: {
    color: '#0284c7',
    fontSize: 10,
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  runFilePill: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  runFilePillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },

  fileLoadingCenter: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fileLoadingText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 10
  },
  fileEmptyCenter: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fileEmptyEmoji: {
    fontSize: 32,
    marginBottom: 8
  },
  fileEmptyTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  fileEmptySub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14
  },
  refreshFilesBtn: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  refreshFilesBtnText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '700'
  }
});
