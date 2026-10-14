# 🎙️ Anotações de Reunião (grátis e local) — extensão para Vivaldi / Chrome

Faz o que as **Anotações IA do Notion** fazem, sem pagar nada:

1. **Grava** o áudio da aba (Google Meet, Zoom web, Teams, YouTube...) **+ o seu microfone**.
2. **Transcreve** em tempo quase real com o **Whisper**, rodando **dentro do seu navegador** (nada de áudio sai do seu computador).
3. **Gera resumo, tópicos, decisões e itens de ação** (3 opções, veja abaixo).
4. Guarda tudo numa página de reuniões, com botão para **copiar em Markdown** (cola direto no Notion) e **baixar o áudio**.

> ⚖️ **Avise os participantes de que a reunião está sendo gravada.** Em muitos casos isso é exigido por lei (LGPD) e é questão de respeito. O Notion pede essa confirmação também.

---

## 📦 Como instalar no Vivaldi (passo a passo)

Extensão "não empacotada" = uma pasta com o código, carregada direto no navegador. Não precisa de loja nem de conta.

1. Baixe/clone este repositório e localize a pasta `vivaldi-anotacoes-reuniao`.
2. No Vivaldi, digite `vivaldi://extensions` na barra de endereço e tecle Enter.
3. Ligue o **Modo desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e escolha a pasta `vivaldi-anotacoes-reuniao` (a que contém o `manifest.json`).
5. Clique no ícone de quebra-cabeça (barra de ferramentas) e **fixe** a extensão para o ícone ficar visível.
6. Clique no ícone → **⚙️ Configurações** → **🎤 Permitir microfone** (só na primeira vez).

## ▶️ Como usar

1. Abra a aba da reunião e entre na chamada.
2. Clique no ícone da extensão → **● Iniciar gravação desta aba**. O ícone mostra **REC**.
3. Na **primeira gravação**, o modelo Whisper é baixado (~80 MB). Isso acontece uma vez; depois fica guardado no navegador. A gravação não espera o download.
4. Clique em **■ Parar e gerar resumo**. Quando terminar, abre a página da reunião sozinha.

💡 **Use fones de ouvido.** Sem fones, seu microfone capta o som das caixas e a fala dos outros sai duplicada.

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
   áudio da aba ─┐                                  │
                 ├─► mistura ─┬─► MediaRecorder ──► arquivo .webm  ─┐
   microfone ────┘            └─► AudioWorklet ──► pedaços de ~20 s │
                                                    └─► Whisper ──► texto ─► resumo ─► IndexedDB
                                                                                       ▲
                                                           Página "Reuniões" lê daqui ─┘
```

| Arquivo | Papel | Conceito para pesquisar |
|---|---|---|
| `manifest.json` | "RG" da extensão: nome, permissões, arquivos | *Manifest V3* |
| `background.js` | gerente: recebe pedidos e coordena | *service worker* |
| `offscreen.js` | grava, corta o áudio e chama o Whisper | *chrome.offscreen*, *tabCapture*, *Web Audio API* |
| `pcm-worklet.js` | entrega o áudio bruto em blocos | *AudioWorklet* |
| `resumo.js` | os 3 geradores de resumo | *prompt*, *fetch*, *API REST* |
| `armazenamento.js` | salva reuniões e áudio | *IndexedDB* |
| `popup.*`, `opcoes.*`, `reunioes.*` | as 3 telas | *DOM*, *módulos ES* |
| `vendor/` | biblioteca Transformers.js + motor ONNX (WASM) | *WebAssembly*, *Whisper* |

**Por que uma página "offscreen"?** O service worker não pode capturar áudio nem usar a Web Audio API. A página invisível pode, e o Chrome/Vivaldi a permite justamente para isso.

**Por que não usar o reconhecimento de voz embutido (Web Speech API)?** Ele só ouve o microfone (não o áudio da aba) e depende de servidores do Google, que no Vivaldi costumam falhar. O Whisper local funciona com qualquer áudio.

**Como o áudio é cortado?** O Whisper lê no máximo 30 s por vez. A extensão acumula áudio e corta numa **pausa na fala** entre 15 s e 28 s (para não partir palavras). Cada trecho entra numa fila e é transcrito em ordem.

## ⚠️ Limitações honestas

- A **1ª gravação** baixa o modelo (precisa de internet nessa hora). Depois a transcrição funciona offline.
- **Não separa quem falou** (o Notion identifica vozes; aqui não).
- A transcrição acompanha com atraso de ~10–30 s e depende do seu PC. Se ficar lenta, use o modelo **Tiny**. Se quiser mais qualidade, o **Small**.
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
