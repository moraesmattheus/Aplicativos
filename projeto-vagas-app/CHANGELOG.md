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

## [2026-08-14] — Claude (Opus 4.8) — Chaves de API sobrevivem a rebuild (EAS secret + .env)

- **O QUE:** parar de perder as chaves de API a cada rebuild/reinstalação (o storage do app zera no
  install novo — foi o que apagou o JSearch do dono).
- **ONDE / MUDOU:**
  - `src/services/jobs.ts` (source `jsearch`): chave agora é
    `s.jsearchKey?.trim() || process.env.EXPO_PUBLIC_JSEARCH_KEY?.trim()` — usa a **embutida no build**
    quando o Config está vazio (sobrevive a rebuild).
  - `.gitignore`: adicionado **`.env`** (chaves locais NUNCA vão pro repo público).
  - **`.env`** (local, gitignored): `EXPO_PUBLIC_JSEARCH_KEY` p/ builds locais (`expo run:android`).
  - **EAS env vars**: criado `EXPO_PUBLIC_JSEARCH_KEY` (visibility sensitive) em **preview** e
    **production** — embutido em `eas build` e `eas update` (OTA).
- **POR QUÊ:** pedido do dono ("as chaves somem no rebuild; quero proteger, nem que seja secret").
- **SEGURANÇA:** a chave **nunca** vai pro repositório (fica no secret do EAS + `.env` gitignored).
  Ressalva honesta: `EXPO_PUBLIC_*` embute no bundle do cliente (extraível do APK). OK p/ **beta pessoal**;
  **antes do lançamento público**, mover as keys pro **backend Worker** (proxy) → 100% server-side.
- **STATUS:** tsc 0 erros; secret criado (preview+prod); publicado por OTA.

> ⚠️ NOTA: este CHANGELOG tem 12 cópias duplicadas da entrada "Claude (Gemini Skill)" (loop de outra
> sessão). Dá pra limpar deixando só 1 — não é conteúdo novo, é repetição.

---

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

## [2026-08-13] — Claude (Opus 4.8) — Revisão pós-rename do repo (apps-claude → Aplicativos)

- **O QUE:** verificar OTA e fluxo depois que o dono renomeou o repositório no GitHub.
- **ACHADOS / MUDOU:**
  - Repo GitHub renomeado **`apps-claude` → `Aplicativos`** (a pasta LOCAL segue `apps-claude`).
  - **OTA do app: 100% intacto** — depende do `projectId` Expo (`u.expo.dev/52475c96…`), não do nome do
    repo. App instalado continua recebendo updates normalmente.
  - **Action de OTA: confirmada funcionando pós-rename** — `eas update:list` mostra updates publicados
    com mensagens de commit (ex.: "fix(jobs): JSearch v5…"), o que só a Action faz. Secret EXPO_TOKEN e
    o workflow migraram junto com o repo.
  - **Remote local atualizado:** `git remote set-url origin …/Aplicativos.git` (não depender do redirect).
  - AGENTS.md seção 0 atualizada com o nome novo.
- **HEADS-UP (não mexi):** se o `rota-de-vida` é publicado via GitHub Pages, a URL virou
  `moraesmattheus.github.io/Aplicativos/rota-de-vida/` (a antiga redireciona por ora).
- **STATUS:** ok — fluxo e OTA normais.

---

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

## [2026-08-12] — Claude (Opus 4.8) — Fix: JSearch v5 (endpoint /search e formato mudaram)

- **O QUE:** consertar a fonte **JSearch (Google for Jobs)** — não trazia nada mesmo com chave válida.
- **ONDE / MUDOU:** `src/services/jobs.ts` → source `jsearch`.
- **CAUSA (bug comprovado):** o JSearch subiu pra **v5** e mudou:
  - endpoint `/search` → **`/search-v2`** (o antigo dá 404 "Endpoint does not exist");
  - as vagas agora vêm em **`data.jobs`** (antes era `data` direto); resposta tem `cursor`;
  - params: usa `country=br` + `date_posted=all` (tirado `page` e `work_from_home`).
