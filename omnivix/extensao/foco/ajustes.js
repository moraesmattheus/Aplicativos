// ajustes.js
// Pagina "Ajustes": cada controle muda um valor do objeto "ajustes" (veja PADRAO_AJUSTES
// em tema.js), aplica na hora nesta pagina e salva. Todas as outras paginas, abertas ou
// nao, aplicam o mesmo valor sozinhas (tema.js escuta as mudancas).

const porId = (id) => document.getElementById(id);
const elTemaPronto = porId("tema-pronto");
const elLista = porId("lista-funcoes");
const elRestaurar = porId("btn-restaurar");

let ajustes = mesclarAjustes(null);
let confirmandoRestaurar = false;

// ---------- Salvar ----------
// "Debounce": ao arrastar um controle deslizante, salva so quando voce faz uma pausa curta,
// em vez de gravar dezenas de vezes. A tela, porem, muda na hora.
let temporizador;
function mudou() {
  aplicarTema(ajustes);
  clearTimeout(temporizador);
  temporizador = setTimeout(() => salvarAjustes(ajustes), 150);
}

// ---------- Controles simples ----------
// Liga um controle deslizante a um campo numerico: (id, onde fica no objeto, sufixo da saida).
function ligarNumero(id, pegar, colocar, sufixo) {
  const campo = porId(id);
  const saida = porId(`saida-${id.replace("pomo-", "")}`);
  const mostrar = () => { if (saida) saida.textContent = `${campo.value}${sufixo}`; };
  campo.addEventListener("input", () => { colocar(Number(campo.value)); mostrar(); mudou(); });
  return () => { campo.value = String(pegar()); mostrar(); };
}

function ligarMarca(id, pegar, colocar) {
  const campo = porId(id);
  campo.addEventListener("change", () => { colocar(campo.checked); mudou(); });
  return () => { campo.checked = pegar(); };
}

function ligarSelecao(id, pegar, colocar) {
  const campo = porId(id);
  campo.addEventListener("change", () => { colocar(campo.value); mudou(); });
  return () => { campo.value = String(pegar()); };
}

// ---------- Cores e temas prontos ----------
const CAMPOS_COR = { fundo: "cor-fundo", superficie: "cor-superficie", texto: "cor-texto", destaque: "cor-destaque", neon: "cor-neon", selecao: "cor-selecao" };

function descobrirTemaAtual() {
  for (const [nome, cores] of Object.entries(TEMAS_PRONTOS)) {
    if (Object.keys(cores).every((k) => cores[k].toLowerCase() === ajustes.cores[k].toLowerCase())) return nome;
  }
  return "Personalizado";
}

// Mostra o contraste entre o texto e o fundo e avisa quando a cor foi corrigida sozinha.
function atualizarAvisoContraste() {
  const legivel = coresLegiveis(ajustes.cores);
  const razao = contraste(legivel.texto, ajustes.cores.fundo).toFixed(1).replace(".", ",");
  const partes = [`Contraste do texto com o fundo: ${razao} para 1 (acima de 4,5 é confortável).`];
  if (legivel.textoAjustado) partes.push("A cor do texto escolhida ficava difícil de ler, então usamos preto ou branco no lugar. Sua escolha continua salva.");
  if (legivel.destaqueAjustado) partes.push("O destaque sumia contra o fundo, então usamos a cor do texto no lugar.");
  if (legivel.selecaoAjustada) partes.push("A cor da seleção sumia contra o fundo, então usamos a cor do texto no lugar.");
  if (legivel.neonAjustado) partes.push("O neon ficava quase invisível contra o fundo, então usamos a cor do texto no lugar.");
  porId("aviso-contraste").textContent = partes.join(" ");
}

function preencherCores() {
  for (const [chave, id] of Object.entries(CAMPOS_COR)) porId(id).value = ajustes.cores[chave];
  elTemaPronto.value = descobrirTemaAtual();
  atualizarAvisoContraste();
}

