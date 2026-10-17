// briefing.js
// Pagina "Briefing": um resumo do dia com tudo que ajuda a decidir "por onde comecar",
// montado so com os seus dados locais (sem IA e sem internet por enquanto).
//
// Seções: Agora, Hoje e proximos dias, Ontem e hoje ate agora, Listas, Abas, Foco e um
// proximo passo sugerido. Tom calmo: nada de "atrasado", "falhou" ou vermelho. Datas que
// passaram aparecem como "para reagendar".
// Quando Google Calendar e Notion forem conectados (fases futuras), entram aqui tambem.

const elSaudacao = document.getElementById("saudacao");
const elDataHoje = document.getElementById("data-hoje");
const elSecoes = document.getElementById("secoes");

// ---------- Pecas de tela ----------
function secao(titulo, linhas) {
  const bloco = criar("section", null, "bloco");
  bloco.append(criar("h2", titulo));
  for (const linha of linhas) {
    bloco.append(typeof linha === "string" ? criar("p", linha) : linha);
  }
  return bloco;
}

function listaDe(itens) {
  const ul = criar("ul", null, "lista-simples");
  for (const item of itens) ul.append(criar("li", item));
  return ul;
}

function saudacaoDoHorario() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// "AAAA-MM-DD" -> numero de dias a partir de hoje (0 = hoje, 1 = amanha, -1 = ontem).
function diasAteData(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Math.round((new Date(ano, mes - 1, dia) - new Date(diasAtras(0))) / 86400000);
}

function ate(texto, maximo) {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}

