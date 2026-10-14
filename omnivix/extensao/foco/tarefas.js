import { AREAS_VIVALDI } from "./areas.js";
import { classificar, palavrasParaAprender, listaPorNome } from "./categorias.js";
import { iniciarRelogio, pararRelogio, totaisPorTarefa } from "./relogio.js";
import { mediaDaCategoria, escolherDica } from "./dicas.js";
// tarefas.js
// Pagina "Tarefas": gerenciador no estilo Google Tarefas, com um cartao de FOCO no topo,
// categorias automaticas e tempo automatico.
//
// O que ele faz:
//  - uma LISTA por area de trabalho do Vivaldi (areas.js) e as que voce criar, mais "Todas as listas";
//  - tarefa nova e LIDA e vai sozinha para a lista da categoria dela (categorias.js);
//    se voce mover uma tarefa na mao, a extensao aprende e acerta nas proximas;
//  - tarefas com data opcional e SUBTAREFAS (um nivel);
//  - "Agora": a primeira tarefa pendente da lista fica grande, o resto fica em "Depois";
//  - TEMPO: o relogio liga quando voce comeca (ou sozinho, pela atividade detectada; veja
//    atividade.js) e mostra dicas pelo tempo (dicas.js).
//
// Como os dados sao guardados (chrome.storage.local, so no seu computador):
//   listas:      [{ id, nome, areaId? }]    areaId = id da area de trabalho do Vivaldi
//   tarefas:     [{ id, listaId, paiId, titulo, data, feita, nota, criadaEm, feitaEm, categorizada }]
//   listaAtual:  id da lista aberta, ou "__todas__"
//   aprendizado: { palavra: nomeDaLista }   (o que a extensao aprendeu com voce)
// A ORDEM do array de tarefas e a ordem na tela.

const TODAS = "__todas__"; // mesmo valor usado nas paginas Foco e Briefing
const LISTA_PADRAO = { id: "padrao", nome: "Minhas tarefas" }; // a "caixa de entrada"

// ---------- 1. Ler e guardar ----------

// Le tudo e "conserta" o que faltar (tarefas antigas sem lista continuam funcionando).
async function lerDados() {
  const bruto = await chrome.storage.local.get([
    "tarefas", "listas", "listaAtual", "temposSessoes", "relogioTarefa", "aprendizado",
  ]);
  const listas = bruto.listas && bruto.listas.length ? bruto.listas : [LISTA_PADRAO];
  const idsDasListas = new Set(listas.map((lista) => lista.id));

  const tarefas = (bruto.tarefas || []).map((tarefa) =>
    idsDasListas.has(tarefa.listaId) ? tarefa : { ...tarefa, listaId: listas[0].id }
  );
  const listaAtual = bruto.listaAtual === TODAS || idsDasListas.has(bruto.listaAtual) ? bruto.listaAtual : listas[0].id;
  return {
    tarefas, listas, listaAtual,
    sessoes: bruto.temposSessoes || [],
    relogio: bruto.relogioTarefa || null,
    aprendizado: bruto.aprendizado || {},
  };
}

async function guardar(parcial) {
  await chrome.storage.local.set(parcial);
}

// A "caixa de entrada" e a lista onde tarefas novas caem antes de serem organizadas.
const caixaDeEntrada = (listas) => listas.find((l) => l.id === LISTA_PADRAO.id) || listas[0];

// Uma tarefa pertence ao que esta sendo visto? (a lista aberta, ou tudo em "Todas")
const noEscopo = (tarefa, listaAtual) => listaAtual === TODAS || tarefa.listaId === listaAtual;

// ---------- 2. Elementos da pagina ----------
const porId = (id) => document.getElementById(id);
const elSeletorLista = porId("seletor-lista");
const elBtnNovaLista = porId("btn-nova-lista");
const elFormLista = porId("form-lista");
const elNomeLista = porId("nome-lista");
const elTarefaAtual = porId("tarefa-atual");
const elCronometro = porId("cronometro");
const elBtnRelogio = porId("btn-relogio");
const elBtnConcluir = porId("btn-concluir");
const elMoverAtual = porId("mover-atual");
const elDica = porId("dica");
const elBlocoNota = porId("bloco-nota");
const elNota = porId("nota");
const elForm = porId("form-nova");
const elInput = porId("nova");
const elData = porId("nova-data");
const elAviso = porId("aviso");
const elLista = porId("lista");
const elListaFeitas = porId("lista-feitas");
const elContagem = porId("contagem");
const elContagemFeitas = porId("contagem-feitas");
const elBtnExcluirLista = porId("btn-excluir-lista");

