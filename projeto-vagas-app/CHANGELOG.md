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
