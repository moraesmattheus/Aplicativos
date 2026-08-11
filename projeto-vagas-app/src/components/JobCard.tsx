// Card de vaga usado no feed (Vagas) e no Dashboard.
// Implementa a "candidatura assistida": abre a vaga no navegador e registra no Kanban.

import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Bar, Card, Chip, Muted, ScoreBadge } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/store/AppStore';
import { JobMatch, priorityFor } from '@/types';

export function JobCard({ match }: { match: JobMatch }) {
  const c = useTheme();
  const { addApplication, isSaved, applications } = useApp();
  const [expanded, setExpanded] = useState(false);

  const prio = priorityFor(match.compatibilidade);
  const saved = isSaved(match.id);
  const savedStage = applications.find((a) => a.id === match.id)?.stage;

  const abrirVaga = async () => {
    try {
      await WebBrowser.openBrowserAsync(match.link);
    } catch {
      // link inválido — ignora
    }
  };

  const candidatar = async () => {
    // Modo assistido: abre a vaga para o usuário revisar e enviar, e registra no Kanban.
    await abrirVaga();
    if (!saved) await addApplication(match, match.compatibilidade, 'Aplicado');
  };

  const salvar = async () => {
    if (!saved) await addApplication(match, match.compatibilidade, 'Salvas');
  };

  return (
    <Card style={styles.card}>
      <Pressable onPress={() => setExpanded((e) => !e)}>
        <View style={styles.header}>
          <ScoreBadge score={match.compatibilidade} color={prio.color} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
              {match.titulo}
            </Text>
            <Muted>{match.empresa}</Muted>
            <View style={styles.metaRow}>
              <Ionicons
                name={match.modalidade === 'Remoto' ? 'globe-outline' : 'location-outline'}
                size={13}
                color={c.textSecondary}
              />
              <Muted style={styles.metaText}>
                {match.local} · {match.modalidade}
              </Muted>
            </View>
          </View>
        </View>

        <View style={[styles.prioRow, { borderColor: c.border }]}>
          <Text style={[styles.prioText, { color: prio.color }]}>
            {prio.emoji} {prio.label}
          </Text>
          <Muted style={styles.source}>via {match.source}</Muted>
        </View>
      </Pressable>

      {/* skills compatíveis / faltantes */}
      {(match.requisitosCompativeis.length > 0 || match.requisitosFaltantes.length > 0) && (
        <View style={styles.chips}>
          {match.requisitosCompativeis.slice(0, 6).map((r) => (
            <Chip key={`ok-${r}`} label={r} tone="ok" />
          ))}
          {expanded &&
            match.requisitosFaltantes.slice(0, 6).map((r) => (
              <Chip key={`miss-${r}`} label={r} tone="miss" />
            ))}
        </View>
      )}

      {expanded && (
        <View style={styles.details}>
          <Breakdown label="Skills" value={match.breakdown.skills} />
          <Breakdown label="Cargo" value={match.breakdown.cargo} />
          <Breakdown label="Senioridade" value={match.breakdown.senioridade} />
          <Breakdown label="Localização" value={match.breakdown.localizacao} />
          {!!match.salario && (
            <Muted style={styles.salario}>💰 {match.salario}</Muted>
          )}
          {!!match.descricao && (
            <Text style={[styles.desc, { color: c.textSecondary }]} numberOfLines={6}>
              {match.descricao}
            </Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={candidatar}
          style={[styles.btn, styles.btnPrimary, { backgroundColor: c.tint }]}>
          <Ionicons name="paper-plane-outline" size={16} color="#fff" />
          <Text style={styles.btnPrimaryText}>
            {saved && savedStage !== 'Salvas' ? 'Reabrir vaga' : 'Candidatar (assistido)'}
          </Text>
        </Pressable>
        <Pressable
          onPress={salvar}
          style={[styles.btn, styles.btnGhost, { borderColor: c.border }]}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={saved ? c.tint : c.textSecondary}
          />
          <Text style={[styles.btnGhostText, { color: c.textSecondary }]}>
            {saved ? savedStage : 'Salvar'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  const c = useTheme();
  return (
    <View style={styles.bd}>
      <Text style={[styles.bdLabel, { color: c.textSecondary }]}>{label}</Text>
      <Bar value={value} />
      <Text style={[styles.bdVal, { color: c.text }]}>{value}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, gap: 10 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12 },
  prioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  prioText: { fontSize: 13, fontWeight: '700' },
  source: { fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  details: { gap: 8, marginTop: 2 },
  bd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bdLabel: { fontSize: 12, width: 84 },
  bdVal: { fontSize: 12, fontWeight: '700', width: 38, textAlign: 'right' },
  salario: { marginTop: 4 },
  desc: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  btnPrimary: { flex: 1 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: { paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
  btnGhostText: { fontWeight: '600', fontSize: 13 },
});
