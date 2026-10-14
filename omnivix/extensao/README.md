# 🎙️ Anotações de Reunião (grátis e local) - extensão para Vivaldi / Chrome

Grava, transcreve e organiza suas reuniões, sem pagar nada:

1. **Grava** o áudio da aba (Google Meet, Zoom web, Teams, YouTube...) **+ o seu microfone**.
2. **Transcreve** com o **Whisper**: no seu navegador (privado) ou na nuvem do Groq (**bem mais rápido**).
3. **Mostra quem falou**: "Você" (microfone) e os outros; com o Gemini, cada participante vira "Pessoa 1", "Pessoa 2"... e você renomeia com um clique.
4. **Gera resumo, tópicos, decisões e itens de ação** (3 opções, veja abaixo).
5. **Envia para o Notion** no lugar certo: Entrevista → banco "Entrevistas", Aula → página da faculdade, e assim por diante.
6. Guarda tudo numa página de reuniões, com botão para **copiar em Markdown** (cola direto no Notion) e **baixar o áudio**.

> ⚖️ **Avise os participantes de que a reunião está sendo gravada.** Em muitos casos isso é exigido por lei (LGPD) e é questão de respeito. 

---

## 🤝 O que ela faz sozinha e o que nunca vai fazer sozinha

| Pedido | Situação |
|---|---|
| Sem bot visível na reunião | ✅ Captura o áudio **no seu navegador**. Ninguém vê nada. |
| Grátis, para qualquer pessoa usar | ✅ Tudo roda no aparelho de cada um (sem servidor para pagar). As chaves do Groq/Gemini/Notion são opcionais e gratuitas. |
| Perceber que há uma reunião | ✅ Avisa no ícone e por notificação ao entrar no Meet, Zoom, Teams, Webex ou Jitsi. |
| Começar a gravar sem eu clicar | ❌ O navegador **proíbe** capturar áudio de uma aba sem um clique seu. É regra de segurança. |
| Funcionar com o PC desligado | ❌ Sem bot na reunião, o áudio só existe no aparelho de quem participa. O PC precisa estar ligado **durante** a reunião. |

Quem quiser reunião gravada com o PC desligado precisa de um bot na nuvem (aparece na lista de participantes) ou da gravação do próprio Zoom/Meet/Teams (feita pelo anfitrião).

## 📦 Como instalar no Vivaldi (passo a passo)

Extensão "não empacotada" = uma pasta com o código, carregada direto no navegador. Não precisa de loja nem de conta.

1. Baixe/clone este repositório e localize a pasta `extensao`.
2. No Vivaldi, digite `vivaldi://extensions` na barra de endereço e tecle Enter.
3. Ligue o **Modo desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e escolha a pasta `extensao` (a que contém o `manifest.json`).
5. Clique no ícone de quebra-cabeça (barra de ferramentas) e **fixe** a extensão para o ícone ficar visível.
6. Clique no ícone → **⚙️ Configurações** → **🎤 Permitir microfone** (só na primeira vez).

## ▶️ Como usar

1. Abra a aba da reunião e entre na chamada.
2. Clique no ícone da extensão → **● Iniciar gravação desta aba**. O ícone mostra **REC**.
3. Na **primeira gravação**, o modelo Whisper é baixado (~80 MB). Isso acontece uma vez; depois fica guardado no navegador. A gravação não espera o download.
4. Clique em **■ Parar e gerar resumo**. Quando terminar, abre a página da reunião sozinha.

💡 **Use fones de ouvido.** Sem fones, seu microfone capta o som das caixas e a fala dos outros sai duplicada.

## ⚡ Deixando rápido e separando quem falou (Configurações)

