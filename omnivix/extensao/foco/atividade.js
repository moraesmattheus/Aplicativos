import { lerAreaDaAba, areaPorId } from "./areas.js";
import { classificar, listaPorNome, palavrasEmComum } from "./categorias.js";
import { iniciarRelogio, pararRelogio } from "./relogio.js";
// atividade.js
// Descobre SOZINHO o que voce esta fazendo e liga o cronometro na tarefa certa (so logica,
// roda no background.js; precisa de areas.js, categorias.js e relogio.js carregados antes).
//
// Como ele "ve" a atividade (a cada 30 s, so com o computador em uso):
//   1. olha a aba ativa: a AREA DE TRABALHO dela (Faculdade, Projetos...) e, se nao houver,
//      as palavras do titulo e o site (github.com => Projetos, mail.google.com => Emails...);
//   2. se voce fica ~2 minutos nesse contexto, liga o relogio na tarefa pendente daquela
//      categoria que mais combina com o titulo da aba (ou na primeira da lista);
//   3. se nao ha tarefa, conta o tempo como "Categoria (sem tarefa)";
//   4. se voce muda de contexto e fica ~3 minutos nele, troca ou para sozinho.
//
// Privacidade: nada sai do seu computador e enderecos NAO sao guardados. O que fica salvo e so
// a categoria, o nome da tarefa e o tempo. Desligue em Ajustes se quiser.

export const ALARME_ATIVIDADE = "atividade-tick";
const MINUTOS_PARA_INICIAR = 2; // fica este tempo num contexto antes de ligar o relogio
const MINUTOS_PARA_TROCAR = 3; // fica este tempo noutro contexto antes de considerar que mudou
export const SEGUNDOS_SEM_USO = 300; // 5 min sem mexer = parado

// Opcoes de automacao (Ajustes). Tudo ligado por padrao.
export async function lerAutomacao() {
  const { ajustes } = await chrome.storage.local.get("ajustes");
  const a = (ajustes && ajustes.automacao) || {};
  return { detectar: a.detectar !== false, seguirArea: a.seguirArea !== false, dicas: a.dicas !== false };
}

async function abaAtiva() {
  const [aba] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return aba && /^https?:\/\//.test(aba.url || "") ? aba : null;
}

// O contexto de agora: { categoria, areaId, titulo } ou null.
async function contextoAtual() {
  const aba = await abaAtiva();
  if (!aba) return null;
  let site = "";
  try {
    site = new URL(aba.url).hostname; // so o site; o resto do endereco nao e usado
  } catch {
    // endereco invalido: segue so com o titulo
  }
  const areaId = lerAreaDaAba(aba);
  const area = areaId ? areaPorId(areaId) : null;
  const { aprendizado = {} } = await chrome.storage.local.get("aprendizado");
  const porConteudo = classificar(`${aba.title || ""} ${site}`, aprendizado);
  // A area de trabalho e o sinal mais forte; sem ela, vale o conteudo da aba.
  return { categoria: area ? area.nome : porConteudo, areaId, titulo: aba.title || "" };
}

// A lista de tarefas acompanha a area de trabalho em que voce esta (so quando a area MUDA,
// para nao brigar com uma lista que voce escolheu na mao).
export async function seguirAreaAtual() {
  const cfg = await lerAutomacao();
  if (!cfg.seguirArea) return;
  const aba = await abaAtiva();
  const areaId = aba ? lerAreaDaAba(aba) : null;
  if (!areaId) return;
  const { ultimaArea, listas = [] } = await chrome.storage.local.get(["ultimaArea", "listas"]);
  if (ultimaArea === areaId) return;
  await chrome.storage.local.set({ ultimaArea: areaId });
  const area = areaPorId(areaId);
  const lista = area ? listaPorNome(listas, area.nome) : null;
  if (lista) await chrome.storage.local.set({ listaAtual: lista.id });
}

export async function tickAtividade() {
  const cfg = await lerAutomacao();
  if (!cfg.detectar) return;

  const dados = await chrome.storage.local.get(["atividade", "atividadePausadaAte", "tarefas", "listas", "relogioTarefa"]);
  if ((dados.atividadePausadaAte || 0) > Date.now()) return; // voce corrigiu: da um tempo
  if ((await chrome.idle.queryState(SEGUNDOS_SEM_USO)) !== "active") return;

  const ctx = await contextoAtual();
  if (!ctx || !ctx.categoria) return;
  const agora = Date.now();

  // Estado da atividade confirmada, com um pouco de "paciencia" antes de trocar de contexto.
  let at = dados.atividade;
  if (!at || !at.categoria) {
    at = { categoria: ctx.categoria, desde: agora, candidata: null, candidataDesde: 0 };
  } else if (ctx.categoria === at.categoria) {
    at.candidata = null;
  } else if (at.candidata !== ctx.categoria) {
    at.candidata = ctx.categoria;
    at.candidataDesde = agora;
  } else if (agora - at.candidataDesde >= MINUTOS_PARA_TROCAR * 60000) {
    at = { categoria: ctx.categoria, desde: at.candidataDesde, candidata: null, candidataDesde: 0 };
  }
  await chrome.storage.local.set({ atividade: at });

  let relogio = dados.relogioTarefa;
  // Mudou de contexto: encerra o relogio automatico da categoria anterior.
  if (relogio && relogio.auto && relogio.categoria && relogio.categoria !== at.categoria) {
    await pararRelogio("mudou de contexto");
    relogio = null;
  }
  if (relogio) return; // ja ha um relogio contando (manual ou da mesma categoria)
  if (agora - at.desde < MINUTOS_PARA_INICIAR * 60000) return; // ainda nao ficou tempo suficiente

  // Escolhe a tarefa: a pendente da categoria que mais combina com o titulo da aba.
  const lista = listaPorNome(dados.listas || [], at.categoria);
  const pendentes = (dados.tarefas || []).filter((t) => lista && t.listaId === lista.id && !t.paiId && !t.feita);
  if (pendentes.length) {
    let alvo = pendentes[0];
    let melhor = palavrasEmComum(ctx.titulo, alvo.titulo);
    for (const t of pendentes) {
      const pontos = palavrasEmComum(ctx.titulo, t.titulo);
      if (pontos > melhor) { alvo = t; melhor = pontos; }
    }
    await iniciarRelogio(alvo.id, { auto: true, categoria: at.categoria });
  } else {
    await iniciarRelogio(`ctx:${at.categoria}`, {
      auto: true,
      categoria: at.categoria,
      titulo: `${at.categoria} (sem tarefa)`,
      listaId: lista ? lista.id : "",
    });
  }
}