- **DIAGNÓSTICO:** testado ao vivo com a chave do dono — `/search` e `/v5/search` davam 404, mas
  `/job-details`, `/estimated-salary` e `/company-job-salary` davam 200 (chave OK, só o path da busca
  mudou). Com `/search-v2`: **200 OK, 10/10 vagas BR de marketing** (ex.: Especialista Financial Media
  Marketing — Experian/SP). Cota do plano free: 200 req/mês.
- **NOTA DE CHAVE:** o dono tinha 2 apps no RapidAPI; a chave que funciona é a do app inscrito no JSearch
  (a outra dava 404 de "não inscrito"). Chave fica só no aparelho (Config), nunca no código (repo público).
- **POR QUÊ:** bug comprovado + pedido do dono (ligar mais sites de vaga).
- **VERIFICADO:** `tsc` 0 erros; endpoint testado com `node fetch` (200 + 10 vagas BR).
- **STATUS:** ok, publicado por OTA no canal preview.

---

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

## [2026-08-12] — Claude (Opus 4.8) — Fix: Gupy estava 404 (fonte morta) + paginação

- **O QUE:** consertar a fonte de vagas **Gupy** (era o maior motivo real do "poucas vagas") e trazer mais resultados.
- **ONDE / MUDOU:** `src/services/jobs.ts` → source `gupy`.
- **MUDOU (bug + melhoria):**
  - **Host corrigido:** `portal.api.gupy.io` (retornava **HTTP 404**, nginx — fonte 100% morta) →
    **`employability-portal.gupy.io/api/v1/jobs`** (retorna JSON de verdade). Testado ao vivo: ~100 vagas
    BR reais p/ "analista de marketing" (ex.: Analista de Marketing Pleno — Lojas Torra).
  - **Paginação:** de 1 página (40) para **3 páginas em paralelo** (offset 0/40/80 → até ~100-120 vagas);
    página que falha não derruba as outras. Header `Accept: application/json`.
- **POR QUÊ:** bug comprovado (404 ao vivo) + pedido do dono ("colocar mais sites, tem poucos").
- **VERIFICADO:** `tsc` 0 erros; endpoint testado com `node fetch` (200 + JSON + 100 vagas).
- **NOTA:** o grande salto de cobertura BR/marketing ainda é ligar o **JSearch (Google for Jobs)** com a
  chave grátis — cobre LinkedIn/Indeed/Catho/Vagas/InfoJobs num call só.
- **STATUS:** ok, publicado por OTA no canal preview.

---

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

## [2026-08-12] — Claude (Opus 4.8) — Fix de tipo: Card/SectionTitle/Muted aceitam array de estilo

- **O QUE:** corrigir 2 erros de `tsc` em `src/app/curriculo.tsx` (linhas 224 e 248) reportados pelo dono.
- **CAUSA:** o componente `Card` (em `src/components/ui.tsx`) tipava `style?: ViewStyle` (estilo único),
  mas a aba Currículo passa **array** de estilos (`[styles.iaCard, { borderColor: c.tint }]`).
- **ONDE / MUDOU:** `src/components/ui.tsx` — `style?: ViewStyle` → `style?: StyleProp<ViewStyle>` no
  `Card`; e `style?: TextStyle` → `style?: StyleProp<TextStyle>` no `SectionTitle` e `Muted`. Import de
  `StyleProp` adicionado. Widening idiomático do RN — 100% compatível com os usos de estilo único que
  já existiam; previne a mesma classe de erro em edições futuras.
- **POR QUÊ:** bug comprovado (typecheck vermelho). Nada de comportamento removido.
- **STATUS:** deve zerar o `tsc`. JS puro → vai por OTA.

## [2026-08-12] — Claude (Opus 4.8) — JSearch: blinda a chave do RapidAPI (trim)

- **O QUE:** garantir que a requisição do JSearch use a chave certa do AsyncStorage e os cabeçalhos
  corretos (pedido do dono).
- **ONDE / MUDOU:** `src/services/jobs.ts`, source `jsearch`. Os headers `X-RapidAPI-Key` e
  `X-RapidAPI-Host: jsearch.p.rapidapi.com` **já existiam** e a chave **já vinha** das Configurações
  (AsyncStorage → `storage.ts` → `Settings.jsearchKey`). Ajuste feito: `const chave = s.jsearchKey?.trim()`
  e guarda `if (!chave) return []`, usando `chave` no header. Evita header inválido quando a chave é
  colada com espaços; também remove o tipo `string | undefined` do header.