for (const [chave, id] of Object.entries(CAMPOS_COR)) {
  porId(id).addEventListener("input", () => {
    ajustes.cores[chave] = porId(id).value;
    elTemaPronto.value = descobrirTemaAtual();
    atualizarAvisoContraste();
    mudou();
  });
}

for (const nome of [...Object.keys(TEMAS_PRONTOS), "Personalizado"]) {
  const opcao = document.createElement("option");
  opcao.value = nome;
  opcao.textContent = nome;
  elTemaPronto.append(opcao);
}
elTemaPronto.addEventListener("change", () => {
  if (!TEMAS_PRONTOS[elTemaPronto.value]) return;
  ajustes.cores = { ...TEMAS_PRONTOS[elTemaPronto.value] };
  preencherCores();
  mudou();
});

// ---------- Lista de funcoes: mostrar/esconder e ordem ----------
function ordemAtual() {
  return funcoesOrdenadas(ajustes.barra.ordem).map((f) => f.icone);
}

function mover(icone, direcao) {
  const ordem = ordemAtual();
  const i = ordem.indexOf(icone);
  const j = i + direcao;
  if (i === -1 || j < 0 || j >= ordem.length) return;
  [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  ajustes.barra.ordem = ordem;
  desenharFuncoes();
  mudou();
}

function criarBotaoSeta(texto, rotulo, aoClicar, desligado) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "pequeno";
  botao.textContent = texto;
  botao.setAttribute("aria-label", rotulo);
  botao.disabled = desligado;
  botao.addEventListener("click", aoClicar);
  return botao;
}

function desenharFuncoes() {
  const lista = funcoesOrdenadas(ajustes.barra.ordem);
  elLista.textContent = "";
  lista.forEach((funcao, i) => {
    const li = document.createElement("li");

    const imagem = criarIcone(funcao, ajustes.barra.traco); // mesma pastilha neon da barra

    const rotulo = document.createElement("label");
    const caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.checked = funcao.fixa || !ajustes.barra.escondidas.includes(funcao.icone);
    caixa.disabled = Boolean(funcao.fixa); // Ajustes nunca some
    caixa.addEventListener("change", () => {
      const sem = ajustes.barra.escondidas.filter((x) => x !== funcao.icone);
      ajustes.barra.escondidas = caixa.checked ? sem : [...sem, funcao.icone];
      mudou();
    });
    const nome = document.createElement("span");
    nome.textContent = funcao.nome + (funcao.fixa ? " (sempre visível)" : "");
    rotulo.append(caixa, nome);

    li.append(
      imagem,
      rotulo,
      criarBotaoSeta("↑", `Subir ${funcao.nome}`, () => mover(funcao.icone, -1), i === 0),
      criarBotaoSeta("↓", `Descer ${funcao.nome}`, () => mover(funcao.icone, 1), i === lista.length - 1)
    );
    elLista.append(li);
  });
}

// ---------- Fonte ----------
const elFamilia = porId("familia");
const elFamiliaPropria = porId("familia-propria");
const elCampoPropria = porId("campo-familia-propria");
const elExemplo = porId("exemplo-fonte");

for (const [chave, fonte] of Object.entries(FAMILIAS)) {
  const opcao = document.createElement("option");
  opcao.value = chave;
  opcao.textContent = fonte.nome;
  elFamilia.append(opcao);
}
const opcaoOutra = document.createElement("option");
opcaoOutra.value = "outra";
opcaoOutra.textContent = "Outra (digitar o nome)";
elFamilia.append(opcaoOutra);

function atualizarFonte() {
  elCampoPropria.hidden = ajustes.familia !== "outra";
  elExemplo.style.fontFamily = cssDaFonte(ajustes); // o exemplo mostra a fonte escolhida
}
elFamilia.addEventListener("change", () => {
  ajustes.familia = elFamilia.value;
  atualizarFonte();
  mudou();
});
elFamiliaPropria.addEventListener("input", () => {
  // So guarda se o nome for valido (letras, numeros, espaco, hifen).
  ajustes.familiaPropria = nomeDeFonteValido(elFamiliaPropria.value) ? elFamiliaPropria.value.trim() : "";
  atualizarFonte();
  mudou();
});

