// Config — tela de configurações.
// O QUÊ: exibe status das fontes de vaga (ativas via secret embutido no build),
//         permite ajustar o prazo de follow-up e acessa os logs do sistema.
// POR QUÊ: as chaves de API (JSearch/Adzuna/Jooble) agora ficam em variáveis
//          EXPO_PUBLIC_* embutidas no bundle (secret EAS), invisíveis ao usuário
//          e sobrevivem a rebuild/reinstalação — sem necessidade de campo de texto.
//          A URL do backend de IA também está em DEFAULT_SETTINGS (hardcoded) e
//          já está funcionando; remover o campo elimina carga desnecessária do front.
// ONDE: acessível via Perfil (href: '/config', fora das abas).

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fontesComChave } from '@/services/jobs';
import { Settings } from '@/services/storage';
import { useApp } from '@/store/AppStore';

export default function ConfigScreen() {
  const c = useTheme();
  const router = useRouter();
  const { settings, saveSettings } = useApp();

  const [form, setForm] = useState<Settings>(settings);
  const [salvo, setSalvo] = useState(false);

  // Atualiza um campo do form e marca como não salvo
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSalvo(false);
  };

  const salvar = async () => {
    await saveSettings(form);
    setSalvo(true);
  };

  // Lista de fontes com status: ativa (via secret embutido), inativa ou configurada pelo usuário
  const fontes = fontesComChave(form);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <SectionTitle>⚙️ Configurações</SectionTitle>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Status das fontes de vaga ───────────────────────── */}
        <SectionTitle style={styles.h2}>Fontes de vaga</SectionTitle>
        <Card style={styles.intro}>
          <Muted>
            Remotive, RemoteOK, Arbeitnow e Gupy funcionam sem configuração.
            JSearch, Adzuna e Jooble estão pré-configurados via chave embutida no app — ativas automaticamente.
          </Muted>
        </Card>
        <Card style={{ gap: 8 }}>
          {/* Fontes sem chave — sempre ativas */}
          {(['Remotive', 'RemoteOK', 'Arbeitnow', 'Gupy'] as const).map((nome) => (
            <View key={nome} style={styles.fonte}>
              <Ionicons name="checkmark-circle" size={18} color={c.success} />
              <Text style={{ color: c.text, flex: 1 }}>{nome}</Text>
              <Muted>sempre ativa</Muted>
            </View>
          ))}
          {/* Fontes com chave — status baseado no secret embutido */}
          {fontes.map((f) => (
            <View key={f.nome} style={styles.fonte}>
              <Ionicons
                name={f.ativa ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={f.ativa ? c.success : c.textSecondary}
              />
              <Text style={{ color: c.text, flex: 1 }}>{f.nome}</Text>
              <Muted>
                {f.origem === 'usuario'  ? 'chave do usuário'
                 : f.origem === 'secret' ? 'embutida no app'
                 :                         'sem chave'}
              </Muted>
            </View>
          ))}
        </Card>

        {/* ── Follow-up ───────────────────────────────────────── */}
        <SectionTitle style={styles.h2}>Follow-up</SectionTitle>
        <Card>
          {/* Quantos dias sem movimentação antes de lembrar o usuário de dar follow-up */}
          <Text style={[styles.label, { color: c.text }]}>Lembrar de dar follow-up após (dias)</Text>
          <TextInput
            value={String(form.followUpDias)}
            onChangeText={(v) => set('followUpDias', Number(v.replace(/\D/g, '')) || 0)}
            keyboardType="number-pad"
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />
        </Card>

        {/* ── Sistema ─────────────────────────────────────────── */}
        <SectionTitle style={styles.h2}>Sistema</SectionTitle>
        <Card>
          <Pressable
            onPress={() => router.push('/logs')}
            style={[styles.fonte, { paddingVertical: 4 }]}
          >
            <Ionicons name="terminal-outline" size={20} color={c.tint} />
            <Text style={{ color: c.text, flex: 1, fontWeight: '600' }}>Ver logs do sistema</Text>
            <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
          </Pressable>
        </Card>

        {/* ── Salvar ──────────────────────────────────────────── */}
        <Pressable onPress={salvar} style={[styles.save, { backgroundColor: salvo ? c.success : c.tint }]}>
          <Ionicons name={salvo ? 'checkmark' : 'save-outline'} size={18} color="#fff" />
          <Text style={styles.saveText}>{salvo ? 'Configurações salvas' : 'Salvar'}</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  content:  { padding: 16, gap: 12 },
  intro:    {},
  h2:       { marginTop: 12, fontSize: 18 },
  fonte:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label:    { fontSize: 14, fontWeight: '600' },
  input:    { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 6 },
  save:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