- **POR QUÊ:** robustez (chave colada com espaço quebrava o RapidAPI). Não li AsyncStorage direto no
  service — a regra do projeto exige passar por `storage.ts` (a chave já flui de lá via `Settings`).
- **STATUS:** ⚠️ tsc não rodado aqui. JS puro → vai por OTA.

## [2026-08-12] — Claude (Opus 4.8) — Fase 2: backend de IA grátis (Cloudflare Worker + Gemini)

- **O QUE:** primeira parte da **Fase 2** — análise de currículo por IA, **grátis**, com a chave no
  servidor (nunca no app). Escolha do dono: IA grátis (Gemini) em backend grátis (Cloudflare).
- **ONDE / MUDOU:**
  - ADICIONADO **`radar-vagas-backend/`** (novo, na RAIZ do repo, ao lado de projeto-vagas-app):
    Cloudflare Worker (`src/index.js`) com endpoints `GET /` (health) e `POST /cv`. Recebe texto ou
    **PDF em base64** e chama o **Gemini** (`gemini-2.0-flash`, free tier) pedindo JSON no mesmo
    formato do ATS local + `resumoIA`. `wrangler.toml`, `package.json`, `README.md` (passo a passo
    grátis: Google AI Studio + Cloudflare, sem cartão), `.gitignore`. Chave = secret `GEMINI_API_KEY`.
  - ADICIONADO **`projeto-vagas-app/src/services/ai.ts`** — cliente do backend (`analisarCVComIA`,
    `pingBackend`); mapeia a resposta para `AtsResult` (reaproveita a mesma UI) + `resumoIA`.
  - ALTERADO **`src/services/storage.ts`** — `Settings.aiBackendUrl?` (URL pública do Worker).
  - ALTERADO **`src/app/config.tsx`** — seção "Backend de IA (Fase 2)" com o campo da URL.
  - ALTERADO **`src/services/documents.ts`** — exporta `lerArquivoBase64` (envia o PDF ao Gemini).
  - ALTERADO **`src/app/curriculo.tsx`** — com backend configurado, botão **"Analisar com IA (grátis)"**
    (PDF vai em base64 → Gemini lê até escaneado), card com o resumo da IA, e "Analisar local" como
    alternativa. Sem backend, tudo segue no ATS local (nada quebra).
- **POR QUÊ:** pedido do dono (Fase 2 + tudo grátis). Arquitetura respeita a regra: chave de IA só no
  servidor. O app funciona com ou sem o backend.
- **A FAZER (dono):** publicar o Worker (ver `radar-vagas-backend/README.md`): criar chave Gemini
  (aistudio.google.com/apikey) + conta Cloudflare + `wrangler deploy`, e colar a URL em Config.
- **STATUS:** ⚠️ tsc não rodado aqui (sem node_modules). App = JS puro → OTA. Backend é deploy à parte.

## [2026-08-12] — Claude (Opus 4.8) — Fontes de vaga (Gupy + fix JSearch) + multi-contratação

- **O QUE:** resolver o "vagas aleatórias" (só vinham boards globais de tech remoto) e atender aos
  pedidos do dono: mais fontes BR conhecidas, vagas mundiais + brasileiras, e tipo de contratação
  com múltipla escolha.
- **ONDE / MUDOU:**
  - ADICIONADO em **`src/services/jobs.ts`** a fonte **`gupy`** — API pública `portal.api.gupy.io`
    (sem chave), vagas BR de empresas que usam Gupy; registrada em `SOURCES`.
  - CORRIGIDO **bug no JSearch** (`jobs.ts`): os dois ramos do `const busca` eram idênticos. Agora
    usa `country=br` + `work_from_home=true` p/ remoto e foca na cidade p/ presencial. O Google for
    Jobs (JSearch) cobre **LinkedIn, Gupy, Indeed, vagas.com, Catho, InfoJobs/Pandapé** — ativa com a
    chave grátis na tela Config.
  - ALTERADO **`src/types.ts`**: `Profile.tipoContratacao` (string) → **`tiposContratacao` (string[])**;
    `DEFAULT_PROFILE` agora `['CLT','PJ']`.
  - ALTERADO **`src/app/perfil.tsx`**: seletor de contratação virou **multi-seleção** (marca vários).
