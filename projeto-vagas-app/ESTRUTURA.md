# 🗂️ Estrutura do projeto — o que é cada coisa

Guia rápido de cada pasta e arquivo. (Para regras/decisões, veja `AGENTS.md`.)

Legenda: 🟢 você mexe aqui · ⚙️ config · 🤖 gerado automático (não mexer/versionar) · 📄 documentação

```
projeto-vagas-app/
├── src/                     🟢 O CÓDIGO DO APP (é aqui que a mágica acontece)
│   ├── app/                 🟢 TELAS (cada arquivo = uma tela/rota — Expo Router)
│   │   ├── _layout.tsx      → esqueleto: providers + as 5 abas de baixo
│   │   ├── index.tsx        → aba "Início" (Dashboard: números + ações pendentes)
│   │   ├── vagas.tsx        → aba "Vagas" (radar: busca e ranqueia as vagas)
│   │   ├── kanban.tsx       → aba "Kanban" (funil das candidaturas)
│   │   ├── agenda.tsx       → aba "Agenda" (entrevistas + Google Calendar)
│   │   ├── perfil.tsx       → aba "Perfil" (seu CV)
│   │   └── config.tsx       → tela "Configurações" (chaves de API) — fora das abas
│   ├── components/          🟢 peças de tela reaproveitáveis
│   │   ├── JobCard.tsx      → o card de vaga (com % de match e botões)
│   │   └── ui.tsx           → botõezinhos, chips, barras, cartões
│   ├── services/            🟢 A LÓGICA (o "motor", sem tela)
│   │   ├── jobs.ts          → busca vagas nas APIs (Remotive, JSearch, Adzuna…)
│   │   ├── matching.ts      → calcula a % de compatibilidade com seu CV
│   │   ├── skills.ts        → entende sinônimos de skills (Meta Ads = Facebook Ads…)
│   │   ├── storage.ts       → salva seus dados no celular
│   │   └── calendar.ts      → cria evento no Google Calendar
│   ├── store/AppStore.tsx   🟢 memória global (perfil, candidaturas) que as telas leem
│   ├── data/sampleJobs.ts   🟢 vagas de exemplo (aparecem antes da 1ª busca)
│   ├── constants/theme.ts   🟢 cores e tamanhos (tema claro/escuro)
│   ├── hooks/               ⚙️ ajudinhas de tema (claro/escuro)
│   ├── types.ts             🟢 os "moldes" dos dados (Vaga, Perfil…) + faixas de match
│   └── global.css / .d.ts   ⚙️ fontes (web) + ajuste de tipos
│
├── assets/                  🟢 imagens: ícone do app, splash, ícones das abas
├── modelo/                  📄 os PDFs do SEU FLUXOGRAMA (o blueprint do produto)
├── scripts/reset-project.js ⚙️ utilitário do template (reseta o projeto — pode ignorar)
│
├── app.json                 ⚙️ config do app: nome, ícone, package Android, OTA, projectId EAS
├── eas.json                 ⚙️ config dos builds (perfis preview/production + canais OTA)
├── package.json             ⚙️ lista de bibliotecas + comandos (npm start / android / web)
├── package-lock.json        🤖 trava as versões exatas (não editar à mão)
├── tsconfig.json            ⚙️ config do TypeScript (define o atalho @/ = src/)
├── .gitignore               ⚙️ o que o git ignora (node_modules, .expo…)
│
├── AGENTS.md                📄 DOCUMENTO-MÃE (visão, estado, regras, roadmap) — leia 1º
├── CHANGELOG.md             📄 diário de bordo (o que mudou, quando, por quê)
├── ESTRUTURA.md             📄 este arquivo
├── README.md                📄 apresentação do projeto
├── CLAUDE.md                📄 aponta pro AGENTS.md (Claude lê)
├── .cursorrules             📄 aponta pro AGENTS.md (Cursor lê)
├── .github/                 📄 copilot-instructions.md (Copilot lê) — aponta pro AGENTS.md
│                              (a Action de auto-update fica na RAIZ do repo: apps-claude/.github/workflows/)
├── LICENSE                  ⚙️ licença (veio do template)
│
├── node_modules/            🤖 as bibliotecas instaladas — ENORME, não versiona, refaz com `npm install`
├── .expo/                   🤖 cache do Expo (router.d.ts, devices.json…) — apaga que refaz
├── .claude/                 ⚙️ config do Claude Code neste projeto
└── .vscode/                 ⚙️ config do VS Code (extensões recomendadas)
```

## 📱 As 5 abas do app (o que o usuário vê embaixo)

| Aba | Arquivo | O que faz |
|-----|---------|-----------|
| 🏠 Início | `src/app/index.tsx` | Painel: nº de candidaturas, entrevistas, match médio, ações pendentes |
| 🔎 Vagas | `src/app/vagas.tsx` | Busca automática nas APIs, aplica filtro (Floripa/remoto), ranqueia por match |
| 📋 Kanban | `src/app/kanban.tsx` | Funil: Salvas → Aplicado → Triagem → Entrevista → Proposta → Encerrado |
| 🗓️ Agenda | `src/app/agenda.tsx` | Marca entrevista no Google Calendar com alertas |
| 👤 Perfil | `src/app/perfil.tsx` | Seu CV (competências, cargo, cidade) — base do cálculo de match |

## 🔁 Como as partes conversam

```
Você (telas em src/app) → store (AppStore) → services (jobs/matching/storage)
                                   ↑
                          types.ts (os moldes) e skills.ts (sinônimos)
```

- **Telas** só mostram e recebem toques.
- **Store** guarda o estado e avisa as telas quando algo muda.
- **Services** fazem o trabalho pesado (buscar, pontuar, salvar).
- **types.ts** define o formato dos dados que circulam entre tudo.

## 🧹 O que dá pra apagar sem medo (regenerável)
`node_modules/`, `.expo/` — o Expo/npm recriam. Nunca commite esses (o `.gitignore` já cuida).
