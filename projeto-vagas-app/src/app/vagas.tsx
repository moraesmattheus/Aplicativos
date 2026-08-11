// Tela de Vagas: dispara a busca automática nas APIs agregadoras,
// aplica filtro (remoto / presencial só Floripa), pontua e ranqueia.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JobCard } from '@/components/JobCard';
import { Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { SAMPLE_JOBS } from '@/data/sampleJobs';
import { rankJobs } from '@/services/matching';
import { searchJobs } from '@/services/jobs';
import { useApp } from '@/store/AppStore';
import { Job } from '@/types';

export default function VagasScreen() {
  const c = useTheme();
  const { profile, settings } = useApp();

  const [termo, setTermo] = useState(profile.titulo || profile.palavrasChave[0] || '');
  const [raw, setRaw] = useState<Job[]>(SAMPLE_JOBS);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string>('Mostrando exemplos — toque em Buscar para vagas reais.');

  const ranked = useMemo(() => rankJobs(raw, profile), [raw, profile]);

  const buscar = async () => {
    setLoading(true);
    setInfo('Vasculhando as fontes...');
    try {
      const res = await searchJobs(
        { termo: termo.trim() || profile.titulo, cidade: profile.cidade, remoto: profile.aceitaRemoto },
        settings,
      );
      const jobs = res.jobs.length > 0 ? res.jobs : SAMPLE_JOBS;
      setRaw(jobs);
      const okTxt = res.fontesOk.length ? `Fontes: ${res.fontesOk.join(', ')}` : 'Nenhuma fonte retornou vagas';
      const errTxt = res.fontesErro.length ? ` · falhou: ${res.fontesErro.join(', ')}` : '';
      setInfo(`${res.jobs.length} vagas · ${okTxt}${errTxt}`);
    } catch {
      setInfo('Erro na busca. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.headerArea}>
        <SectionTitle>🔎 Radar de vagas</SectionTitle>
        <View style={[styles.searchRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={c.textSecondary} />
          <TextInput
            value={termo}
            onChangeText={setTermo}
            placeholder="Cargo ou palavra-chave"
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text }]}
            returnKeyType="search"
            onSubmitEditing={buscar}
          />
          <Pressable
            onPress={buscar}
            disabled={loading}
            style={[styles.searchBtn, { backgroundColor: c.tint, opacity: loading ? 0.6 : 1 }]}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>Buscar</Text>
            )}
          </Pressable>
        </View>
        <Muted style={styles.info}>{info}</Muted>
        <Muted style={styles.filterHint}>
          {profile.aceitaRemoto ? '🌐 Remoto: qualquer lugar' : '🌐 Remoto: desligado'} · 🏢 Presencial: só{' '}
          {profile.cidade}
        </Muted>
      </View>

      <FlatList
        data={ranked}
        keyExtractor={(j) => j.id}
        renderItem={({ item }) => <JobCard match={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Muted>Nenhuma vaga passou no filtro. Ajuste o perfil ou a busca.</Muted>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerArea: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 8,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 6 },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  info: { marginTop: 2 },
  filterHint: { fontSize: 11 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { padding: 40, alignItems: 'center' },
});
