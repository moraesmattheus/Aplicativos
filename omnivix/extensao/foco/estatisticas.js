// estatisticas.js
// Pagina "Estatisticas": mostra o que foi feito e quanto tempo foi gasto, para o periodo
// escolhido. Tudo e calculado aqui, a partir dos dados guardados no seu computador.
//
// De onde vem cada numero:
//   - horas de foco  -> "sessoesFoco" (gravadas pelo Pomodoro, ligadas a tarefa de agora)
//   - concluidas     -> tarefas com "feitaEm" dentro do periodo
//   - criadas        -> tarefas com "criadaEm" dentro do periodo
//   - abas           -> "abasPorDia" (so numeros, o background.js conta)
// Tom: so informa. Nada de "meta nao cumprida" nem vermelho, por causa da ansiedade.

const elCartoes = document.getElementById("cartoes");
const elGraficoDias = document.getElementById("grafico-dias");
const elTempoTarefas = document.getElementById("tempo-tarefas");
const elConcluidas = document.getElementById("lista-concluidas");
const elTempoAtivo = document.getElementById("tempo-ativo");
const elTempoCategorias = document.getElementById("tempo-categorias");
const elResumoAbas = document.getElementById("resumo-abas");
const botoesPeriodo = document.querySelectorAll(".periodos button");

let periodoDias = 7;

// ---------- Pecas de tela ----------
function cartao(valor, rotulo) {
  const el = criar("div", null, "cartao");
  el.append(criar("p", valor, "valor"), criar("p", rotulo, "rotulo"));
  return el;
}

function linhaBarra(nome, texto, proporcao) {
  const linha = criar("div", null, "barra-linha");
  const topo = criar("div", null, "topo");
  topo.append(criar("span", nome), criar("span", texto));
  const trilho = criar("div", null, "barra-trilho");
  const preenchida = criar("div", null, "barra-preenchida");
  preenchida.style.width = `${Math.max(2, Math.round(proporcao * 100))}%`;
  trilho.append(preenchida);
  linha.append(topo, trilho);
  return linha;
}

function vazio(texto) {
  return criar("p", texto, "suave");
}

