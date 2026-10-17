// tema.js
// Carregado no <head> de TODAS as paginas. Faz tres coisas:
//   1. define os ajustes padrao e sabe validar qualquer valor guardado;
//   2. le os ajustes (chrome.storage.local, chave "ajustes") e aplica na pagina;
//   3. aplica de novo, ao vivo, sempre que voce mudar algo na pagina Ajustes.
//
// Seguranca: tudo que vem do armazenamento e VALIDADO antes de ser usado (cores so no
// formato #rrggbb, numeros dentro de limites, posicao so entre 4 valores). Assim um valor
// estragado nunca quebra a tela nem entra como codigo.

const PADRAO_AJUSTES = {
  // Paleta do tema "study in the dark" do Vivaldi, com o fundo em preto total.
  cores: { fundo: "#000000", superficie: "#181616", texto: "#d0cdcd", destaque: "#dcdcdc", neon: "#8be9ff", selecao: "#8be9ff" },
  raio: 14, // arredondamento dos cantos (px)
  fonte: 15, // tamanho base da letra (px)
  familia: "sistema", // qual fonte (chave de FAMILIAS) ou "outra"
  familiaPropria: "", // nome de uma fonte instalada, usado quando familia = "outra"
  linha: 15, // altura da linha em decimos (15 = 1,5)
  espaco: 14, // espacamento entre blocos (px)
  semMovimento: false,
  barra: {
    posicao: "left", // top | bottom | left | right
    tamanho: 34, // tamanho dos icones (px)
    forma: 30, // formato do realce do icone: 0 = quadrado, 50 = redondo (% de arredondamento)
    rotulos: false, // mostrar o nome embaixo do icone
    recolher: false, // esconder a barra e mostrar so ao passar o mouse na borda
    faixa: 6, // espessura da zona invisivel que abre a barra (px)
    desfoque: 14, // forca do desfoque atras da barra aberta (px)
    animacao: 500, // duracao do deslizar da barra escondida (ms)
    brilho: 60, // intensidade do neon dos icones (0 a 100)
    traco: "fino", // espessura do desenho do icone: fino | medio | grosso
    escondidas: [], // ids dos icones escondidos
    ordem: [], // ids na ordem escolhida (vazio = ordem padrao)
  },
  pomodoro: { foco: 25, pausa: 5 }, // minutos
  automacao: { detectar: true, seguirArea: true, dicas: true }, // tudo automatico por padrao
};

// Temas prontos (so trocam as 4 cores).
const TEMAS_PRONTOS = {
  "Study in the dark": { fundo: "#000000", superficie: "#181616", texto: "#d0cdcd", destaque: "#dcdcdc", neon: "#8be9ff", selecao: "#8be9ff" },
  "Preto e branco": { fundo: "#000000", superficie: "#111111", texto: "#ffffff", destaque: "#ffffff", neon: "#ffffff", selecao: "#ffffff" },
  "Grafite": { fundo: "#161618", superficie: "#212125", texto: "#d8d8dc", destaque: "#b8b8c0", neon: "#b9b4ff", selecao: "#b9b4ff" },
  "Azul noturno": { fundo: "#05070d", superficie: "#0d1220", texto: "#cfd6e6", destaque: "#8fb4ff", neon: "#6fa8ff", selecao: "#6fa8ff" },
  "Claro": { fundo: "#ffffff", superficie: "#f1efef", texto: "#181616", destaque: "#181616", neon: "#0b7fb0", selecao: "#0b7fb0" },
};

const POSICOES_BARRA = ["top", "bottom", "left", "right"];

// Fontes disponiveis. Sao fontes que ja vem no Windows/Mac, com reserva caso falte alguma.
// (Uma extensao nao baixa fontes da internet: usa as que estao instaladas no computador.)
const FAMILIAS = {
  sistema: { nome: "Padrão do sistema", css: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  segoe: { nome: "Segoe UI", css: '"Segoe UI", system-ui, sans-serif' },
  arial: { nome: "Arial", css: 'Arial, Helvetica, sans-serif' },
  verdana: { nome: "Verdana (bem legível)", css: 'Verdana, Geneva, sans-serif' },
  trebuchet: { nome: "Trebuchet MS", css: '"Trebuchet MS", Tahoma, sans-serif' },
  georgia: { nome: "Georgia (com serifa)", css: 'Georgia, "Times New Roman", serif' },
  times: { nome: "Times New Roman", css: '"Times New Roman", Times, serif' },
  consolas: { nome: "Consolas (monoespaçada)", css: 'Consolas, "Courier New", monospace' },
  comic: { nome: "Comic Sans MS", css: '"Comic Sans MS", "Comic Neue", sans-serif' },
};

// Nome de fonte digitado pelo usuario: so letras, numeros, espaco e hifen (nada de aspas
// ou simbolos que pudessem quebrar o CSS).
function nomeDeFonteValido(texto) {
  return typeof texto === "string" && /^[\p{L}\p{N} \-]{1,40}$/u.test(texto.trim());
}

function cssDaFonte(a) {
  if (a.familia === "outra" && nomeDeFonteValido(a.familiaPropria)) {
    return `"${a.familiaPropria.trim()}", system-ui, sans-serif`;
  }
  return (FAMILIAS[a.familia] || FAMILIAS.sistema).css;
}

// ---------- Validacao ----------
function limitar(valor, minimo, maximo, padrao) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.min(maximo, Math.max(minimo, Math.round(n))) : padrao;
}