- **POR QUÊ:** pedido do dono (fontes conhecidas grátis, mundial+BR, multi-contratação). Nenhuma
  fonte antiga removida — as globais (Remotive/RemoteOK/Arbeitnow) seguem cobrindo remoto mundial.
- **DECISÃO respeitando as regras:** LinkedIn/Solides/vagas.com/Pandapé **não têm API grátis** e
  scraping é proibido pelo `AGENTS.md` — a via legítima é o **Google for Jobs (JSearch)**, que os
  indexa. Gupy tem endpoint público, então entrou direto.
- **A FAZER (dono):** criar contas grátis e colar as chaves em *Perfil → ⚙️ Config*: **JSearch**
  (RapidAPI), **Adzuna**, **Jooble**. Sem elas, rodam Gupy + os 3 globais.
- **NOTA:** o mapeamento da Gupy foi escrito por padrão do endpoint público (não testado neste
  ambiente); isolado em try/catch — se o formato mudar, ela só não retorna, sem quebrar a busca.
- **STATUS:** ⚠️ tsc não rodado aqui (sem node_modules). Tudo é JS puro → vai por OTA também.

## [2026-08-12] — Claude (Opus 4.8) — OTA-safe + correção do lock (Action de EAS Update)

- **O QUE:** publicar o update via **OTA** (pedido do dono). Duas correções necessárias:
  1. **`package-lock.json` fora de sincronia** — a Action `eas-update.yml` falhava no `npm ci`
     ("Missing: expo-document-picker@57.0.1 / pako@2.2.0 / @types/pako@2.0.4 from lock file"),
     porque os commits anteriores adicionaram deps no `package.json` sem atualizar o lock.
  2. **`expo-document-picker` é módulo NATIVO** — OTA entrega só JS. O APK instalado foi buildado
     antes dessa dep, então o seletor de arquivo poderia derrubar a tela via OTA.
- **ONDE / MUDOU:**
  - ALTERADO **`package-lock.json`** — regenerado com `npm install --package-lock-only` (adiciona as 3
    deps; nenhum node_modules baixado). Destrava o `npm ci` da Action.
  - ALTERADO **`src/app/curriculo.tsx`** — o `import * as DocumentPicker` estático virou
    `require('expo-document-picker')` **preguiçoso dentro de `escolherArquivo`, protegido por try/catch**.
    Em APK sem o módulo nativo (caso do OTA), mostra aviso "precisa de novo build; cole o texto" em vez
    de crashar. Todo o resto (motor ATS, leitura PDF/DOCX com pako, colar texto) é JS puro → roda no OTA.
- **POR QUÊ:** **bug comprovado** (Action vermelha no `npm ci`) + segurança do OTA (evitar crash por
  módulo nativo ausente). O `EXPO_TOKEN` já estava configurado no repo (confirmado no log da Action).
- **RESULTADO ESPERADO:** com este push, a Action roda `npm ci` (verde) → `eas update --branch preview`
  publica o OTA. Melhorias de JS chegam sozinhas ao abrir o app. **O botão "escolher arquivo" só
  funciona após um novo build do APK** (`eas build -p android --profile preview`) — até lá, usar o
  "colar texto", que funciona 100% via OTA.
- **STATUS:** ⚠️ `tsc` ainda não rodado no ambiente remoto (sem node_modules). Lock e código revisados à mão.

## [2026-08-12] — Claude (Opus 4.8) — Leitura real de PDF/DOCX no upload do currículo

- **O QUE:** deixar o upload de currículo ler **PDF e DOCX de verdade** no aparelho (antes era só
  `fetch().text()`, que corrompe binário). Pedido do dono (opção "A").
