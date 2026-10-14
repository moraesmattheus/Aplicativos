# Aplicativos 📱

> Apps que eu construo com **Claude Code** — de um plano de vida a um CRM de carreira com IA.
> *Apps I build with Claude Code — from a life-planning PWA to an AI-powered career CRM.*

Cada app fica em sua própria subpasta. Marketing de performance é minha base;
aqui é onde estou construindo produto e me aprofundando em tecnologia.

---

## 🎯 Radar de Vagas — CRM pessoal de carreira

App **Android (Expo / React Native)** que encontra vagas, calcula a
**compatibilidade com o seu currículo**, ajuda a candidatar em modo assistido,
organiza tudo num **Kanban** e agenda entrevistas no **Google Calendar**.

**Ciclo do produto:** Perfil → Busca → Filtro → Deduplicação → Matching → Score
→ Priorização → Candidatura → Kanban → Follow-up → Entrevista → Google Calendar.

- 📂 App: [`projeto-vagas-app`](./projeto-vagas-app/)
- 🌐 **Versão web (sem Expo, abre no navegador):** [`radar-vagas-web`](./radar-vagas-web/) · https://moraesmattheus.github.io/Aplicativos/radar-vagas-web/
- 🧠 Backend de IA: [`radar-vagas-backend`](./radar-vagas-backend/) — Cloudflare Workers + Google Gemini, lê currículo em **PDF/DOCX** (inclusive escaneado) e faz análise ATS. O app também roda **sem** o backend, com análise local.
- 🛠️ React Native · Expo · TypeScript · Cloudflare Workers · Gemini

## 🎙️ Anotações de Reunião - extensão grátis para Vivaldi/Chrome

Grava o áudio da aba + microfone, **transcreve localmente com Whisper** e gera
resumo e itens de ação - uma alternativa gratuita às Anotações IA do Notion.

- 📂 Pasta: [`vivaldi-anotacoes-reuniao`](./vivaldi-anotacoes-reuniao/) (instruções de instalação no README da pasta)
- 🛠️ JavaScript · Manifest V3 · Web Audio · Transformers.js (Whisper) · IndexedDB

## 🤖 Agente de Reuniões - grava sozinho (Windows)

Programa de bandeja que **detecta chamadas** (pelo uso do microfone) e **aulas/entrevistas** (pela agenda),
grava o áudio do PC + microfone **sem bot na reunião**, transcreve, separa quem falou, resume e envia ao
**Notion** no lugar certo. Compartilha o "cérebro" com a extensão.

- 📂 Pasta: [`agente-reunioes`](./agente-reunioes/) (instalação passo a passo no README da pasta)
- 🛠️ Electron · Whisper (Transformers.js) · Notion API · iCalendar

## 🧭 Rota de Vida — plano de vida do casal (PWA)

App do casal para acompanhar o plano de vida: **rota financeira** (Rota A × Rota B),
diário de bordo, mentalidade, ambiente e metas. É um **PWA instalável** na tela
inicial do celular, funciona offline e **atualiza sozinho** quando o código muda.

- 📂 Pasta: [`rota-de-vida`](./rota-de-vida/)
- 🌐 No ar: https://moraesmattheus.github.io/Aplicativos/rota-de-vida/
- 🛠️ PWA · HTML/JS · Service Worker · Web Manifest

---

## 🗂️ Estrutura / Structure

```
Aplicativos/
├── projeto-vagas-app/     # Radar de Vagas — app Android (Expo/React Native)
├── radar-vagas-web/       # Radar de Vagas em versão web (HTML/JS puro, sem Expo)
├── radar-vagas-backend/   # Backend de IA (Cloudflare Workers + Gemini)
└── rota-de-vida/          # PWA de plano de vida (publicado no GitHub Pages)
```

---

<sub>Feito por <a href="https://github.com/moraesmattheus">Mattheus Moraes</a> · Florianópolis, SC · marketing de performance em transição para tech.</sub>
