# Radar de Vagas (versão web)

Versão do Radar de Vagas que **roda direto no navegador**, sem Expo, sem build e sem instalar nada.
É um site estático (HTML + CSS + JavaScript puro), no mesmo estilo do `rota-de-vida`.

Serve para **mostrar o app funcionando** (por exemplo em entrevistas) em qualquer celular ou computador.

## O que tem
- **Início:** estatísticas, próximas entrevistas, ações pendentes e o **Modo demonstração**.
- **Vagas:** busca em Remotive, RemoteOK, Arbeitnow e Gupy, com **score de compatibilidade 0-100** contra o seu perfil.
  Presencial e híbrido só aparecem na cidade do perfil. Remoto vale para qualquer lugar.
- **Kanban:** Salvas, Aplicado, Triagem, Entrevista, Proposta e Encerrado. Anotações e data de entrevista.
- **Agenda:** baixa um arquivo `.ics` (abre no Google Calendar, Outlook e Apple Calendar) com alertas de 24 h, 1 h e 15 min.
- **Currículo (ATS):** nota de 0 a 100, pontos a melhorar e preenchimento automático do Perfil. Análise local, ou com IA pelo backend.
- **Perfil e Config:** tudo salvo no navegador (localStorage), com backup e restauração em `.json`.

## Como abrir
**Mais simples:** dê dois cliques em `index.html`.

**Com servidor local** (necessário para instalar como app e usar o service worker):
```bash
cd radar-vagas-web
python3 -m http.server 8000
# abra http://localhost:8000
```

**Publicado:** `https://moraesmattheus.github.io/Aplicativos/radar-vagas-web/` (GitHub Pages, depois que esta pasta estiver na branch publicada).

## Para a demonstração (entrevista)
1. Abra o app e vá em **Início**.
2. Toque em **Carregar dados de demonstração**. O Kanban enche com candidaturas fictícias.
3. Em **Vagas**, toque em **Ver vagas de exemplo**. Funciona **sem internet**.
4. Em **Currículo**, cole um texto e toque em **Analisar (ATS local)**.

## Limites (leia antes de prometer algo)
- **Algumas fontes bloqueiam o navegador.** Sites de vagas podem recusar chamadas feitas direto de uma página web (regra de segurança chamada CORS).
  Quando isso acontece o app mostra "indisponível no navegador" naquela fonte e segue com as outras.
  Se tudo falhar, use **Ver vagas de exemplo**.
- **JSearch, Adzuna e Jooble não estão aqui de propósito.** Elas exigem chave de API, e uma chave colocada numa página web fica visível para qualquer pessoa.
  Para usá-las com segurança, as chamadas teriam que passar pelo backend (Cloudflare Worker), onde a chave fica guardada como secret.
- **PDF só funciona com a análise por IA**, porque o backend (Gemini) lê o arquivo. Para a análise local, cole o texto ou use `.txt`.
- **Os dados ficam só neste navegador.** Trocar de aparelho ou limpar os dados do site apaga tudo. Use **Baixar backup** em Config.
- As vagas marcadas como "exemplo" são **fictícias**.

## Segurança
- Nenhuma chave de API está neste código.
- Todo texto vindo de APIs externas é escapado antes de aparecer na tela, e só links `http(s)` são abertos.
- A URL do backend de IA (`https://radar-vagas-backend.radar-vagas.workers.dev`) é pública, e a chave do Gemini fica como secret no Worker.

## Estrutura
```
radar-vagas-web/
├── index.html            # estrutura das telas
├── style.css             # visual (tema escuro/claro automático, funciona no celular)
├── app.js                # lógica: skills, matching, fontes de vagas, ATS, Kanban, agenda
├── sw.js                 # service worker (offline e instalável)
├── manifest.webmanifest  # dados para instalar como app
└── icons/                # ícones
```

A lógica de skills, matching e ATS foi portada de `projeto-vagas-app/src/services/` (TypeScript) para JavaScript puro.
