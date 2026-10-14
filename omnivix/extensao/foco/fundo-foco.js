import { ALARME_RELOGIO, lerRelogio, iniciarRelogio, pararRelogio } from "./relogio.js";
import { ALARME_ATIVIDADE, SEGUNDOS_SEM_USO, lerAutomacao, seguirAreaAtual, tickAtividade } from "./atividade.js";

// background.js
// É o "service worker": um script que roda em segundo plano, sem janela.
// Ele acorda quando acontece um evento (clicar no ícone, abrir uma aba...) e depois "dorme".
// Por isso nunca guardamos dados em variáveis comuns aqui: elas somem quando ele dorme.
// Dados ficam no chrome.storage.

// ---------- 1. Abrir o painel ao clicar no ícone ----------
// Antes usávamos "openPanelOnActionClick", que depende deste script ter rodado antes para
// ligar a opção. Depois de reiniciar o navegador o script pode estar dormindo e o primeiro
// clique não fazia nada. Agora o próprio clique acorda o script e abre o painel.
// O clique também autoriza o Omnivix a gravar a aba atual (regra de segurança do navegador).
async function abrirPainel(aba) {
  try {
    if (!chrome.sidePanel || !chrome.sidePanel.open) throw new Error("sem painel lateral");
    await chrome.sidePanel.open({ tabId: aba.id }); // precisa ser chamado direto do clique
  } catch (erro) {
    // Plano B: sem painel lateral (ou ele falhou), abre a mesma tela numa aba normal.
    console.warn("Painel lateral indisponível, abrindo em aba:", erro);
    chrome.tabs.create({ url: chrome.runtime.getURL("foco/sidepanel.html") });
  }
}

chrome.action.onClicked.addListener(abrirPainel);

// O atalho Alt+Shift+S (_execute_action) cai no mesmo clique acima.
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}

// ---------- 2. Lembrar quem abriu quem (para a árvore de abas) ----------
// O navegador "esquece" o pai de uma aba quando o pai é fechado. Para a árvore não se
// perder, guardamos nós mesmos um dicionário: { idDaAba: idDaAbaPai }.
// storage.session guarda enquanto o navegador está aberto (ids de abas mudam ao reiniciar).

// Fila: se duas abas abrem quase juntas, as duas mudanças precisam acontecer UMA depois da
// outra. Sem a fila, uma sobrescreveria a outra (ler, mudar, salvar ao mesmo tempo).
let fila = Promise.resolve();

function alterarPais(funcaoQueAltera) {
  fila = fila
    .then(async () => {
      const { pais = {} } = await chrome.storage.session.get("pais");
      funcaoQueAltera(pais);
      await chrome.storage.session.set({ pais });
    })
    .catch((erro) => console.error("Falha ao salvar a árvore:", erro));
}

// Quando uma aba nasce de outra, anotamos o pai.
chrome.tabs.onCreated.addListener((aba) => {
  if (aba.openerTabId == null) return;
  alterarPais((pais) => {
    pais[aba.id] = aba.openerTabId;
  });
});

// Quando uma aba fecha, os filhos dela sobem para o "avô" (assim a árvore não quebra).
chrome.tabs.onRemoved.addListener((idFechado) => {
  alterarPais((pais) => {
    const avo = pais[idFechado];
    for (const [filho, pai] of Object.entries(pais)) {
      if (pai !== idFechado) continue;
      if (avo === undefined) delete pais[filho];
      else pais[filho] = avo;
    }
    delete pais[idFechado];
  });
});

// ---------- 3. Pomodoro: o que fazer quando o tempo acaba ----------
// O painel lateral pode estar fechado quando o tempo acaba, por isso quem "ouve" o
// alarme é o background. chrome.alarms acorda o service worker na hora certa.
// O estado fica em chrome.storage.local, na chave "pomodoro":
//   { fase: "foco" | "pausa" | "parado", fim: <hora de término em ms>, minutosPausa: 5 }

const ALARME_POMODORO = "pomodoro-fim";

