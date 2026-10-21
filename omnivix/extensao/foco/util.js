// util.js
// Funcoes pequenas usadas pelas paginas Estatisticas e Briefing.

// Dia no formato AAAA-MM-DD, no SEU fuso horario ("sv-SE" so serve para esse formato).
function chaveDoDia(ms) {
  return new Date(ms).toLocaleDateString("sv-SE");
}

// Meia-noite (00:00) do dia de "ms", em milissegundos.
function inicioDoDia(ms) {
  const dia = new Date(ms);
  dia.setHours(0, 0, 0, 0);
  return dia.getTime();
}

// Meia-noite de "n" dias atras (n = 0 e hoje). Usa setDate para respeitar horario de verao.
function diasAtras(n) {
  const dia = new Date();
  dia.setHours(0, 0, 0, 0);
  dia.setDate(dia.getDate() - n);
  return dia.getTime();
}

// 135 minutos -> "2 h 15 min". 40 -> "40 min". 0 -> "0 min".
function formatarDuracao(minutos) {
  const total = Math.round(minutos);
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (!horas) return `${resto} min`;
  return `${horas} h ${String(resto).padStart(2, "0")} min`;
}

// Cria um elemento com texto (sempre textContent: nunca innerHTML com dados).
function criar(tag, texto, classe) {
  const elemento = document.createElement(tag);
  if (texto != null) elemento.textContent = texto;
  if (classe) elemento.className = classe;
  return elemento;
}

// Le tudo que as paginas de resumo precisam, ja com valores padrao.
async function lerTudo() {
  const dados = await chrome.storage.local.get([
    "tarefas", "listas", "listaAtual", "sessoesFoco", "abasPorDia", "pomodoro", "temposSessoes",
  ]);
  return {
    tarefas: dados.tarefas || [],
    listas: dados.listas && dados.listas.length ? dados.listas : [{ id: "padrao", nome: "Minhas tarefas" }],
    listaAtual: dados.listaAtual,
    sessoes: dados.sessoesFoco || [],
    abasPorDia: dados.abasPorDia || {},
    pomodoro: dados.pomodoro || { fase: "parado" },
    ativas: dados.temposSessoes || [], // tempo por tarefa (relogio automatico ou manual)
  };
}
