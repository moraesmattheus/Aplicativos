# AGENTS.md — Contexto-mãe do projeto (LEIA ANTES DE TUDO)

> **Para qualquer IA (Claude, ChatGPT, Cursor, Copilot, Gemini…) e para humanos.**
> Este é o **arquivo de verdade** do projeto. Leia-o **inteiro** antes de escrever ou alterar
> qualquer código. Sempre que mudar algo relevante, **atualize este arquivo** na mesma tarefa.
> `CLAUDE.md` aponta para cá; ferramentas que leem `AGENTS.md` já pegam este contexto.

> **Expo mudou.** Antes de escrever código, consulte a doc versionada:
> https://docs.expo.dev/versions/v57.0.0/ — este projeto usa **Expo SDK 57 / React Native 0.86 /
> React 19 / Expo Router (file-based)**.

---

## 0. 📍 ONDE PARAMOS / PRÓXIMO PASSO  (atualize SEMPRE ao terminar)

> Esta é a primeira coisa que qualquer IA deve ler e a última que deve atualizar.
> Escreva aqui, em 1 minuto, onde o trabalho parou e qual é o próximo passo concreto.

- **Última sessão:** 2026-08-11 — Claude (Opus).
- **Estado:** ✅ **Fase 1 completa e funcionando** (typecheck limpo, renderizou no web sem erros).
  Todas as 5 telas + Config prontas. App roda 100% local. `eas.json` + `app.json` prontos p/ APK.
- **📁 CANÔNICO (onde trabalhar):** este app agora vive no monorepo
  **`apps-claude/projeto-vagas-app`** (repo GitHub `moraesmattheus/apps-claude`, ao lado do
  `rota-de-vida` — NÃO mexer no rota-de-vida). Localmente:
  `C:\Users\matth\Downloads\Apps\apps-claude\projeto-vagas-app`.
  A cópia antiga em `Downloads\Apps\emprego\projeto-vagas-app` é leftover local (pode ignorar/apagar).
- **PENDENTE que depende do dono (login):**
  - **`git push origin main`** no repo `apps-claude` — commit já feito local, falta autenticar o GitHub.
  - **`eas build -p android --profile preview`** — conta Expo (grátis) → gera APK; OU publicar como
    **PWA** no GitHub Pages (padrão do repo, igual rota-de-vida) para instalar pelo navegador.
- **PRÓXIMO PASSO sugerido (escolha um):**
  1. **Pegar o CV real do usuário** (área Marketing/Performance) e ajustar `DEFAULT_PROFILE`
     (`src/types.ts`) + dicionário (`src/services/skills.ts`) para o perfil verdadeiro.
  2. **Firebase Auth (login Google):** criar projeto Firebase, colar config, integrar (Tarefa 7).
  3. **Fase 2 (IA):** desenhar Cloud Function com Claude API para análise de CV/vaga.
- **Nada pela metade / sem TODO aberto no código.** Se você deixar algo incompleto, anote aqui.

## 0.1 🤝 Sinergia entre IAs (protocolo de colaboração)

Este projeto é construído por **várias IAs em conjunto** (Claude, ChatGPT/Codex, Cursor, Copilot,
Gemini…) + o dono humano. A regra é **cooperar e complementar**, nunca competir nem descartar o
trabalho anterior. Cada IA tem forças diferentes; somadas, entregam mais.

```
PROTOCOLO (toda IA segue):
1. LER  este AGENTS.md inteiro ANTES de agir (visão, estado, regras, decisões).
2. RESPEITAR as decisões já tomadas (seções 5, 6 e 8). Se discordar, PROPOR ao humano — não
   reescrever silenciosamente o que já funciona.
3. CONTINUAR de onde a anterior parou (seção 0), não recomeçar do zero.
4. COMPLEMENTAR: assuma tarefas que faltam ou que sua força resolve melhor
   (ex.: uma IA faz UI, outra faz o backend de IA, outra revisa segurança).
5. DEIXAR RASTRO: ao terminar, atualize a seção 0 (onde parou / próximo passo) e o
   changelog (seção 9) com data, autor (qual IA) e resumo. Atualize o README se algo visível mudou.
6. NÃO QUEBRAR contratos: alias `@/`, camada de storage, filtro de Floripa, priorização por faixas,
   modo assistido. Rode `npx tsc --noEmit` antes de dizer "pronto".
7. HANDOFF LIMPO: nada de meio-caminho sem anotar. Se parar no meio, escreva o que falta na seção 0.
```

