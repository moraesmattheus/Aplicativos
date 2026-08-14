// Tela de Visualização de Logs Internos.
// Permite debugar o app direto no dispositivo.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { clearLogs, getLogs, LogEntry, subscribeLogs } from '@/services/logger';

export default function LogsScreen() {
  const c = useTheme();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>(getLogs());

  useEffect(() => {
    return subscribeLogs(setLogs);
  }, []);

  const exportar = async () => {
    const texto = logs
      .map((l) => `[${l.timestamp}] ${l.level.toUpperCase()}: ${l.message}`)
      .join('\n');
    await Share.share({ message: texto, title: 'Logs Radar de Vagas' });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <SectionTitle>📋 Console de Logs</SectionTitle>
        <View style={styles.headerRight}>
          <Pressable onPress={clearLogs} hitSlop={6}>
            <Ionicons name="trash-outline" size={22} color={c.danger} />
          </Pressable>
          <Pressable onPress={exportar} hitSlop={6} style={{ marginLeft: 12 }}>
            <Ionicons name="share-outline" size={22} color={c.tint} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <LogItem entry={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: c.textSecondary }}>Nenhum log capturado ainda.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function LogItem({ entry }: { entry: LogEntry }) {
  const c = useTheme();
  const color =
    entry.level === 'error' ? c.danger : entry.level === 'warn' ? c.warning : c.text;

  return (
    <View style={[styles.item, { borderBottomColor: c.border }]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.timestamp, { color: c.textSecondary }]}>{entry.timestamp}</Text>
        <Text style={[styles.level, { color, fontWeight: 'bold' }]}>{entry.level.toUpperCase()}</Text>
      </View>
      <Text style={[styles.message, { color }]}>{entry.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  empty: { marginTop: 40, alignItems: 'center' },
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  itemHeader: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  timestamp: { fontSize: 11, fontFamily: 'monospace' },
  level: { fontSize: 11 },
  message: { fontSize: 13, lineHeight: 18, fontFamily: 'monospace' },
});
