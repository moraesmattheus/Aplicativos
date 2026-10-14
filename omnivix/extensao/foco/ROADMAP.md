# Roadmap do Foco (funções planejadas + TDAH)

Regras do projeto
- Não alterar o tema do Vivaldi. As páginas da extensão seguem o tema "study in the dark": fundo preto total, branco e cinza, ícones redondos, cantos de 14 px.
- Segredos só em `backend/.env` (ignorado pelo git). Só o `.env.example` vai ao repositório.
- Código com comentários explicando o porquê. Backend em Python (comentários com `#`); extensão em JavaScript (comentários com `//`).
- Seguir boas práticas: validar entrada, nunca `innerHTML` com dados externos, permissões mínimas, tokens no servidor.

| Fase | Entrega | Status |
|---|---|---|
| 1 | Gerenciador de tarefas (listas, subtarefas, datas) com cartão "Agora" | feita |
| 2 | Árvore de abas com busca, abas por site, duplicadas, reabrir sozinho | feita (testar) |
| 2b | Pomodoro com sessões ligadas à tarefa, estatísticas, briefing local, páginas separadas, tema preto e branco | feita (testar) |
| 3 | Agrupamento automático de abas por IA (backend `/ai/group-tabs`) | backend pronto, falta ligar a extensão |
| 4 | Abas duplicadas, "onde parei?", captura rápida de ideias | a fazer |
| 5 | Pomodoro com pausas curtas, bloqueio de sites (fixo e por IA conforme a tarefa) | a fazer |
| 6 | Texto selecionado vira tarefa por IA, quebrar tarefa em passos pequenos | a fazer |
| 7 | Chat flutuante `Alt+Shift+C` com contexto da página | a fazer |
| 8 | Notion e Google Calendar (OAuth no backend) | a fazer |
| 9 | Rotinas: briefing matinal, resumo semanal/mensal, memória local apagável | a fazer |
| 10 | Reuniões (Meet/Zoom): gravar aba, transcrever, itens de ação | a fazer |
| 11 | Servidor MCP próprio (Claude cria e conclui tarefas) | a fazer |
| 12 | Analytics e Todoist, WhatsApp (por último, mais sensível) | a fazer |

## TDAH (do laudo de 11/2025)
- Controle inibitório fraco: captura rápida de ideia sem sair da tarefa; aviso gentil ao sair do foco.
- Planejamento e finalização: quebrar em passos pequenos, um passo visível por vez, marcar o primeiro passo mais fácil.
- Atenção alternada baixa e sensibilidade a interferência: "onde parei?" ao voltar, evitar trocar de assunto de uma vez.
- Pausas curtas entre períodos de produção (recomendação do laudo): Pomodoro com pausa que sugere levantar e se mexer.
- Ansiedade alta: linguagem calma, sem contador de atraso, sem vermelho, modo "só o essencial".

## "Apps" do Vivaldi
Duas opções para ficar na barra lateral do Vivaldi (a testar):
1. Painel lateral nativo da extensão (já configurado).
2. Web Panel: botão `+` da barra lateral, endereço `chrome-extension://<id>/sidepanel.html`. O `<id>` aparece em `vivaldi://extensions` depois de carregar a extensão.

## Rodar o backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # depois edite o .env
uvicorn main:app --host 127.0.0.1 --port 8787
```
