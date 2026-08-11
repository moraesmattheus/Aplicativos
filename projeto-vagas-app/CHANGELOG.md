# CHANGELOG — Diário de bordo do projeto

> **Leitura/escrita obrigatória para todas as IAs e pessoas.** Ver a REGRA DE OURO em `AGENTS.md` (0.2).
>
> **Preservar:** não apague nem sobrescreva código que funciona. Mudança = adição/extensão.
> Só alterar/remover existente se for **bug comprovado** ou **pedido do dono** — e registrar aqui.
>
> **Registrar:** a cada alteração, adicione uma entrada NO TOPO da lista, com este formato:

```
## [AAAA-MM-DD] — <Autor: qual IA ou pessoa>
- O QUE: <objetivo da mudança>
- ONDE: <arquivos/funções exatas>
- MUDOU: <adicionado | alterado | removido> — <detalhe>
- POR QUÊ: <bug? pedido do dono? nova feature?>  (se removeu/alterou algo, diga o que era antes)
- STATUS: <ok / tsc limpo / pendências>
```

---

## [2026-08-11] — Claude (Opus 4.8) — Doc de estrutura + limpeza de lixo

- **O QUE:** documentar o que é cada pasta/arquivo e remover lixo.
- **ONDE / MUDOU:**
  - ADICIONADO **`ESTRUTURA.md`** — guia anotado de cada pasta/arquivo + as 5 abas.
  - REMOVIDO **`path/to/the_file.txt`** (pasta `path/`) — placeholder de tutorial (conteúdo: "Contents of
    the file"), lixo acidental, estava untracked.
- **POR QUÊ:** pedido do dono (entender a estrutura; e deletar lixo digital).
- **STATUS:** ok.

---

## [2026-08-11] — Claude (Opus 4.8) — EAS Update (OTA): atualizar sem rebuildar

- **O QUE:** habilitar **atualização over-the-air (OTA)** — mudanças de JS/telas caem no celular
  **sem novo build**. (Pedido do dono: beta, builds demoram.)
- **ONDE / MUDOU:**
  - Instalado **`expo-updates`**; `eas update:configure` gravou `updates.url` +
    `runtimeVersion {policy: appVersion}` no `app.json`, e `channel` (development/preview/production) no `eas.json`.
  - Cancelado o build anterior (sem OTA) — será rebuildado **uma vez** com OTA.
  - Adicionado **`.github/workflows/eas-update.yml`** (raiz do repo apps-claude): a cada push em
    `projeto-vagas-app/**` roda `eas update --branch preview`. Filtro **não afeta o rota-de-vida**.
- **POR QUÊ:** pedido do dono — atualizar o app sem ficar rebuildando no dev.
- **PENDENTE p/ o dono:** criar o secret **`EXPO_TOKEN`** no GitHub (Settings → Secrets → Actions) para
  o Action publicar. Token gerado em expo.dev → Account → Settings → Access tokens.
- **COMO FICA:** depois de **1 rebuild** (instala 1 última vez), todo push com mudança de **JS/tela**
  atualiza o app sozinho ao abrir. Mudança **nativa** (lib nativa, permissão, ícone) ainda pede rebuild.
- **STATUS:** OTA configurado; falta o rebuild final do APK (disparado a seguir) e o secret EXPO_TOKEN.

---

## [2026-08-11] — Claude (Opus 4.8) — EAS: projeto criado + build do APK

- **O QUE:** configurar o EAS e gerar o APK instalável (Android).
- **ONDE / MUDOU:**
  - `app.json` — ADICIONADO `extra.eas.projectId` = `52475c96-764d-4fd5-86bf-24fae1319d98`.
  - Projeto EAS criado: **`@moraesmattheus/projeto-vagas-app`** (conta pessoal do dono).
  - `npm install` rodado local nesta pasta (node_modules é gitignored, não vai pro repo).
  - `eas build -p android --profile preview` disparado (perfil que gera `.apk`).
- **POR QUÊ:** pedido do dono ("baixar o app no celular"). Login Expo feito pelo dono; sessão em `~/.expo`.
- **STATUS:** build roda na nuvem da Expo (~10-20 min). Link do `.apk` sai ao final.

---

## [2026-08-11] — Claude (Opus 4.8) — Organização: um lugar só, um repo só

- **O QUE:** consolidar tudo em `apps-claude/projeto-vagas-app` e remover duplicatas/lixo (pedido do dono).
- **ONDE / MUDOU (REMOÇÕES):**
  - Removido o **`.git` aninhado** que estava dentro de `apps-claude/projeto-vagas-app/` — era um clone
    do repo `github.com/moraesmattheus/emprego`. História preservada no GitHub; localmente virava confusão.
  - Deletados **`backend/`, `data/`, `frontend/`** de `projeto-vagas-app/` — protótipo inicial já
    substituído pelo app real (`src/services/matching.ts`, `src/data/sampleJobs.ts`) e documentado.
  - Deletada a pasta duplicada **`C:\Users\matth\Downloads\Apps\emprego\`** inteira — era cópia
    idêntica do app (verificado por diff: nada único, nada diferente).
  - **MANTIDO:** `modelo/` (9 PDFs do fluxograma/blueprint — referência valiosa), agora rastreado no repo.
- **POR QUÊ:** pedido do dono ("tudo em um único lugar; se for lixo digital, delete").
- **PENDENTE p/ o dono:** apagar o repositório `github.com/moraesmattheus/emprego` (agora redundante —
  conteúdo consolidado aqui). Só ele pode deletar repo no GitHub.
- **STATUS:** ✅ Local limpo: `Downloads\Apps\` contém só `apps-claude`. `rota-de-vida` intocado. Falta push.

---

## [2026-08-11] — Claude (Opus 4.8) — Integra no monorepo apps-claude

- **O QUE:** mover o app para dentro do repositório existente `moraesmattheus/apps-claude`
  (onde já mora o `rota-de-vida`), como pedido pelo dono.
- **ONDE / MUDOU:**
  - Repo `apps-claude` clonado localmente em `C:\Users\matth\Downloads\Apps\apps-claude`.
  - App copiado para a subpasta **`apps-claude/projeto-vagas-app/`** (sem `.git`/`node_modules`).
  - Commit `791013a` no branch `main` — **só a pasta nova** (73 arquivos). `rota-de-vida`, `index.html`
    e `README.md` da raiz **NÃO foram tocados** (verificado com `git status`).
  - AGENTS.md seção 0 atualizada: local canônico agora é `apps-claude/projeto-vagas-app`.
- **POR QUÊ:** pedido do dono (um repo, dois apps separados; não mexer no rota-de-vida).
- **STATUS:** commit local ✅. **`git push` pendente** (autenticação do GitHub — o ambiente do agente
  não faz login; o dono empurra pelo VS Code ou terminal). A cópia antiga em `emprego/` virou leftover.

---

## [2026-08-11] — Claude (Opus 4.8) — Setup GitHub + EAS/APK

- **O QUE:** preparar o versionamento no GitHub e o build do APK instalável.
- **ONDE / MUDOU:**
  - `eas.json` (NOVO) — perfis de build; o perfil `preview` gera **APK** Android instalável.
  - `app.json` (ALTERADO):
    - `name`: "projeto-vagas-app" → **"Radar de Vagas"** (nome de exibição no celular).
    - `android.package` (ADICIONADO): `com.moraesmattheus.radardevagas` (obrigatório p/ build).
    - plugin `expo-calendar` (ADICIONADO) com texto de permissão de calendário.
  - `git init` — projeto virou repositório próprio; **1º commit** `7fb8be0` (73 arquivos).
- **POR QUÊ:** pedido do dono (subir no GitHub e conseguir instalar o app no celular).
- **STATUS:** commit local ✅. **Push ao GitHub e `eas build` dependem do login do dono** (Expo/GitHub) —
  comandos entregues no chat. Nada de código de produto foi alterado (só config de build/publicação).

---

## [2026-08-11] — Claude (Opus 4.8) — Fase 1 (criação do app)

- **O QUE:** Construir o app do zero (MVP funcional) a partir do fluxograma do dono.
- **ONDE / MUDOU (tudo ADICIONADO — nada removido de trabalho do dono):**
  - `src/types.ts` — tipos `Job`, `JobMatch`, `Application`, `Profile`, `KanbanStage`, `ScoreBreakdown`;
    `priorityFor()` (faixas 85/75/60/40); `DEFAULT_PROFILE` (Marketing/Performance).
  - `src/services/skills.ts` — normalização, sinônimos, dicionário de skills (tech + marketing), `extractSkills()`.
  - `src/services/matching.ts` — `computeMatch()` (score + breakdown), `passesLocationFilter()` (Floripa), `rankJobs()`.
  - `src/services/storage.ts` — persistência AsyncStorage (perfil, candidaturas, settings) + tipo `Settings`.
  - `src/services/jobs.ts` — agregador de 6 fontes (Remotive, RemoteOK, Arbeitnow, JSearch, Adzuna, Jooble) + dedup.
  - `src/services/calendar.ts` — `expo-calendar` → Google Calendar do aparelho, alertas 24h/1h/15min.
  - `src/store/AppStore.tsx` — estado global (`AppProvider`, `useApp()`).
  - `src/components/ui.tsx` — Card, Chip, Bar, Muted, SectionTitle, ScoreBadge.
  - `src/components/JobCard.tsx` — card de vaga + candidatura assistida.
  - `src/app/_layout.tsx` — navegação por 5 abas (reescreveu o layout do template de scaffold).
  - `src/app/index.tsx` (Dashboard), `vagas.tsx`, `kanban.tsx`, `agenda.tsx`, `perfil.tsx`, `config.tsx` — telas.
  - `src/data/sampleJobs.ts` — vagas de exemplo (fallback).
  - `src/constants/theme.ts` — ampliou a paleta (tint, success, warning, danger, border, card).
  - `src/global.d.ts` — declaração de módulos `*.css` p/ o tsc.
  - `AGENTS.md`, `CLAUDE.md`(já existia apontando p/ AGENTS), `README.md`, `.cursorrules`,
    `.github/copilot-instructions.md`, este `CHANGELOG.md` — documentação/handoff entre IAs.
- **REMOVIDO (só arquivos-molde do scaffold create-expo-app, NÃO trabalho do dono):**
  - `src/app/explore.tsx`, `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`
  - POR QUÊ: eram telas/exemplos do template padrão que referenciavam rotas inexistentes e davam erro
    de typecheck; substituídos pela navegação e telas reais do produto.
- **DEPENDÊNCIAS ADICIONADAS:** `@react-native-async-storage/async-storage`, `expo-calendar`,
  `@expo/vector-icons`, `@expo/metro-runtime`.
- **POR QUÊ:** entrega da Fase 1 do produto (visão do fluxograma).
- **STATUS:** ✅ `npx tsc --noEmit` limpo. Renderizou no preview web sem erros de console.
  App roda 100% local (sem backend). Próximo passo: ver seção 0 do AGENTS.md.