// Estado so de tela (nao precisa ser guardado):
let idComSubtarefaAberta = null; // qual tarefa esta mostrando o campo de subtarefa
let confirmandoExcluirLista = false; // "dois cliques" para excluir a lista
let ultimoDesenho = null; // dados do ultimo desenho, para o relogio da tela atualizar a cada segundo
let temporizadorAviso;

function mostrarAviso(texto) {
  elAviso.textContent = texto;
  clearTimeout(temporizadorAviso);
  if (texto) temporizadorAviso = setTimeout(() => (elAviso.textContent = ""), 8000);
}

// ---------- 3. Datas e tempos ----------
// Mostra a data de forma calma. Sem vermelho e sem "atrasada": so informa.
function textoDaData(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const [ano, mes, dia] = iso.split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diferenca = Math.round((alvo - hoje) / 86400000);

  if (diferenca === 0) return "hoje";
  if (diferenca === 1) return "amanhã";
  if (diferenca === -1) return "ontem";
  return alvo.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function minutosDe(ms) {
  return Math.floor(ms / 60000);
}

function relogioTexto(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ---------- 4. Acoes ----------

// Descobre em que lista uma tarefa nova deve entrar. Se voce esta numa lista especifica, ela
// respeita a sua escolha; se esta na caixa de entrada ou em "Todas", a categoria decide.
function escolherDestino(titulo, listaAtual, listas, aprendizado) {
  const caixa = caixaDeEntrada(listas);
  if (listaAtual !== TODAS && listaAtual !== caixa.id) return { listaId: listaAtual, categoria: null, listas };

  const nome = classificar(titulo, aprendizado);
  if (!nome) return { listaId: caixa.id, categoria: null, listas };

  let lista = listaPorNome(listas, nome);
  let novasListas = listas;
  if (!lista) {
    lista = { id: crypto.randomUUID(), nome };
    novasListas = [...listas, lista]; // a categoria ainda nao tinha lista: cria
  }
  return { listaId: lista.id, categoria: lista.nome, listas: novasListas };
}

async function adicionarTarefa(titulo, data, paiId) {
  const { tarefas, listas, listaAtual, aprendizado } = await lerDados();

  let listaId = listaAtual === TODAS ? caixaDeEntrada(listas).id : listaAtual;
  let categoria = null;
  let listasFinais = listas;

  if (paiId) {
    // Subtarefa: fica sempre na lista da tarefa-mae.
    const mae = tarefas.find((t) => t.id === paiId);
    if (mae) listaId = mae.listaId;
  } else {
    const destino = escolherDestino(titulo, listaAtual, listas, aprendizado);
    ({ listaId, categoria, listas: listasFinais } = destino);
  }

  tarefas.push({
    id: crypto.randomUUID(),
    listaId,
    paiId: paiId || "",
    titulo,
    // So aceita data no formato certo; qualquer outra coisa vira vazio.
    data: /^\d{4}-\d{2}-\d{2}$/.test(data || "") ? data : "",
    feita: false,
    criadaEm: Date.now(), // para as estatisticas
    feitaEm: null,
    categorizada: true, // ja passou pela organizacao automatica
    nota: "",
  });
  await guardar({ tarefas, listas: listasFinais });
  if (categoria) mostrarAviso(`Organizada automaticamente em: ${categoria}`);
}

// Ao abrir, organiza UMA vez as tarefas antigas que ainda estao na caixa de entrada.
async function organizarExistentes() {
  const { tarefas, listas, aprendizado } = await lerDados();
  const caixa = caixaDeEntrada(listas);
  let movidas = 0;
  let listasAtuais = listas;
  let mudou = false;

  for (const tarefa of tarefas) {
    if (tarefa.paiId || tarefa.feita || tarefa.categorizada || tarefa.listaId !== caixa.id) continue;
    tarefa.categorizada = true; // so tenta uma vez (se voce mover de volta, respeitamos)
    mudou = true;
    const nome = classificar(tarefa.titulo, aprendizado);
    if (!nome) continue;
    let lista = listaPorNome(listasAtuais, nome);
    if (!lista) {
      lista = { id: crypto.randomUUID(), nome };
      listasAtuais = [...listasAtuais, lista];
    }
    tarefa.listaId = lista.id;
    for (const sub of tarefas.filter((s) => s.paiId === tarefa.id)) sub.listaId = lista.id;
    movidas += 1;
  }
  if (mudou) await guardar({ tarefas, listas: listasAtuais });
  if (movidas) mostrarAviso(`${movidas} ${movidas === 1 ? "tarefa organizada" : "tarefas organizadas"} automaticamente nas listas certas.`);
}

// Garante uma lista para cada area de trabalho do Vivaldi (com o areaId, usado pela deteccao).
async function garantirListasDasAreas() {
  const { listas } = await lerDados();
  let mudou = false;
  const novas = listas.map((l) => ({ ...l }));
  for (const area of AREAS_VIVALDI) {
    const existente = listaPorNome(novas, area.nome);
    if (!existente) {
      novas.push({ id: crypto.randomUUID(), nome: area.nome, areaId: area.id });
      mudou = true;
    } else if (existente.areaId !== area.id) {
      existente.areaId = area.id;
      mudou = true;
    }
  }
  if (mudou) await guardar({ listas: novas });
}

// Move uma tarefa (e as subtarefas) para outra lista e APRENDE com isso.
async function moverTarefa(id, listaId) {
  const { tarefas, listas, aprendizado } = await lerDados();
  const tarefa = tarefas.find((t) => t.id === id);
  const destino = listas.find((l) => l.id === listaId);
  if (!tarefa || !destino || tarefa.listaId === listaId) return;

  for (const t of tarefas) {
    if (t.id === id || t.paiId === id) t.listaId = listaId;
  }
  tarefa.categorizada = true;
  for (const palavra of palavrasParaAprender(tarefa.titulo)) aprendizado[palavra] = destino.nome;
  await guardar({ tarefas, aprendizado });
  mostrarAviso(`Movida para ${destino.nome}. Vou lembrar disso nas próximas tarefas parecidas.`);
}

// Marca como feita ou desfaz. Se for uma tarefa com subtarefas, elas acompanham.
async function alternarFeita(id, feita) {
  const dados = await lerDados();
  let resumo = "";

  if (feita) {
    // Concluir encerra o relogio dessa tarefa (se estava contando) e mostra um resumo.
    const ligado = dados.relogio && (dados.relogio.tarefaId === id || dados.tarefas.some((t) => t.id === dados.relogio.tarefaId && t.paiId === id));
    if (ligado) await pararRelogio("concluida");
    const depois = (await chrome.storage.local.get("temposSessoes")).temposSessoes || [];
    const minutos = minutosDe(totaisPorTarefa(depois)[id] || 0);
    if (minutos >= 1) {
      const tarefa = dados.tarefas.find((t) => t.id === id);
      const lista = tarefa && dados.listas.find((l) => l.id === tarefa.listaId);
      const media = lista ? mediaDaCategoria(lista.nome, dados.tarefas, depois) : null;
      resumo = `Concluída em ${minutos} min.` + (media ? ` Sua média em ${lista.nome}: ${media} min.` : "");
    }
  }

  const { tarefas } = await lerDados();
  for (const tarefa of tarefas) {
    if (tarefa.id === id || tarefa.paiId === id) {
      tarefa.feita = feita;
      tarefa.feitaEm = feita ? Date.now() : null; // quando foi concluida (estatisticas)
    }
  }
  await guardar({ tarefas });
  if (resumo) mostrarAviso(resumo);
}

async function excluirTarefa(id) {
  const { tarefas, relogio } = await lerDados();
  if (relogio && relogio.tarefaId === id) await pararRelogio("excluida");
  // Apaga a tarefa e as subtarefas dela.
  await guardar({ tarefas: tarefas.filter((t) => t.id !== id && t.paiId !== id) });
}

// Move a tarefa para o comeco da lista, para virar a "Agora", e COMECA o relogio dela.
async function focarNesta(id) {
  const { tarefas, listaAtual } = await lerDados();
  const indice = tarefas.findIndex((t) => t.id === id);
  if (indice === -1) return;
  const [tarefa] = tarefas.splice(indice, 1);
  const primeira = tarefas.findIndex((t) => noEscopo(t, listaAtual) && !t.paiId && !t.feita);
  tarefas.splice(primeira === -1 ? tarefas.length : primeira, 0, tarefa);
  await guardar({ tarefas });
  await iniciarRelogio(id);
}

async function criarLista(nome) {
  const { listas } = await lerDados();
  const nova = { id: crypto.randomUUID(), nome };
  await guardar({ listas: [...listas, nova], listaAtual: nova.id });
}

async function excluirListaAtual() {
  const { tarefas, listas, listaAtual } = await lerDados();
  if (listaAtual === TODAS || listas.length <= 1) return; // sempre sobra pelo menos uma lista
  const restantes = listas.filter((l) => l.id !== listaAtual);
  await guardar({
    listas: restantes,
    tarefas: tarefas.filter((t) => t.listaId !== listaAtual),
    listaAtual: restantes[0].id,
  });
}

// Botao Comecar/Pausar do cartao "Agora".
async function alternarRelogio() {
  const { tarefas, listaAtual, relogio } = await lerDados();
  if (relogio) {
    await pararRelogio("manual");
    if (relogio.auto) {
      // Era um relogio automatico e voce parou: a deteccao espera 30 min antes de tentar de novo.
      await guardar({ atividadePausadaAte: Date.now() + 30 * 60000 });
      mostrarAviso("Certo, parei. Só volto a detectar a atividade automaticamente daqui a 30 minutos.");
    }
    return;
  }
  const atual = tarefas.find((t) => noEscopo(t, listaAtual) && !t.paiId && !t.feita);
  if (atual) await iniciarRelogio(atual.id);
}

// ---------- 5. Desenhar ----------

function criarBotaoPequeno(texto, titulo, aoClicar) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "pequeno";
  botao.textContent = texto;
  botao.title = titulo;
  botao.addEventListener("click", aoClicar);
  return botao;
}

// Lista de destinos para "mover": primeira opcao e so o texto-guia.
function preencherMover(select, listas, listaIdAtual) {
  select.textContent = "";
  const guia = document.createElement("option");
  guia.value = "";
  guia.textContent = "Mover para…";
  select.append(guia);
  for (const lista of listas) {
    if (lista.id === listaIdAtual) continue;
    const opcao = document.createElement("option");
    opcao.value = lista.id;
    opcao.textContent = lista.nome;
    select.append(opcao);
  }
}

// Uma linha de tarefa. "opcoes" controla o que aparece (Focar, subtarefas, mover...).
function criarLinha(tarefa, todas, opcoes) {
  const { listas, totais, relogio, mostrarLista } = opcoes;
  const li = document.createElement("li");
  const topo = document.createElement("div");
  topo.className = "linha-tarefa";

  const caixa = document.createElement("input");
  caixa.type = "checkbox";
  caixa.checked = tarefa.feita;
  caixa.setAttribute("aria-label", tarefa.feita ? "Desfazer conclusão" : "Concluir tarefa");
  caixa.addEventListener("change", () => alternarFeita(tarefa.id, caixa.checked));

  const texto = document.createElement("span");
  texto.className = tarefa.feita ? "titulo feita" : "titulo";
  // textContent (nunca innerHTML) evita que texto digitado vire codigo por acidente.
  texto.textContent = tarefa.titulo;
  topo.append(caixa, texto);

  const chips = [];
  if (mostrarLista) {
    const lista = listas.find((l) => l.id === tarefa.listaId);
    if (lista) chips.push(lista.nome);
  }
  const data = textoDaData(tarefa.data);
  if (data) chips.push(data);
  const minutos = minutosDe(totais[tarefa.id] || 0);
  if (minutos >= 1) chips.push(`${minutos} min`);
  if (relogio && relogio.tarefaId === tarefa.id) chips.push("contando");
  for (const textoChip of chips) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = textoChip;
    topo.append(chip);
  }

  if (opcoes.focar) topo.append(criarBotaoPequeno("Focar", "Fazer desta a tarefa de agora e começar a contar o tempo", () => focarNesta(tarefa.id)));
  if (opcoes.subtarefa) {
    topo.append(
      criarBotaoPequeno("+", "Adicionar subtarefa", () => {
        idComSubtarefaAberta = idComSubtarefaAberta === tarefa.id ? null : tarefa.id;
        desenhar();
      })
    );
  }
  if (opcoes.mover) {
    const select = document.createElement("select");
    select.className = "mover";
    select.setAttribute("aria-label", "Mover para outra lista");
    preencherMover(select, listas, tarefa.listaId);
    select.addEventListener("change", () => select.value && moverTarefa(tarefa.id, select.value));
    topo.append(select);
  }
  topo.append(criarBotaoPequeno("×", "Excluir", () => excluirTarefa(tarefa.id)));
  li.append(topo);

  // Subtarefas (um nivel so, de proposito: simples e sem labirinto).
  const subs = todas.filter((s) => s.paiId === tarefa.id);
  if (subs.length || idComSubtarefaAberta === tarefa.id) {
    const ul = document.createElement("ul");
    ul.className = "tarefas sub";
    for (const sub of subs) ul.append(criarLinha(sub, todas, { ...opcoes, focar: false, subtarefa: false, mover: false, mostrarLista: false }));

    if (idComSubtarefaAberta === tarefa.id) {
      const form = document.createElement("form");
      form.className = "linha";
      const campo = document.createElement("input");
      campo.type = "text";
      campo.maxLength = 200;
      campo.placeholder = "Nova subtarefa";
      const enviar = document.createElement("button");
      enviar.textContent = "Ok";
      form.append(campo, enviar);
      form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const titulo = campo.value.trim();
        if (!titulo) return;
        await adicionarTarefa(titulo, "", tarefa.id); // a tela redesenha sozinha
      });
      const itemForm = document.createElement("li");
      itemForm.append(form);
      ul.append(itemForm);
      setTimeout(() => campo.focus(), 0);
    }
    li.append(ul);
  }
  return li;
}