function corValida(valor, padrao) {
  return typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : padrao;
}

function listaDeTextos(valor) {
  return Array.isArray(valor) ? valor.filter((x) => typeof x === "string").slice(0, 50) : [];
}

// Junta o que esta guardado com o padrao, corrigindo qualquer valor invalido.
function mesclarAjustes(salvo) {
  const s = salvo && typeof salvo === "object" ? salvo : {};
  const p = PADRAO_AJUSTES;
  const c = s.cores || {};
  const b = s.barra || {};
  const m = s.pomodoro || {};
  const au = s.automacao || {};
  return {
    cores: {
      fundo: corValida(c.fundo, p.cores.fundo),
      superficie: corValida(c.superficie, p.cores.superficie),
      texto: corValida(c.texto, p.cores.texto),
      destaque: corValida(c.destaque, p.cores.destaque),
      neon: corValida(c.neon, p.cores.neon),
      selecao: corValida(c.selecao, p.cores.selecao),
    },
    raio: limitar(s.raio, 0, 28, p.raio),
    fonte: limitar(s.fonte, 12, 20, p.fonte),
    familia: s.familia === "outra" || FAMILIAS[s.familia] ? s.familia : p.familia,
    familiaPropria: nomeDeFonteValido(s.familiaPropria) ? s.familiaPropria.trim() : "",
    linha: limitar(s.linha, 12, 20, p.linha),
    espaco: limitar(s.espaco, 6, 24, p.espaco),
    semMovimento: Boolean(s.semMovimento),
    barra: {
      posicao: POSICOES_BARRA.includes(b.posicao) ? b.posicao : p.barra.posicao,
      tamanho: limitar(b.tamanho, 20, 48, p.barra.tamanho),
      forma: limitar(b.forma, 0, 50, p.barra.forma),
      rotulos: b.rotulos === undefined ? p.barra.rotulos : Boolean(b.rotulos),
      recolher: Boolean(b.recolher),
      faixa: limitar(b.faixa, 2, 16, p.barra.faixa),
      desfoque: limitar(b.desfoque, 0, 30, p.barra.desfoque),
      animacao: limitar(b.animacao, 0, 1500, p.barra.animacao),
      brilho: limitar(b.brilho, 0, 100, p.barra.brilho),
      traco: ["fino", "medio", "grosso"].includes(b.traco) ? b.traco : p.barra.traco,
      escondidas: listaDeTextos(b.escondidas),
      ordem: listaDeTextos(b.ordem),
    },
    automacao: {
      detectar: au.detectar !== false,
      seguirArea: au.seguirArea !== false,
      dicas: au.dicas !== false,
    },
    pomodoro: {
      foco: limitar(m.foco, 1, 120, p.pomodoro.foco),
      pausa: limitar(m.pausa, 1, 60, p.pomodoro.pausa),
    },
  };
}

// ---------- Leitura, gravacao e aplicacao ----------
async function lerAjustes() {
  const { ajustes } = await chrome.storage.local.get("ajustes");
  return mesclarAjustes(ajustes);
}

async function salvarAjustes(ajustes) {
  await chrome.storage.local.set({ ajustes: mesclarAjustes(ajustes) });
}