// ---------- Montagem do briefing ----------
async function montar() {
  const { tarefas, listas, listaAtual, sessoes, pomodoro } = await lerTudo();
  const agora = Date.now();

  elSaudacao.textContent = `${saudacaoDoHorario()}, Mattheus`;
  elDataHoje.textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const principais = tarefas.filter((t) => !t.paiId);
  const pendentes = principais.filter((t) => !t.feita);
  const atual = pendentes.find((t) => !listaAtual || t.listaId === listaAtual || !t.listaId) || null;
  const nomeDaLista = (id) => (listas.find((l) => l.id === id) || listas[0]).nome;

  const secoes = [];

  // 1. Agora
  const linhasAgora = [];
  if (atual) {
    linhasAgora.push(atual.titulo);
    const subs = tarefas.filter((t) => t.paiId === atual.id);
    if (subs.length) {
      const feitas = subs.filter((s) => s.feita).length;
      linhasAgora.push(criar("p", `${feitas} de ${subs.length} subtarefas concluídas.`, "suave"));
    }
    if (atual.nota) linhasAgora.push(criar("p", `Onde parei: ${atual.nota}`, "suave"));
  } else {
    linhasAgora.push("Nenhuma tarefa em foco. Escolha uma pequena para começar.");
  }
  secoes.push(secao("Agora", linhasAgora));

  // 2. Hoje e proximos dias
  const hoje = [];
  const amanha = [];
  const proximos = [];
  const reagendar = [];
  let semData = 0;
  for (const tarefa of pendentes) {
    const dias = diasAteData(tarefa.data);
    if (dias === null) semData += 1;
    else if (dias < 0) reagendar.push(tarefa.titulo);
    else if (dias === 0) hoje.push(tarefa.titulo);
    else if (dias === 1) amanha.push(tarefa.titulo);
    else if (dias <= 7) proximos.push(`${tarefa.titulo} (${new Date(new Date(diasAtras(0)).setDate(new Date().getDate() + dias)).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })})`);
  }
  const linhasPrazos = [];
  if (hoje.length) linhasPrazos.push(criar("p", "Para hoje:"), listaDe(hoje));
  if (amanha.length) linhasPrazos.push(criar("p", "Para amanhã:"), listaDe(amanha));
  if (proximos.length) linhasPrazos.push(criar("p", "Próximos 7 dias:"), listaDe(proximos));
  if (reagendar.length) linhasPrazos.push(criar("p", `Datas que passaram (para reagendar): ${reagendar.length}`, "suave"), listaDe(reagendar.slice(0, 5)));
  if (semData) linhasPrazos.push(criar("p", `${semData} ${semData === 1 ? "tarefa sem data" : "tarefas sem data"}.`, "suave"));
  if (!linhasPrazos.length) linhasPrazos.push("Nenhuma tarefa pendente.");
  secoes.push(secao("Hoje e próximos dias", linhasPrazos));

  // 3. Ontem e hoje ate agora
  const inicioHoje = diasAtras(0);
  const inicioOntem = diasAtras(1);
  const concluidasOntem = principais.filter((t) => t.feitaEm && t.feitaEm >= inicioOntem && t.feitaEm < inicioHoje);
  const concluidasHoje = principais.filter((t) => t.feitaEm && t.feitaEm >= inicioHoje);
  const minutosOntem = sessoes.filter((s) => s.inicio >= inicioOntem && s.inicio < inicioHoje).reduce((m, s) => m + s.minutos, 0);
  const minutosHoje = sessoes.filter((s) => s.inicio >= inicioHoje).reduce((m, s) => m + s.minutos, 0);
  const linhasRecap = [
    `Ontem: ${formatarDuracao(minutosOntem)} de foco e ${concluidasOntem.length} ${concluidasOntem.length === 1 ? "tarefa concluída" : "tarefas concluídas"}.`,
    `Hoje até agora: ${formatarDuracao(minutosHoje)} de foco e ${concluidasHoje.length} ${concluidasHoje.length === 1 ? "tarefa concluída" : "tarefas concluídas"}.`,
  ];
  if (concluidasOntem.length) linhasRecap.push(listaDe(concluidasOntem.slice(0, 5).map((t) => t.titulo)));
  secoes.push(secao("Ontem e hoje", linhasRecap));

  // 4. Listas
  const porLista = listas
    .map((lista) => `${lista.nome}: ${pendentes.filter((t) => (t.listaId || listas[0].id) === lista.id).length} pendentes`);
  secoes.push(secao("Listas", [listaDe(porLista)]));

  // 5. Abas
  const abas = await chrome.tabs.query({});
  const sites = new Map();
  const enderecos = new Map();
  for (const aba of abas) {
    try {
      const url = new URL(aba.url || "");
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const site = url.hostname.replace(/^www\./, "");
      sites.set(site, (sites.get(site) || 0) + 1);
      url.hash = "";
      const chave = url.href.replace(/\/$/, "");
      enderecos.set(chave, (enderecos.get(chave) || 0) + 1);
    } catch {
      // aba sem endereco valido: ignora
    }
  }
  const repetidas = [...enderecos.values()].reduce((soma, n) => soma + (n > 1 ? n - 1 : 0), 0);
  const topSites = [...sites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => `${s} (${n})`);
  const linhasAbas = [`${abas.length} ${abas.length === 1 ? "aba aberta" : "abas abertas"}${repetidas ? `, ${repetidas} repetidas` : ""}.`];
  if (topSites.length) linhasAbas.push(criar("p", `Mais abertos: ${topSites.join(", ")}.`, "suave"));
  secoes.push(secao("Abas", linhasAbas));

  // 6. Foco agora
  const rotulos = { foco: "Foco em andamento", pausa: "Em pausa curta", parado: "Pomodoro parado" };
  const linhasFoco = [rotulos[pomodoro.fase] || rotulos.parado];
  if (pomodoro.fase !== "parado" && pomodoro.fim) {
    linhasFoco.push(criar("p", `Termina às ${new Date(pomodoro.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`, "suave"));
  }
  secoes.push(secao("Foco", linhasFoco));

  // 7. Proximo passo sugerido (regra simples, sem IA)
  const passo = atual
    ? `Comece com 10 minutos em "${ate(atual.titulo, 60)}". Depois decida se continua.`
    : reagendar.length
    ? "Escolha uma das tarefas com data que passou e coloque uma data nova."
    : "Crie ou escolha uma tarefa pequena. Só uma.";
  secoes.push(secao("Próximo passo sugerido", [passo]));

  // 8. Aviso honesto sobre o que ainda nao entra
  secoes.push(secao("Em breve", [criar("p", "Agenda do Google Calendar, páginas do Notion e resumo com IA entram quando forem conectados.", "suave")]));

  elSecoes.textContent = "";
  elSecoes.style.display = "grid";
  elSecoes.style.gap = "12px";
  for (const bloco of secoes) elSecoes.append(bloco);
}

// Atualiza quando dados relevantes mudam (e ao abrir a pagina).
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && (mudancas.tarefas || mudancas.sessoesFoco || mudancas.pomodoro || mudancas.listaAtual)) montar();
});
chrome.tabs.onCreated.addListener(() => montar());
chrome.tabs.onRemoved.addListener(() => montar());

montar();