Em resumo: **o próximo (IA ou humano) tem que conseguir continuar só lendo este arquivo.**
O objetivo do dono é **não perder nada** do que já foi feito — este arquivo é o seguro disso.

## 0.2 🔒 REGRA DE OURO — preservar + registrar (OBRIGATÓRIO)

> Decisão permanente do dono do projeto. Vale para **todas as IAs e humanos**, sempre.

```
PRESERVAR:
- NÃO apague, sobrescreva ou "refatore" código que já existe e funciona.
- Por padrão, MUDANÇA = ADIÇÃO/EXTENSÃO. Some funcionalidade sem destruir a anterior.
- Só é permitido alterar/apagar código existente quando:
    (a) for correção de BUG comprovado, ou
    (b) o dono humano pedir explicitamente a mudança.
  Em qualquer um dos casos, REGISTRE no CHANGELOG.md (o quê, onde, por quê).
- Na dúvida entre reescrever e adicionar → ADICIONE. Se achar que algo está errado, PROPONHA
  ao dono antes de mexer; não decida sozinho apagar.

REGISTRAR (log obrigatório a cada alteração):
- Toda IA/pessoa que mexer no projeto DEVE escrever no CHANGELOG.md, ANTES de encerrar:
    • DATA e AUTOR (qual IA ou pessoa)
    • O QUE foi feito (objetivo)
    • ONDE (arquivos/funções exatas mexidas)
    • O QUE MUDOU (adicionado / alterado / removido — e por quê)
    • Se removeu/alterou algo existente: MOTIVO (bug? pedido do dono?) e o que era antes.
- Também atualize a seção 0 (ONDE PARAMOS) deste AGENTS.md.
- Objetivo: quando surgir um problema, dá pra achar EXATAMENTE onde e o que corrigir, e reverter
  com segurança. O histórico nunca pode ficar "cego".
```

Ver **`CHANGELOG.md`** na raiz — é o diário de bordo detalhado do projeto. Mantê-lo atualizado é
tão obrigatório quanto o código compilar.

---

## 1. O que é o produto (visão)

App **Android** (depois iOS) que funciona como um **CRM pessoal de carreira + agente de recrutamento**.
Baseado no fluxograma do dono do projeto. Ciclo principal:

```
Perfil → Busca → Filtro → Deduplicação → Matching → Score → Priorização →
Candidatura → Kanban → Monitoramento → E-mail → Follow-up → Entrevista →
Google Calendar → Resultado → Aprendizado → Nova busca
```

**Objetivo do dono:** achar vagas compatíveis com o CV dele, pontuar compatibilidade,
candidatar-se (modo assistido), acompanhar tudo em Kanban, agendar entrevistas no Google Calendar,
e no futuro monetizar por **assinatura**. Hospedagem/versionamento no **GitHub**; login e nuvem via
**Firebase**; IA para análises (planejado com **Claude API**).

**Perfil do usuário (IMPORTANTE p/ calibrar o match):** área de **Marketing / Performance / Growth /
E-commerce** (Meta Ads, Google Ads, GA4, GTM, e-commerce). *Não é desenvolvedor* — as skills de dev
que aparecem em código antigo eram placeholder. Confirmar o CV real com o usuário quando possível.

**Localização:** vagas **remotas** de qualquer lugar; **presenciais/híbridas só em Florianópolis/SC**.

---

## 2. Estado atual — o que JÁ ESTÁ FEITO (Fase 1, funcionando)

Rodou, renderizou e passou no `tsc --noEmit` sem erros. Tudo **local, sem servidor**.

- **Perfil/CV** editável (`src/app/perfil.tsx`) — competências, cargo, senioridade, cidade,
  contratação, LinkedIn, portfólio, pretensão, resumo.
- **Radar de vagas** (`src/app/vagas.tsx` + `src/services/jobs.ts`) — agrega APIs legítimas:
  - **Sem chave (ligadas):** Remotive, RemoteOK, Arbeitnow.
  - **Com chave grátis (opcional):** JSearch (Google for Jobs → cobre LinkedIn/Gupy/Indeed/Catho/
    Vagas/InfoJobs etc.), Adzuna, Jooble. Configuráveis em `src/app/config.tsx`.