// Luminosidade de 0 (preto) a 1 (branco). Serve para escolher texto claro ou escuro.
function luminancia(hex) {
  const canal = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

// ---------- Legibilidade (contraste) ----------
// Contraste e a razao entre a luminosidade de duas cores (de 1 a 21). A regra WCAG pede
// pelo menos 4,5 para texto normal. Abaixo disso a letra fica "quase invisivel".
function contraste(corA, corB) {
  const [maior, menor] = [luminancia(corA), luminancia(corB)].sort((x, y) => y - x);
  return (maior + 0.05) / (menor + 0.05);
}

// Preto ou branco, o que tiver MAIS contraste com a cor dada.
function preferirPretoOuBranco(cor) {
  return contraste("#000000", cor) >= contraste("#ffffff", cor) ? "#000000" : "#ffffff";
}

// Corrige combinacoes ilegiveis SEM mexer no que voce escolheu (a escolha continua guardada;
// so a cor aplicada na tela e ajustada). Devolve tambem o que foi corrigido, para avisar.
function coresLegiveis(c) {
  let texto = c.texto;
  const textoRuim = contraste(texto, c.fundo) < 4.5 || contraste(texto, c.superficie) < 4.5;
  if (textoRuim) texto = preferirPretoOuBranco(c.fundo);

  let destaque = c.destaque;
  const destaqueRuim = contraste(destaque, c.fundo) < 3; // botao invisivel contra o fundo
  if (destaqueRuim) destaque = texto;

  let neon = c.neon;
  const neonRuim = contraste(neon, c.fundo) < 3; // neon quase invisivel contra o fundo
  if (neonRuim) neon = texto;

  let selecao = c.selecao;
  const selecaoRuim = contraste(selecao, c.fundo) < 3; // selecao invisivel contra o fundo
  if (selecaoRuim) selecao = texto;

  return {
    texto,
    destaque,
    neon,
    selecao,
    selecaoAjustada: selecaoRuim,
    sobreSelecao: preferirPretoOuBranco(selecao),
    neonAjustado: neonRuim,
    sobreDestaque: preferirPretoOuBranco(destaque), // letra do botao: a de maior contraste
    textoAjustado: textoRuim,
    destaqueAjustado: destaqueRuim,
  };
}

function aplicarTema(bruto) {
  const a = mesclarAjustes(bruto);
  const raiz = document.documentElement;
  const estilo = raiz.style;
  const legivel = coresLegiveis(a.cores);

  estilo.setProperty("--fundo", a.cores.fundo);
  estilo.setProperty("--superficie", a.cores.superficie);
  estilo.setProperty("--texto", legivel.texto);
  estilo.setProperty("--destaque", legivel.destaque);
  estilo.setProperty("--neon", legivel.neon);
  estilo.setProperty("--selecao", legivel.selecao);
  estilo.setProperty("--sobre-selecao", legivel.sobreSelecao);
  estilo.setProperty("--brilho", String(a.barra.brilho / 100));
  estilo.setProperty("--sobre-destaque", legivel.sobreDestaque);
  estilo.setProperty("--raio", `${a.raio}px`);
  estilo.setProperty("--fonte", `${a.fonte}px`);
  estilo.setProperty("--familia", cssDaFonte(a));
  estilo.setProperty("--linha", String(a.linha / 10));
  estilo.setProperty("--espaco", `${a.espaco}px`);
  estilo.setProperty("--icone", `${a.barra.tamanho}px`);
  estilo.setProperty("--forma", `${a.barra.forma}%`);
  estilo.setProperty("--faixa", `${a.barra.faixa}px`);
  estilo.setProperty("--desfoque", `${a.barra.desfoque}px`);
  estilo.setProperty("--anim", `${a.barra.animacao}ms`);
  // Campos, barras de rolagem e caixas de selecao seguem o claro/escuro do fundo.
  estilo.colorScheme = luminancia(a.cores.fundo) > 0.5 ? "light" : "dark";

  // Opcoes que o CSS le por atributos.
  raiz.dataset.posicao = a.barra.posicao;
  raiz.dataset.rotulos = a.barra.rotulos ? "on" : "off";
  raiz.dataset.recolher = a.barra.recolher ? "on" : "off";
  raiz.dataset.movimento = a.semMovimento ? "off" : "on";

  // Guarda uma copia para a PROXIMA abertura aplicar o tema na hora (sem "piscar").
  try {
    localStorage.setItem("ajustesCache", JSON.stringify(a));
  } catch {
    // sem localStorage: tudo bem, so perde o efeito anti-piscada
  }
}

// Aplica ao abrir a pagina e a cada mudanca nos ajustes (ao vivo, em todas as paginas).
// 1) na hora, com a copia da ultima vez; 2) depois, com o valor oficial guardado.
try {
  aplicarTema(JSON.parse(localStorage.getItem("ajustesCache")));
} catch {
  aplicarTema(null);
}
lerAjustes().then(aplicarTema);
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && mudancas.ajustes) aplicarTema(mudancas.ajustes.newValue);
});
