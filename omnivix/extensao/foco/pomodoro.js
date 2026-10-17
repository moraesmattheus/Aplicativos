import { iniciarRelogio } from "./relogio.js";
// pomodoro.js
// Pagina "Foco": cronometro com pausas curtas (o laudo recomenda "pausas curtas entre
// periodos de producao"). O fim do tempo e a notificacao ficam no background.js; aqui
// ficam os botoes, o relogio e o registro de sessoes quando voce PARA antes da hora.
//
// Ideia de seguranca contra erros: guardamos a HORA DE TERMINO (fim), e nao "segundos
// restantes". Assim, se a pagina fechar e abrir de novo, o relogio continua certo.
//
// Estatisticas: cada foco e ligado a tarefa que estava em "Agora" quando voce clicou em
// Iniciar. Ao terminar (ou parar), gravamos { tarefaId, titulo, inicio, minutos } em
// "sessoesFoco". E assim que a pagina Estatisticas sabe quantas horas cada tarefa gastou.

const ALARME = "pomodoro-fim"; // mesmo nome usado no background.js

const elFase = document.getElementById("pomo-fase");
const elTempo = document.getElementById("pomo-tempo");
const elDuracao = document.getElementById("pomo-duracao");
const elIniciar = document.getElementById("pomo-iniciar");
const elParar = document.getElementById("pomo-parar");
const elTarefaAtual = document.getElementById("tarefa-atual");

let estado = { fase: "parado", fim: 0 };
let relogio = null;

// ---------- Tarefa de agora ----------
// Primeira tarefa pendente (nao subtarefa) da lista aberta na pagina Tarefas.
async function acharTarefaAtual() {
  const { tarefas = [], listaAtual } = await chrome.storage.local.get(["tarefas", "listaAtual"]);
  return (
    tarefas.find((t) => !t.paiId && !t.feita && (!listaAtual || listaAtual === "__todas__" || t.listaId === listaAtual || !t.listaId)) || null
  );
}

async function mostrarTarefaAtual() {
  const atual = await acharTarefaAtual();
  elTarefaAtual.textContent = atual ? atual.titulo : "Nada em foco";
}

// ---------- Registro de sessoes ----------
// (O background.js tem uma funcao parecida, usada quando o tempo acaba sozinho.)
async function registrarSessao(foco, minutos) {
  if (!minutos || minutos < 1) return; // menos de 1 minuto nao vale registrar
  const { sessoesFoco = [] } = await chrome.storage.local.get("sessoesFoco");
  sessoesFoco.push({
    id: crypto.randomUUID(),
    tarefaId: foco.tarefaId || "",
    titulo: foco.titulo || "Sem tarefa",
    inicio: foco.inicio,
    minutos,
  });
  await chrome.storage.local.set({ sessoesFoco: sessoesFoco.slice(-5000) }); // limite de seguranca
}

// ---------- Acoes ----------
async function iniciarFoco() {
  const minutos = Number(elDuracao.value);
  // Validacao: so aceita numeros positivos pequenos (evita valor estranho vindo da tela).
  if (!Number.isFinite(minutos) || minutos < 1 || minutos > 120) return;

  const ajustes = await lerAjustes();
  const tarefa = await acharTarefaAtual();
  const inicio = Date.now();
  const fim = inicio + minutos * 60000;
  await chrome.storage.local.set({
    pomodoro: {
      fase: "foco",
      fim,
      inicio,
      minutos,
      minutosPausa: ajustes.pomodoro.pausa,
      tarefaId: tarefa ? tarefa.id : "",
      titulo: tarefa ? tarefa.titulo : "Sem tarefa",
    },
  });
  await chrome.alarms.create(ALARME, { when: fim });
  // Comecar um foco tambem comeca a contar o tempo da tarefa (relogio.js).
  if (tarefa) await iniciarRelogio(tarefa.id);
}

async function parar() {
  const { pomodoro } = await chrome.storage.local.get("pomodoro");
  // Se estava em FOCO, conta o tempo que de fato foi usado.
  if (pomodoro && pomodoro.fase === "foco") {
    const usados = Math.floor((Date.now() - pomodoro.inicio) / 60000);
    await registrarSessao(pomodoro, Math.min(usados, pomodoro.minutos));
  }
  await chrome.alarms.clear(ALARME);
  const ajustes = await lerAjustes();
  await chrome.storage.local.set({
    pomodoro: { fase: "parado", fim: 0, minutosPausa: ajustes.pomodoro.pausa },
  });
}

// ---------- Tela ----------
function formatar(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutos = String(Math.floor(total / 60)).padStart(2, "0");
  const segundos = String(total % 60).padStart(2, "0");
  return `${minutos}:${segundos}`;
}

const ROTULOS = { foco: "Foco", pausa: "Pausa curta", parado: "Pronto para começar" };

function desenharPomodoro() {
  elFase.textContent = ROTULOS[estado.fase] || ROTULOS.parado;
  const rodando = estado.fase !== "parado";
  elIniciar.hidden = rodando;
  elDuracao.hidden = rodando;
  elParar.hidden = !rodando;
  elTempo.textContent = rodando ? formatar(estado.fim - Date.now()) : "";
}

// Atualiza o relogio a cada segundo, mas so enquanto ha contagem em andamento.
function ajustarRelogio() {
  clearInterval(relogio);
  if (estado.fase !== "parado") relogio = setInterval(desenharPomodoro, 1000);
}

async function carregar() {
  const dados = await chrome.storage.local.get("pomodoro");
  estado = dados.pomodoro || { fase: "parado", fim: 0 };
  desenharPomodoro();
  ajustarRelogio();
}

elIniciar.addEventListener("click", iniciarFoco);
elParar.addEventListener("click", parar);

// Quando o background muda a fase (foco vira pausa), a tela acompanha sozinha.
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area !== "local") return;
  if (mudancas.pomodoro) carregar();
  if (mudancas.tarefas || mudancas.listaAtual) mostrarTarefaAtual();
});

// Foco padrao dos Ajustes: seleciona na lista (e cria a opcao se ela nao existir).
async function aplicarDuracaoPadrao() {
  const { pomodoro } = await lerAjustes();
  const valor = String(pomodoro.foco);
  if (![...elDuracao.options].some((opcao) => opcao.value === valor)) {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = `${valor} min`;
    elDuracao.append(opcao);
  }
  elDuracao.value = valor;
}
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && mudancas.ajustes && estado.fase === "parado") aplicarDuracaoPadrao();
});

carregar();
aplicarDuracaoPadrao();
mostrarTarefaAtual();
