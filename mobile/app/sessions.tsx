import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SQLiteSessionStorage } from '../src/services/sqliteStorage';
import { StoredSession } from '../src/types';

export default function SessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    const load = async () => {
      const list = await SQLiteSessionStorage.getSessions();
      setSessions(list);
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>DEBUG SESSIONS</Text>
      <Text style={styles.headerSub}>Stored in local SQLite on this device ({sessions.length} sessions)</Text>

      {sessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No saved sessions</Text>
          <Text style={styles.emptySub}>Scan a QR code from the DevQR CLI to see sessions here.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/result', params: { sessionId: item.id } })}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardProject}>{item.bundle.project?.name || 'Project'}</Text>
                <Text style={styles.cardPlatform}>{item.bundle.environment?.platform}</Text>
              </View>
              <Text style={styles.cardError} numberOfLines={2}>{item.bundle.error?.message}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardId}>{item.id}</Text>
                <Text style={styles.cardTime}>
                  {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  headerTitle: { color: '#0f172a', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: '#64748b', fontSize: 13, marginBottom: 18, marginTop: 4 },
  list: { paddingBottom: 30 },
  card: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  cardProject: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  cardPlatform: { color: '#0284c7', fontSize: 11, fontWeight: '700', backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cardError: { color: '#dc2626', fontSize: 12, marginBottom: 10, lineHeight: 17 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  cardTime: { color: '#94a3b8', fontSize: 11 },
  emptyCard: { padding: 30, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', marginTop: 20 },
  emptyText: { color: '#334155', fontSize: 14, fontWeight: 'bold' },
  emptySub: { color: '#94a3b8', fontSize: 12, marginTop: 6, textAlign: 'center' }
});
