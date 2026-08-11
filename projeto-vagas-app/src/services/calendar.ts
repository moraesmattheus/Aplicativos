// Integração com o calendário do aparelho via expo-calendar.
// Quando a conta Google está configurada no Android, o evento sincroniza
// automaticamente com o Google Calendar. Alertas: 24h, 1h e 15min antes.

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export interface AgendarParams {
  empresa: string;
  cargo: string;
  inicio: Date;
  duracaoMin?: number;
  link?: string;
  local?: string;
}

export interface AgendarResult {
  ok: boolean;
  eventId?: string;
  motivo?: string;
}

/** Converte "dd/mm/aaaa" + "hh:mm" em Date. Retorna null se inválido. */
export function parseDataHora(data: string, hora: string): Date | null {
  const m = data.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  const h = hora.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || !h) return null;
  const [, dd, mm, yy] = m;
  const [, hh, min] = h;
  const ano = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  const d = new Date(ano, Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return isNaN(d.getTime()) ? null : d;
}

async function calendarioGravavel() {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const graváveis = cals.filter((c) => c.allowsModifications);
  // prioriza um calendário Google (identificado pelo nome da conta/fonte)
  const google = graváveis.find(
    (c) =>
      (c.source?.name || '').toLowerCase().includes('google') ||
      (c.source?.name || '').toLowerCase().includes('gmail') ||
      (c.title || '').toLowerCase().includes('gmail'),
  );
  return google ?? graváveis[0] ?? null;
}

/** Cria o evento de entrevista no calendário. */
export async function agendarEntrevista(p: AgendarParams): Promise<AgendarResult> {
  if (Platform.OS === 'web') {
    return { ok: false, motivo: 'O calendário funciona no app instalado (Android), não no preview web.' };
  }
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return { ok: false, motivo: 'Permissão de calendário negada.' };

    const cal = await calendarioGravavel();
    if (!cal) return { ok: false, motivo: 'Nenhum calendário gravável encontrado no aparelho.' };

    const fim = new Date(p.inicio.getTime() + (p.duracaoMin ?? 60) * 60000);
    const eventId = await Calendar.createEventAsync(cal.id, {
      title: `Entrevista: ${p.empresa} — ${p.cargo}`,
      startDate: p.inicio,
      endDate: fim,
      location: p.local,
      notes: p.link ? `Link: ${p.link}` : undefined,
      alarms: [{ relativeOffset: -1440 }, { relativeOffset: -60 }, { relativeOffset: -15 }],
      timeZone: 'America/Sao_Paulo',
    });
    return { ok: true, eventId };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'Falha ao criar o evento.' };
  }
}
