// Camada de persistência local (AsyncStorage).
// Toda a UI fala com este módulo — não com o AsyncStorage direto.
// Assim, trocar por Firestore depois é mudar só aqui (mesma assinatura async).

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Application, DEFAULT_PROFILE, KanbanStage, Profile } from '@/types';

const K_PROFILE = '@vagas/profile';
const K_APPLICATIONS = '@vagas/applications';
const K_SETTINGS = '@vagas/settings';

/** Chaves de API opcionais + preferências de busca. */
export interface Settings {
  jsearchKey?: string; // RapidAPI (JSearch / Google for Jobs)
  adzunaAppId?: string;
  adzunaAppKey?: string;
  joobleKey?: string;
  /** URL pública do backend de IA (Fase 2). Vazio = usa só o ATS local. */
  aiBackendUrl?: string;
  /** intervalo (horas) para lembrete de follow-up de cards parados */
  followUpDias: number;
  /** já passou pelo onboarding do perfil? */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  followUpDias: 5,
  onboarded: false,
};

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silencioso: falha de storage não deve derrubar a UI
  }
}

// ---------- Perfil ----------

export async function loadProfile(): Promise<Profile> {
  return readJSON<Profile>(K_PROFILE, DEFAULT_PROFILE);
}

export async function saveProfile(profile: Profile): Promise<void> {
  await writeJSON(K_PROFILE, profile);
}

// ---------- Settings ----------

export async function loadSettings(): Promise<Settings> {
  return readJSON<Settings>(K_SETTINGS, DEFAULT_SETTINGS);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJSON(K_SETTINGS, settings);
}

// ---------- Candidaturas (Kanban) ----------

export async function loadApplications(): Promise<Application[]> {
  try {
    const raw = await AsyncStorage.getItem(K_APPLICATIONS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Application[]) : [];
  } catch {
    return [];
  }
}

async function saveApplications(apps: Application[]): Promise<void> {
  await writeJSON(K_APPLICATIONS, apps);
}

/** Insere ou atualiza uma candidatura (por id). Retorna a lista atualizada. */
export async function upsertApplication(app: Application): Promise<Application[]> {
  const apps = await loadApplications();
  const idx = apps.findIndex((a) => a.id === app.id);
  if (idx >= 0) apps[idx] = app;
  else apps.unshift(app);
  await saveApplications(apps);
  return apps;
}

export async function removeApplication(id: string): Promise<Application[]> {
  const apps = (await loadApplications()).filter((a) => a.id !== id);
  await saveApplications(apps);
  return apps;
}

/** Move uma candidatura de etapa, registrando o histórico. */
export async function moveApplication(id: string, stage: KanbanStage): Promise<Application[]> {
  const apps = await loadApplications();
  const app = apps.find((a) => a.id === id);
  if (app) {
    const now = new Date().toISOString();
    app.stage = stage;
    app.updatedAt = now;
    app.history = [...(app.history ?? []), { stage, at: now }];
    await saveApplications(apps);
  }
  return apps;
}

/** Atualiza campos livres de uma candidatura (notas, entrevista, evento). */
export async function patchApplication(
  id: string,
  patch: Partial<Application>,
): Promise<Application[]> {
  const apps = await loadApplications();
  const idx = apps.findIndex((a) => a.id === id);
  if (idx >= 0) {
    apps[idx] = { ...apps[idx], ...patch, updatedAt: new Date().toISOString() };
    await saveApplications(apps);
  }
  return apps;
}

/** Limpa tudo (usado em "sair da conta" ou reset). */
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([K_PROFILE, K_APPLICATIONS, K_SETTINGS]);
}