// Atualiza o relogio e a dica do cartao "Agora" (chamado a cada segundo enquanto conta).
function atualizarRelogioNaTela() {
  if (!ultimoDesenho) return;
  const { atual, relogio, totais, listas, tarefas, sessoes } = ultimoDesenho;
  const agora = Date.now();

  if (relogio) {
    const nome = atual && relogio.tarefaId === atual.id ? "" : ` em "${relogio.titulo}"`;
    elCronometro.textContent = `Contando${nome}: ${relogioTexto(agora - relogio.desde)}${relogio.auto ? " (automático)" : ""}`;
    elBtnRelogio.textContent = "Pausar";
  } else {
    const total = atual ? minutosDe(totais[atual.id] || 0) : 0;
    elCronometro.textContent = total >= 1 ? `Tempo nesta tarefa: ${total} min` : "";
    elBtnRelogio.textContent = "Começar";
  }
  elBtnRelogio.hidden = !atual && !relogio;

  // Dica automatica: so enquanto o relogio conta na tarefa mostrada.
  let dica = null;
  if (relogio && atual && relogio.tarefaId === atual.id) {
    const lista = listas.find((l) => l.id === atual.listaId);
    const categoria = lista ? lista.nome : "";
    dica = escolherDica({
      categoria,
      minutosSessao: minutosDe(agora - relogio.desde),
      minutosTotal: minutosDe((totais[atual.id] || 0) + (agora - relogio.desde)),
      media: categoria ? mediaDaCategoria(categoria, tarefas, sessoes) : null,
      temNota: Boolean(atual.nota),
    });
  }
  elDica.hidden = !dica;
  elDica.textContent = dica || "";
}

