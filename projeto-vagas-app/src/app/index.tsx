// Dashboard (tela inicial) — inspirado nas págs. 14-15 do fluxograma.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/store/AppStore';
import { priorityFor } from '@/types';

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function Dashboard() {
  const c = useTheme();
  const router = useRouter();
  const { profile, applications, settings } = useApp();

  const stats = useMemo(() => {
    const candidaturas = applications.filter((a) => a.stage !== 'Salvas');
    const entrevistas = applications.filter((a) => a.stage === 'Entrevista');
    const ofertas = applications.filter((a) => a.stage === 'Proposta');
    const salvas = applications.filter((a) => a.stage === 'Salvas');
    const matchMedio =
      applications.length > 0
        ? Math.round(applications.reduce((s, a) => s + a.match, 0) / applications.length)
        : 0;
    const taxa = candidaturas.length > 0 ? Math.round((entrevistas.length / candidaturas.length) * 100) : 0;
    return {
      candidaturas: candidaturas.length,
      entrevistas: entrevistas.length,
      ofertas: ofertas.length,
      salvas: salvas.length,
      matchMedio,
      taxa,
    };
  }, [applications]);

  const followUps = useMemo(
    () =>
      applications.filter(
        (a) => ['Aplicado', 'Triagem'].includes(a.stage) && daysSince(a.updatedAt) >= settings.followUpDias,
      ),
    [applications, settings.followUpDias],
  );

  const entrevistasProximas = useMemo(
    () => applications.filter((a) => a.interviewAt && new Date(a.interviewAt).getTime() > Date.now()),
    [applications],
  );

  const melhores = useMemo(
    () => [...applications].sort((a, b) => b.match - a.match).slice(0, 3),
    [applications],
  );

  const primeiroNome = (profile.nome || '').split(' ')[0];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.hello, { color: c.text }]}>
          👋 Olá{primeiroNome ? `, ${primeiroNome}` : ''}
        </Text>
        <Muted>Seu radar de carreira</Muted>

        {/* stats */}
        <View style={styles.grid}>
          <Stat icon="briefcase-outline" label="Candidaturas" value={stats.candidaturas} />
          <Stat icon="bookmark-outline" label="Salvas" value={stats.salvas} />
          <Stat icon="mic-outline" label="Entrevistas" value={stats.entrevistas} tint />
          <Stat icon="trophy-outline" label="Ofertas" value={stats.ofertas} />
          <Stat icon="star-outline" label="Match médio" value={`${stats.matchMedio}%`} />
          <Stat icon="trending-up-outline" label="Taxa entrevista" value={`${stats.taxa}%`} />
        </View>

        {/* ações pendentes */}
        <SectionTitle style={styles.h2}>⚠️ Ações pendentes</SectionTitle>
        <Card>
          <Action
            text={`${followUps.length} candidatura(s) precisam de follow-up`}
            onPress={() => router.push('/kanban')}
          />
          <Action
            text={`${entrevistasProximas.length} entrevista(s) agendada(s)`}
            onPress={() => router.push('/agenda')}
          />
          <Action
            text="Buscar novas vagas com alto match"
            onPress={() => router.push('/vagas')}
            last
          />
        </Card>

        {/* melhores */}
        <SectionTitle style={styles.h2}>🔥 Suas melhores candidaturas</SectionTitle>
        {melhores.length === 0 ? (
          <Card>
            <Muted>Você ainda não salvou vagas.</Muted>
            <Pressable
              onPress={() => router.push('/vagas')}
              style={[styles.cta, { backgroundColor: c.tint }]}>
              <Ionicons name="search" size={16} color="#fff" />
              <Text style={styles.ctaText}>Buscar vagas agora</Text>
            </Pressable>
          </Card>
        ) : (
          melhores.map((a) => {
            const prio = priorityFor(a.match);
            return (
              <Card key={a.id} style={styles.best}>
                <Text style={[styles.bestScore, { color: prio.color }]}>{a.match}%</Text>
                <View style={styles.bestText}>
                  <Text style={[styles.bestTitle, { color: c.text }]} numberOfLines={1}>
                    {a.job.titulo}
                  </Text>
                  <Muted numberOfLines={1}>
                    {a.job.empresa} · {a.job.modalidade} · {a.stage}
                  </Muted>
                </View>
              </Card>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  icon,
  label,
  value,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tint?: boolean;
}) {
  const c = useTheme();
  return (
    <Card style={styles.stat}>
      <Ionicons name={icon} size={18} color={tint ? c.tint : c.textSecondary} />
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      <Muted style={styles.statLabel}>{label}</Muted>
    </Card>
  );
}

function Action({ text, onPress, last }: { text: string; onPress: () => void; last?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.actionText, { color: c.text }]}>{text}</Text>
      <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 4 },
  hello: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: { width: '31%', flexGrow: 1, gap: 4, paddingVertical: 14 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  h2: { marginTop: 20, marginBottom: 10, fontSize: 18 },
  action: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  actionText: { fontSize: 14, flex: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  best: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  bestScore: { fontSize: 20, fontWeight: '800', width: 52 },
  bestText: { flex: 1, gap: 2 },
  bestTitle: { fontSize: 15, fontWeight: '700' },
});
