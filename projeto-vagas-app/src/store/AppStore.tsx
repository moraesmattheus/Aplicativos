// Estado global do app: perfil, candidaturas (Kanban) e configurações.
// Carrega do armazenamento na montagem e expõe ações que persistem + atualizam a UI.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Application, DEFAULT_PROFILE, Job, KanbanStage, Profile } from '@/types';
import * as storage from '@/services/storage';
import { DEFAULT_SETTINGS, Settings } from '@/services/storage';

interface AppState {
  ready: boolean;
  profile: Profile;
  settings: Settings;
  applications: Application[];
  // ações
  saveProfile: (p: Profile) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  addApplication: (job: Job, match: number, stage?: KanbanStage) => Promise<void>;
  moveApplication: (id: string, stage: KanbanStage) => Promise<void>;
  removeApplication: (id: string) => Promise<void>;
  patchApplication: (id: string, patch: Partial<Application>) => Promise<void>;
  isSaved: (jobId: string) => boolean;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [applications, setApplications] = useState<Application[]>([]);

  const reload = useCallback(async () => {
    const [p, s, a] = await Promise.all([
      storage.loadProfile(),
      storage.loadSettings(),
      storage.loadApplications(),
    ]);
    setProfile(p);
    setSettings(s);
    setApplications(a);
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setReady(true);
    })();
  }, [reload]);

  const saveProfile = useCallback(async (p: Profile) => {
    setProfile(p);
    await storage.saveProfile(p);
  }, []);

  const saveSettings = useCallback(async (s: Settings) => {
    setSettings(s);
    await storage.saveSettings(s);
  }, []);

  const addApplication = useCallback(
    async (job: Job, match: number, stage: KanbanStage = 'Salvas') => {
      const now = new Date().toISOString();
      const app: Application = {
        id: job.id,
        job,
        match,
        stage,
        createdAt: now,
        updatedAt: now,
        history: [{ stage, at: now }],
      };
      const next = await storage.upsertApplication(app);
      setApplications(next);
    },
    [],
  );

  const moveApplication = useCallback(async (id: string, stage: KanbanStage) => {
    const next = await storage.moveApplication(id, stage);
    setApplications([...next]);
  }, []);

  const removeApplication = useCallback(async (id: string) => {
    const next = await storage.removeApplication(id);
    setApplications(next);
  }, []);

  const patchApplication = useCallback(async (id: string, patch: Partial<Application>) => {
    const next = await storage.patchApplication(id, patch);
    setApplications([...next]);
  }, []);

  const savedIds = useMemo(() => new Set(applications.map((a) => a.id)), [applications]);
  const isSaved = useCallback((jobId: string) => savedIds.has(jobId), [savedIds]);

  const value: AppState = {
    ready,
    profile,
    settings,
    applications,
    saveProfile,
    saveSettings,
    addApplication,
    moveApplication,
    removeApplication,
    patchApplication,
    isSaved,
    reload,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>');
  return ctx;
}