let relogioDaTela = null;

async function desenhar() {
  const { tarefas, listas, listaAtual, sessoes, relogio } = await lerDados();
  const totais = totaisPorTarefa(sessoes);

  // --- Seletor de listas ---
  elSeletorLista.textContent = "";
  const todas = document.createElement("option");
  todas.value = TODAS;
  todas.textContent = "Todas as listas";
  todas.selected = listaAtual === TODAS;
  elSeletorLista.append(todas);
  for (const lista of listas) {
    const opcao = document.createElement("option");
    opcao.value = lista.id;
    opcao.textContent = lista.nome;
    opcao.selected = lista.id === listaAtual;
    elSeletorLista.append(opcao);
  }
  elBtnExcluirLista.hidden = listaAtual === TODAS || listas.length <= 1;
  elBtnExcluirLista.textContent = confirmandoExcluirLista ? "Confirmar: excluir lista e suas tarefas" : "Excluir esta lista";

  // --- Separar as tarefas do que esta sendo visto ---
  const doEscopo = tarefas.filter((t) => noEscopo(t, listaAtual));
  const principais = doEscopo.filter((t) => !t.paiId);
  const pendentes = principais.filter((t) => !t.feita);
  const feitas = principais.filter((t) => t.feita);
  const atual = pendentes[0];
  const depois = pendentes.slice(1);

  // --- Cartao "Agora" ---
  if (atual) {
    elTarefaAtual.textContent = atual.titulo;
    elBtnConcluir.hidden = false;
    elBlocoNota.hidden = false;
    elMoverAtual.hidden = false;
    preencherMover(elMoverAtual, listas, atual.listaId);
    // Nao mexemos no texto enquanto voce digita (o cursor pularia).
    if (document.activeElement !== elNota) elNota.value = atual.nota || "";
  } else {
    elTarefaAtual.textContent = "Nada em foco";
    elBtnConcluir.hidden = true;
    elBlocoNota.hidden = true;
    elMoverAtual.hidden = true;
  }

  // --- Listas "Depois" e "Concluidas" ---
  const opcoesBase = { listas, totais, relogio, mostrarLista: listaAtual === TODAS };
  elContagem.textContent = depois.length;
  elContagemFeitas.textContent = feitas.length;
  elLista.textContent = "";
  elListaFeitas.textContent = "";
  for (const tarefa of depois) elLista.append(criarLinha(tarefa, doEscopo, { ...opcoesBase, focar: true, subtarefa: true, mover: true }));
  for (const tarefa of feitas) elListaFeitas.append(criarLinha(tarefa, doEscopo, { ...opcoesBase, focar: false, subtarefa: false, mover: false }));

  // --- Relogio e dica ---
  ultimoDesenho = { atual, relogio, totais, listas, tarefas, sessoes };
  atualizarRelogioNaTela();
  clearInterval(relogioDaTela);
  if (relogio) relogioDaTela = setInterval(atualizarRelogioNaTela, 1000);
}

