import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheckIcon, BugIcon, ChipIcon, ServerIcon, TerminalIcon } from '../src/components/SvgIcons';
import { DebugBundle } from '../src/types';

export default function ContextViewerScreen() {
  const router = useRouter();
  const { bundleJson } = useLocalSearchParams<{ bundleJson: string }>();
  const bundle: DebugBundle = bundleJson ? JSON.parse(bundleJson) : null;

  if (!bundle) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>CONTEXT INSPECTOR</Text>
        <View style={styles.badgeWrapper}>
          <ShieldCheckIcon size={13} color="#166534" style={{ marginRight: 4 }} />
          <Text style={styles.badge}>Sanitized Context</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <BugIcon size={14} color="#0284c7" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>ERROR</Text>
        </View>
        <Text style={styles.codeBox}>{bundle.error?.message}</Text>
      </View>

      {bundle.error?.stackTrace && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <TerminalIcon size={14} color="#0284c7" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>STACK TRACE</Text>
          </View>
          <Text style={styles.codeBox}>{bundle.error.stackTrace}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <ChipIcon size={14} color="#0284c7" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>ENVIRONMENT</Text>
        </View>
        <Text style={styles.codeBox}>
          Platform: {bundle.environment?.platform}{'\n'}
          OS: {bundle.environment?.os}{'\n'}
          Node: v{bundle.environment?.node || '22'}
        </Text>
      </View>

      {bundle.dependencies && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <ServerIcon size={14} color="#0284c7" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>DEPENDENCIES</Text>
          </View>
          <Text style={styles.codeBox}>{JSON.stringify(bundle.dependencies, null, 2)}</Text>
        </View>
      )}

      {bundle.relevantFiles && bundle.relevantFiles.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <TerminalIcon size={14} color="#0284c7" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>RELEVANT CODE</Text>
          </View>
          {bundle.relevantFiles.map((f, i) => (
            <View key={i} style={styles.fileCard}>
              <Text style={styles.fileName}>{f.filePath}</Text>
              <Text style={styles.codeBox}>{f.content}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.85}>
        <Text style={styles.closeBtnText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  badge: { color: '#166534', fontSize: 11, fontWeight: '700' },

  section: { marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { color: '#0284c7', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  codeBox: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, color: '#f8fafc', fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
  fileCard: { marginBottom: 12 },
  fileName: { color: '#0284c7', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },

  closeBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  closeBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});
