import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  SparklesIcon,
  CameraIcon,
  CloudIcon,
  CheckCircleIcon,
  ServerIcon,
  FolderIcon,
  SettingsIcon,
  ChevronRightIcon,
  ChipIcon,
  TerminalIcon
} from '../src/components/SvgIcons';
import { CreateFileModal } from '../src/components/CreateFileModal';
import { SQLiteSessionStorage } from '../src/services/sqliteStorage';
import { MobileSecureStore } from '../src/services/secureStore';
import { StoredSession } from '../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [provider, setProvider] = useState('openai');
  const [createFileModalVisible, setCreateFileModalVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      const settings = await MobileSecureStore.getSettings();
      if (!settings.onboardingCompleted) {
        router.replace('/onboarding');
        return;
      }
      setProvider(settings.aiProvider);
      const list = await SQLiteSessionStorage.getSessions();
      setSessions(list);
    };
    load();
  }, []);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeWrapper}>
          <SparklesIcon size={12} color="#0284c7" style={{ marginRight: 4 }} />
          <Text style={styles.badge}>PORTABLE AI DEBUGGING</Text>
        </View>
        <Text style={styles.title}>Dev<Text style={styles.titleHighlight}>QR</Text></Text>
        <Text style={styles.subtitle}>Laptop Errors. Phone Intelligence.</Text>
      </View>

      {/* AI Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusLabel}>AI ENGINE</Text>
          <View style={styles.providerBadgeWrapper}>
            <CloudIcon size={12} color="#0284c7" style={{ marginRight: 4 }} />
            <Text style={styles.providerBadge}>CLOUD AI ({provider.toUpperCase()})</Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <CheckCircleIcon size={14} color="#16a34a" style={{ marginRight: 4 }} />
            <Text style={styles.statusText}>Status: <Text style={styles.greenText}>READY</Text></Text>
          </View>
          <View style={styles.statusItem}>
            <ServerIcon size={14} color="#0284c7" style={{ marginRight: 4 }} />
            <Text style={styles.statusText}>Storage: <Text style={styles.cyanText}>SQLite Local</Text></Text>
          </View>
        </View>
      </View>

      {/* Primary Action Button */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push('/scanner')}
        activeOpacity={0.85}
      >
        <View style={styles.iconCircle}>
          <CameraIcon size={22} color="#ffffff" />
        </View>
        <View style={styles.primaryButtonContent}>
          <Text style={styles.primaryButtonText}>SCAN DEBUG SESSION</Text>
          <Text style={styles.primaryButtonSub}>Point camera at DevQR CLI terminal</Text>
        </View>
        <ChevronRightIcon size={18} color="#bae6fd" />
      </TouchableOpacity>

      {/* Navigation shortcuts */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/arch')} activeOpacity={0.8}>
          <ChipIcon size={15} color="#0284c7" style={{ marginRight: 6 }} />
          <Text style={styles.secondaryButtonText}>Architecture</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/sessions')} activeOpacity={0.8}>
          <FolderIcon size={15} color="#0284c7" style={{ marginRight: 6 }} />
          <Text style={styles.secondaryButtonText}>Sessions ({sessions.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/settings')} activeOpacity={0.8}>
          <SettingsIcon size={15} color="#0284c7" style={{ marginRight: 6 }} />
          <Text style={styles.secondaryButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Direct Workspace File Generator Tool */}
      <TouchableOpacity
        style={styles.createFileBanner}
        onPress={() => setCreateFileModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.createFileIconWrap}>
          <TerminalIcon size={20} color="#0284c7" />
        </View>
        <View style={styles.createFileContent}>
          <View style={styles.createFileTitleRow}>
            <Text style={styles.createFileTitle}>Create File & Push to IDE</Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>LIVE LAN</Text>
            </View>
          </View>
          <Text style={styles.createFileSub}>Generate full code file with AI & open in VS Code</Text>
        </View>
        <ChevronRightIcon size={16} color="#0284c7" />
      </TouchableOpacity>

      {/* Live Terminal REPL Quick Card */}
      <TouchableOpacity
        style={styles.terminalCard}
        onPress={() => router.push('/terminal')}
        activeOpacity={0.85}
      >
        <View style={styles.terminalIconWrap}>
          <TerminalIcon size={20} color="#38bdf8" />
        </View>
        <View style={styles.createFileContent}>
          <View style={styles.createFileTitleRow}>
            <Text style={styles.createFileTitle}>Live Terminal REPL</Text>
            <View style={styles.termBadge}>
              <Text style={styles.termBadgeText}>STREAMING</Text>
            </View>
          </View>
          <Text style={styles.createFileSub}>Stream laptop terminal & run interactive CLI tests</Text>
        </View>
        <ChevronRightIcon size={16} color="#38bdf8" />
      </TouchableOpacity>

      {/* Recent Sessions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <CameraIcon size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>No recent debugging sessions</Text>
            <Text style={styles.emptySub}>Run 'devqr' in your laptop terminal and scan QR code</Text>
          </View>
        ) : (
          sessions.slice(0, 5).map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.sessionItem}
              onPress={() => router.push({ pathname: '/result', params: { sessionId: item.id } })}
              activeOpacity={0.7}
            >
              <View style={styles.sessionHeaderRow}>
                <Text style={styles.sessionTitle}>{item.bundle.project?.name || 'Project'}</Text>
                <Text style={styles.sessionIdBadge}>{item.id}</Text>
              </View>
              <Text style={styles.sessionError} numberOfLines={2}>{item.bundle.error?.message}</Text>
              <View style={styles.sessionFooterRow}>
                <Text style={styles.sessionMeta}>{item.bundle.environment?.platform}</Text>
                <Text style={styles.sessionMeta}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>

    <CreateFileModal
      visible={createFileModalVisible}
      onClose={() => setCreateFileModalVisible(false)}
      bridgeUrl={sessions?.[0]?.bundle?.bridgeUrl || 'http://127.0.0.1:9222'}
      projectContext={sessions?.[0]?.bundle?.project?.name ? `Project: ${sessions[0].bundle.project.name} (${sessions[0].bundle.project.framework})` : ''}
    />
  </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingTop: 50 },
  header: { marginBottom: 22 },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  badge: { color: '#0284c7', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 },
  title: { fontSize: 34, fontWeight: '800', color: '#0f172a' },
  titleHighlight: { color: '#0284c7' },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 4, fontWeight: '500' },

  statusCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  statusLabel: { color: '#64748b', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  providerBadgeWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  providerBadge: { color: '#0284c7', fontSize: 11, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusItem: { flexDirection: 'row', alignItems: 'center' },
  statusText: { color: '#475569', fontSize: 12 },
  greenText: { color: '#16a34a', fontWeight: 'bold' },
  cyanText: { color: '#0284c7', fontWeight: 'bold' },

  primaryButton: { backgroundColor: '#0284c7', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 14, shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  primaryButtonContent: { flex: 1 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  primaryButtonSub: { color: '#e0f2fe', fontSize: 12, marginTop: 2 },

  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  secondaryButton: { flex: 1, flexDirection: 'row', backgroundColor: '#ffffff', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  secondaryButtonText: { color: '#1e293b', fontSize: 13, fontWeight: '700' },

  createFileBanner: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  createFileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createFileContent: {
    flex: 1,
  },
  createFileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  createFileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  newBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  newBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  createFileSub: {
    fontSize: 12,
    color: '#64748b',
  },
  terminalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  terminalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  termBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  termBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  section: { marginTop: 6 },
  sectionTitle: { color: '#64748b', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.8, marginBottom: 12 },
  emptyCard: { padding: 30, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyText: { color: '#334155', fontSize: 14, fontWeight: 'bold' },
  emptySub: { color: '#94a3b8', fontSize: 12, marginTop: 6, textAlign: 'center' },

  sessionItem: { backgroundColor: '#ffffff', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  sessionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sessionTitle: { color: '#0f172a', fontSize: 14, fontWeight: 'bold' },
  sessionIdBadge: { color: '#64748b', fontSize: 10, fontWeight: '600', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sessionError: { color: '#dc2626', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  sessionFooterRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sessionMeta: { color: '#94a3b8', fontSize: 11, fontWeight: '500' }
});