// ---------- 6. Ligando os controles ----------

elForm.addEventListener("submit", async (evento) => {
  evento.preventDefault(); // impede o formulario de recarregar a pagina
  const titulo = elInput.value.trim(); // trim() tira espacos do comeco e do fim
  if (!titulo) return;
  await adicionarTarefa(titulo, elData.value, "");
  elInput.value = "";
  elData.value = "";
  elInput.focus(); // continua pronto para anotar a proxima ideia
});

elBtnConcluir.addEventListener("click", async () => {
  const { tarefas, listaAtual } = await lerDados();
  const atual = tarefas.find((t) => noEscopo(t, listaAtual) && !t.paiId && !t.feita);
  if (atual) await alternarFeita(atual.id, true);
});

elBtnRelogio.addEventListener("click", alternarRelogio);

elMoverAtual.addEventListener("change", async () => {
  if (!elMoverAtual.value) return;
  const { tarefas, listaAtual } = await lerDados();
  const atual = tarefas.find((t) => noEscopo(t, listaAtual) && !t.paiId && !t.feita);
  if (atual) await moverTarefa(atual.id, elMoverAtual.value);
});

elSeletorLista.addEventListener("change", async () => {
  confirmandoExcluirLista = false;
  await guardar({ listaAtual: elSeletorLista.value });
});

