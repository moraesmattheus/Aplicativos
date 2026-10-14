// relogio.js
// Cronometro por tarefa. Sem tela: so logica, usada pela pagina Tarefas, pela pagina Foco e
// pelo background.js (por isso nao mexe em document nem em window).
//
// Quem LIGA o relogio:
//   - voce (botao Comecar, Focar, ou Iniciar foco no Pomodoro); ou
//   - a deteccao AUTOMATICA de atividade (atividade.js): se voce passa uns minutos numa area
//     ou site que combina com uma tarefa, o relogio dessa tarefa liga sozinho.
// Quem PARA o relogio: concluir a tarefa, trocar de tarefa, pausa do Pomodoro, ficar parado
// 5 minutos sem mexer no computador (retoma sozinho quando voce volta) ou mudar de assunto.
//
// O que fica guardado (chrome.storage.local, so no seu computador):
//   relogioTarefa:  { tarefaId, titulo, listaId, categoria, auto, desde, avisos: [] }   (so enquanto conta)
//   relogioRetomar: id da tarefa a retomar quando voce voltar (ou null)
//   temposSessoes:  [{ id, tarefaId, titulo, listaId, categoria, auto, inicio, fim, ms, motivo }]
// O tempo total de uma tarefa e a SOMA das sessoes dela (nao ha contador duplicado).
// Quando nao ha tarefa, o tempo e guardado numa tarefa "de contexto" (id "ctx:Faculdade"),
// para as estatisticas saberem que voce passou aquele tempo na Faculdade.

export const ALARME_RELOGIO = "relogio-tick";
const MINIMO_SESSAO_MS = 15000; // sessoes com menos de 15 s nao valem a pena guardar
const MAXIMO_SESSOES = 5000;

export async function lerRelogio() {
  const { relogioTarefa } = await chrome.storage.local.get("relogioTarefa");
  return relogioTarefa || null;
}

// Comeca a contar o tempo de uma tarefa (se outra estava contando, ela e encerrada antes).
// opcoes: { auto, categoria, titulo, listaId } (titulo e listaId so para ids "ctx:...").
export async function iniciarRelogio(tarefaId, opcoes = {}) {
  const atual = await lerRelogio();
  if (atual && atual.tarefaId === tarefaId) return; // ja esta contando esta mesma tarefa
  if (atual) await pararRelogio("troca");

  let titulo = opcoes.titulo || "";
  let listaId = opcoes.listaId || "";
  let categoria = opcoes.categoria || "";

  if (!tarefaId.startsWith("ctx:")) {
    const { tarefas = [] } = await chrome.storage.local.get("tarefas");
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa || tarefa.feita) return;
    titulo = tarefa.titulo;
    listaId = tarefa.listaId;
    if (!categoria) {
      const { listas = [] } = await chrome.storage.local.get("listas");
      const lista = listas.find((l) => l.id === tarefa.listaId);
      categoria = lista ? lista.nome : "";
    }
  }

  await chrome.storage.local.set({
    relogioTarefa: { tarefaId, titulo, listaId, categoria, auto: Boolean(opcoes.auto), desde: Date.now(), avisos: [] },
    relogioRetomar: null,
  });
  // Um "tique" por minuto: o background usa para avisar na hora das dicas.
  await chrome.alarms.create(ALARME_RELOGIO, { periodInMinutes: 1 });
}

// Para de contar e guarda a sessao. "fimMs" permite encerrar numa hora anterior a agora
// (ex.: quando voce ficou parado, o tempo parado nao conta).
export async function pararRelogio(motivo, fimMs) {
  const atual = await lerRelogio();
  if (!atual) return;

  const fim = Math.min(Date.now(), fimMs || Date.now());
  const ms = Math.max(0, fim - atual.desde);
  await chrome.alarms.clear(ALARME_RELOGIO);
  await chrome.storage.local.set({ relogioTarefa: null });
  if (ms < MINIMO_SESSAO_MS) return;

  const { temposSessoes = [] } = await chrome.storage.local.get("temposSessoes");
  temposSessoes.push({
    id: crypto.randomUUID(),
    tarefaId: atual.tarefaId,
    titulo: atual.titulo,
    listaId: atual.listaId,
    categoria: atual.categoria || "",
    auto: Boolean(atual.auto),
    inicio: atual.desde,
    fim,
    ms,
    motivo: motivo || "",
  });
  await chrome.storage.local.set({ temposSessoes: temposSessoes.slice(-MAXIMO_SESSOES) });
}

// Soma do tempo de cada tarefa: { idDaTarefa: milissegundos }.
export function totaisPorTarefa(sessoes) {
  const totais = {};
  for (const s of sessoes) totais[s.tarefaId] = (totais[s.tarefaId] || 0) + s.ms;
  return totais;
}