- **Filtro de localização** (`passesLocationFilter`) — remoto ok; presencial/híbrido só Floripa.
- **Normalização + deduplicação** de vagas (`dedupe` em `jobs.ts`).
- **Motor de compatibilidade** (`src/services/matching.ts` + `src/services/skills.ts`) — score 0-100
  com **breakdown** (skills, cargo, senioridade, localização) e **priorização por faixas**
  (`priorityFor` em `src/types.ts`): 85+ máxima, 75+ recomendada, 60+ avaliar, 40+ baixa, <40 descartar.
- **Candidatura assistida** (`src/components/JobCard.tsx`) — abre a vaga no navegador e registra no Kanban.
- **Kanban** (`src/app/kanban.tsx`) — colunas: Salvas → Aplicado → Triagem → Entrevista → Proposta → Encerrado.
- **Agenda** (`src/app/agenda.tsx` + `src/services/calendar.ts`) — cria evento no **Google Calendar**
  via `expo-calendar` (calendário do aparelho) com alertas 24h/1h/15min.
- **Dashboard** (`src/app/index.tsx`) — stats (candidaturas, entrevistas, match médio, taxa) + ações pendentes.
- **Armazenamento local** (`src/services/storage.ts`, AsyncStorage) — camada isolada, pronta p/ trocar por Firestore.
- **Estado global** (`src/store/AppStore.tsx`) — provider `AppProvider` + hook `useApp()`.

## 3. O que NÃO está feito (roadmap)

**Fase 2 — Camada de IA (precisa de backend Firebase Cloud Functions + Claude API, chave no servidor):**
ler CV em PDF/DOCX, análise profunda da vaga, gerar carta/versão do CV, sugerir respostas de
formulário, **central de comunicações (Gmail)** classificando entrevista/status/rejeição, mensagens
de follow-up, **aprendizado (ML)** de conversão.

**Fase 3 — Publicação/negócio:** login Google (**Firebase Auth**), sincronização **Firestore**,
build do **APK (EAS)**, e **assinatura** (Google Play Billing via **RevenueCat**).

---

## 4. Arquitetura e mapa de arquivos

```
src/
├── app/                 # telas (Expo Router, file-based)
│   ├── _layout.tsx      # AppProvider + ThemeProvider + Tabs (5 abas)
│   ├── index.tsx        # Dashboard
│   ├── vagas.tsx        # Radar de vagas (busca + ranking)
│   ├── kanban.tsx       # Kanban
│   ├── agenda.tsx       # Entrevistas + Google Calendar
│   ├── perfil.tsx       # Perfil / CV
│   └── config.tsx       # Configurações (chaves de API) — rota fora das abas (href:null)
├── components/
│   ├── JobCard.tsx      # card de vaga (candidatura assistida)
│   └── ui.tsx           # Card, Chip, Bar, Muted, SectionTitle, ScoreBadge
├── services/
│   ├── jobs.ts          # agregador das APIs + normalização + dedup
│   ├── matching.ts      # motor de compatibilidade + filtro de localização
│   ├── skills.ts        # normalização/sinônimos/dicionário de skills
│   ├── storage.ts       # persistência (AsyncStorage) + tipo Settings
│   └── calendar.ts      # expo-calendar (Google Calendar do aparelho)
├── store/AppStore.tsx   # estado global (perfil, candidaturas, settings)
├── data/sampleJobs.ts   # vagas de exemplo (fallback offline)
├── constants/theme.ts   # cores (claro/escuro), spacing, fonts
├── hooks/               # use-theme, use-color-scheme
└── types.ts             # Job, JobMatch, Application, Profile, KanbanStage, priorityFor()
```

**Fluxo de dados:** telas → `useApp()` (store) → `services/storage.ts`. A busca: `vagas.tsx` →
`searchJobs()` (`jobs.ts`) → `rankJobs()` (`matching.ts`) → lista ordenada de `JobMatch`.

---

## 5. REGRAS — o que FAZER  ✅  (diretrizes para IAs)

