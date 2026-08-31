import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  TerminalIcon,
  CloseIcon,
  SparklesIcon,
  BugIcon,
  FlashIcon,
  CheckCircleIcon
} from './SvgIcons';

interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'status' | 'stdin' | 'exit' | 'error';
  text: string;
  time: string;
}

interface InteractiveTerminalModalProps {
  visible: boolean;
  onClose: () => void;
  bridgeUrl?: string;
  initialCommand?: string;
  title?: string;
  targetFolder?: string;
  fileName?: string;
  onAutoFixError?: (errorText: string) => void;
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

export function InteractiveTerminalModal({
  visible,
  onClose,
  bridgeUrl = 'http://127.0.0.1:9222',
  initialCommand = 'python -u main.py',
  title = 'Interactive Terminal REPL',
  targetFolder = 'Workspace',
  fileName,
  onAutoFixError
}: InteractiveTerminalModalProps) {
  const [command, setCommand] = useState<string>(initialCommand);
  const [inputText, setInputText] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [exitInfo, setExitInfo] = useState<{ code: number; signal?: string; durationMs: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const stdinInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    setCommand(initialCommand);
  }, [initialCommand]);

  useEffect(() => {
    if (visible) {
      setLogs([]);
      setHasError(false);
      setExitInfo(null);
      connectAndRun(command || initialCommand);
    } else {
      cleanupWs();
    }

    return () => {
      cleanupWs();
    };
  }, [visible]);

