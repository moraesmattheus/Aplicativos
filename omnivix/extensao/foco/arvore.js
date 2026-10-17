// arvore.js
// Pagina "Abas": mostra as abas da janela de forma organizada, em duas partes:
//   1) "Árvores": abas que abriram outras (cada filha aparece dentro da aba que a abriu).
//   2) "Por site": as abas soltas, agrupadas pelo site (ex.: google.com, github.com).
// Assim, mesmo com 30 abas, você enxerga poucos grupos em vez de uma lista enorme.
// A tela se atualiza sozinha sempre que uma aba abre, fecha ou muda.

const elBusca = document.getElementById("busca");
const elResumo = document.getElementById("resumo");
const elArvore = document.getElementById("arvore");
const elPorSite = document.getElementById("por-site");

// Protege contra qualquer ciclo estranho de pai/filho.
const PROFUNDIDADE_MAXIMA = 20;

// ---------- 1. Descobrir o site de uma aba ----------
function siteDaAba(aba) {
  try {
    const url = new URL(aba.url || "");
    // Só mostramos o domínio de sites de verdade. Páginas internas do navegador viram um grupo só.
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.hostname.replace(/^www\./, "");
    }
  } catch {
    // URL inválida ou vazia: cai no grupo padrão abaixo.
  }
  return "Páginas do navegador";
}

// ---------- 3. Montar a estrutura ----------
// Devolve { raizes, paiDe } onde cada no é { aba, filhos: [] }.
async function montarNos() {
  const abas = await chrome.tabs.query({ currentWindow: true });
  // Mapa guardado pelo background.js: { idDaAba: idDoPai }.
  const { pais = {} } = await chrome.storage.session.get("pais");

  // Map = dicionário: acha um nó pelo id da aba.
  const porId = new Map(abas.map((aba) => [aba.id, { aba, filhos: [] }]));
  const raizes = [];

  for (const no of porId.values()) {
    // Preferimos o pai que nós guardamos; se não houver, usamos o do navegador.
    const idPai = pais[no.aba.id] ?? no.aba.openerTabId;
    const pai = porId.get(idPai);
    if (pai && pai !== no) pai.filhos.push(no);
    else raizes.push(no);
  }
  return raizes;
}

// ---------- 4. Filtro da busca ----------
// Um nó aparece se ele OU algum descendente combina com o texto buscado.
function combina(no, termo) {
  const texto = `${no.aba.title || ""} ${no.aba.url || ""}`.toLowerCase();
  return texto.includes(termo) || no.filhos.some((filho) => combina(filho, termo));
}

// ---------- 5. Desenhar ----------
function criarItem(no, termo, profundidade) {
  const li = document.createElement("li");

  const botao = document.createElement("button");
  botao.className = "no";
  // textContent (nunca innerHTML) evita que um título de página vire código.
  botao.textContent = no.aba.title || no.aba.url || "Sem título";
  botao.title = no.aba.title || no.aba.url || "";
  if (no.aba.active) botao.setAttribute("aria-current", "true");
  botao.addEventListener("click", () => irParaAba(no.aba));
  li.append(botao);

  const filhos = no.filhos.filter((f) => !termo || combina(f, termo));
  if (filhos.length && profundidade < PROFUNDIDADE_MAXIMA) {
    const ul = document.createElement("ul");
    for (const filho of filhos) ul.append(criarItem(filho, termo, profundidade + 1));
    li.append(ul);
  }
  return li;
}

function contarAbas(no) {
  return 1 + no.filhos.reduce((soma, filho) => soma + contarAbas(filho), 0);
}

function temAbaAtiva(no) {
  return no.aba.active || no.filhos.some(temAbaAtiva);
}

async function desenharArvore() {
  const termo = elBusca.value.trim().toLowerCase();
  const raizes = (await montarNos()).filter((no) => !termo || combina(no, termo));

  // Separa: quem tem filhos é "árvore"; quem não tem é "solta".
  const arvores = raizes.filter((no) => no.filhos.length > 0);
  const soltas = raizes.filter((no) => no.filhos.length === 0);

  const total = raizes.reduce((soma, no) => soma + contarAbas(no), 0);
  elResumo.textContent = `${total} ${total === 1 ? "aba" : "abas"}`;
  await atualizarDuplicadas();

  // Parte 1: árvores
  elArvore.textContent = "";
  for (const no of arvores) elArvore.append(criarItem(no, termo, 0));

  // Parte 2: soltas agrupadas por site
  const porSite = new Map();
  for (const no of soltas) {
    const site = siteDaAba(no.aba);
    if (!porSite.has(site)) porSite.set(site, []);
    porSite.get(site).push(no);
  }

  elPorSite.textContent = "";
  // Sites com mais abas primeiro.
  const ordenados = [...porSite.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [site, nos] of ordenados) {
    const detalhes = document.createElement("details");
    // Abre sozinho o grupo onde está a aba atual, ou todos quando há busca ativa.
    detalhes.open = Boolean(termo) || nos.some(temAbaAtiva);

    const resumo = document.createElement("summary");
    resumo.textContent = `${site} (${nos.length})`;
    detalhes.append(resumo);

    const ul = document.createElement("ul");
    ul.className = "lista-abas";
    for (const no of nos) ul.append(criarItem(no, termo, 0));
    detalhes.append(ul);
    elPorSite.append(detalhes);
  }

  if (!raizes.length) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = "Nenhuma aba encontrada.";
    elPorSite.append(vazio);
  }
}