// ---------- Ligando tudo ----------
const preenchedores = [
  ligarNumero("raio", () => ajustes.raio, (v) => (ajustes.raio = v), " px"),
  ligarNumero("fonte", () => ajustes.fonte, (v) => (ajustes.fonte = v), " px"),
  ligarNumero("linha", () => ajustes.linha, (v) => (ajustes.linha = v), ""),
  ligarNumero("espaco", () => ajustes.espaco, (v) => (ajustes.espaco = v), " px"),
  ligarMarca("sem-movimento", () => ajustes.semMovimento, (v) => (ajustes.semMovimento = v)),
  ligarSelecao("posicao", () => ajustes.barra.posicao, (v) => (ajustes.barra.posicao = v)),
  ligarNumero("tamanho", () => ajustes.barra.tamanho, (v) => (ajustes.barra.tamanho = v), " px"),
  ligarNumero("forma", () => ajustes.barra.forma, (v) => (ajustes.barra.forma = v), " %"),
  ligarMarca("rotulos", () => ajustes.barra.rotulos, (v) => (ajustes.barra.rotulos = v)),
  ligarMarca("recolher", () => ajustes.barra.recolher, (v) => (ajustes.barra.recolher = v)),
  ligarNumero("faixa", () => ajustes.barra.faixa, (v) => (ajustes.barra.faixa = v), " px"),
  ligarNumero("desfoque", () => ajustes.barra.desfoque, (v) => (ajustes.barra.desfoque = v), " px"),
  ligarNumero("animacao", () => ajustes.barra.animacao, (v) => (ajustes.barra.animacao = v), " ms"),
  ligarNumero("brilho", () => ajustes.barra.brilho, (v) => (ajustes.barra.brilho = v), " %"),
  ligarSelecao("traco", () => ajustes.barra.traco, (v) => { ajustes.barra.traco = v; desenharFuncoes(); }),
  ligarMarca("auto-detectar", () => ajustes.automacao.detectar, (v) => (ajustes.automacao.detectar = v)),
  ligarMarca("auto-seguir", () => ajustes.automacao.seguirArea, (v) => (ajustes.automacao.seguirArea = v)),
  ligarMarca("auto-dicas", () => ajustes.automacao.dicas, (v) => (ajustes.automacao.dicas = v)),
  ligarNumero("pomo-pausa", () => ajustes.pomodoro.pausa, (v) => (ajustes.pomodoro.pausa = v), " min"),
];

// Foco padrao do Pomodoro: lista de opcoes comuns.
const selecaoFoco = porId("pomo-foco");
for (const minutos of [5, 10, 15, 20, 25, 30, 40, 50, 60]) {
  const opcao = document.createElement("option");
  opcao.value = String(minutos);
  opcao.textContent = `${minutos} min`;
  selecaoFoco.append(opcao);
}
preenchedores.push(ligarSelecao("pomo-foco", () => ajustes.pomodoro.foco, (v) => (ajustes.pomodoro.foco = Number(v))));

function preencherTudo() {
  for (const preencher of preenchedores) preencher();
  elFamilia.value = ajustes.familia;
  elFamiliaPropria.value = ajustes.familiaPropria;
  atualizarFonte();
  preencherCores();
  desenharFuncoes();
  elRestaurar.textContent = confirmandoRestaurar ? "Confirmar: voltar ao padrão" : "Restaurar o padrão";
}

// Restaurar apaga as suas escolhas: pedimos DOIS cliques.
elRestaurar.addEventListener("click", async () => {
  if (!confirmandoRestaurar) {
    confirmandoRestaurar = true;
    preencherTudo();
    return;
  }
  confirmandoRestaurar = false;
  ajustes = mesclarAjustes(null);
  preencherTudo();
  mudou();
});

lerAjustes().then((salvos) => {
  ajustes = salvos;
  preencherTudo();
});