```
DO  usar TypeScript estrito; rodar `npx tsc --noEmit` antes de concluir qualquer alteração.
DO  manter os imports com alias `@/` → `src/` (ex.: `@/services/jobs`). `@/assets/` → `assets/`.
DO  passar TODA persistência por `src/services/storage.ts` (nunca chamar AsyncStorage direto na UI).
DO  manter a camada de storage com assinatura async, para trocar por Firestore sem reescrever telas.
DO  normalizar skills com `canonical()`/`extractSkills()` de `src/services/skills.ts` no matching.
DO  respeitar o filtro: remoto = qualquer lugar; presencial/híbrido = SÓ Florianópolis.
DO  usar as cores do tema (`useTheme()`), suportando claro e escuro.
DO  isolar cada fonte de vaga em try/catch — uma fonte que falha não pode derrubar a busca.
DO  escrever comentários e textos de UI em português.
DO  atualizar ESTE arquivo (AGENTS.md) e o README quando mudar arquitetura, telas ou decisões.
DO  preferir o modo ASSISTIDO de candidatura (o usuário confirma o envio).
```

## 6. REGRAS — o que NÃO FAZER  ⛔

```
DON'T fazer scraping de LinkedIn/Gupy/Solides/Indeed direto — bloqueiam robôs e viola os termos.
      Use as APIs agregadoras legítimas (JSearch/Adzuna/Jooble/Remotive/RemoteOK/Arbeitnow).
DON'T implementar auto-candidatura total sem consentimento — pode banir a conta do usuário.
      O padrão é assistido; só automatizar onde a plataforma permitir oficialmente.
DON'T guardar senhas de terceiros (LinkedIn etc.) no app. Login só via Google/OAuth.
DON'T commitar chaves de API no repositório. Chaves ficam em Settings (device) ou no backend.
DON'T colocar segredos/regras de negócio sensíveis no app cliente — quando houver IA, a chave da
      Claude API fica em Cloud Function (servidor), nunca no bundle do app.
DON'T quebrar o alias `@/`, nem mover arquivos sem atualizar imports e este mapa.
DON'T remover o filtro de Florianópolis nem a priorização por faixas (são requisitos do produto).
DON'T assumir que o usuário é dev — o perfil real é Marketing/Performance (ver seção 1).
DON'T apagar/sobrescrever/reescrever código que já funciona (ver REGRA DE OURO, seção 0.2).
      Só em caso de bug comprovado ou pedido do dono — e SEMPRE registrando no CHANGELOG.md.
DON'T encerrar sem registrar o que foi feito, onde e o que mudou (CHANGELOG.md + seção 0).
```

---

## 7. Como rodar / verificar

```bash
npm install
npx tsc --noEmit         # typecheck (deve passar sem erros antes de concluir)
npm run web              # preview rápido no navegador (localhost:8081)
npm run android          # no celular (Expo Go) ou dev build
```

**Gerar APK:**
```bash
npm i -g eas-cli && eas login && eas build:configure
eas build -p android --profile preview   # gera .apk instalável
```

**Notas de plataforma:** `expo-calendar` só funciona no app nativo (guardado com `Platform.OS==='web'`
em `calendar.ts`). No preview web do Expo Router, as abas ficam todas montadas no DOM (sobreposição
visual) — é artefato do web, no Android cada aba aparece isolada.

---

## 8. Decisões técnicas (e o porquê)

- **Expo + React Native (não Flutter):** gera APK sem Android Studio, reaproveita JS, roda no VS Code.
- **On-device primeiro (sem backend na Fase 1):** app prático de instalar; backend entra só na IA/sync.
- **Google for Jobs (JSearch) como fonte principal:** um endpoint legítimo já cobre dezenas de sites.
- **Google Calendar via `expo-calendar`:** sincroniza com o Google quando a conta está no aparelho —
  evita montar OAuth de Google Calendar na Fase 1.
- **AsyncStorage agora, Firestore depois:** velocidade agora, nuvem/multi-dispositivo quando logar.

---

## 9. Histórico de mudanças

O diário de bordo **detalhado e obrigatório** fica em **`CHANGELOG.md`** (raiz do projeto).
Toda alteração precisa ser registrada lá com: data, autor (IA/pessoa), o quê, onde (arquivos), o que
mudou e por quê. Ver a REGRA DE OURO (seção 0.2). Este AGENTS.md guarda só o resumo do estado atual
(seção 0); o histórico linha-a-linha vive no CHANGELOG.md.
