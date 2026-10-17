> Esta pasta é a parte "Foco" do Omnivix (painel lateral). Instale a pasta `omnivix/extensao` inteira no navegador; o ícone abre o painel.

# Foco TDAH (extensao-ai)

Extensão para Vivaldi/Chrome que ajuda a manter uma tarefa por vez, com visual calmo.
Feita para o perfil do laudo de 11/2025: TDAH combinado + ansiedade, com dificuldade de
planejar, finalizar tarefas e alternar atenção.

Cada função é uma **página separada**, com o seu próprio ícone:

| Página | Ícone | O que faz |
|---|---|---|
| `briefing.html` | sol | Resumo do dia: tarefa de agora, prazos, ontem e hoje, listas, abas, foco e próximo passo |
| `tarefas.html` | visto | Gerenciador estilo Google Tarefas: listas, subtarefas, datas, concluídas, cartão "Agora" e "Onde parei?" |
| `foco.html` | relógio | Pomodoro com pausa curta automática; cada sessão é gravada na tarefa de agora |
| `abas.html` | árvore | Árvore de abas, busca, abas por site, abas repetidas e a chave "reabrir abas sozinho" |
| `estatisticas.html` | barras | Horas de foco por dia e por tarefa, tarefas concluídas, abas abertas e fechadas (hoje, 7 e 30 dias) |

Visual: segue o tema "study in the dark" do Vivaldi (fundo preto total, texto `#d0cdcd`, destaque `#dcdcdc`, cantos de 14 px, ícones redondos). A extensão não altera o tema do navegador.

## Como instalar no Vivaldi
1. Abra `vivaldi://extensions` (ou Ctrl+Shift+E).
2. Ligue **Modo do desenvolvedor**.
3. Clique em **Carregar sem pacote** e escolha esta pasta (`extensao-ai`).
4. Clique no ícone da extensão: abre o painel com a barra de ícones. Atalho: `Alt+Shift+S`.

Depois de editar um arquivo, volte em `vivaldi://extensions` e clique em recarregar na extensão.

## Um painel por função na barra lateral do Vivaldi (cada um com seu ícone)
1. Em `vivaldi://extensions`, copie o **ID** da extensão (letras de 32 caracteres).
2. Na barra lateral do Vivaldi clique em `+` (Adicionar painel da web).
3. Cole `chrome-extension://SEU_ID/tarefas.html` e confirme. Repita com `foco.html`, `abas.html`, `estatisticas.html` e `briefing.html`.
4. O Vivaldi usa o ícone de cada página. (Se ele recusar o endereço, use o painel com a barra de ícones.)

## Arquivos
| Arquivo | Para que serve |
|---|---|
| `manifest.json` | "Documento de identidade": nome, versão, permissões, onde estão os arquivos |
| `background.js` | Segundo plano: abre o painel, lembra quem abriu quem, Pomodoro (alarme) e reabrir abas sozinho |
| `sidepanel.html`, `barra.js`, `barra.css` | Painel com barra de ícones que troca entre as páginas |
| `tarefas.html`, `tarefas.js` | Página de tarefas |
| `foco.html`, `pomodoro.js` | Página do Pomodoro |
| `abas.html`, `arvore.js` | Página de abas |
| `base.css` | Aparência comum (só cores do sistema, não mexe no tema do Vivaldi) |
| `icons/` | Ícones da extensão e de cada página |
| `backend/` | Servidor local para IA (fase 3, ainda não ligado). Segredos só em `backend/.env` |

## Próximas fases
Veja `ROADMAP.md`.

## Automático (sem você lembrar de nada)
- **Categorias:** cada tarefa nova é lida e vai sozinha para a lista da área de trabalho dela
  (Faculdade, Estudos, Emails, Vagas, IAs, Orion, Calendários, Redes sociais, Compras, Projetos, e
  Casa, Saúde, Finanças, Pessoal). Se você mover uma tarefa, a extensão aprende as palavras dela.
- **Tempo:** o cronômetro liga sozinho quando você passa uns 2 minutos numa área ou site que combina
  com uma tarefa; para sozinho ao mudar de assunto, ao concluir, na pausa do Pomodoro e quando você
  fica 5 minutos parado (retoma quando volta). Também liga em Focar e em Iniciar foco.
- **Dicas:** pelo tempo (10, 25 e 50 min, e quando passa do dobro da sua média na categoria), no
  cartão "Agora" e por notificação aos 25, 50 e 90 minutos.
- **Áreas do Vivaldi:** os nomes e ids ficam em `areas.js` (a extensão não consegue ler os nomes).
  Se criar, renomear ou apagar áreas no Vivaldi, atualize esse arquivo.
- Ajustes liga e desliga cada parte. Nada sai do computador e endereços nunca são guardados.
