// Agenda de entrevistas — cria eventos no Google Calendar (via calendário do
// aparelho) com alertas, e lista as entrevistas marcadas.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Muted, SectionTitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { agendarEntrevista, parseDataHora } from '@/services/calendar';
import { useApp } from '@/store/AppStore';

export default function AgendaScreen() {
  const c = useTheme();
  const { applications, patchApplication, moveApplication } = useApp();

  const [selId, setSelId] = useState<string | null>(null);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const candidatas = useMemo(() => applications.filter((a) => a.stage !== 'Encerrado'), [applications]);
  const marcadas = useMemo(
    () =>
      applications
        .filter((a) => a.interviewAt)
        .sort((a, b) => new Date(a.interviewAt!).getTime() - new Date(b.interviewAt!).getTime()),
    [applications],
  );

  const agendar = async () => {
    setMsg(null);
    const app = applications.find((a) => a.id === selId);
    if (!app) return setMsg({ tipo: 'erro', texto: 'Selecione uma candidatura.' });
    const inicio = parseDataHora(data, hora);
    if (!inicio) return setMsg({ tipo: 'erro', texto: 'Data/hora inválida. Use dd/mm/aaaa e hh:mm.' });
    if (inicio.getTime() < Date.now()) return setMsg({ tipo: 'erro', texto: 'A data já passou.' });

    setSalvando(true);
    const res = await agendarEntrevista({
      empresa: app.job.empresa,
      cargo: app.job.titulo,
      inicio,
      link: app.job.link,
      local: app.job.local,
    });
    // registra localmente mesmo se o calendário não estiver disponível (ex.: preview web)
    await patchApplication(app.id, { interviewAt: inicio.toISOString(), calendarEventId: res.eventId });
    if (app.stage !== 'Entrevista') await moveApplication(app.id, 'Entrevista');
    setSalvando(false);

    setMsg(
      res.ok
        ? { tipo: 'ok', texto: '✅ Entrevista adicionada ao calendário com alertas (24h / 1h / 15min).' }
        : { tipo: 'erro', texto: `Salvo no app, mas o calendário não: ${res.motivo}` },
    );
    setSelId(null);
    setData('');
    setHora('');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionTitle>🗓️ Agenda</SectionTitle>
        <Muted>Entrevistas sincronizadas com seu Google Calendar</Muted>

        {/* próximas */}
        <SectionTitle style={styles.h2}>Próximas entrevistas</SectionTitle>
        {marcadas.length === 0 ? (
          <Card>
            <Muted>Nenhuma entrevista marcada ainda.</Muted>
          </Card>
        ) : (
          marcadas.map((a) => {
            const dt = new Date(a.interviewAt!);
            const futura = dt.getTime() > Date.now();
            return (
              <Card key={a.id} style={styles.evt}>
                <View style={[styles.evtDate, { backgroundColor: c.backgroundSelected }]}>
                  <Text style={[styles.evtDay, { color: c.text }]}>{dt.getDate()}</Text>
                  <Muted style={styles.evtMon}>
                    {dt.toLocaleDateString('pt-BR', { month: 'short' })}
                  </Muted>
                </View>
                <View style={styles.evtText}>
                  <Text style={[styles.evtTitle, { color: c.text }]} numberOfLines={1}>
                    {a.job.empresa}
                  </Text>
                  <Muted numberOfLines={1}>{a.job.titulo}</Muted>
                  <Muted style={{ color: futura ? c.tint : c.textSecondary }}>
                    {dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {a.calendarEventId ? ' · 📅 no Google' : ''}
                  </Muted>
                </View>
              </Card>
            );
          })
        )}

        {/* agendar nova */}
        <SectionTitle style={styles.h2}>Agendar entrevista</SectionTitle>
        <Card style={{ gap: 12 }}>
          <Muted>1. Escolha a candidatura</Muted>
          <View style={styles.pick}>
            {candidatas.length === 0 && <Muted>Salve/aplique em vagas primeiro.</Muted>}
            {candidatas.map((a) => {
              const sel = selId === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setSelId(a.id)}
                  style={[
                    styles.pickItem,
                    { borderColor: sel ? c.tint : c.border, backgroundColor: sel ? c.tint + '18' : 'transparent' },
                  ]}>
                  <Text style={[styles.pickText, { color: sel ? c.tint : c.text }]} numberOfLines={1}>
                    {a.job.empresa} — {a.job.titulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Muted>2. Data e horário</Muted>
          <View style={styles.dtRow}>
            <TextInput
              value={data}
              onChangeText={setData}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={c.textSecondary}
              keyboardType="numbers-and-punctuation"
              style={[styles.dtInput, { color: c.text, borderColor: c.border }]}
            />
            <TextInput
              value={hora}
              onChangeText={setHora}
              placeholder="hh:mm"
              placeholderTextColor={c.textSecondary}
              keyboardType="numbers-and-punctuation"
              style={[styles.dtInput, { color: c.text, borderColor: c.border }]}
            />
          </View>

          <Pressable
            onPress={agendar}
            disabled={salvando}
            style={[styles.btn, { backgroundColor: c.tint, opacity: salvando ? 0.6 : 1 }]}>
            <Ionicons name="calendar" size={16} color="#fff" />
            <Text style={styles.btnText}>Adicionar ao Google Calendar</Text>
          </Pressable>

          {msg && (
            <Text style={{ color: msg.tipo === 'ok' ? c.success : c.danger, fontSize: 13 }}>{msg.texto}</Text>
          )}
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 4 },
  h2: { marginTop: 20, marginBottom: 10, fontSize: 18 },
  evt: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  evtDate: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evtDay: { fontSize: 20, fontWeight: '800' },
  evtMon: { fontSize: 11, textTransform: 'uppercase' },
  evtText: { flex: 1, gap: 2 },
  evtTitle: { fontSize: 15, fontWeight: '700' },
  pick: { gap: 8 },
  pickItem: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  pickText: { fontSize: 13, fontWeight: '600' },
  dtRow: { flexDirection: 'row', gap: 10 },
  dtInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
});
