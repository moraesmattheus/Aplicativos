# Rota de Vida

App pessoal do casal (Mattheus & noiva) para acompanhar o plano de vida:
rota financeira, diário de bordo, mentalidade, ambiente e metas.

É um **PWA** (Progressive Web App): abre no navegador, mas pode ser
**instalado na tela inicial do celular** e funciona como um aplicativo de
verdade — inclusive offline. E o melhor: **tudo que você mudar no código e
publicar aqui aparece automaticamente no app instalado**, sem precisar
baixar nada de novo nem passar por loja de aplicativos.

## Como funciona o "muda aqui, muda no app automaticamente"

1. O código do app mora neste repositório do GitHub.
2. O **GitHub Pages** publica esse código como um site (grátis).
3. Você instala esse site no celular ("Adicionar à tela inicial").
4. Um *service worker* (`sw.js`) mantém o app funcionando offline e, sempre
   que você abre o app com internet, ele busca a versão mais nova publicada.
   Então, quando eu (ou você) atualizo o código e publico, na próxima vez que
   abrir, o app já vem atualizado.

Ou seja: a "cópia instalada" é sempre um espelho do que está publicado aqui.

## Passo a passo para colocar no ar (uma vez só)

1. No GitHub, abra o repositório `apps-claude` → **Settings** → **Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Em **Branch**, selecione a branch que tem esses arquivos (ex.: `main`) e a
   pasta `/ (root)`. Clique em **Save**.
4. Aguarde ~1 minuto. Como este app fica na subpasta `rota-de-vida/`, o link
   dele será:
   `https://moraesmattheus.github.io/apps-claude/rota-de-vida/`
5. Abra esse link no **Chrome (Android)** ou **Safari (iPhone)**.

> Importante: o app precisa ser aberto por esse endereço `https://...github.io`
> (ou qualquer hospedagem com HTTPS). O service worker e a instalação **não
> funcionam** abrindo o arquivo direto do computador (`file://`).

## Como instalar no celular

**Android (Chrome):** abra o link → menu ⋮ → **Instalar aplicativo** /
**Adicionar à tela inicial**. (O próprio app também mostra um botão "Instalar".)

**iPhone (Safari):** abra o link → botão **Compartilhar** (quadrado com seta)
→ **Adicionar à Tela de Início**.

Pronto: vai aparecer o ícone na tela inicial e abrir em tela cheia, sem barra
de navegador.

## Sobre os dados

- Os dados (reserva, diário, metas etc.) ficam salvos **no próprio aparelho**
  (armazenamento local do navegador). Não vão para nenhum servidor.
- Como cada celular guarda os seus dados, use a aba **Metas → Meus dados →
  Exportar backup** para gerar um arquivo `.json`. Dá para guardar como backup
  e para **importar no outro celular** (o da noiva), mantendo os dois iguais.
- Fazer backup de vez em quando é recomendado: se limpar os dados do navegador,
  o histórico local é perdido.

## Estrutura das abas

1. **Rota** — comparação Rota A (direto ao apto) × Rota B (Airbnb primeiro),
   com o ponto de risco da renda que ainda não existe destacado.
2. **Diário** — registro mensal do quanto foi guardado + gráfico de evolução.
3. **Mente** — registro de ação da semana, uso do tempo ocioso e gatilhos.
4. **Ambiente** — ambientes/pessoas experimentados e lista do que buscar.
5. **Metas** — linha do tempo dos marcos, com data alvo e status.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | O app inteiro (interface + lógica + cálculos das rotas) |
| `manifest.webmanifest` | Deixa o app instalável (nome, ícones, tela cheia) |
| `sw.js` | Service worker: offline + atualização automática |
| `icons/` | Ícones do app na tela inicial |