  const cleanupWs = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsRunning(false);
  };

  const getWsUrl = (httpUrl: string): string => {
    const clean = httpUrl.replace(/\/+$/, '');
    if (clean.startsWith('https://')) {
      return clean.replace('https://', 'wss://');
    }
    return clean.replace('http://', 'ws://');
  };

  const connectAndRun = (cmdToRun: string, initialInput?: string) => {
    cleanupWs();
    setIsRunning(true);
    setExitInfo(null);
    setHasError(false);

    const wsUrl = getWsUrl(bridgeUrl);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setLogs([
      {
        id: Math.random().toString(),
        type: 'status',
        text: `Connecting to DevQR Terminal Bridge (${wsUrl})...`,
        time: now
      }
    ]);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}

        setLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'status',
            text: `Connected to laptop LAN bridge. Spawning: $ ${cmdToRun}${initialInput ? ` (Input: ${initialInput})` : ''}`,
            time: new Date().toLocaleTimeString()
          }
        ]);

        // Send spawn request
        ws.send(
          JSON.stringify({
            type: 'spawn',
            command: cmdToRun,
            initialInput
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          if (msg.type === 'stdout') {
            const cleanedText = cleanAnsi(msg.data);
            setLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                type: 'stdout',
                text: cleanedText,
                time
              }
            ]);
            // Check for crash keywords in stdout
            if (/(?:Traceback \(most recent call last\)|Error:|Exception:|SyntaxError:|TypeError:|ValueError:)/i.test(cleanedText)) {
              setHasError(true);
            }
          } else if (msg.type === 'stderr') {
            setHasError(true);
            setLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                type: 'stderr',
                text: cleanAnsi(msg.data),
                time
              }
            ]);
          } else if (msg.type === 'status') {
            setLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                type: 'status',
                text: msg.message,
                time
              }
            ]);
          } else if (msg.type === 'exit') {
            setIsRunning(false);
            setExitInfo({
              code: msg.code,
              signal: msg.signal,
              durationMs: msg.durationMs
            });

            if (msg.code !== 0) {
              setHasError(true);
            }

            setLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                type: 'exit',
                text: `Process finished with exit code ${msg.code} in ${msg.durationMs}ms`,
                time
              }
            ]);

            try {
              if (msg.code === 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
            } catch {}
          } else if (msg.type === 'error') {
            setHasError(true);
            setLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                type: 'error',
                text: `Terminal Bridge Error: ${msg.message}`,
                time
              }
            ]);
          }
        } catch (err: any) {
          console.warn('WS parse error:', err);
        }
      };

      ws.onerror = (err) => {
        setIsRunning(false);
        setIsConnected(false);
        setLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'error',
            text: `Could not connect to WebSocket bridge at ${wsUrl}. Verify devqr is running on laptop.`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsRunning(false);
      };
    } catch (e: any) {
      setIsRunning(false);
      setIsConnected(false);
      setLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'error',
          text: `WebSocket initialization error: ${e.message}`,
          time: new Date().toLocaleTimeString()
        }
      ]);
    }
  };

  const handleSendInput = (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : inputText;
    const trimmed = text.trim();

    // 1. If process is running, feed directly to stdin
    if (isRunning && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'stdin',
          data: text + '\n'
        })
      );

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'stdin',
          text: `> ${text}`,
          time
        }
      ]);

      if (textToSend === undefined) {
        setInputText('');
      }

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      return;
    }

    // 2. If process is idle or stopped:
    if (textToSend !== undefined) {
      setInputText(prev => prev + textToSend);
      return;
    }

    // If user explicitly submitted via SEND button or Enter key:
    if (trimmed) {
      setCommand(trimmed);
      connectAndRun(trimmed);
      setInputText('');
    } else if (command.trim()) {
      // Enter re-runs the current command
      connectAndRun(command.trim());
    }
  };

  const handleSendCtrlC = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'kill',
          signal: 'SIGINT'
        })
      );
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  };

  const handleReRun = () => {
    connectAndRun(command);
  };

  const handleAutoFix = () => {
    const errorText = logs
      .filter(l => l.type === 'stderr' || l.type === 'error' || l.type === 'stdout')
      .map(l => l.text)
      .join('\n');

    onClose();
    if (onAutoFixError) {
      onAutoFixError(errorText);
    }
  };

  const getCombinedLogText = () => {
    return logs.map(l => l.text).join('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeContainer}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconWrap}>
                <TerminalIcon size={16} color="#0284c7" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.titleText}>LIVE STREAMING TERMINAL</Text>
                <Text style={styles.subtitleText} numberOfLines={1}>
                  {bridgeUrl} • {fileName || command}
                </Text>
              </View>
            </View>

            <View style={styles.headerRightRow}>
              <View style={[styles.statusBadge, isConnected ? styles.badgeConnected : styles.badgeDisconnected]}>
                <View style={[styles.statusDot, isConnected ? styles.dotConnected : styles.dotDisconnected]} />
                <Text style={[styles.statusText, isConnected ? styles.textConnected : styles.textDisconnected]}>
                  {isConnected ? (isRunning ? 'LIVE' : 'IDLE') : 'OFFLINE'}
                </Text>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <CloseIcon size={16} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Command Bar */}
          <View style={styles.commandBar}>
            <Text style={styles.promptSymbol}>$</Text>
            <TextInput
              style={styles.commandInput}
              value={command}
              onChangeText={setCommand}
              placeholder="Command to run (e.g. python main.py)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleReRun}
            />
            <TouchableOpacity
              style={[styles.reRunBtn, isRunning && styles.reRunBtnDisabled]}
              onPress={handleReRun}
              disabled={isRunning}
              activeOpacity={0.8}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.reRunBtnText}>RUN</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Live Terminal Screen */}
          <View style={styles.terminalWindow}>
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
                {logs.map((log) => {
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

                {/* Live active typing prompt */}
                <View style={styles.activeLineRow}>
                  <Text style={styles.activeLinePrompt}>&gt; </Text>
                  <Text style={styles.activeLineText}>{inputText}</Text>
                  <Text style={styles.cursorText}>▌</Text>
                </View>
              </Pressable>
            </ScrollView>

            {/* AI Auto-Fix Trigger Bar (When Crash Occurs) */}
            {hasError && !isRunning && (
              <View style={styles.errorAlertBar}>
                <View style={styles.errorAlertLeft}>
                  <BugIcon size={16} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text style={styles.errorAlertText}>Crash / Exception detected in output</Text>
                </View>
                <TouchableOpacity style={styles.aiFixBtn} onPress={handleAutoFix} activeOpacity={0.85}>
                  <SparklesIcon size={14} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.aiFixBtnText}>1-Click AI Fix</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick Keys Bar */}
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

          {/* Interactive Stdin Input Bar */}
          <View style={styles.inputContainer}>
            <Text style={styles.stdinPrompt}>&gt;</Text>
            <TextInput
              ref={stdinInputRef}
              style={styles.stdinInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isRunning ? "Type stdin (input/choice) & tap SEND..." : "Type stdin or command & tap SEND..."}
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff'
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  subtitleText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  textDisconnected: {
    color: '#64748b'
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },

  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  promptSymbol: {
    color: '#0284c7',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 8
  },
  commandInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#0f172a',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  reRunBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  reRunBtnDisabled: {
    opacity: 0.5
  },
  reRunBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },

  terminalWindow: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  terminalScroll: {
    flex: 1
  },
  terminalContent: {
    padding: 14,
    paddingBottom: 20
  },
  logText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18
  },
  logStdout: {
    color: '#1e293b'
  },
  logStderr: {
    color: '#dc2626',
    fontWeight: '600'
  },
  logStatus: {
    color: '#0284c7',
    fontStyle: 'italic'
  },
  logStdin: {
    color: '#b45309',
    fontWeight: 'bold'
  },
  logExit: {
    color: '#15803d',
    fontWeight: 'bold',
    marginTop: 6
  },
  cursorRow: {
    marginTop: 2
  },
  cursorText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: 'bold'
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
    color: '#0284c7',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  activeLineText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },

  errorAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderTopWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  errorAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  errorAlertText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '600'
  },
  aiFixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  aiFixBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },

  quickKeysRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
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
    paddingVertical: 8,
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
  }
});
