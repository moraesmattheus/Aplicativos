// Kanban das candidaturas — uma coluna por etapa do processo.

import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/store/AppStore';
import { Application, KANBAN_STAGES, KanbanStage, priorityFor, STAGE_META } from '@/types';

export default function KanbanScreen() {
  const c = useTheme();
  const { applications, moveApplication, removeApplication } = useApp();

  const move = (app: Application, dir: -1 | 1) => {
    const idx = KANBAN_STAGES.indexOf(app.stage);
    const next = KANBAN_STAGES[idx + dir];
    if (next) moveApplication(app.id, next);
  };

  const confirmRemove = (app: Application) => {
    Alert.alert('Remover candidatura?', app.job.titulo, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeApplication(app.id) },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <SectionTitle>📋 Kanban</SectionTitle>
        <Muted>{applications.length} candidatura(s) no funil</Muted>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
        {KANBAN_STAGES.map((stage) => {
          const items = applications.filter((a) => a.stage === stage);
          const meta = STAGE_META[stage];
          return (
            <View key={stage} style={[styles.column, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
              <View style={styles.colHeader}>
                <Text style={[styles.colTitle, { color: c.text }]}>
                  {meta.emoji} {meta.label}
                </Text>
                <View style={[styles.count, { backgroundColor: meta.color }]}>
                  <Text style={styles.countText}>{items.length}</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.colBody}>
                {items.length === 0 && <Muted style={styles.emptyCol}>—</Muted>}
                {items.map((app) => (
                  <KanbanCard
                    key={app.id}
                    app={app}
                    onPrev={() => move(app, -1)}
                    onNext={() => move(app, 1)}
                    onRemove={() => confirmRemove(app)}
                    canPrev={KANBAN_STAGES.indexOf(app.stage) > 0}
                    canNext={KANBAN_STAGES.indexOf(app.stage) < KANBAN_STAGES.length - 1}
                  />
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function KanbanCard({
  app,
  onPrev,
  onNext,
  onRemove,
  canPrev,
  canNext,
}: {
  app: Application;
  onPrev: () => void;
  onNext: () => void;
  onRemove: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const c = useTheme();
  const prio = priorityFor(app.match);
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.cardScore, { color: prio.color }]}>{app.match}%</Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={15} color={c.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
        {app.job.titulo}
      </Text>
      <Muted numberOfLines={1}>{app.job.empresa}</Muted>
      <Muted style={styles.cardMeta} numberOfLines={1}>
        {app.job.modalidade} · {app.job.local}
      </Muted>

      <View style={styles.cardActions}>
        <Pressable onPress={onPrev} disabled={!canPrev} style={styles.moveBtn} hitSlop={6}>
          <Ionicons name="chevron-back" size={18} color={canPrev ? c.tint : c.border} />
        </Pressable>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(app.job.link)} hitSlop={6}>
          <Ionicons name="open-outline" size={17} color={c.textSecondary} />
        </Pressable>
        <Pressable onPress={onNext} disabled={!canNext} style={styles.moveBtn} hitSlop={6}>
          <Ionicons name="chevron-forward" size={18} color={canNext ? c.tint : c.border} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  board: { paddingHorizontal: 12, paddingBottom: 16, gap: 12 },
  column: {
    width: 250,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    maxHeight: '100%',
  },
  colHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  colTitle: { fontSize: 14, fontWeight: '700' },
  count: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  colBody: { gap: 10, paddingBottom: 8 },
  emptyCol: { textAlign: 'center', paddingVertical: 16 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardScore: { fontSize: 15, fontWeight: '800' },
  cardTitle: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  cardMeta: { fontSize: 11 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  moveBtn: { padding: 2 },
});