// Guarda uma sessão de foco para as estatísticas (tempo gasto por tarefa).
// Cada sessão: { id, tarefaId, titulo, inicio, minutos }. Guardamos o TÍTULO junto para que
// as estatísticas continuem corretas mesmo se a tarefa for renomeada ou excluída depois.
// (pomodoro.js tem uma função parecida, usada quando você para o foco antes da hora.)
async function registrarSessao(estado, minutos) {
  if (!minutos || minutos < 1) return;
  const { sessoesFoco = [] } = await chrome.storage.local.get("sessoesFoco");
  sessoesFoco.push({
    id: crypto.randomUUID(),
    tarefaId: estado.tarefaId || "",
    titulo: estado.titulo || "Sem tarefa",
    inicio: estado.inicio || Date.now() - minutos * 60000,
    minutos,
  });
  await chrome.storage.local.set({ sessoesFoco: sessoesFoco.slice(-5000) }); // limite de segurança
}

// Notificação calma, sem urgência. O catch evita erro se o navegador bloquear.
function avisar(titulo, mensagem) {
  chrome.notifications
    .create({ type: "basic", iconUrl: "icons/icon-128.png", title: titulo, message: mensagem })
    .catch((erro) => console.error("Notificação não exibida:", erro));
}

chrome.alarms.onAlarm.addListener(async (alarme) => {
  if (alarme.name !== ALARME_POMODORO) return;

  const { pomodoro } = await chrome.storage.local.get("pomodoro");
  if (!pomodoro || pomodoro.fase === "parado") return;

  if (pomodoro.fase === "foco") {
    // Acabou o foco: guarda a sessão (para as estatísticas) e começa a pausa.
    await registrarSessao(pomodoro, pomodoro.minutos);
    await pararRelogio("pausa"); // durante a pausa o tempo da tarefa nao conta
    // Descansar é parte do plano: a pausa começa automaticamente.
    const fim = Date.now() + pomodoro.minutosPausa * 60000;
    await chrome.storage.local.set({ pomodoro: { ...pomodoro, fase: "pausa", fim } });
    await chrome.alarms.create(ALARME_POMODORO, { when: fim });
    avisar("Pausa curta", "Você foi bem. Levante, beba água e se mexa um pouco.");
  } else {
    // Acabou a pausa: para e espera. Quem decide voltar é você, sem pressão.
    await chrome.storage.local.set({ pomodoro: { ...pomodoro, fase: "parado", fim: 0 } });
    avisar("Pausa terminou", "Quando se sentir pronto, volte para a tarefa.");
  }
});

// ---------- 4. Reabrir sozinho de onde você parou ----------
// Tudo aqui é automático e silencioso: não há tela nem botão (só uma chave liga/desliga
// no painel). Duas situações disparam a reabertura:
//   A) Você abre o Vivaldi e as abas da última vez não voltaram.
//   B) Você fecha uma área de trabalho (ou muitas abas de uma vez) e elas somem de repente.
//
// Para isso precisamos LEMBRAR quais abas existiam. Isso fica guardado só no seu
// computador (chrome.storage.local, chave "memoriaAbas") e nunca é enviado a lugar nenhum.
//
// LIMITE DO VIVALDI: extensões não conseguem colocar uma aba "dentro" de uma área de
// trabalho. As abas reabertas aparecem numa janela nova. Para o Vivaldi também devolver
// as áreas, ative: Configurações > Início > "Iniciar com a última sessão".

const ALARME_MEMORIA = "memoria-salvar";
const ALARME_INICIO = "restaurar-inicio";
const MINIMO_PARA_QUEDA = 4; // só consideramos "queda" se havia pelo menos 4 abas
const MAXIMO_REABRIR = 80; // trava de segurança: nunca abre mais que isso de uma vez
const PAUSA_ENTRE_RESTAURACOES_MS = 20000; // evita reabrir duas vezes seguidas

// A chave "reabrirAuto" vem do painel. Se nunca foi mexida, o padrão é LIGADO.
async function reabrirLigado() {
  const { reabrirAuto } = await chrome.storage.local.get("reabrirAuto");
  return reabrirAuto !== false;
}

// Dois endereços são "o mesmo" se só diferem pelo "#" e pela barra final.
function normalizar(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return url;
  }
}