// ---------- 5b. Abas duplicadas ----------
// Duas abas são "iguais" se têm o mesmo endereço, ignorando o que vem depois do "#"
// (âncora da página) e a barra final.
function chaveDaUrl(aba) {
  try {
    const url = new URL(aba.url || "");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null; // ignora páginas internas
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

// Devolve as abas que podem ser fechadas (sobra uma de cada endereço).
async function acharRepetidas() {
  const abas = await chrome.tabs.query({ currentWindow: true });
  const vistas = new Map(); // endereço -> aba que vamos MANTER
  const repetidas = [];

  // Ordem: a aba ativa e as fixadas ganham prioridade de ficar.
  const ordenadas = [...abas].sort((a, b) => Number(b.active || b.pinned) - Number(a.active || a.pinned));
  for (const aba of ordenadas) {
    const chave = chaveDaUrl(aba);
    if (!chave) continue;
    if (vistas.has(chave)) repetidas.push(aba);
    else vistas.set(chave, aba);
  }
  return repetidas;
}

const elDuplicadas = document.getElementById("duplicadas");
const elDuplicadasTexto = document.getElementById("duplicadas-texto");
const elBtnDuplicadas = document.getElementById("btn-duplicadas");
let repetidasAtuais = [];
let aguardandoConfirmacao = false;

async function atualizarDuplicadas() {
  repetidasAtuais = await acharRepetidas();
  aguardandoConfirmacao = false;
  elDuplicadas.hidden = repetidasAtuais.length === 0;
  elDuplicadasTexto.textContent = `${repetidasAtuais.length} ${repetidasAtuais.length === 1 ? "aba repetida" : "abas repetidas"}.`;
  elBtnDuplicadas.textContent = "Fechar as repetidas";
}

// Fechar abas não tem "desfazer" fácil, então pedimos DOIS cliques: o primeiro só
// muda o texto do botão para confirmar.
elBtnDuplicadas.addEventListener("click", async () => {
  if (!aguardandoConfirmacao) {
    aguardandoConfirmacao = true;
    elBtnDuplicadas.textContent = `Confirmar: fechar ${repetidasAtuais.length}`;
    return;
  }
  await chrome.tabs.remove(repetidasAtuais.map((aba) => aba.id));
  await atualizarDuplicadas();
});

// ---------- 6. Ir até a aba clicada ----------
async function irParaAba(aba) {
  await chrome.tabs.update(aba.id, { active: true });
  await chrome.windows.update(aba.windowId, { focused: true });
}

// ---------- 7. Atualização automática ----------
// As abas mudam o tempo todo. "Debounce" = esperar 200 ms de calma antes de redesenhar,
// para não redesenhar dezenas de vezes seguidas.
let temporizador;
function redesenharDepoisDeUmPouco() {
  clearTimeout(temporizador);
  temporizador = setTimeout(desenharArvore, 200);
}

chrome.tabs.onCreated.addListener(redesenharDepoisDeUmPouco);
chrome.tabs.onRemoved.addListener(redesenharDepoisDeUmPouco);
chrome.tabs.onUpdated.addListener(redesenharDepoisDeUmPouco);
chrome.tabs.onActivated.addListener(redesenharDepoisDeUmPouco);
chrome.tabs.onMoved.addListener(redesenharDepoisDeUmPouco);
chrome.storage.onChanged.addListener((mudancas, area) => {
  // Quando o background.js atualiza o mapa de pais, redesenha.
  if (area === "session" && mudancas.pais) redesenharDepoisDeUmPouco();
});
elBusca.addEventListener("input", desenharArvore);

// ---------- 8. Chave "Reabrir abas sozinho" ----------
// Quem usa essa chave e o background.js. Aqui so lemos e gravamos o valor.
const elReabrir = document.getElementById("reabrir-auto");
chrome.storage.local.get("reabrirAuto").then(({ reabrirAuto }) => {
  elReabrir.checked = reabrirAuto !== false; // padrao: ligado
});
elReabrir.addEventListener("change", () => chrome.storage.local.set({ reabrirAuto: elReabrir.checked }));

// Primeira pintura ao abrir a pagina.
desenharArvore();
