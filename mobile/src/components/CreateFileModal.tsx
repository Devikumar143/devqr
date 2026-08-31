import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import {
  SparklesIcon,
  CloseIcon,
  CopyIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  TerminalIcon
} from './SvgIcons';
import { CloudAIEngine } from '../services/aiEngine';

interface CreateFileModalProps {
  visible: boolean;
  onClose: () => void;
  initialPath?: string;
  initialPrompt?: string;
  initialContent?: string;
  bridgeUrl?: string;
  projectContext?: string;
}

export const CreateFileModal: React.FC<CreateFileModalProps> = ({
  visible,
  onClose,
  initialPath = 'src/services/newModule.ts',
  initialPrompt = '',
  initialContent = '',
  bridgeUrl = 'http://127.0.0.1:9222',
  projectContext = ''
}) => {
  const [filePath, setFilePath] = useState(initialPath);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [content, setContent] = useState(initialContent);
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [resultStatus, setResultStatus] = useState<{
    success?: boolean;
    message?: string;
    lines?: number;
    filePath?: string;
  } | null>(null);

  const quickTemplates = [
    { label: 'Auth Middleware', path: 'src/middleware/auth.ts', prompt: 'JWT verification and role-based access control middleware' },
    { label: 'Unit Test Suite', path: 'tests/service.test.ts', prompt: 'Comprehensive unit tests with mock fixtures and edge case assertions' },
    { label: 'Database Service', path: 'src/services/db.ts', prompt: 'Data access layer with transactions, connection pooling, and error handling' },
    { label: 'REST API Controller', path: 'src/controllers/api.ts', prompt: 'Express/Fastify route handler with schema validation and status codes' },
    { label: 'Helper Utils', path: 'src/utils/helpers.ts', prompt: 'Formatters, validators, and async utility helper functions' }
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Prompt required', 'Please enter a description for the file you want to create.');
      return;
    }
    setGenerating(true);
    setResultStatus(null);
    try {
      const res = await CloudAIEngine.generateNewFileCode(prompt.trim(), filePath.trim(), projectContext);
      if (res.content) {
        setContent(res.content);
        if (res.filePath) setFilePath(res.filePath);
      }
    } catch (e: any) {
      Alert.alert('Generation Error', e.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePushToLaptop = async () => {
    if (!filePath.trim()) {
      Alert.alert('File path required', 'Please provide a destination file path.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Content empty', 'Please write or generate code content before pushing.');
      return;
    }

    setPushing(true);
    try {
      const targetUrl = bridgeUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${targetUrl}/api/create-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: filePath.trim(),
          content: content,
          openInIDE: true
        })
      });

      const data = await res.json();
      if (data.success) {
        setResultStatus({
          success: true,
          message: data.isNew ? 'New file created & opened in IDE!' : 'Existing file updated & opened in IDE!',
          lines: data.lines,
          filePath: data.filePath
        });
      } else {
        setResultStatus({
          success: false,
          message: data.error || 'Failed to push file to laptop.'
        });
      }
    } catch (err: any) {
      setResultStatus({
        success: false,
        message: `Wi-Fi Bridge unreachable at ${bridgeUrl}. Ensure devqr CLI is running on your laptop.`
      });
    } finally {
      setPushing(false);
    }
  };

  const lineCount = content ? content.split('\n').length : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Modal Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <TerminalIcon size={20} color="#0284c7" style={{ marginRight: 8 }} />
            <Text style={styles.headerTitle}>Create File & Push to IDE</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <CloseIcon size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {/* Quick Templates */}
          <Text style={styles.sectionLabel}>QUICK TEMPLATES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
            {quickTemplates.map((t, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.templateChip}
                onPress={() => {
                  setFilePath(t.path);
                  setPrompt(t.prompt);
                }}
                activeOpacity={0.75}
              >
                <SparklesIcon size={12} color="#0284c7" style={{ marginRight: 5 }} />
                <Text style={styles.templateText}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Destination File Path */}
          <Text style={styles.sectionLabel}>TARGET FILE PATH ON LAPTOP</Text>
          <TextInput
            style={styles.input}
            value={filePath}
            onChangeText={setFilePath}
            placeholder="e.g. src/services/auth.ts or tests/main.test.py"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* AI Specification Prompt */}
          <Text style={styles.sectionLabel}>AI CODE GENERATOR PROMPT</Text>
          <View style={styles.promptBox}>
            <TextInput
              style={styles.promptInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe what this file should implement (e.g. Rate limiter middleware with Redis cache)..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[styles.generateBtn, generating && styles.btnDisabled]}
              onPress={handleGenerate}
              disabled={generating}
              activeOpacity={0.85}
            >
              {generating ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.generateBtnText}>Synthesizing Code...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <SparklesIcon size={14} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.generateBtnText}>Generate Full File with AI</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Code Editor / Preview */}
          <View style={styles.editorHeaderRow}>
            <Text style={styles.sectionLabel}>
              SOURCE CODE {lineCount > 0 ? `(${lineCount} LINES)` : ''}
            </Text>
            {content.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setContent('')}
                activeOpacity={0.7}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.codeEditorContainer}>
            <TextInput
              style={styles.codeEditorInput}
              value={content}
              onChangeText={setContent}
              placeholder="// Full file code will appear here or you can type directly..."
              placeholderTextColor="#475569"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
          </View>

          {/* Result Alert / Confirmation */}
          {resultStatus && (
            <View style={[styles.resultCard, resultStatus.success ? styles.resultSuccess : styles.resultError]}>
              <View style={styles.resultHeaderRow}>
                <CheckCircleIcon
                  size={16}
                  color={resultStatus.success ? '#16a34a' : '#dc2626'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.resultTitle, resultStatus.success ? styles.resultTitleSuccess : styles.resultTitleError]}>
                  {resultStatus.success ? 'IDE Push Successful' : 'Push Error'}
                </Text>
              </View>
              <Text style={styles.resultMsg}>{resultStatus.message}</Text>
              {resultStatus.success && resultStatus.filePath && (
                <Text style={styles.resultSub}>
                  Written to: <Text style={styles.resultHighlight}>{resultStatus.filePath}</Text> ({resultStatus.lines} lines)
                </Text>
              )}
            </View>
          )}

          {/* Push Action Button */}
          <TouchableOpacity
            style={[styles.pushBtn, pushing && styles.btnDisabled]}
            onPress={handlePushToLaptop}
            disabled={pushing}
            activeOpacity={0.85}
          >
            {pushing ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.pushBtnText}>Pushing to Laptop Bridge...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <TerminalIcon size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.pushBtnText}>PUSH FILE & OPEN IN IDE</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.bridgeFooterNote}>
            Over local Wi-Fi to {bridgeUrl} • Auto-opens in VS Code / Cursor
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  templateScroll: {
    marginBottom: 16,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  templateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  promptBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  promptInput: {
    fontSize: 13,
    color: '#0f172a',
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  generateBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  editorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  clearBtnText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
  },
  codeEditorContainer: {
    backgroundColor: '#090d16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    minHeight: 180,
    maxHeight: 280,
    marginBottom: 16,
  },
  codeEditorInput: {
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  resultCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  resultSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  resultError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  resultTitleSuccess: {
    color: '#166534',
  },
  resultTitleError: {
    color: '#991b1b',
  },
  resultMsg: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  resultSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  resultHighlight: {
    color: '#0284c7',
    fontWeight: '700',
  },
  pushBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  pushBtnText: {
    color: '#ffffff',
    fontSize: 14,
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
  bridgeFooterNote: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
});
