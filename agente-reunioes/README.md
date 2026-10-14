# 🤖 Agente de Reuniões (Windows)

Um programa que fica na **bandeja do Windows** (perto do relógio) e **grava, transcreve e organiza sozinho**.
Sem bot na reunião, sem extensão, sem você precisar clicar em nada.

| Situação | O que acontece |
|---|---|
| Você entra numa chamada (Meet, Teams, Zoom, Discord...) | O agente percebe que um programa passou a usar o microfone e **começa a gravar sozinho**. Quando a chamada acaba, ele para. |
| Aula ou entrevista **presencial** | Ele lê o seu **Google Agenda** e grava no horário do evento (aulas semanais incluídas). |
| Qualquer outro momento | Atalho **Ctrl+Alt+R** (liga/desliga) ou clique direito no ícone da bandeja. |

Depois de gravar, ele faz tudo de uma vez: transcreve (**quem falou: "Você" e os outros**), resume, escolhe o **tipo** (Entrevista, Aula da faculdade...), dá um título e **envia para a página certa do Notion**.

> ⚖️ **Avise os participantes de que a reunião está sendo gravada.** Em muitos casos a lei (LGPD) exige. O agente mostra uma notificação ao começar para você não esquecer.

---

## 📦 Instalação (passo a passo)

1. Instale o **Node.js LTS**: <https://nodejs.org> (botão verde "LTS").
2. Baixe este repositório inteiro (botão verde **Code › Download ZIP** no GitHub) e extraia. As pastas `agente-reunioes` e `vivaldi-anotacoes-reuniao` precisam ficar **lado a lado**.
3. Abra a pasta `agente-reunioes`, clique na barra de endereço do Explorer, digite `cmd` e Enter.
4. No terminal que abriu, rode:
   ```
   npm install
   npm start
   ```
   A primeira instalação demora alguns minutos (baixa o Electron, ~100 MB).
5. A tela de **Configurações** abre sozinha na primeira vez. O agente passa a abrir junto com o Windows.

**Instalador (opcional):** `npm run empacotar` gera um `.exe` em `dist/`. (Ainda não testei esse passo.)

### Windows: permissões
- **Configurações › Privacidade e segurança › Microfone**: ligue "Permitir que aplicativos da área de trabalho acessem o microfone".
- Use **fones de ouvido**. Sem eles, o microfone capta as caixas de som e a voz dos outros pode sair duplicada como "Você".

## ⚙️ O que configurar (em ordem de importância)

1. **Agenda (para presencial):** no Google Agenda, abra as configurações do seu calendário › **Endereço secreto no formato iCal** › copie e cole em Configurações. Ele grava eventos cujo título tenha "aula", "entrevista", "reunião" etc. (você muda as palavras).
2. **Transcrição rápida:** em Configurações escolha **Groq (nuvem)** e cole a chave grátis de [console.groq.com/keys](https://console.groq.com/keys). Sem chave, roda tudo no seu PC (Whisper local, com placa de vídeo quando possível), mais devagar e 100% privado.
3. **Separar cada participante** ("Pessoa 1", "Pessoa 2"): ligue a opção e use a chave grátis do **Gemini** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)). O áudio dos outros é enviado ao Google no fim da reunião.
4. **Resumo inteligente:** escolha Gemini (ou Ollama, local). O "Básico" funciona sem IA, mas é simples.
5. **Notion:** token da integração + os **tipos** com o link de cada destino. O tipo é escolhido pela IA lendo a conversa (e o título do evento da agenda).

As chaves ficam **criptografadas** com o cofre do Windows (só o seu usuário lê).

## 🧠 Como funciona (para estudar)

```
 microfone em uso ──► detector.js ─┐
 evento da agenda ──► agenda.js  ──┼─► principal.js (bandeja) ──► janela invisível (gravador.js)
 Ctrl+Alt+R ───────────────────────┘                                  │ áudio do PC (loopback) + microfone
                                                                      ▼
                          gravacao.js: pedaços de fala ─► Whisper/Groq ─► texto com falante ─► resumo ─► Notion
```

| Arquivo | Papel | Conceito para pesquisar |
|---|---|---|
| `principal.js` | decide quando gravar; bandeja, atalho, janelas | *Electron main process* |
| `detector.js` | descobre se algum programa usa o microfone (Registro do Windows) | *CapabilityAccessManager* |
| `agenda.js` | lê o `.ics` e dispara nos horários (inclui repetições) | *iCalendar, RRULE* |
| `app/gravador.js` | captura o áudio do computador e o microfone | *WASAPI loopback, getDisplayMedia* |
| `app/gravacao.js` | o "cérebro" (**compartilhado com a extensão**) | *Whisper, VAD, filas* |
| `config-principal.js` | salva as configurações e criptografa as chaves | *DPAPI, safeStorage* |
| `scripts/sincronizar.js` | copia o cérebro de `../vivaldi-anotacoes-reuniao` | *fonte única de verdade* |

Detalhe importante: o detector **não escuta o áudio** para saber se há chamada. Ele só olha o registro do Windows que diz "este programa está usando o microfone", o mesmo que acende o ícone de microfone na barra de tarefas.

## ⚠️ Limitações honestas

- **Ainda não rodei no Windows de verdade.** Testei no Linux simulando o microfone e o áudio (fluxo completo: chamada detectada → gravação → transcrição → tipo → fim; aula pela agenda; leitura do formato do Registro do Windows). A captura do áudio do sistema no Windows depende do Windows 10/11, e a detecção pelo Registro é confiável mas não perfeita. Se algo falhar, me mande a mensagem.
- **Falsos positivos:** ditado por voz, jogos com chat de voz ou um gravador também usam o microfone. Coloque o `.exe` deles na lista de "Programas que NÃO são chamadas".
- **Entrevista presencial sem agenda:** não há sinal de que começou. Use o atalho **Ctrl+Alt+R** ou crie um evento no calendário.
- **macOS e Linux:** gravação manual e agenda funcionam; a detecção automática por microfone é só Windows (e Linux com PulseAudio).
- O PC precisa estar **ligado** durante a reunião (não há bot; o áudio só existe no seu computador).

## 🧪 Testes

`npm test` roda os testes do detector (formato do Registro, tempos de espera) e da agenda (aula semanal no fuso certo, eventos cancelados e de dia inteiro).
