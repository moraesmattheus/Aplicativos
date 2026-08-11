# 🎯 Radar de Vagas — CRM pessoal de carreira

App Android (Expo / React Native) que **encontra vagas**, calcula a **compatibilidade com o seu CV**,
te ajuda a **candidatar (modo assistido)**, organiza tudo num **Kanban** e agenda entrevistas no
**Google Calendar**. Baseado no fluxograma do produto.

> Ciclo: **Perfil → Busca → Filtro → Deduplicação → Matching → Score → Priorização → Candidatura →
> Kanban → Follow-up → Entrevista → Google Calendar**.

---

## ✅ O que já está pronto (Fase 1 — roda sem servidor)

- **Perfil / CV** editável (competências, cargo, senioridade, cidade, contratação, etc.).
- **Radar de vagas** buscando em APIs agregadoras legítimas:
  - Sem chave (já funcionam): **Remotive, RemoteOK, Arbeitnow**.
  - Com chave grátis (mais cobertura, inclui Google for Jobs → LinkedIn/Gupy/Indeed/Catho/Vagas...):
    **JSearch, Adzuna, Jooble** — configuráveis em *Perfil → ⚙️ Configurações*.
- **Filtro de localização**: remoto liberado; presencial/híbrido **só em Florianópolis**.
- **Normalização + deduplicação** de vagas repetidas entre plataformas.
- **Score de compatibilidade** com breakdown (skills, cargo, senioridade, localização) e
  **priorização por faixas** (85 / 75 / 60 / 40 — igual ao fluxograma).
- **Candidatura assistida**: abre a vaga e registra no Kanban.
- **Kanban** com etapas (Salvas → Aplicado → Triagem → Entrevista → Proposta → Encerrado).
- **Agenda**: cria entrevista no **Google Calendar** (via calendário do aparelho) com alertas 24h/1h/15min.
- **Dashboard** com estatísticas e ações pendentes (follow-ups, entrevistas).
- **Armazenamento local** (AsyncStorage), com a camada de dados isolada para trocar por Firestore.

## 🔜 Próximas fases

- **Fase 2 — IA (backend Firebase + Claude API):** ler CV em PDF, análise profunda da vaga,
  gerar carta/versão do CV, sugerir respostas, **central de comunicações (Gmail)** classificando
  entrevista/status/rejeição, mensagens de follow-up e **aprendizado (ML)** de conversão.
- **Fase 3 — Publicação:** login Google (Firebase Auth), sincronização Firestore, build do APK (EAS)
  e **assinatura** (Google Play Billing / RevenueCat).

---

## ▶️ Como rodar

```bash
npm install
npm run web      # abre no navegador (teste rápido)
npm run android  # abre no celular/emulador via Expo Go ou dev build
```

No celular: instale o app **Expo Go**, rode `npx expo start` e leia o QR Code.

## 🔑 Chaves de API (opcional, para busca ampla)

Todas gratuitas. Configure em *Perfil → ⚙️ Configurações*:

| Fonte   | Onde pegar                                                        |
|---------|------------------------------------------------------------------|
| JSearch | https://rapidapi.com (assine o JSearch — Google for Jobs)        |
| Adzuna  | https://developer.adzuna.com (App ID + App Key)                  |
| Jooble  | https://br.jooble.org/api/about                                  |

## 📦 Gerar o APK (Android)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

O `--profile preview` gera um **.apk** instalável. Para a Play Store, use `--profile production` (gera `.aab`).

---

## 🗂️ Estrutura

```
src/
├── app/                 # telas (Expo Router)
│   ├── index.tsx        # Dashboard
│   ├── vagas.tsx        # Radar de vagas
│   ├── kanban.tsx       # Kanban de candidaturas
│   ├── agenda.tsx       # Entrevistas + Google Calendar
│   ├── perfil.tsx       # Perfil / CV
│   └── config.tsx       # Configurações (chaves de API)
├── components/          # UI reutilizável (JobCard, ui.tsx)
├── services/
│   ├── jobs.ts          # agregador das APIs de vaga
│   ├── matching.ts      # motor de compatibilidade
│   ├── skills.ts        # normalização/sinônimos de skills
│   ├── storage.ts       # persistência (AsyncStorage)
│   └── calendar.ts      # integração com o calendário
├── store/AppStore.tsx   # estado global (perfil, candidaturas, settings)
├── data/sampleJobs.ts   # vagas de exemplo (fallback)
└── types.ts             # tipos + faixas de priorização
```

## ⚠️ Notas honestas

- **Auto-candidatura total** em LinkedIn/Gupy/Solides não é confiável (bloqueiam robôs e viola os termos);
  por isso o app usa **modo assistido** — encontra, pontua e prepara, você confirma o envio.
- A busca "vasculha vários sites" via **agregadores legítimos** (o Google for Jobs já indexa a maioria),
  sem scraper frágil.
- **Não** guarde senhas de terceiros no app. Login será via **Google (OAuth)**, sem senha.
