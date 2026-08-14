// Aba Currículo (ATS): sobe/cola o currículo, roda o motor de ATS, mostra o
// score + o que melhorar. Se o CV estiver bom, preenche o Perfil sozinho;
// se não, mostra as correções antes.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bar, Card, Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { analisarCVComIA } from '@/services/ai';
import { analyzeCV, AtsResult, mergeExtractedIntoProfile, NIVEL_META } from '@/services/ats';
import { bytesParaBase64, extrairTextoDeArquivo } from '@/services/documents';
import { useApp } from '@/store/AppStore';

export default function CurriculoScreen() {
  const c = useTheme();
  const router = useRouter();

  // ⚡ Safe destructuring com fallback para evitar crashes
  const appState = useApp();
  const profile = appState?.profile || { competencias: [], titulo: '', senioridade: 'Pleno' as const };
  const saveProfile = appState?.saveProfile || (async () => {});
  const settings = appState?.settings || { aiBackendUrl: '' };

  const [texto, setTexto] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [result, setResult] = useState<AtsResult | null>(null);
  const [resumoIA, setResumoIA] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState(false);

  const temIA = !!(settings?.aiBackendUrl && settings.aiBackendUrl.trim());

  const escolherArquivo = async () => {
    setAviso(null);
    setResult(null);
    setPdfBase64(null);

    let DocumentPicker;
    try {
      DocumentPicker = require('expo-document-picker');
      // Valida que o módulo nativo carregou (não só o require)
      if (!DocumentPicker?.getDocumentAsync) {
        throw new Error('Módulo nativo ExpoDocumentPicker não disponível');
      }
    } catch (err) {
      console.warn('[Currículo] DocumentPicker não disponível:', err);
      setAviso('📋 Seletor de arquivos indisponível neste build. Cole o texto do currículo no campo abaixo.');
      return;
    }

    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        // true → copia p/ cache e devolve URI file:// (fetch lê de forma confiável).
        // false devolvia content:// que o Hermes lê como vazio.
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets?.[0]) return;

      const asset = r.assets[0];
      setNomeArquivo(asset.name);
      setLendo(true);
      setAviso(null);

      // Pequena pausa para a UI respirar
      await new Promise(resolve => setTimeout(resolve, 200));

      try {
        const res = await extrairTextoDeArquivo(asset.uri, asset.name, asset.mimeType);

        if (res.ok) {
          setTexto(res.texto);
          setAviso(`✅ Arquivo carregado.`);
        } else {
          setAviso(`⚠️ Texto não extraído localmente. Use "Analisar com IA".`);
        }

        if (temIA && res.bytes) {
          try {
            // Conversão base64 ultra-segura com timeout
            const b64 = bytesParaBase64(res.bytes);
            setPdfBase64(b64);
            setMimeType(asset.mimeType || 'application/pdf');
          } catch (b64Error) {
            console.error('[Currículo] Erro na conversão base64:', b64Error);
            setAviso('⚠️ Arquivo muito grande. Use "Análise Local" ou reduza o tamanho do PDF.');
          }
        }
      } catch (extractError) {
        console.error('[Currículo] Erro ao extrair texto:', extractError);
        setAviso('⚠️ Erro ao processar arquivo. Tente outro formato ou cole o texto.');
      } finally {
        setLendo(false);
      }
    } catch (e) {
      console.error('[Currículo] Erro ao escolher arquivo:', e);
      setLendo(false);
      setAviso('Erro ao carregar arquivo. Tente novamente ou cole o texto.');
    }
  };

  const analisar = async () => {
    if (texto.trim().length < 40) return setAviso('Texto muito curto para análise.');
    setLoading(true);
    setAplicado(false);
    setAviso(null);
    await new Promise(r => setTimeout(r, 100));
    const res = analyzeCV(texto, profile);
    setResult(res);
    setLoading(false);
    if (res.aprovado) await aplicarNoPerfil(res, true);
  };

  const analisarComIA = async () => {
    if (!temIA) return;
    if (!pdfBase64 && texto.trim().length < 40) return setAviso('Carregue um arquivo antes.');

    setLoading(true);
    setAplicado(false);
    setResumoIA(null);
    setAviso('🤖 Analisando com IA...');
    try {
      const res = await analisarCVComIA(settings.aiBackendUrl!, {
        texto: pdfBase64 ? undefined : texto,
        pdfBase64: pdfBase64 ?? undefined,
        mimeType: mimeType ?? undefined,
        alvo: profile,
      });
      setResult(res);
      setResumoIA(res.resumoIA ?? null);
      setAviso(null);
      if (res.aprovado) await aplicarNoPerfil(res, true);
    } catch (e) {
      setAviso(`Erro na IA. Tente a análise local.`);
    } finally {
      setLoading(false);
    }
  };

  const aplicarNoPerfil = async (res: AtsResult, auto = false) => {
    const novo = mergeExtractedIntoProfile(profile, res.extracted);
    await saveProfile(novo);
    setAplicado(true);
    if (!auto) setAviso('Perfil atualizado!');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionTitle>📄 Currículo (ATS)</SectionTitle>
        <Muted>Analise seu currículo localmente ou com IA.</Muted>

        <Pressable onPress={escolherArquivo} disabled={lendo} style={[styles.upload, { borderColor: c.tint, backgroundColor: c.tint + '12', opacity: lendo ? 0.6 : 1 }]}>
          {lendo ? <ActivityIndicator color={c.tint} /> : <Ionicons name="cloud-upload-outline" size={22} color={c.tint} />}
          <Text style={[styles.uploadText, { color: c.tint }]}>
            {lendo ? 'Lendo...' : nomeArquivo ? `Trocar: ${nomeArquivo}` : 'Escolher arquivo (PDF, DOCX)'}
          </Text>
        </Pressable>

        <TextInput
          value={texto}
          onChangeText={(v) => { setTexto(v); setResult(null); setPdfBase64(null); }}
          placeholder="Ou cole o texto aqui..."
          placeholderTextColor={c.textSecondary}
          multiline
          style={[styles.textarea, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
        />

        {aviso && (
          <Card style={styles.aviso}>
            <Text style={{ color: c.text, fontSize: 13 }}>{aviso}</Text>
          </Card>
        )}

        {temIA && (
          <Pressable onPress={analisarComIA} disabled={loading || lendo} style={[styles.btn, { backgroundColor: c.tint, opacity: (loading || lendo) ? 0.6 : 1 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
            <Text style={styles.btnText}>Analisar com IA</Text>
          </Pressable>
        )}

        <Pressable onPress={analisar} disabled={loading || lendo} style={[styles.btnGhostFull, { borderColor: c.border, opacity: (loading || lendo) ? 0.6 : 1 }]}>
          <Text style={{ color: c.tint, fontWeight: '700' }}>Análise Local (Rápida)</Text>
        </Pressable>

        {result && (
          <Resultado
            res={result}
            resumoIA={resumoIA}
            onAplicar={() => aplicarNoPerfil(result)}
            aplicado={aplicado}
            irParaPerfil={() => router.push('/perfil')}
          />
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Resultado({ res, resumoIA, onAplicar, aplicado, irParaPerfil }: {
  res: AtsResult;
  resumoIA: string | null;
  onAplicar: () => void;
  aplicado: boolean;
  irParaPerfil: () => void;
}) {
  const c = useTheme();
  const meta = NIVEL_META[res.nivel as keyof typeof NIVEL_META] || NIVEL_META.ruim;

  return (
    <View style={styles.result}>
      {resumoIA && (
        <Card style={[styles.iaCard, { borderColor: c.tint }]}>
          <Text style={[styles.iaTitle, { color: c.tint }]}>✨ Resumo da IA</Text>
          <Text style={[styles.iaText, { color: c.text }]}>{resumoIA}</Text>
        </Card>
      )}

      <Card style={styles.scoreCard}>
        <View style={[styles.scoreCircle, { borderColor: meta.color }]}>
          <Text style={[styles.scoreNum, { color: meta.color }]}>{res.score}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.scoreLabel, { color: meta.color }]}>{meta.label}</Text>
          <Muted>{meta.frase}</Muted>
        </View>
      </Card>

      {res.issues.length > 0 && (
        <>
          <SectionTitle style={styles.h2}>🛠️ Melhorias</SectionTitle>
          {res.issues.map((issue: any, i: number) => (
            <Card key={i} style={styles.issue}>
              <Text style={[styles.issueTitle, { color: c.text }]}>{issue.campo}: {issue.problema}</Text>
              <Muted>💡 {issue.sugestao}</Muted>
            </Card>
          ))}
        </>
      )}

      <Pressable onPress={aplicado ? irParaPerfil : onAplicar} style={[styles.btn, { backgroundColor: aplicado ? c.success : c.tint, marginTop: 10 }]}>
        <Text style={styles.btnText}>{aplicado ? 'Ver Perfil Atualizado' : 'Aplicar dados no Perfil'}</Text>
      </Pressable>
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
  upload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 18, marginTop: 8 },
  uploadText: { fontSize: 14, fontWeight: '700' },
  textarea: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  aviso: { paddingVertical: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhostFull: { paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  iaCard: { gap: 6, borderWidth: 1 },
  iaTitle: { fontSize: 14, fontWeight: '800' },
  iaText: { fontSize: 14, lineHeight: 20 },
  result: { gap: 10, marginTop: 8 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 24, fontWeight: '800' },
  scoreLabel: { fontSize: 18, fontWeight: '800' },
  h2: { marginTop: 10, fontSize: 16 },
  criterio: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  criterioLabel: { fontSize: 13, width: 90 },
  criterioVal: { fontSize: 13, fontWeight: '700', width: 25, textAlign: 'right' },
  issue: { gap: 2 },
  issueTitle: { fontSize: 14, fontWeight: '700' },
});