| Quero... | Ative | Custo | O que sai do seu PC |
|---|---|---|---|
| Texto aparecendo em poucos segundos | **Transcrição: Groq (nuvem)**, chave em [console.groq.com/keys](https://console.groq.com/keys) | grátis (sem cartão, com limite diário) | os trechos de áudio, durante a reunião |
| Rápido **e** 100% local | **Local + placa de vídeo (WebGPU)** (já vem ligado; cai sozinho para o processador se falhar) | grátis | nada |
| Separar "Você" × outros | nada: já é automático (microfone × aba) | grátis | nada |
| Separar **cada participante** | **Separar cada participante** + chave do Gemini | grátis | o áudio da aba, só no fim da reunião |

Clique no nome de um falante na transcrição para **renomear** (ex.: "Pessoa 1" → "Maria"). Depois use **Refazer resumo** para os itens de ação saírem com o nome certo.

## 📤 Enviando para o Notion, cada tipo no seu lugar

1. Acesse [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → **Nova integração** → tipo **Interna** → copie o token (`ntn_...`).
2. No Notion, abra cada página/banco de destino → **•••** → **Conexões** → adicione a sua integração. (Sem isso o Notion responde "sem acesso".)
3. Em **Configurações → 4. Notion**, cole o token e cadastre os **tipos**: nome (ex.: *Aula da faculdade*), palavras que ajudam a reconhecer (ex.: *aula, professor, matéria, prova*) e o **link** do destino. Use **Testar** para conferir.
4. Marque **Enviar automaticamente** ou use o botão **📤 Enviar ao Notion** na página da reunião. Lá também dá para **trocar o tipo** antes de enviar.

Como o tipo é escolhido: com resumo por **Gemini/Ollama**, a IA lê a conversa e escolhe entre os seus tipos. Com o resumo **básico**, conta quantas palavras-chave de cada tipo aparecem (se houver pouca evidência, usa o **destino padrão**).

- Link de **banco de dados** → cria uma **linha** (usa a coluna de título, seja qual for o nome). Link de **página** → cria uma **subpágina**.
- A página recebe resumo, tópicos, decisões, itens de ação (como caixas de marcar) e a transcrição completa com quem falou.
- O token fica guardado só no seu navegador. Só a página da reunião vai ao Notion.
- Colunas extras do banco (data, tags...) não são preenchidas: o dia e o tipo vão no topo da página.

## 🧠 Escolha quem escreve o resumo (Configurações)

| Opção | Custo | Qualidade | Privacidade |
|---|---|---|---|
| **Básico** (padrão) | grátis | simples: escolhe as frases mais importantes | 100% offline |
| **Google Gemini** | grátis (chave em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) | muito boa, com responsáveis e prazos | o **texto** da transcrição vai para o Google (no plano grátis, ele pode usar para melhorar produtos) |
| **Ollama** | grátis | boa (depende do modelo e do seu PC) | 100% local. Instale em [ollama.com](https://ollama.com) e inicie com `OLLAMA_ORIGINS=chrome-extension://*` |

---

## 🗺️ Como funciona (para estudar)

```
Popup ──clique──► Background (service worker) ──► Offscreen (página invisível)
                                                    │
   áudio da aba ──► canal "Participantes" ─┐
                                            ├─► pedaços de fala ─► Whisper/Groq ─► texto + falante
   seu microfone ─► canal "Você" ───────────┘                                          │
        (aba + microfone também são misturados e gravados num .webm)                   ▼
                                       fim: Gemini separa participantes ─► resumo ─► IndexedDB
                                                           Página "Reuniões" lê daqui ─┘
```

| Arquivo | Papel | Conceito para pesquisar |
|---|---|---|
| `manifest.json` | "RG" da extensão: nome, permissões, arquivos | *Manifest V3* |
| `background.js` | gerente: recebe pedidos e coordena | *service worker* |
| `offscreen.js` | grava, corta o áudio e chama o Whisper | *chrome.offscreen*, *tabCapture*, *Web Audio API* |
| `pcm-worklet.js` | entrega o áudio bruto em blocos | *AudioWorklet* |
| `resumo.js` | os 3 geradores de resumo | *prompt*, *fetch*, *API REST* |
| `gemini.js` | chamada compartilhada ao Gemini (texto e áudio) | *API REST*, *JSON* |
| `notion.js` | cria a página no Notion (banco ou página) | *API do Notion*, *blocos*, *rate limit* |
| `falantes.js` | separa os participantes pelo áudio (Gemini) | *speaker diarization* |
| `transcricao-nuvem.js` | transcrição pelo Groq (gera o .wav e envia) | *multipart/form-data*, *WAV* |
| `armazenamento.js` | salva reuniões e áudio | *IndexedDB* |
| `popup.*`, `opcoes.*`, `reunioes.*` | as 3 telas | *DOM*, *módulos ES* |
| `vendor/` | biblioteca Transformers.js + motor ONNX (WASM) | *WebAssembly*, *Whisper* |

**Por que uma página "offscreen"?** O service worker não pode capturar áudio nem usar a Web Audio API. A página invisível pode, e o Chrome/Vivaldi a permite justamente para isso.

**Por que não usar o reconhecimento de voz embutido (Web Speech API)?** Ele só ouve o microfone (não o áudio da aba) e depende de servidores do Google, que no Vivaldi costumam falhar. O Whisper local funciona com qualquer áudio.

**Como sabe quem é "Você"?** Microfone e aba entram em canais separados. Tudo que vem do microfone é "Você"; o que vem da aba são os outros. Não precisa de IA para isso.

**Como o áudio é cortado?** Cada canal ignora o silêncio e corta numa **pausa na fala** (a partir de 8 s no modo local e 4 s na nuvem; no máximo 20 s e 15 s), para não partir palavras. Os trechos dos dois canais entram numa fila e voltam ordenados pelo horário.

## ⚠️ Limitações honestas

- A **1ª gravação** baixa o modelo (precisa de internet nessa hora). Depois a transcrição funciona offline.
- Separar **cada participante** depende do Gemini (nuvem); sem ele, todos os outros aparecem como "Participantes". Se duas pessoas falam juntas, a separação erra mais.
- **Sem fones**, o microfone capta o som das caixas e a fala dos outros pode sair também como "Você".
- No modo local a transcrição acompanha com atraso de ~10–25 s e depende do seu PC (use WebGPU ou o modelo **Tiny** se ficar lenta; o **Small** é mais preciso). Na nuvem (Groq) o atraso é de poucos segundos.
- Não grava páginas internas do navegador (`vivaldi://...`).
- O Whisper às vezes erra nomes próprios e termos técnicos. Revise a transcrição.

## 🔧 Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Só sai a fala dos outros | Em Configurações, clique em **Permitir microfone** |
| Não grava / erro ao iniciar | Clique no ícone **com a aba da reunião ativa** (a extensão só pode gravar a aba em que você clicou) |
| "Falha ao transcrever" | Veja a mensagem: costuma ser internet fora na 1ª vez (download do modelo) |
| Quer ver erros técnicos | `vivaldi://extensions` → **Detalhes** da extensão → **Inspecionar visualizações** |

## 📜 Licenças

`vendor/` contém o [Transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0) e o runtime ONNX (MIT). Os modelos Whisper (MIT) são baixados do Hugging Face.
