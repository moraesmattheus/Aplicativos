// Perfil / CV — base do cálculo de compatibilidade (cadastro do fluxograma).

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Chip, Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/store/AppStore';
import { Profile, Senioridade } from '@/types';

const SENIORIDADES: Senioridade[] = ['Estágio', 'Júnior', 'Pleno', 'Sênior'];
const CONTRATACOES = ['CLT', 'PJ', 'Estágio', 'Freelance'];

const splitList = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

export default function PerfilScreen() {
  const c = useTheme();
  const router = useRouter();
  const { profile, saveProfile } = useApp();

  const [form, setForm] = useState<Profile>(profile);
  const [competenciasText, setCompetenciasText] = useState(profile.competencias.join(', '));
  const [palavrasText, setPalavrasText] = useState(profile.palavrasChave.join(', '));
  const [salvo, setSalvo] = useState(false);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSalvo(false);
  };

  const toggleContratacao = (t: string) => {
    setForm((f) => {
      const atuais = f.tiposContratacao ?? [];
      const novo = atuais.includes(t) ? atuais.filter((x) => x !== t) : [...atuais, t];
      return { ...f, tiposContratacao: novo };
    });
    setSalvo(false);
  };

  const salvar = async () => {
    await saveProfile({
      ...form,
      competencias: splitList(competenciasText),
      palavrasChave: splitList(palavrasText),
    });
    setSalvo(true);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <SectionTitle>👤 Perfil</SectionTitle>
        <Pressable onPress={() => router.push('/config')} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={c.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.cvNote}>
          <Ionicons name="sparkles-outline" size={18} color={c.tint} />
          <Muted style={{ flex: 1 }}>
            Em breve: importar CV em PDF e deixar a IA preencher tudo. Por enquanto, ajuste abaixo.
          </Muted>
        </Card>

        <Field label="Nome" value={form.nome} onChange={(v) => set('nome', v)} />
        <Field label="E-mail" value={form.email ?? ''} onChange={(v) => set('email', v)} keyboard="email-address" />
        <Field label="Telefone" value={form.telefone ?? ''} onChange={(v) => set('telefone', v)} keyboard="phone-pad" />
        <Field label="Cidade (para vagas presenciais)" value={form.cidade} onChange={(v) => set('cidade', v)} />

        <View style={[styles.switchRow, { borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: c.text }]}>Aceito vagas remotas</Text>
            <Muted>Presenciais/híbridas só em {form.cidade || '—'}</Muted>
          </View>
          <Switch value={form.aceitaRemoto} onValueChange={(v) => set('aceitaRemoto', v)} />
        </View>

        <Field label="Cargo principal" value={form.titulo} onChange={(v) => set('titulo', v)} />

        <Text style={[styles.label, { color: c.text }]}>Senioridade</Text>
        <View style={styles.chips}>
          {SENIORIDADES.map((s) => (
            <Selectable key={s} label={s} active={form.senioridade === s} onPress={() => set('senioridade', s)} />
          ))}
        </View>

        <Text style={[styles.label, { color: c.text }]}>Tipo de contratação (pode escolher mais de um)</Text>
        <View style={styles.chips}>
          {CONTRATACOES.map((t) => (
            <Selectable
              key={t}
              label={t}
              active={(form.tiposContratacao ?? []).includes(t)}
              onPress={() => toggleContratacao(t)}
            />
          ))}
        </View>

        <Field label="Pretensão salarial" value={form.pretensaoSalarial ?? ''} onChange={(v) => set('pretensaoSalarial', v)} placeholder="R$ 7.000" />
        <Field label="LinkedIn" value={form.linkedin ?? ''} onChange={(v) => set('linkedin', v)} placeholder="linkedin.com/in/voce" />
        <Field label="Portfólio" value={form.portfolio ?? ''} onChange={(v) => set('portfolio', v)} placeholder="github.com/voce" />

        <Field
          label="Palavras-chave da busca (separadas por vírgula)"
          value={palavrasText}
          onChange={(v) => { setPalavrasText(v); setSalvo(false); }}
          placeholder="react, front-end, mobile"
        />

        <Text style={[styles.label, { color: c.text }]}>Competências / skills (vírgula)</Text>
        <TextInput
          value={competenciasText}
          onChangeText={(v) => { setCompetenciasText(v); setSalvo(false); }}
          placeholder="javascript, react, node.js"
          placeholderTextColor={c.textSecondary}
          multiline
          style={[styles.input, styles.multi, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
        />
        <View style={styles.chips}>
          {splitList(competenciasText).slice(0, 12).map((s) => (
            <Chip key={s} label={s} tone="ok" />
          ))}
        </View>

        <Text style={[styles.label, { color: c.text }]}>Resumo do CV</Text>
        <TextInput
          value={form.resumo ?? ''}
          onChangeText={(v) => set('resumo', v)}
          placeholder="Um parágrafo sobre sua experiência..."
          placeholderTextColor={c.textSecondary}
          multiline
          style={[styles.input, styles.multi, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
        />

        <Pressable onPress={salvar} style={[styles.save, { backgroundColor: salvo ? c.success : c.tint }]}>
          <Ionicons name={salvo ? 'checkmark' : 'save-outline'} size={18} color="#fff" />
          <Text style={styles.saveText}>{salvo ? 'Perfil salvo' : 'Salvar perfil'}</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: 'email-address' | 'phone-pad';
}) {
  const c = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
      />
    </View>
  );
}

function Selectable({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sel, { borderColor: active ? c.tint : c.border, backgroundColor: active ? c.tint + '18' : 'transparent' }]}>
      <Text style={[styles.selText, { color: active ? c.tint : c.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  content: { padding: 16, gap: 12 },
  cvNote: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  multi: { minHeight: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sel: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  selText: { fontSize: 13, fontWeight: '600' },
  save: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