elBtnNovaLista.addEventListener("click", () => {
  elFormLista.hidden = !elFormLista.hidden;
  if (!elFormLista.hidden) elNomeLista.focus();
});

elFormLista.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nome = elNomeLista.value.trim();
  if (!nome) return;
  await criarLista(nome);
  elNomeLista.value = "";
  elFormLista.hidden = true;
});

// Excluir lista apaga tarefas: pedimos DOIS cliques.
elBtnExcluirLista.addEventListener("click", async () => {
  if (!confirmandoExcluirLista) {
    confirmandoExcluirLista = true;
    desenhar();
    return;
  }
  confirmandoExcluirLista = false;
  await excluirListaAtual();
});

// "Onde parei?": salva a nota na tarefa atual. Debounce de 400 ms = so salva quando
// voce faz uma pequena pausa de digitacao, em vez de salvar a cada letra.
let temporizadorNota;
elNota.addEventListener("input", () => {
  clearTimeout(temporizadorNota);
  temporizadorNota = setTimeout(async () => {
    const { tarefas, listaAtual } = await lerDados();
    const atual = tarefas.find((t) => noEscopo(t, listaAtual) && !t.paiId && !t.feita);
    if (!atual) return;
    atual.nota = elNota.value.slice(0, 500); // mesmo limite do campo, por seguranca
    await guardar({ tarefas });
  }, 400);
});

// Redesenha quando algo relevante muda (inclusive o relogio, ligado aqui ou pelo background).
chrome.storage.onChanged.addListener((mudancas, area) => {
  const chaves = ["tarefas", "listas", "listaAtual", "relogioTarefa", "temposSessoes"];
  if (area === "local" && chaves.some((c) => mudancas[c])) {
    if (mudancas.tarefas || mudancas.listas || mudancas.listaAtual) confirmandoExcluirLista = false;
    desenhar();
  }
});

// Ao abrir: garante as listas das areas, organiza as tarefas antigas uma vez e desenha.
(async () => {
  await garantirListasDasAreas();
  await organizarExistentes();
  await desenhar();
})();
