// Aba Currículo (ATS): sobe/cola o currículo, roda o motor de ATS, mostra o
// score + o que melhorar. Se o CV estiver bom, preenche o Perfil sozinho;
// se não, mostra as correções antes.

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bar, Card, Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { analyzeCV, AtsResult, mergeExtractedIntoProfile, NIVEL_META } from '@/services/ats';
import { useApp } from '@/store/AppStore';

/** Lê o texto de um arquivo escolhido. Confiável p/ .txt; PDF/DOCX é best-effort. */
async function lerArquivo(uri: string): Promise<{ texto: string; legivel: boolean }> {
  try {
    const res = await fetch(uri);
    const texto = await res.text();
    // heurística: se a maioria dos caracteres for "imprimível", provavelmente é texto real
    const limpos = texto.replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ]/g, '');
    const legivel = texto.length > 0 && limpos.length / texto.length > 0.7 && limpos.trim().length > 40;
    return { texto: limpos, legivel };
  } catch {
    return { texto: '', legivel: false };
  }
}

export default function CurriculoScreen() {
  const c = useTheme();
  const router = useRouter();
  const { profile, saveProfile } = useApp();

  const [texto, setTexto] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [result, setResult] = useState<AtsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState(false);

  const escolherArquivo = async () => {
    setAviso(null);
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const asset = r.assets[0];
      setNomeArquivo(asset.name);
      const { texto: lido, legivel } = await lerArquivo(asset.uri);
      if (legivel) {
        setTexto(lido);
        setAviso(`✅ "${asset.name}" carregado. Toque em Analisar.`);
      } else {
        setAviso(`⚠️ Não consegui ler o texto de "${asset.name}" (PDF/DOCX ainda não são lidos direto no app). Copie e cole o conteúdo do currículo no campo abaixo.`);
      }
    } catch {
      setAviso('Não foi possível abrir o arquivo. Cole o texto do currículo abaixo.');
    }
  };

  const analisar = async () => {
    if (texto.trim().length < 40) {
      setAviso('Cole o texto do currículo (ou escolha um arquivo) antes de analisar.');
      return;
    }
    setLoading(true);
    setAplicado(false);
    setAviso(null);
    // pequena espera p/ o spinner aparecer em textos grandes
    await new Promise((r) => setTimeout(r, 50));
    const res = analyzeCV(texto, profile);
    setResult(res);
    setLoading(false);
    // se o CV está bom, preenche o perfil sozinho
    if (res.aprovado) {
      await aplicarNoPerfil(res, true);
    }
  };

  const aplicarNoPerfil = async (res: AtsResult, auto = false) => {
    const novo = mergeExtractedIntoProfile(profile, res.extracted);
    await saveProfile(novo);
    setAplicado(true);
    if (!auto) setAviso('Perfil atualizado com os dados do currículo.');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionTitle>📄 Currículo (ATS)</SectionTitle>
        <Muted>Descubra como os robôs de RH leem seu CV — e conserte antes de enviar.</Muted>

        {/* entrada */}
        <Pressable onPress={escolherArquivo} style={[styles.upload, { borderColor: c.tint, backgroundColor: c.tint + '12' }]}>
          <Ionicons name="cloud-upload-outline" size={22} color={c.tint} />
          <Text style={[styles.uploadText, { color: c.tint }]}>
            {nomeArquivo ? `Trocar arquivo (${nomeArquivo})` : 'Escolher arquivo (.txt, PDF, DOCX)'}
          </Text>
        </Pressable>

        <Muted style={styles.ou}>ou cole o texto do currículo:</Muted>
        <TextInput
          value={texto}
          onChangeText={(v) => { setTexto(v); setResult(null); }}
          placeholder="Cole aqui todo o conteúdo do seu currículo..."
          placeholderTextColor={c.textSecondary}
          multiline
          style={[styles.textarea, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
        />

        {aviso && (
          <Card style={styles.aviso}>
            <Muted style={{ color: c.text }}>{aviso}</Muted>
          </Card>
        )}

        <Pressable onPress={analisar} disabled={loading} style={[styles.btn, { backgroundColor: c.tint, opacity: loading ? 0.6 : 1 }]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="scan-outline" size={18} color="#fff" />}
          <Text style={styles.btnText}>{loading ? 'Analisando...' : 'Analisar currículo'}</Text>
        </Pressable>

        {/* resultado */}
        {result && <Resultado res={result} onAplicar={() => aplicarNoPerfil(result)} aplicado={aplicado} irParaPerfil={() => router.push('/perfil')} />}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Resultado({
  res,
  onAplicar,
  aplicado,
  irParaPerfil,
}: {
  res: AtsResult;
  onAplicar: () => void;
  aplicado: boolean;
  irParaPerfil: () => void;
}) {
  const c = useTheme();
  const meta = NIVEL_META[res.nivel];

  return (
    <View style={styles.result}>
      {/* score grande */}
      <Card style={styles.scoreCard}>
        <View style={[styles.scoreCircle, { borderColor: meta.color }]}>
          <Text style={[styles.scoreNum, { color: meta.color }]}>{res.score}</Text>
          <Text style={[styles.scoreMax, { color: c.textSecondary }]}>/100</Text>
        </View>
        <View style={styles.scoreInfo}>
          <Text style={[styles.scoreLabel, { color: meta.color }]}>{meta.emoji} {meta.label}</Text>
          <Muted>{meta.frase}</Muted>
          <Muted style={{ marginTop: 4 }}>{res.palavras} palavras · {res.skillsEncontradas.length} skills lidas</Muted>
        </View>
      </Card>

      {/* aprovado → preencheu sozinho */}
      {res.aprovado && (
        <Card style={[styles.okCard, { borderColor: c.success }]}>
          <Ionicons name="checkmark-circle" size={20} color={c.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.okTitle, { color: c.text }]}>
              {aplicado ? 'Perfil preenchido automaticamente ✨' : 'Currículo aprovado'}
            </Text>
            <Muted>Dados do CV aplicados ao seu Perfil. Revise e comece a buscar vagas.</Muted>
          </View>
          <Pressable onPress={irParaPerfil} hitSlop={6}>
            <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
          </Pressable>
        </Card>
      )}

      {/* breakdown */}
      <SectionTitle style={styles.h2}>Nota por critério</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Criterio label="Palavras-chave" value={res.breakdown.palavrasChave} />
        <Criterio label="Contato" value={res.breakdown.contato} />
        <Criterio label="Seções" value={res.breakdown.secoes} />
        <Criterio label="Resultados" value={res.breakdown.resultados} />
        <Criterio label="Formato" value={res.breakdown.formato} />
      </Card>

      {/* pontos fortes */}
      {res.pontosFortes.length > 0 && (
        <>
          <SectionTitle style={styles.h2}>✅ Pontos fortes</SectionTitle>
          <Card style={{ gap: 6 }}>
            {res.pontosFortes.map((p, i) => (
              <Text key={i} style={[styles.forte, { color: c.text }]}>• {p}</Text>
            ))}
          </Card>
        </>
      )}

      {/* o que melhorar */}
      {res.issues.length > 0 && (
        <>
          <SectionTitle style={styles.h2}>🛠️ O que melhorar ({res.issues.length})</SectionTitle>
          {res.issues.map((issue, i) => {
            const cor = issue.gravidade === 'alta' ? c.danger : issue.gravidade === 'media' ? c.warning : c.textSecondary;
            return (
              <Card key={i} style={styles.issue}>
                <View style={[styles.issueDot, { backgroundColor: cor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.issueTitle, { color: c.text }]}>{issue.campo}: {issue.problema}</Text>
                  <Muted style={{ marginTop: 2 }}>💡 {issue.sugestao}</Muted>
                </View>
              </Card>
            );
          })}
        </>
      )}

      {/* aplicar manualmente quando não aprovado */}
      {!res.aprovado && (
        <Pressable onPress={onAplicar} style={[styles.btnGhost, { borderColor: c.border }]}>
          <Ionicons name={aplicado ? 'checkmark' : 'person-add-outline'} size={18} color={c.tint} />
          <Text style={[styles.btnGhostText, { color: c.tint }]}>
            {aplicado ? 'Perfil preenchido' : 'Preencher meu perfil mesmo assim'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Criterio({ label, value }: { label: string; value: number }) {
  const c = useTheme();
  const cor = value >= 70 ? c.success : value >= 45 ? c.warning : c.danger;
  return (
    <View style={styles.criterio}>
      <Text style={[styles.criterioLabel, { color: c.textSecondary }]}>{label}</Text>
      <Bar value={value} color={cor} />
      <Text style={[styles.criterioVal, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 10 },
  upload: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 18, marginTop: 8,
  },
  uploadText: { fontSize: 14, fontWeight: '700' },
  ou: { textAlign: 'center', marginTop: 4 },
  textarea: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 130, textAlignVertical: 'top' },
  aviso: { paddingVertical: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  result: { gap: 10, marginTop: 8 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
  scoreMax: { fontSize: 11, marginTop: -2 },
  scoreInfo: { flex: 1, gap: 2 },
  scoreLabel: { fontSize: 18, fontWeight: '800' },
  okCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  okTitle: { fontSize: 15, fontWeight: '700' },
  h2: { marginTop: 14, fontSize: 17 },
  criterio: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  criterioLabel: { fontSize: 13, width: 96 },
  criterioVal: { fontSize: 13, fontWeight: '700', width: 28, textAlign: 'right' },
  forte: { fontSize: 14, lineHeight: 20 },
  issue: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  issueDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  issueTitle: { fontSize: 14, fontWeight: '700' },
  btnGhost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 6 },
  btnGhostText: { fontWeight: '700', fontSize: 14 },
});
