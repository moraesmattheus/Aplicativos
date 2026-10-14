// barra.js
// Monta a barra de icones do painel lateral: cada funcao tem um icone redondo com o nome
// embaixo (o nome, o tamanho, a posicao, a ordem e quais aparecem vem dos Ajustes).
// Ao clicar, a pagina escolhida aparece no quadro (iframe). A ultima pagina usada e lembrada.
// A lista de funcoes esta em funcoes.js; os ajustes, em tema.js.

const PAGINA_INICIAL = "tarefas.html";
const barra = document.getElementById("barra");
const quadro = document.getElementById("conteudo");

// So aceitamos as paginas da propria extensao (lista fechada): nada de endereco de fora.
const PAGINAS_PERMITIDAS = new Set(FUNCOES.map((funcao) => funcao.pagina));

let paginaAberta = PAGINA_INICIAL;

function criarBotao(funcao, traco) {
  const botao = document.createElement("button");
  botao.dataset.pagina = funcao.pagina;
  botao.title = funcao.nome;
  botao.setAttribute("aria-label", funcao.nome);
  botao.setAttribute("aria-pressed", String(funcao.pagina === paginaAberta));

  const imagem = criarIcone(funcao, traco); // pastilha neon com o simbolo (funcoes.js)

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = funcao.nome; // textContent: nunca innerHTML

  botao.append(imagem, nome);
  botao.addEventListener("click", () => abrirPagina(funcao.pagina));
  return botao;
}

// Desenha a barra de acordo com os ajustes (ordem e quais icones aparecem).
async function desenharBarra() {
  const { barra: opcoes } = await lerAjustes();
  barra.textContent = "";
  let grupoAnterior = null;
  for (const funcao of funcoesOrdenadas(opcoes.ordem)) {
    if (!funcao.fixa && opcoes.escondidas.includes(funcao.icone)) continue;
    // Divisoria quando o grupo muda (aparece so na barra vertical, ver barra.css).
    if (grupoAnterior !== null && funcao.grupo !== grupoAnterior) {
      const linha = document.createElement("div");
      linha.className = "separador";
      linha.setAttribute("role", "separator");
      barra.append(linha);
    }
    grupoAnterior = funcao.grupo;
    barra.append(criarBotao(funcao, opcoes.traco));
  }
}

function abrirPagina(pagina) {
  if (!PAGINAS_PERMITIDAS.has(pagina)) return;
  paginaAberta = pagina;
  quadro.src = pagina;
  for (const botao of barra.querySelectorAll("button")) {
    botao.setAttribute("aria-pressed", String(botao.dataset.pagina === pagina));
  }
  chrome.storage.local.set({ paginaAtual: pagina });
}

// Mudou algo nos Ajustes (ordem, icones escondidos): redesenha a barra.
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && mudancas.ajustes) desenharBarra();
});

// Ao abrir: volta para a ultima pagina usada e desenha a barra.
chrome.storage.local.get("paginaAtual").then(async ({ paginaAtual }) => {
  paginaAberta = PAGINAS_PERMITIDAS.has(paginaAtual) ? paginaAtual : PAGINA_INICIAL;
  await desenharBarra();
  abrirPagina(paginaAberta);
});
