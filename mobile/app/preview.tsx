import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SparklesIcon,
  EyeIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  BugIcon,
  FlashIcon
} from '../src/components/SvgIcons';
import { QRDecoder } from '../src/services/qrDecoder';
import { DebugBundle } from '../src/types';

export default function PreviewScreen() {
  const router = useRouter();
  const { payload, bundleJson: passedBundleJson } = useLocalSearchParams<{ payload?: string; bundleJson?: string }>();
  const [bundle, setBundle] = useState<DebugBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeConnected, setBridgeConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (passedBundleJson) {
      try {
        const parsed = JSON.parse(passedBundleJson);
        setBundle(parsed);
      } catch (e) {
        setError('Failed to parse bundle JSON.');
      }
      return;
    }

    if (payload) {
      const decoded = QRDecoder.decode(payload);
      if (decoded.bundle) {
        setBundle(decoded.bundle as DebugBundle);
      } else {
        setError(decoded.error || 'Failed to decode QR code');
      }
    }
  }, [payload, passedBundleJson]);

  // Ping the laptop bridge to verify LAN connection and fetch live full source file
  useEffect(() => {
    if (bundle?.bridgeUrl) {
      const checkBridge = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`${bundle.bridgeUrl}/api/ping`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            setBridgeConnected(true);
            // Fetch 100% full live source file from laptop disk
            if (bundle.relevantFiles?.[0]?.filePath) {
              try {
                const fileRes = await fetch(`${bundle.bridgeUrl}/api/file?path=${encodeURIComponent(bundle.relevantFiles[0].filePath)}`);
                if (fileRes.ok) {
                  const fileJson = await fileRes.json();
                  if (fileJson.content) {
                    setBundle(prev => prev ? ({
                      ...prev,
                      relevantFiles: [{ ...prev.relevantFiles![0], content: fileJson.content }]
                    }) : prev);
                  }
                }
              } catch {}
            }
          } else {
            setBridgeConnected(false);
          }
        } catch {
          setBridgeConnected(false);
        }
      };
      checkBridge();
    }
  }, [bundle?.bridgeUrl]);

  if (error) {
    return (
      <View style={styles.center}>
        <BugIcon size={36} color="#dc2626" style={{ marginBottom: 12 }} />
        <Text style={styles.errorTitle}>DECODE ERROR</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/scanner')}>
          <Text style={styles.backBtnText}>TRY AGAIN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!bundle) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Reading Debug Session...</Text>
      </View>
    );
  }

  const bundleJson = JSON.stringify(bundle);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.badgeWrapper}>
        <SparklesIcon size={12} color="#0284c7" style={{ marginRight: 4 }} />
        <Text style={styles.sessionHeader}>SESSION PREVIEW</Text>
      </View>
      <Text style={styles.projectName}>{bundle.project?.name || 'Debug Session'}</Text>

      {/* Real-time LAN Bridge Status Card */}
      {bundle.bridgeUrl ? (
        <View style={styles.bridgeCardActive}>
          <View style={styles.bridgeHeaderRow}>
            <View style={styles.bridgeTitleWrap}>
              <View style={[styles.statusDot, { backgroundColor: bridgeConnected === true ? '#16a34a' : '#0284c7' }]} />
              <Text style={styles.bridgeTitleActive}>
                {bridgeConnected === true ? 'LAN BRIDGE VERIFIED & CONNECTED' : 'DIRECT LAN BRIDGE ACTIVE'}
              </Text>
            </View>
            <View style={styles.autoFixTag}>
              <FlashIcon size={12} color="#16a34a" style={{ marginRight: 3 }} />
              <Text style={styles.autoFixTagText}>1-Click Fix Ready</Text>
            </View>
          </View>
          <Text style={styles.bridgeEndpoint}>{bundle.bridgeUrl}</Text>
          <Text style={styles.bridgeSub}>
            {bridgeConnected === true
              ? '✓ Live connection confirmed with laptop! 1-Click Auto-Fix will patch your code in real time.'
              : 'Laptop & Phone paired over Wi-Fi. Fixes will auto-apply in real time.'}
          </Text>
        </View>
      ) : (
        <View style={styles.bridgeCardOffline}>
          <Text style={styles.bridgeTitleOffline}>OFFLINE QR MODE</Text>
          <Text style={styles.bridgeSub}>
            No direct bridge IP. Fixes can be applied via manual payload.
          </Text>
        </View>
      )}

      {/* Metadata */}
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.metaKey}>Language</Text>
          <Text style={styles.metaVal}>{bundle.project?.language || 'JavaScript'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaKey}>Framework</Text>
          <Text style={styles.metaVal}>{bundle.project?.framework || 'Node.js'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaKey}>Runtime</Text>
          <Text style={styles.metaVal}>{bundle.environment?.runtime || bundle.environment?.platform || 'Windows'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaKey}>Source File</Text>
          <Text style={styles.metaValPrimary}>{bundle.relevantFiles?.[0]?.filePath || 'None'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaKey}>Session ID</Text>
          <Text style={styles.metaVal}>{bundle.sessionId}</Text>
        </View>
      </View>

      {/* Error */}
      <View style={styles.errorCard}>
        <View style={styles.errorHeaderRow}>
          <BugIcon size={14} color="#dc2626" style={{ marginRight: 6 }} />
          <Text style={styles.errorHeader}>CAPTURED ERROR</Text>
        </View>
        <Text style={styles.errorMessage}>{bundle.error?.message}</Text>
      </View>

      {/* Context checklist */}
      <View style={styles.contextCard}>
        <Text style={styles.cardTitle}>INCLUDED CONTEXT</Text>
        <View style={styles.checkItemRow}>
          <CheckCircleIcon size={16} color="#16a34a" style={{ marginRight: 6 }} />
          <Text style={styles.checkItem}>Stack Trace ({bundle.error?.stackTrace ? 'Included' : 'None'})</Text>
        </View>
        <View style={styles.checkItemRow}>
          <CheckCircleIcon size={16} color="#16a34a" style={{ marginRight: 6 }} />
          <Text style={styles.checkItem}>Environment Metadata</Text>
        </View>
        <View style={styles.checkItemRow}>
          <CheckCircleIcon size={16} color="#16a34a" style={{ marginRight: 6 }} />
          <Text style={styles.checkItem}>
            Relevant Source ({bundle.relevantFiles?.[0]?.filePath ? `1 file attached: ${bundle.relevantFiles[0].filePath}` : 'None'})
          </Text>
        </View>
      </View>

      {/* Privacy Guarantee Note */}
      <View style={styles.privacyBanner}>
        <ShieldCheckIcon size={15} color="#065f46" style={{ marginRight: 6 }} />
        <Text style={styles.privacyText}>Sanitized on laptop. Zero DevQR cloud backend.</Text>
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={styles.viewContextBtn}
        onPress={() => router.push({ pathname: '/context-viewer', params: { bundleJson } })}
        activeOpacity={0.8}
      >
        <EyeIcon size={16} color="#0284c7" style={{ marginRight: 6 }} />
        <Text style={styles.viewContextText}>VIEW CONTEXT</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.analyzeBtn}
        onPress={() => router.push({ pathname: '/result', params: { bundleJson } })}
        activeOpacity={0.85}
      >
        <SparklesIcon size={18} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={styles.analyzeBtnText}>ANALYZE WITH AI</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { color: '#64748b', fontSize: 13, marginTop: 10 },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 6 },
  sessionHeader: { color: '#0284c7', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  projectName: { color: '#0f172a', fontSize: 24, fontWeight: '800', marginBottom: 14 },

  bridgeCardActive: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    marginBottom: 15,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  bridgeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  bridgeTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  bridgeTitleActive: { color: '#166534', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  autoFixTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  autoFixTagText: { color: '#166534', fontSize: 9, fontWeight: 'bold' },
  bridgeEndpoint: { color: '#0f172a', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 4 },
  bridgeSub: { color: '#15803d', fontSize: 11, lineHeight: 16 },

  bridgeCardOffline: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 15
  },
  bridgeTitleOffline: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },

  card: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  metaKey: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  metaVal: { color: '#0f172a', fontSize: 13, fontWeight: '700' },
  metaValPrimary: { color: '#0284c7', fontSize: 13, fontWeight: '700' },

  errorCard: { backgroundColor: '#fef2f2', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca', marginBottom: 12 },
  errorHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  errorHeader: { color: '#dc2626', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  errorMessage: { color: '#991b1b', fontSize: 13, fontFamily: 'monospace' },

  contextCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  cardTitle: { color: '#0f172a', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 },
  checkItemRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  checkItem: { color: '#334155', fontSize: 13 },

  privacyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 20 },
  privacyText: { color: '#065f46', fontSize: 11, fontWeight: '600', flex: 1 },

  viewContextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    marginBottom: 10
  },
  viewContextText: { color: '#0284c7', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4
  },
  analyzeBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  errorTitle: { color: '#dc2626', fontSize: 16, fontWeight: '800', marginTop: 10 },
  errorSub: { color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  backBtn: { marginTop: 16, backgroundColor: '#0284c7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 }
});
