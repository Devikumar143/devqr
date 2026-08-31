import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MobileSecureStore, MobileAppSettings } from '../src/services/secureStore';
import { SQLiteSessionStorage } from '../src/services/sqliteStorage';
import { OnDeviceLLMService, ModelDownloadProgress, AVAILABLE_ON_DEVICE_MODELS } from '../src/services/onDeviceLLM';
import { BottomAlert } from '../src/components/BottomAlert';
import { SparklesIcon, CheckCircleIcon, FlashIcon, BugIcon } from '../src/components/SvgIcons';
import { DevQRLogo } from '../src/components/DevQRLogo';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<MobileAppSettings>({ aiProvider: 'gemini', onboardingCompleted: true, autoSanitize: true });
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
    latency?: number;
    model?: string;
  }>({ status: 'idle', message: '' });

  // On-Device Model State
  const [modelStatus, setModelStatus] = useState<{ isDownloaded: boolean; sizeBytes: number; sizeFormatted: string }>({ isDownloaded: false, sizeBytes: 0, sizeFormatted: '0 MB' });
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const [isTestingOnDevice, setIsTestingOnDevice] = useState(false);

  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type?: 'error' | 'success' | 'info';
    title: string;
    message: string;
    actionText?: string;
    onAction?: () => void;
  }>({
    visible: false,
    title: '',
    message: ''
  });

  useEffect(() => {
    loadSettings();
    checkModelStatus();
  }, []);

  const checkModelStatus = async () => {
    const onDevice = OnDeviceLLMService.getInstance();
    const status = await onDevice.isModelDownloaded();
    setModelStatus(status);
  };

  const loadSettings = async () => {
    const s = await MobileSecureStore.getSettings();
    setSettings(s);
    const key = await MobileSecureStore.getApiKey(s.aiProvider);
    setApiKey(key || '');
  };

  const handleSelectProvider = async (provider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'ondevice') => {
    const updated = await MobileSecureStore.saveSettings({ aiProvider: provider });
    setSettings(updated);
    if (provider !== 'ondevice') {
      const key = await MobileSecureStore.getApiKey(provider);
      setApiKey(key || '');
    }
    setTestResult({ status: 'idle', message: '' });
  };

  const handleDownloadModel = async () => {
    setIsDownloadingModel(true);
    setDownloadProgress({ totalBytes: 986 * 1024 * 1024, downloadedBytes: 0, percent: 0 });
    try {
      const onDevice = OnDeviceLLMService.getInstance();
      await onDevice.downloadModel('qwen2.5-coder-1.5b', (progress) => {
        setDownloadProgress(progress);
      });
      await checkModelStatus();
      setAlertState({
        visible: true,
        type: 'success',
        title: 'Model Downloaded!',
        message: 'Qwen2.5-Coder 1.5B is ready on your device. You can now generate code in 100% Airplane Mode.'
      });
    } catch (err: any) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Download Failed',
        message: err.message || 'Could not download model. Check internet connection and free storage.'
      });
    } finally {
      setIsDownloadingModel(false);
      setDownloadProgress(null);
    }
  };

  const handleCancelDownload = async () => {
    const onDevice = OnDeviceLLMService.getInstance();
    await onDevice.cancelDownload();
    setIsDownloadingModel(false);
    setDownloadProgress(null);
  };

  const handleDeleteModel = async () => {
    setAlertState({
      visible: true,
      type: 'error',
      title: 'Delete Model File?',
      message: 'This will delete the 986 MB model from your phone storage to free up space.',
      actionText: 'Delete (986 MB)',
      onAction: async () => {
        const onDevice = OnDeviceLLMService.getInstance();
        await onDevice.deleteModel();
        await checkModelStatus();
      }
    });
  };

  const handleTestOnDevice = async () => {
    setIsTestingOnDevice(true);
    setTestResult({ status: 'idle', message: '' });
    const startTime = Date.now();
    try {
      const onDevice = OnDeviceLLMService.getInstance();
      const res = await onDevice.generate(
        'You are DevQR offline engine.',
        'Write a one-line hello world function in Python.'
      );
      const latency = Date.now() - startTime;
      setTestResult({
        status: 'success',
        model: 'Qwen2.5-Coder 1.5B (On-Device GGUF)',
        latency,
        message: `Offline inference verified! Output: ${res.slice(0, 80)}...`
      });
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'On-device inference failed. Verify model is downloaded and run in development build.'
      });
    } finally {
      setIsTestingOnDevice(false);
    }
  };

  const handleSaveKey = async () => {
    await MobileSecureStore.saveApiKey(settings.aiProvider, apiKey.trim());
    setAlertState({
      visible: true,
      type: 'success',
      title: 'API Key Saved',
      message: `Stored securely in your device Keychain / KeyStore.`
    });
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        status: 'error',
        message: 'Please paste your API key in the input box first.'
      });
      return;
    }

    setTesting(true);
    setTestResult({ status: 'idle', message: '' });
    const startTime = Date.now();

    try {
      if (settings.aiProvider === 'openrouter') {
        const openRouterModels = [
          'deepseek/deepseek-r1',
          'anthropic/claude-3.5-sonnet',
          'meta-llama/llama-3.3-70b-instruct',
          'openai/gpt-4o-mini',
          'google/gemini-2.0-flash-exp:free',
          'qwen/qwen-2.5-coder-32b-instruct',
          'deepseek/deepseek-chat',
          'auto'
        ];
        let success = false;
        let lastErr = '';

        for (const model of openRouterModels) {
          try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey.trim()}`,
                'HTTP-Referer': 'https://devqr.local',
                'X-Title': 'DevQR'
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Respond with OK.' }],
                max_tokens: 10
              })
            });

            if (res.ok) {
              const latency = Date.now() - startTime;
              await MobileSecureStore.saveApiKey(settings.aiProvider, apiKey.trim());
              setTestResult({
                status: 'success',
                model: `OpenRouter (${model})`,
                latency,
                message: 'OpenRouter Gateway verified! Global AI reasoning is ready.'
              });
              success = true;
              break;
            } else {
              const errData = await res.json().catch(() => ({}));
              lastErr = errData?.error?.message || `HTTP ${res.status}`;
            }
          } catch (e: any) {
            lastErr = e.message;
          }
        }

        if (!success) {
          throw new Error(lastErr || 'Invalid OpenRouter API Key.');
        }
      } else if (settings.aiProvider === 'gemini') {
        const geminiModels = [
          'gemini-3.1-pro',
          'gemini-3.1-pro-preview',
          'gemini-3.1-pro-latest',
          'gemini-3.7-flash',
          'gemini-3.7-pro',
          'gemini-3.6',
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'gemini-2.0-flash',
          'gemini-2.0-flash-exp',
          'gemini-2.0-flash-lite',
          'gemini-2.0-flash-lite-preview-02-05',
          'gemini-2.0-pro-exp-02-05',
          'gemini-1.5-flash',
          'gemini-1.5-flash-latest',
          'gemini-1.5-flash-8b',
          'gemini-1.5-flash-8b-latest',
          'gemini-1.5-pro',
          'gemini-1.5-pro-latest',
          'gemini-pro',
          'gemini-flash'
        ];
        let success = false;
        let lastError = '';

        for (const model of geminiModels) {
          try {
            const cleanKey = apiKey.trim();
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': cleanKey
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Hello, respond with OK.' }] }]
              })
            });

            if (res.ok) {
              const latency = Date.now() - startTime;
              await MobileSecureStore.saveApiKey(settings.aiProvider, cleanKey);
              setTestResult({
                status: 'success',
                model: `Google ${model}`,
                latency,
                message: 'API Key is verified & active! Live AI code analysis is ready.'
              });
              success = true;
              break;
            } else {
              const errJson = await res.json().catch(() => ({}));
              lastError = errJson?.error?.message || `Google API returned status ${res.status}`;
            }
          } catch (e: any) {
            lastError = e.message;
          }
        }

        if (!success) {
          throw new Error(lastError || 'Could not verify Gemini key with Google AI Studio.');
        }
      } else if (settings.aiProvider === 'groq') {
        const groqModels = [
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'llama-3.1-70b-versatile',
          'deepseek-r1-distill-llama-70b',
          'deepseek-r1-distill-qwen-32b',
          'qwen-2.5-coder-32b',
          'qwen-2.5-32b',
          'llama3-70b-8192',
          'llama3-8b-8192',
          'mixtral-8x7b-32768',
          'gemma2-9b-it',
          'gemma-7b-it'
        ];
        let success = false;
        let lastErr = '';

        for (const model of groqModels) {
          try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey.trim()}`
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Respond with OK.' }],
                max_tokens: 10
              })
            });

            if (res.ok) {
              const latency = Date.now() - startTime;
              await MobileSecureStore.saveApiKey(settings.aiProvider, apiKey.trim());
              setTestResult({
                status: 'success',
                model: `Groq (${model})`,
                latency,
                message: 'Groq LPU verified! Ultra-fast AI code analysis is active.'
              });
              success = true;
              break;
            } else {
              const errData = await res.json().catch(() => ({}));
              lastErr = errData?.error?.message || `HTTP ${res.status}`;
            }
          } catch (e: any) {
            lastErr = e.message;
          }
        }

        if (!success) {
          throw new Error(lastErr || 'Invalid Groq API Key.');
        }
      } else if (settings.aiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Respond with OK.' }],
            max_tokens: 10
          })
        });

        const latency = Date.now() - startTime;

        if (res.ok) {
          await MobileSecureStore.saveApiKey(settings.aiProvider, apiKey.trim());
          setTestResult({
            status: 'success',
            model: 'OpenAI GPT-4o Mini',
            latency,
            message: 'API Key is valid and active! Live AI code analysis is ready.'
          });
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || 'Invalid OpenAI API Key.');
        }
      } else if (settings.aiProvider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'OK' }]
          })
        });

        const latency = Date.now() - startTime;

        if (res.ok) {
          await MobileSecureStore.saveApiKey(settings.aiProvider, apiKey.trim());
          setTestResult({
            status: 'success',
            model: 'Claude 3.5 Sonnet',
            latency,
            message: 'API Key is valid and active! Live AI code analysis is ready.'
          });
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || 'Invalid Claude API Key.');
        }
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'Connection failed. Please check your key and internet connection.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClearPrompt = () => {
    setAlertState({
      visible: true,
      type: 'error',
      title: 'Delete All Sessions?',
      message: 'This will permanently remove all debugging history stored on this phone.',
      actionText: 'Delete All',
      onAction: async () => {
        await SQLiteSessionStorage.clearAll();
        setAlertState({
          visible: true,
          type: 'success',
          title: 'Storage Cleared',
          message: 'All local sessions deleted successfully.'
        });
      }
    });
  };

  const getPlaceholder = () => {
    if (settings.aiProvider === 'openrouter') return 'sk-or-v1-... (OpenRouter API Key)';
    if (settings.aiProvider === 'groq') return 'gsk_... (Groq Console API Key)';
    if (settings.aiProvider === 'gemini') return 'AIzaSy... (Google AI Studio key)';
    if (settings.aiProvider === 'anthropic') return 'sk-ant-... (Anthropic Claude key)';
    return 'sk-... (OpenAI key)';
  };

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>SETTINGS</Text>

        {/* AI Provider Switcher */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>SELECT AI PROVIDER</Text>
          <View style={styles.providerRow}>
            <TouchableOpacity
              style={[styles.providerTab, settings.aiProvider === 'openrouter' && styles.providerTabActiveOpenRouter]}
              onPress={() => handleSelectProvider('openrouter')}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerTabText, settings.aiProvider === 'openrouter' && styles.providerTabTextActive]}>
                OpenRouter
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.providerTab, settings.aiProvider === 'gemini' && styles.providerTabActive]}
              onPress={() => handleSelectProvider('gemini')}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerTabText, settings.aiProvider === 'gemini' && styles.providerTabTextActive]}>
                Gemini
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.providerTab, settings.aiProvider === 'groq' && styles.providerTabActiveGroq]}
              onPress={() => handleSelectProvider('groq')}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerTabText, settings.aiProvider === 'groq' && styles.providerTabTextActive]}>
                Groq
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.providerTab, settings.aiProvider === 'openai' && styles.providerTabActive]}
              onPress={() => handleSelectProvider('openai')}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerTabText, settings.aiProvider === 'openai' && styles.providerTabTextActive]}>
                OpenAI
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.providerTab, settings.aiProvider === 'anthropic' && styles.providerTabActive]}
              onPress={() => handleSelectProvider('anthropic')}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerTabText, settings.aiProvider === 'anthropic' && styles.providerTabTextActive]}>
                Claude
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.providerTab, settings.aiProvider === 'ondevice' && styles.providerTabActiveOnDevice]}
              onPress={() => handleSelectProvider('ondevice')}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerTabText, settings.aiProvider === 'ondevice' && styles.providerTabTextActive]}>
                📱 On-Device (GGUF)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Conditional On-Device Model Downloader OR API Key Input */}
          {settings.aiProvider === 'ondevice' ? (
            <View style={styles.onDeviceModelCard}>
              <View style={styles.modelHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modelNameText}>Qwen2.5-Coder 1.5B (GGUF Q4)</Text>
                  <Text style={styles.modelDescText}>
                    100% offline standalone coding model. Runs directly on your phone NPU/GPU without internet.
                  </Text>
                </View>
                <View style={[styles.modelStatusBadge, modelStatus.isDownloaded ? styles.statusDownloaded : styles.statusNotDownloaded]}>
                  <Text style={[styles.modelStatusText, modelStatus.isDownloaded ? styles.statusTextDownloaded : styles.statusTextNotDownloaded]}>
                    {isDownloadingModel ? 'DOWNLOADING' : modelStatus.isDownloaded ? `READY (${modelStatus.sizeFormatted})` : 'NOT DOWNLOADED'}
                  </Text>
                </View>
              </View>

              {/* Real-time Download Progress Bar */}
              {isDownloadingModel && downloadProgress && (
                <View style={styles.downloadProgressWrap}>
                  <View style={styles.progressStatsRow}>
                    <Text style={styles.progressPercentText}>{downloadProgress.percent}%</Text>
                    <Text style={styles.progressMbText}>
                      {(downloadProgress.downloadedBytes / (1024 * 1024)).toFixed(1)} MB / {(downloadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                    {downloadProgress.speedMbPerSec !== undefined && (
                      <Text style={styles.progressSpeedText}>
                        {downloadProgress.speedMbPerSec} MB/s {downloadProgress.etaSeconds ? `(${downloadProgress.etaSeconds}s left)` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${downloadProgress.percent}%` }]} />
                  </View>
                </View>
              )}

              {/* Action Buttons for On-Device Model */}
              <View style={styles.onDeviceBtnRow}>
                {!modelStatus.isDownloaded && !isDownloadingModel && (
                  <TouchableOpacity style={styles.downloadModelBtn} onPress={handleDownloadModel} activeOpacity={0.85}>
                    <Text style={styles.downloadModelBtnText}>⬇ Download Qwen2.5-Coder (986 MB)</Text>
                  </TouchableOpacity>
                )}

                {isDownloadingModel && (
                  <TouchableOpacity style={styles.cancelDownloadBtn} onPress={handleCancelDownload} activeOpacity={0.85}>
                    <Text style={styles.cancelDownloadBtnText}>✕ Cancel Download</Text>
                  </TouchableOpacity>
                )}

                {modelStatus.isDownloaded && (
                  <>
                    <TouchableOpacity
                      style={styles.testOnDeviceBtn}
                      onPress={handleTestOnDevice}
                      disabled={isTestingOnDevice}
                      activeOpacity={0.85}
                    >
                      {isTestingOnDevice ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                          <Text style={styles.testOnDeviceBtnText}>Testing Inference...</Text>
                        </View>
                      ) : (
                        <Text style={styles.testOnDeviceBtnText}>⚡ Test Offline Inference</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteModelBtn} onPress={handleDeleteModel} activeOpacity={0.85}>
                      <Text style={styles.deleteModelBtnText}>🗑 Delete Model</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>
                {settings.aiProvider.toUpperCase()} API Key:
              </Text>
              <TextInput
                style={styles.input}
                value={apiKey}
                onChangeText={(text) => {
                  setApiKey(text);
                  if (testResult.status !== 'idle') setTestResult({ status: 'idle', message: '' });
                }}
                secureTextEntry
                placeholder={getPlaceholder()}
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.testBtn} onPress={handleTestKey} disabled={testing} activeOpacity={0.8}>
                  {testing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#0284c7" style={{ marginRight: 6 }} />
                      <Text style={styles.testBtnText}>Testing API...</Text>
                    </View>
                  ) : (
                    <Text style={styles.testBtnText}>Test & Verify Key</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveKey} activeOpacity={0.85}>
                  <Text style={styles.saveBtnText}>Save Key</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Live Diagnostic Card */}
          {testResult.status === 'success' && (
            <View style={styles.testSuccessCard}>
              <View style={styles.testHeaderRow}>
                <CheckCircleIcon size={16} color="#16a34a" style={{ marginRight: 6 }} />
                <Text style={styles.testSuccessTitle}>AI VERIFIED & WORKING</Text>
              </View>
              <Text style={styles.testSuccessSub}>
                Model: <Text style={{ fontWeight: 'bold', color: '#15803d' }}>{testResult.model}</Text> • Latency: <Text style={{ fontWeight: 'bold' }}>{testResult.latency}ms</Text>
              </Text>
              <Text style={styles.testSuccessMsg}>{testResult.message}</Text>
            </View>
          )}

          {testResult.status === 'error' && (
            <View style={styles.testErrorCard}>
              <View style={styles.testHeaderRow}>
                <BugIcon size={16} color="#dc2626" style={{ marginRight: 6 }} />
                <Text style={styles.testErrorTitle}>AI TEST FAILED</Text>
              </View>
              <Text style={styles.testErrorMsg}>{testResult.message}</Text>
            </View>
          )}

          <View style={styles.freeTipBox}>
            <SparklesIcon size={13} color="#15803d" style={{ marginRight: 6 }} />
            <Text style={styles.freeTipText}>
              {settings.aiProvider === 'ondevice'
                ? 'Tip: On-Device AI runs 100% locally on your phone without WiFi or cellular data. Works in Airplane Mode!'
                : settings.aiProvider === 'openrouter'
                ? 'Tip: Get an OpenRouter API key at openrouter.ai to unlock DeepSeek R1, Claude 3.5 Sonnet, GPT-4o & all models with 1 key!'
                : settings.aiProvider === 'groq'
                ? 'Tip: Get a free Groq API key at console.groq.com for 500+ tokens/sec LPU speeds!'
                : 'Tip: Get a free Google Gemini key at aistudio.google.com for live AI reasoning!'}
            </Text>
          </View>
        </View>

        {/* Privacy Guarantee */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>PRIVACY & ARCHITECTURE</Text>
          <Text style={styles.infoText}>✓ Zero DevQR Cloud Backend</Text>
          <Text style={styles.infoText}>✓ Secret Sanitization Enforced</Text>
          <Text style={styles.infoText}>✓ SQLite Local Device Storage</Text>
          <Text style={styles.infoText}>✓ Direct Device-to-AI Provider REST API</Text>
        </View>

        {/* Storage Management */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>STORAGE</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearPrompt} activeOpacity={0.8}>
            <Text style={styles.dangerBtnText}>Clear Local SQLite Sessions</Text>
          </TouchableOpacity>
        </View>

        {/* Brand Footer */}
        <View style={styles.brandCard}>
          <DevQRLogo variant="horizontal" size={38} />
          <Text style={styles.brandTagline}>Zero DevQR backend. Your debugging session belongs to you.</Text>
          <Text style={styles.brandVersion}>DevQR Mobile v1.0.0 (Production Build)</Text>
        </View>
      </ScrollView>

      <BottomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        actionText={alertState.actionText}
        onAction={alertState.onAction}
        onClose={() => setAlertState({ ...alertState, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 50 },
  headerTitle: { color: '#0f172a', fontSize: 24, fontWeight: '800', marginBottom: 20 },

  card: { backgroundColor: '#ffffff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  cardHeader: { color: '#0284c7', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 14 },

  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  providerTab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', backgroundColor: '#f1f5f9' },
  providerTabActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  providerTabActiveGroq: { backgroundColor: '#f97316', borderColor: '#ea580c' },
  providerTabActiveOpenRouter: { backgroundColor: '#6366f1', borderColor: '#4f46e5' },
  providerTabActiveOnDevice: { backgroundColor: '#0d9488', borderColor: '#0f766e' },
  providerTabText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  providerTabTextActive: { color: '#ffffff' },

  // On-Device GGUF Model Downloader Card Styles
  onDeviceModelCard: { backgroundColor: '#f0fdfa', borderWidth: 1.5, borderColor: '#99f6e4', borderRadius: 14, padding: 14, marginBottom: 14 },
  modelHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  modelNameText: { color: '#115e59', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  modelDescText: { color: '#134e4a', fontSize: 11, lineHeight: 15 },
  modelStatusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1 },
  modelStatusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statusDownloaded: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  statusTextDownloaded: { color: '#166534' },
  statusNotDownloaded: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  statusTextNotDownloaded: { color: '#64748b' },

  downloadProgressWrap: { marginTop: 8, marginBottom: 12, backgroundColor: '#ffffff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ccfbf1' },
  progressStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressPercentText: { color: '#0d9488', fontSize: 12, fontWeight: '800' },
  progressMbText: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  progressSpeedText: { color: '#0f766e', fontSize: 10, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#0d9488', borderRadius: 4 },

  onDeviceBtnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  downloadModelBtn: { flex: 1, backgroundColor: '#0d9488', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  downloadModelBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  cancelDownloadBtn: { flex: 1, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelDownloadBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '800' },
  testOnDeviceBtn: { flex: 1.4, backgroundColor: '#0d9488', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  testOnDeviceBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  deleteModelBtn: { flex: 0.9, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deleteModelBtnText: { color: '#dc2626', fontSize: 11, fontWeight: '800' },

  label: { color: '#0f172a', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, color: '#0f172a', fontSize: 13, marginBottom: 12 },

  testSuccessCard: { backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#86efac', borderRadius: 12, padding: 12, marginBottom: 14 },
  testHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  testSuccessTitle: { color: '#166534', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  testSuccessSub: { color: '#334155', fontSize: 12, marginBottom: 4 },
  testSuccessMsg: { color: '#15803d', fontSize: 11, lineHeight: 16 },

  testErrorCard: { backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 12, padding: 12, marginBottom: 14 },
  testErrorTitle: { color: '#991b1b', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  testErrorMsg: { color: '#dc2626', fontSize: 12, lineHeight: 17, marginTop: 2 },

  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  testBtn: { flex: 1.2, backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#bae6fd', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  testBtnText: { color: '#0369a1', fontSize: 12, fontWeight: '800' },
  saveBtn: { flex: 0.8, backgroundColor: '#0284c7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },

  freeTipBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 10, borderRadius: 10 },
  freeTipText: { color: '#166534', fontSize: 11, flex: 1, lineHeight: 16 },

  infoText: { color: '#334155', fontSize: 13, marginVertical: 4, fontWeight: '500' },
  dangerBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  dangerBtnText: { color: '#dc2626', fontSize: 13, fontWeight: 'bold' },

  brandCard: { marginTop: 10, marginBottom: 20, alignItems: 'center', backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  brandTagline: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  brandVersion: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginTop: 8 }
});