// Lista as abas abertas agora (só sites de verdade, não páginas internas do navegador).
async function abasAbertasAgora() {
  const abas = await chrome.tabs.query({});
  return abas
    .filter((aba) => /^https?:\/\//.test(aba.url || ""))
    .map((aba) => ({ url: aba.url, title: (aba.title || "").slice(0, 200), pinned: Boolean(aba.pinned) }));
}

// Reabre as abas guardadas que NÃO estão abertas agora, numa janela nova.
async function reabrir(abasGuardadas, textoAviso) {
  const { ultimaRestauracao = 0 } = await chrome.storage.local.get("ultimaRestauracao");
  if (Date.now() - ultimaRestauracao < PAUSA_ENTRE_RESTAURACOES_MS) return;

  const abertas = new Set((await abasAbertasAgora()).map((aba) => normalizar(aba.url)));
  const faltando = abasGuardadas
    .filter((aba) => !abertas.has(normalizar(aba.url)))
    .slice(0, MAXIMO_REABRIR);
  if (!faltando.length) return;

  await chrome.storage.local.set({ ultimaRestauracao: Date.now() });
  const janela = await chrome.windows.create({ url: faltando.map((aba) => aba.url), focused: true });

  // Fixa de novo as abas que eram fixadas (a ordem é a mesma da lista).
  const criadas = janela.tabs || [];
  await Promise.all(
    faltando.map((aba, i) => (aba.pinned && criadas[i] ? chrome.tabs.update(criadas[i].id, { pinned: true }) : null))
  );
  avisar("Abas reabertas", `${faltando.length} ${textoAviso}`);
}

// Atualiza a memória; se detectar uma queda brusca, reabre em vez de "esquecer".
let filaMemoria = Promise.resolve();

function atualizarMemoria() {
  filaMemoria = filaMemoria
    .then(async () => {
      const agora = await abasAbertasAgora();
      // Navegador fechando (zero abas): não apaga a memória.
      if (agora.length === 0) return;

      const { memoriaAbas } = await chrome.storage.local.get("memoriaAbas");
      const antes = memoriaAbas ? memoriaAbas.abas : [];

      const quedaBrusca = antes.length >= MINIMO_PARA_QUEDA && agora.length < antes.length / 2;
      if (quedaBrusca && (await reabrirLigado())) {
        // Não sobrescreve a memória: ela ainda guarda o que existia antes da queda.
        await reabrir(antes, "abas reabertas porque uma área foi fechada.");
        return;
      }
      await chrome.storage.local.set({ memoriaAbas: { em: Date.now(), abas: agora.slice(0, 300) } });
    })
    .catch((erro) => console.error("Falha ao atualizar a memória de abas:", erro));
}

// Agenda a gravação para ~30 s depois da última mudança (várias mudanças viram uma só).
async function agendarMemoria() {
  if (!(await chrome.alarms.get(ALARME_MEMORIA))) {
    await chrome.alarms.create(ALARME_MEMORIA, { delayInMinutes: 0.5 });
  }
}

chrome.tabs.onCreated.addListener(agendarMemoria);
chrome.tabs.onUpdated.addListener((id, mudanca) => {
  if (mudanca.url || mudanca.status === "complete") agendarMemoria();
});
chrome.tabs.onRemoved.addListener(() => {
  agendarMemoria();
  // Fechar uma área remove várias abas de uma vez: conferimos logo, sem esperar os 30 s.
  setTimeout(atualizarMemoria, 4000);
});

// Quando o Vivaldi abre: espera ~15 s (para ele restaurar a sessão dele primeiro) e
// então reabre o que ainda estiver faltando.
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARME_INICIO, { delayInMinutes: 0.25 });
});

chrome.alarms.onAlarm.addListener(async (alarme) => {
  if (alarme.name === ALARME_MEMORIA) atualizarMemoria();
  if (alarme.name === ALARME_INICIO && (await reabrirLigado())) {
    const { memoriaAbas } = await chrome.storage.local.get("memoriaAbas");
    if (memoriaAbas) await reabrir(memoriaAbas.abas, "abas reabertas de onde você parou.");
  }
});

// ---------- 5. Contar abas abertas e fechadas por dia (para as estatísticas) ----------
// Guardamos só NÚMEROS por dia, nunca endereços: { "2026-10-05": { abertas: 12, fechadas: 9 } }.
let filaContagem = Promise.resolve();

