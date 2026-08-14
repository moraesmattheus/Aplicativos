// Configurações — chaves de API opcionais (mais cobertura de vagas) e follow-up.
// Rota fora das abas, acessada pelo Perfil.

import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
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

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSalvo(false);
  };

  const salvar = async () => {
    await saveSettings(form);
    setSalvo(true);
  };

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
        <Card style={styles.intro}>
          <Muted>
            As fontes gratuitas (Remotive, RemoteOK, Arbeitnow) já funcionam sem chave. Adicione as chaves abaixo
            para ampliar a busca — inclusive vagas presenciais em Floripa via Google for Jobs.
          </Muted>
        </Card>

        <SectionTitle style={styles.h2}>Fontes ativas</SectionTitle>
        <Card style={{ gap: 8 }}>
          {fontes.map((f) => (
            <View key={f.nome} style={styles.fonte}>
              <Ionicons
                name={f.ativa ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={f.ativa ? c.success : c.textSecondary}
              />
              <Text style={{ color: c.text, flex: 1 }}>{f.nome}</Text>
              <Muted>{f.ativa ? 'ativa' : 'sem chave'}</Muted>
            </View>
          ))}
        </Card>

        <SectionTitle style={styles.h2}>Chaves de API</SectionTitle>

        <KeyField
          label="JSearch (RapidAPI)"
          hint="Google for Jobs — a mais ampla. Crie grátis no RapidAPI."
          value={form.jsearchKey ?? ''}
          onChange={(v) => set('jsearchKey', v)}
          link="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"
        />
        <KeyField
          label="Adzuna — App ID"
          hint="Forte no Brasil. Crie grátis no developer.adzuna.com."
          value={form.adzunaAppId ?? ''}
          onChange={(v) => set('adzunaAppId', v)}
          link="https://developer.adzuna.com"
        />
        <KeyField
          label="Adzuna — App Key"
          value={form.adzunaAppKey ?? ''}
          onChange={(v) => set('adzunaAppKey', v)}
        />
        <KeyField
          label="Jooble — API Key"
          hint="Agregador com boa cobertura no BR."
          value={form.joobleKey ?? ''}
          onChange={(v) => set('joobleKey', v)}
          link="https://br.jooble.org/api/about"
        />

        <SectionTitle style={styles.h2}>Backend de IA (Fase 2)</SectionTitle>
        <Card style={{ gap: 6 }}>
          <View style={styles.keyLabelRow}>
            <Text style={[styles.label, { color: c.text }]}>URL do backend</Text>
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://aistudio.google.com/apikey')} hitSlop={6}>
              <Text style={[styles.linkText, { color: c.tint }]}>como criar ↗</Text>
            </Pressable>
          </View>
          <Muted>
            Opcional e grátis. Com ele, a aba Currículo ganha &quot;Analisar com IA&quot; (lê PDF de verdade,
            até escaneado). Sem ele, a análise ATS local segue funcionando. Passo a passo: pasta
            radar-vagas-backend no repositório.
          </Muted>
          <TextInput
            value={form.aiBackendUrl ?? ''}
            onChangeText={(v) => set('aiBackendUrl', v)}
            placeholder="https://radar-vagas-backend.xxx.workers.dev"
            placeholderTextColor={c.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />
        </Card>

        <SectionTitle style={styles.h2}>Follow-up</SectionTitle>
        <Card>
          <Text style={[styles.label, { color: c.text }]}>Lembrar de dar follow-up após (dias)</Text>
          <TextInput
            value={String(form.followUpDias)}
            onChangeText={(v) => set('followUpDias', Number(v.replace(/\D/g, '')) || 0)}
            keyboardType="number-pad"
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />
        </Card>

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

        <Pressable onPress={salvar} style={[styles.save, { backgroundColor: salvo ? c.success : c.tint }]}>
          <Ionicons name={salvo ? 'checkmark' : 'save-outline'} size={18} color="#fff" />
          <Text style={styles.saveText}>{salvo ? 'Configurações salvas' : 'Salvar'}</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KeyField({
  label,
  hint,
  value,
  onChange,
  link,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  link?: string;
}) {
  const c = useTheme();
  return (
    <View style={styles.keyField}>
      <View style={styles.keyLabelRow}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {link && (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(link)} hitSlop={6}>
            <Text style={[styles.linkText, { color: c.tint }]}>obter chave ↗</Text>
          </Pressable>
        )}
      </View>
      {hint && <Muted>{hint}</Muted>}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="cole aqui"
        placeholderTextColor={c.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={value.length > 0}
        style={[styles.input, { color: c.text, borderColor: c.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  content: { padding: 16, gap: 12 },
  intro: {},
  h2: { marginTop: 12, fontSize: 18 },
  fonte: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyField: { gap: 6 },
  keyLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
  linkText: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 6 },
  save: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
