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

## Modo nuvem (login com Google) — opcional

Dá para salvar tudo na nuvem e **sincronizar os dois celulares automaticamente**,
entrando com a conta Google (que já traz a verificação em 2 etapas do Google).
Isso usa o **Firebase**, do Google, e o plano grátis é de sobra. É opcional: sem
configurar, o app segue 100% local como antes.

### Passo a passo (uma vez só, ~10 min)

1. Acesse <https://console.firebase.google.com> e clique em **Adicionar projeto**.
   Dê um nome (ex.: `rota-de-vida`) e conclua.
2. No projeto, menu **Build → Authentication → Get started**. Na aba
   **Sign-in method**, ative **Google** e salve.
3. Ainda em Authentication → **Settings → Authorized domains**, clique em
   **Add domain** e adicione `moraesmattheus.github.io`.
4. Menu **Build → Firestore Database → Create database** → modo **produção** →
   escolha a região (ex.: `southamerica-east1`).
5. Na aba **Rules** do Firestore, cole exatamente isto e **Publique**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

6. A configuração web do projeto (`firebaseConfig`) **já vem embutida no app**,
   então não é preciso colar nada. No app, aba **Metas → ☁️ Conta e nuvem**,
   toque em **Entrar com Google**.
7. No **outro celular**, abra o app e toque em **Entrar com Google** com a
   **mesma conta Google**. Pronto: os dois compartilham os mesmos dados, em
   tempo real.

> Se um dia trocar de projeto Firebase, dá para colar outra config manualmente
> (a opção de colar aparece se a config embutida for removida do código).

> Segurança: as chaves web do Firebase são públicas por design — quem protege os
> dados são as **regras** acima (só o dono logado lê/escreve) + o login. Usem a
> **mesma conta Google** nos dois aparelhos para compartilhar os dados do casal.
>
> 2FA: o login com Google já exige a verificação em 2 etapas **se ela estiver
> ativada na conta Google de vocês**. 2FA por SMS/app dentro do próprio app
> exigiria o plano pago (Identity Platform) — o login Google cobre isso de graça.

## Estrutura das abas

1. **Rota** — veredito da rota recomendada + data-alvo, dashboard com anel de
   progresso da entrada e comparação Rota A × Rota B (com o ponto de risco).
2. **Mapa** — mapa mental interativo: nós arrastáveis e conectados, por tipo
   (Rota, Submeta, Obstáculo, Objeção, Estudo, Renda passiva, Tarefa, Ideia).
   Toque num nó para editar; arraste o fundo para mover; use +/− para zoom.
3. **Alvos** — apartamentos que vocês querem. Cole o link do anúncio e o app
   tenta puxar foto/título/descrição (via Microlink); marque o alvo principal
   e o valor entra no cálculo da Rota. Se o site bloquear, preencha na mão.
4. **Renda** — rendas passivas com dados ao vivo dos ativos que vocês
   escolherem. Cripto via CoinGecko (sem cadastro); ações/FIIs da B3 via
   brapi.dev (token grátis opcional). Mostra cotação, variação e dividend
   yield. É **informação, não recomendação de investimento**.
5. **Diário** — registro mensal do quanto foi guardado + gráfico de evolução.
6. **Mente** — registro de ação da semana, uso do tempo ocioso e gatilhos.
7. **Ambiente** — ambientes/pessoas experimentados e lista do que buscar.
8. **Metas** — linha do tempo dos marcos + progresso e ações vindas do Mapa.

No **Mapa**, cada nó tem um "＋" para criar um nó-filho ligado a ele ali mesmo,
e um "🔍" que abre uma pesquisa na web sobre aquele tópico.

> Observação sobre "puxar do link": um app sem servidor não lê sites de
> imóveis diretamente (bloqueio de CORS do navegador). O app usa o serviço
> público **Microlink** para extrair a prévia. Alguns anúncios podem não
> liberar a prévia — nesse caso o cadastro manual cobre.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | O app inteiro (interface + lógica + cálculos das rotas) |
| `manifest.webmanifest` | Deixa o app instalável (nome, ícones, tela cheia) |
| `sw.js` | Service worker: offline + atualização automática |
| `icons/` | Ícones do app na tela inicial |