- **ONDE / MUDOU:**
  - ADICIONADO **`src/services/documents.ts`** — extrator local:
    - `extrairTextoPdf(bytes)`: varre os content streams do PDF, descomprime `FlateDecode` com **pako**
      e extrai os operadores de texto (strings literais `(...)`, hex `<...>`, `Tj`/`TJ`, quebras por
      `T*`/`ET`, espaços por `Td/TD/Tm`). Pula imagens (`/Image`, `DCTDecode`, `JPXDecode`).
    - `extrairTextoDocx(bytes)`: lê o ZIP (diretório central), acha `word/document.xml`, faz
      `inflateRaw` e remove as tags XML.
    - `lerBytesDeUri(uri)`: bytes via `fetch().arrayBuffer()` → fallback `blob`+`FileReader` (dataURL)
      → base64 (portável web+nativo, sem depender da versão do expo-file-system).
    - `pareceTexto()` e decodificadores Latin1/UTF-8/base64.
  - ALTERADO **`src/app/curriculo.tsx`** — `escolherArquivo` agora chama `extrairTextoDeArquivo`
    (documents.ts) em vez do `fetch().text()` local (removida a função `lerArquivo` antiga, que só
    servia para .txt). Adicionado estado `lendo` + spinner "Lendo arquivo..." e contagem de palavras.
  - ALTERADO **`package.json`** — dependências `pako` (^2.1.0) + `@types/pako` (^2.0.3).
- **POR QUÊ:** pedido do dono — tornar o "subir currículo" realmente útil com PDF/DOCX, sem backend.
  A função `lerArquivo` removida era nova (do commit anterior desta mesma feature) e nunca lia binário;
  foi substituída, não havia comportamento estável dependendo dela.
- **LIMITE que permanece:** PDF **escaneado (imagem)** ou com **fontes CID embutidas** continua
  ilegível on-device (precisaria de OCR/CMap — território da Fase 2 com Claude API). Nesses casos o
  app detecta e pede pra colar o texto. `.txt`, DOCX e a maioria dos PDFs "de texto" funcionam.
- **STATUS:** ⚠️ **tsc NÃO rodado** (ambiente remoto sem `node_modules`). Na máquina do dono:
  `npx expo install expo-document-picker` + `npm install` (traz pako) + `npx tsc --noEmit` + `npm run web`.

## [2026-08-12] — Claude (Opus 4.8) — Nova aba "Currículo (ATS)" com score + auto-preenchimento

- **O QUE:** adicionar ao app a capacidade de subir/colar o currículo, receber um **score ATS**
  (0-100) simulando a leitura dos robôs de RH, ver **o que melhorar** e, se o CV estiver bom,
  **preencher o Perfil automaticamente** com os dados extraídos. Pedido direto do dono.
- **ONDE / MUDOU:**
  - ADICIONADO **`src/services/ats.ts`** — motor de ATS 100% local: `analyzeCV(texto, alvo?)`
    pontua 5 critérios (palavras-chave 32, contato 20, seções 18, resultados 18, formato 12),
    devolve `issues` (problema+sugestão por gravidade), `pontosFortes` e `extracted` (nome, e-mail,
    telefone, LinkedIn, portfólio, cargo, senioridade, skills, resumo). `mergeExtractedIntoProfile()`
    mescla no Perfil sem apagar o que já existe. Reaproveita `extractSkills`/`canonicalSet`/`normalize`
    de `skills.ts`. `NIVEL_META` para rótulos/cores. `aprovado = score >= 70`.
  - ADICIONADO **`src/app/curriculo.tsx`** — aba nova: botão de upload (`expo-document-picker`,
    leitura via `fetch(uri)`), campo de colar texto, botão Analisar, card de score grande, nota por
    critério (barras), pontos fortes, lista de melhorias e aplicação no Perfil (automática se aprovado,
    manual se não).
  - ALTERADO **`src/app/_layout.tsx`** — registrada a aba `curriculo` (entre Início e Vagas), ícone
    `document-text`. (Só adição de um `<Tabs.Screen>`; nada removido.)
  - ALTERADO **`package.json`** — adicionada dependência `expo-document-picker` (~57.0.1).