function contarAba(tipo) {
  filaContagem = filaContagem
    .then(async () => {
      const dia = new Date().toLocaleDateString("sv-SE"); // formato AAAA-MM-DD no seu fuso
      const { abasPorDia = {} } = await chrome.storage.local.get("abasPorDia");
      const registro = abasPorDia[dia] || { abertas: 0, fechadas: 0 };
      registro[tipo] += 1;
      abasPorDia[dia] = registro;
      // Mantém só os últimos 120 dias.
      const dias = Object.keys(abasPorDia).sort();
      for (const antigoDia of dias.slice(0, Math.max(0, dias.length - 120))) delete abasPorDia[antigoDia];
      await chrome.storage.local.set({ abasPorDia });
    })
    .catch((erro) => console.error("Falha ao contar abas:", erro));
}

chrome.tabs.onCreated.addListener(() => contarAba("abertas"));
chrome.tabs.onRemoved.addListener(() => contarAba("fechadas"));

// ---------- 6. Automatico: atividade, tempo parado e dicas ----------
// Tudo aqui acontece sozinho (veja atividade.js e relogio.js). Ajustes liga e desliga cada parte.

// A cada 30 s: olha o que voce esta fazendo e liga/troca o relogio; e a lista segue a area atual.
chrome.alarms.create(ALARME_ATIVIDADE, { periodInMinutes: 0.5 });

// Parado por 5 minutos: o relogio para (o tempo parado nao conta) e retoma quando voce volta.
chrome.idle.setDetectionInterval(SEGUNDOS_SEM_USO);
chrome.idle.onStateChanged.addListener(async (estado) => {
  try {
    if (estado === "active") {
      const { relogioRetomar } = await chrome.storage.local.get("relogioRetomar");
      if (relogioRetomar) {
        await chrome.storage.local.set({ relogioRetomar: null });
        await iniciarRelogio(relogioRetomar);
      }
      return;
    }
    const atual = await lerRelogio();
    if (!atual) return;
    await pararRelogio("inatividade", Date.now() - SEGUNDOS_SEM_USO * 1000);
    if (!atual.tarefaId.startsWith("ctx:")) await chrome.storage.local.set({ relogioRetomar: atual.tarefaId });
  } catch (erro) {
    console.error("Falha ao tratar inatividade:", erro);
  }
});

// Trocou de aba ou de janela: a lista acompanha a area de trabalho (rapido, sem esperar os 30 s).
chrome.tabs.onActivated.addListener(() => seguirAreaAtual().catch((e) => console.error(e)));
chrome.windows.onFocusChanged.addListener(() => seguirAreaAtual().catch((e) => console.error(e)));

// Dicas por tempo: notificacoes calmas aos 25, 50 e 90 minutos seguidos numa tarefa.
async function avisarPorTempo() {
  const cfg = await lerAutomacao();
  if (!cfg.dicas) return;
  const relogio = await lerRelogio();
  if (!relogio) return;
  const minutos = Math.floor((Date.now() - relogio.desde) / 60000);
  const nome = relogio.titulo.length > 60 ? `${relogio.titulo.slice(0, 59)}…` : relogio.titulo;
  const mensagens = {
    25: `Já são 25 minutos em "${nome}". Que tal uma pausa curta de 5 minutos? Levante e se mexa.`,
    50: `50 minutos seguidos em "${nome}". Se ainda está grande, divida em passos menores e faça só o próximo.`,
    90: `1h30 seguidas em "${nome}". Descanse um pouco. O resto rende mais depois.`,
  };
  for (const limiar of [25, 50, 90]) {
    if (minutos >= limiar && !relogio.avisos.includes(limiar)) {
      relogio.avisos.push(limiar);
      await chrome.storage.local.set({ relogioTarefa: relogio });
      avisar("Dica de ritmo", mensagens[limiar]);
      return; // um aviso por vez
    }
  }
}

chrome.alarms.onAlarm.addListener(async (alarme) => {
  try {
    if (alarme.name === ALARME_ATIVIDADE) {
      await tickAtividade();
      await seguirAreaAtual();
    }
    if (alarme.name === ALARME_RELOGIO) await avisarPorTempo();
  } catch (erro) {
    console.error("Falha no ciclo automatico:", erro);
  }
});