// ---------- Calculo e desenho ----------
async function desenhar() {
  const { tarefas, sessoes, abasPorDia, ativas } = await lerTudo();
  const inicio = diasAtras(periodoDias - 1); // periodo "Hoje" = so desde a meia-noite

  const sessoesDoPeriodo = sessoes.filter((s) => s.inicio >= inicio);
  const totalMinutos = sessoesDoPeriodo.reduce((soma, s) => soma + s.minutos, 0);
  const diasComFoco = new Set(sessoesDoPeriodo.map((s) => chaveDoDia(s.inicio))).size;
  const concluidas = tarefas.filter((t) => t.feitaEm && t.feitaEm >= inicio);
  const criadas = tarefas.filter((t) => t.criadaEm && t.criadaEm >= inicio);

  // --- Cartoes ---
  elCartoes.textContent = "";
  elCartoes.append(
    cartao(formatarDuracao(totalMinutos), "de foco"),
    cartao(String(sessoesDoPeriodo.length), "sessões de foco"),
    cartao(String(concluidas.length), "tarefas concluídas"),
    cartao(String(criadas.length), "tarefas criadas"),
    cartao(String(diasComFoco), diasComFoco === 1 ? "dia com foco" : "dias com foco"),
    cartao(
      sessoesDoPeriodo.length ? formatarDuracao(totalMinutos / sessoesDoPeriodo.length) : "0 min",
      "por sessão, em média"
    )
  );

  // --- Foco por dia (colunas) ---
  elGraficoDias.textContent = "";
  if (periodoDias === 1) {
    elGraficoDias.append(vazio(`Hoje: ${formatarDuracao(totalMinutos)} de foco.`));
  } else {
    const dias = [];
    for (let i = periodoDias - 1; i >= 0; i--) {
      const ms = diasAtras(i);
      const chave = chaveDoDia(ms);
      const minutos = sessoesDoPeriodo
        .filter((s) => chaveDoDia(s.inicio) === chave)
        .reduce((soma, s) => soma + s.minutos, 0);
      dias.push({ chave, minutos, ms });
    }
    const maximo = Math.max(1, ...dias.map((d) => d.minutos));
    const colunas = criar("div", null, "colunas");
    for (const dia of dias) {
      const coluna = criar("div", null, "coluna");
      const barra = document.createElement("i");
      barra.style.height = `${Math.round((dia.minutos / maximo) * 100)}%`;
      barra.title = `${new Date(dia.ms).toLocaleDateString("pt-BR")}: ${formatarDuracao(dia.minutos)}`;
      coluna.append(barra);
      colunas.append(coluna);
    }
    const eixo = criar("div", null, "eixo");
    eixo.append(
      criar("span", new Date(dias[0].ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })),
      criar("span", "hoje")
    );
    elGraficoDias.append(colunas, eixo);
  }

  // --- Tempo por tarefa ---
  elTempoTarefas.textContent = "";
  const porTarefa = new Map();
  for (const s of sessoesDoPeriodo) {
    const chave = s.tarefaId || s.titulo;
    const item = porTarefa.get(chave) || { titulo: s.titulo, minutos: 0, sessoes: 0 };
    item.minutos += s.minutos;
    item.sessoes += 1;
    porTarefa.set(chave, item);
  }
  const ordenadas = [...porTarefa.values()].sort((a, b) => b.minutos - a.minutos);
  if (!ordenadas.length) {
    elTempoTarefas.append(vazio("Ainda sem sessões de foco neste período. Inicie um foco na página Foco."));
  } else {
    const maior = ordenadas[0].minutos;
    for (const item of ordenadas) {
      const sufixo = item.sessoes === 1 ? "1 sessão" : `${item.sessoes} sessões`;
      elTempoTarefas.append(linhaBarra(item.titulo, `${formatarDuracao(item.minutos)} (${sufixo})`, item.minutos / maior));
    }
  }

  // --- Tempo ativo (o relogio automatico ou manual): por tarefa e por categoria ---
  const ativasPeriodo = ativas.filter((s) => s.inicio >= inicio);
  const somarPor = (chave, nome) => {
    const mapa = new Map();
    for (const s of ativasPeriodo) {
      const k = chave(s);
      const item = mapa.get(k) || { titulo: nome(s), ms: 0 };
      item.ms += s.ms;
      mapa.set(k, item);
    }
    return [...mapa.values()].sort((a, b) => b.ms - a.ms);
  };
  const preencherBarras = (alvo, itens, vazioTexto) => {
    alvo.textContent = "";
    if (!itens.length) { alvo.append(vazio(vazioTexto)); return; }
    for (const item of itens) {
      alvo.append(linhaBarra(item.titulo, formatarDuracao(item.ms / 60000), item.ms / itens[0].ms));
    }
  };
  preencherBarras(elTempoAtivo, somarPor((s) => s.tarefaId, (s) => s.titulo),
    "Ainda sem tempo registrado. Ele conta sozinho quando você começa a trabalhar numa tarefa.");
  preencherBarras(elTempoCategorias, somarPor((s) => s.categoria || "Sem categoria", (s) => s.categoria || "Sem categoria"),
    "Sem tempo por categoria neste período.");

  // --- Concluidas, com o tempo total que cada uma consumiu (em qualquer periodo) ---
  elConcluidas.textContent = "";
  if (!concluidas.length) {
    elConcluidas.append(criar("li", "Nenhuma tarefa concluída neste período.", "suave"));
  }
  for (const tarefa of [...concluidas].sort((a, b) => b.feitaEm - a.feitaEm)) {
    const minutos = Math.round(ativas.filter((s) => s.tarefaId === tarefa.id).reduce((soma, s) => soma + s.ms, 0) / 60000)
      + sessoes.filter((s) => s.tarefaId === tarefa.id).reduce((soma, s) => soma + s.minutos, 0);
    const li = document.createElement("li");
    const data = new Date(tarefa.feitaEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    li.append(criar("span", tarefa.titulo), criar("span", ` ${data}${minutos ? `, ${formatarDuracao(minutos)} de foco` : ""}`, "data"));
    elConcluidas.append(li);
  }

  // --- Abas ---
  elResumoAbas.textContent = "";
  let abertas = 0;
  let fechadas = 0;
  for (const [dia, registro] of Object.entries(abasPorDia)) {
    if (dia >= chaveDoDia(inicio)) {
      abertas += registro.abertas;
      fechadas += registro.fechadas;
    }
  }
  elResumoAbas.append(
    criar("p", `${abertas} abertas e ${fechadas} fechadas neste período.`),
    criar("p", "Os números começam a ser contados a partir de agora.", "suave")
  );
}

// ---------- Ligacoes ----------
for (const botao of botoesPeriodo) {
  botao.addEventListener("click", () => {
    periodoDias = Number(botao.dataset.dias);
    for (const b of botoesPeriodo) b.setAttribute("aria-pressed", String(b === botao));
    desenhar();
  });
}

chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && (mudancas.sessoesFoco || mudancas.tarefas || mudancas.abasPorDia || mudancas.temposSessoes)) desenhar();
});

desenhar();
