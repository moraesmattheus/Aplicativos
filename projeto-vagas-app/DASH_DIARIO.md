# 📊 DASH DIÁRIO — Radar de Vagas

> Painel de status vivo. **Atualizado a cada mudança relevante.** Última atualização no rodapé.
> Histórico detalhado fica no `CHANGELOG.md`; regras e visão no `AGENTS.md`.

---

## 🟢 Estado geral: **Fase 2 em andamento** (app funcional + IA ligada)

## ✅ O que está funcionando (hoje, 2026-08-14)
- **App rodando no aparelho** (Samsung Galaxy **S26 Ultra**, Android 16) — build de **dev**, servido pelo **Metro** (local, via USB `adb reverse`).
- **Busca de vagas:** Gupy (BR, ~100 vagas) + **JSearch/Google for Jobs** (LinkedIn/Indeed/Catho/Vagas) + Remotive/RemoteOK/Arbeitnow.
- **Chave JSearch** embutida no build (`EXPO_PUBLIC_JSEARCH_KEY` via `.env` + secret EAS) → **sobrevive a rebuild**.
- **Análise de CV com IA** (aba Currículo → "Analisar com IA") → backend Cloudflare Worker + **Gemini `gemini-flash-latest`** (200 OK).
- **Currículo:** upload de PDF/DOCX sem crash (correção OOM/StackOverflow de ontem, agora commitada).
- **Kanban, Agenda, Perfil, Dashboard** — ok.

## 🔧 O que mudou hoje
- **Config enxuta:** removidos campos de chave (JSearch/Adzuna/Jooble) e campo do backend de IA da tela Config. Menos carga no front.
- **Chaves via secret:** Adzuna e Jooble agora usam EXPO_PUBLIC_* como fallback (igual ao JSearch) — ativas sem o usuário digitar nada.
- **Status de fontes:** painel mostra "embutida no app" quando a chave vem do secret EAS.
- **Adzuna/Jooble:** NÃO havia chaves no histórico. Placeholders no .env criados; usuário precisa obter as chaves.
- Consertada a **Gupy** (host morto 404 → `employability-portal`) + paginação.
- Consertado o **JSearch** (v5: `/search` → `/search-v2`, vagas em `data.jobs`).
- **Chave JSearch** passa a sobreviver a rebuild (EAS secret + `.env`).
- **Commitadas** as correções de **crash do Currículo** (estavam soltas, sem commit).
- **Backend IA:** `gemini-2.0-flash` (descontinuado) → **`gemini-flash-latest`** + retry em 503.
- Revisão pós-**rename do repo** (`apps-claude` → `Aplicativos`); remote local atualizado.

## ⏳ Pendências
- [x] ~~**Apagar 787 MB de lixo**~~ — arquivos **não encontrados** (já deletados em sessão anterior). ✅
- [x] ~~**Limpar 12 duplicatas** da entrada "Gemini Skill" no `CHANGELOG.md`~~ — **11 removidas, 1 mantida**, commitado (`ae6612d`). ✅
- [x] **Build de dev** (Metro/USB) — **decisão tomada**: continuar no dev build por ora. APK standalone quando necessário. ✅
- [ ] Login e senha (Firebase) · Preparar lançamento (LinkedIn) — próximas fases.
- [ ] Adzuna/Jooble: pegar chaves grátis (opcional, mais fontes).

## 🖥️ Ambiente
- **Projeto:** `C:\Users\matth\Downloads\Apps\apps-claude\projeto-vagas-app`
- **Repo:** GitHub `moraesmattheus/Aplicativos` (monorepo, ao lado do `rota-de-vida`)
- **Device:** `RXGL305VF2J` (S26 Ultra) — USB, `adb reverse tcp:8081`
- **Metro:** rodando local na 8081 (dev-client)
- **Backend IA:** `https://radar-vagas-backend.radar-vagas.workers.dev` (Cloudflare Worker + Gemini)
- **JDK p/ build nativo:** 17 em `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot` (o 25 é incompatível)

---
_Atualizado: 2026-08-14 11:xx — por Claude (Fable 5). Config enxuta; chaves via EXPO_PUBLIC secret; tsc limpo._