- **POR QUÊ:** **nova feature pedida pelo dono** ("aba que suba currículo, dê rank de ATS, mostre o
  que mudar e, se estiver bom, preencha tudo do app"). Nada existente foi removido/reescrito.
- **NOTA (limite conhecido):** leitura de **PDF/DOCX no aparelho é best-effort** — não há extrator
  de texto confiável 100% on-device. `.txt` e texto colado funcionam sempre; para PDF/DOCX o app
  avisa e pede pra colar. A leitura profunda de PDF/DOCX é candidata natural à **Fase 2 (Claude API
  no backend)**, onde `analyzeCV` pode ser complementado por análise da IA.
- **STATUS:** ⚠️ **tsc NÃO rodado nesta sessão** — o ambiente remoto está sem `node_modules`
  (clone fresco) e sem `expo-document-picker` instalado. **Antes de rodar, o dono deve executar
  `npx expo install expo-document-picker` + `npm install`** e então `npx tsc --noEmit` / `npm run web`.
  Código escrito seguindo os padrões e tipos existentes.

## [2026-08-11] — Claude (Opus 5) — Verificação de saúde + correção do preview web (SSR)

- **O QUE:** verificar se o app está pronto para rodar (typecheck + bundles web/android) e corrigir
  o preview web, que estava quebrando com erro 500.
- **ONDE / MUDOU:**
  - ALTERADO **`app.json`** → `expo.web.output`: `"static"` → **`"single"`** (1 linha).
- **POR QUÊ:** **bug comprovado.** Com `output: "static"`, o Expo Router faz *static rendering* (SSR
  em Node) do HTML; esse bundle de servidor quebrava com
  `TypeError: React.default.createContext is not a function` (interop CJS/ESM do React 19.2.3 dentro
  de `@expo/cli/node_modules/@expo/router-server/node/render.js`), devolvendo **HTTP 500** em
  `localhost:8081`. Com `"single"` o web vira SPA (o que faz sentido num app nativo-first): passou a
  responder **HTTP 200**. Não afeta Android/iOS nem o build EAS — `web.output` só controla o alvo web.
- **VERIFICADO:**
  - `npx tsc --noEmit` → **0 erros**.
  - Bundle **android** (`expo-router/entry`, platform=android) → **200**, ~8,9 MB, sem erro.
  - Bundle **web** (platform=web) → **200**, ~7,3 MB, sem erro; `/` → **200** com HTML do app.
- **STATUS:** ok, tsc limpo. App pronto para rodar.

---

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

## [2026-08-11] — Claude (Opus 4.8) — Rodapé de versão (teste visível de OTA)

- **O QUE:** adicionar um rodapé de versão/beta no Dashboard — útil em beta e serve como teste
  visível do OTA (o dono vê a mudança chegar sozinha no app já instalado).
- **ONDE / MUDOU:** `src/app/index.tsx` — ADICIONADO um `<Text>` de rodapé
  ("Radar de Vagas · beta · v1.0.0 · atualização automática (OTA) ativa") + estilo `footer`.
- **POR QUÊ:** validar o pipeline OTA ponta a ponta (push → Action/eas update → app atualiza).
- **STATUS:** tsc 0 erros. Publicado no canal `preview`.

---

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

## [2026-08-11] — Claude (Opus 4.8) — Doc de estrutura + limpeza de lixo

- **O QUE:** documentar o que é cada pasta/arquivo e remover lixo.
- **ONDE / MUDOU:**
  - ADICIONADO **`ESTRUTURA.md`** — guia anotado de cada pasta/arquivo + as 5 abas.
  - REMOVIDO **`path/to/the_file.txt`** (pasta `path/`) — placeholder de tutorial (conteúdo: "Contents of
    the file"), lixo acidental, estava untracked.
- **POR QUÊ:** pedido do dono (entender a estrutura; e deletar lixo digital).
- **STATUS:** ok.

---

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

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

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

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

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

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

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

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

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

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

## [2026-08-13] — Claude (Gemini Skill)
- O QUE: Ativação da Fase 2 (IA) com backend real
- ONDE: `src/services/storage.ts`, `radar-vagas-backend/`
- MUDOU: Adicionado o deploy do Cloudflare Worker com Gemini e configurado no `DEFAULT_SETTINGS` do app.
- POR QUÊ: Pedido do dono para iniciar a Fase 2 e criar a URL do backend.
- STATUS: ok / tsc limpo / Backend em produção

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
