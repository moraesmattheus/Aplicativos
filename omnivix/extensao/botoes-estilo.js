// Aparência dos botões: cada um dos TRÊS botões (comum, principal e perigo/Apagar) tem o seu conjunto completo de opções,
// e cada parte do botão (vidro, reflexo, contorno, sombras, respiração, cor...) pode ser ligada ou desligada.
// Sem nenhuma API do navegador: serve à extensão, ao app e aos testes. O CSS (estilo.css) só lê as variáveis geradas aqui.

export const TIPOS = ['comum', 'principal', 'perigo'];
export const NOMES_DOS_TIPOS = { comum: 'Botão comum', principal: 'Botão principal', perigo: 'Botão Apagar (vermelho)' };

// As "partes" que o usuário pode tirar de cada botão (checkbox ligado = a parte existe).
export const PARTES = {
  cor: 'Cor de fundo',
  vidro: 'Vidro (translucidez)',
  desfoque: 'Desfoque do fundo',
  reflexo: 'Reflexo / brilho',
  contorno: 'Contorno fino',
  sombraExterna: 'Sombra de baixo',
  sombraInterna: 'Sombra por dentro',
  sombraLetras: 'Sombra nas letras',
  respiracao: 'Respiração ao passar o mouse'
};

// Valores padrão de cada botão (o visual que aprovamos: comum = vidro neutro; principal = cinza escuro; perigo = vermelho vivo).
const base = {
  cor: '', // vazio = a cor padrão daquele botão (comum: nenhuma; principal: destaque do tema; perigo: vermelho)
  forca: 30, // % de cor do fundo (10 a 100). Só vale se "Cor de fundo" estiver ligada.
  vidro: 100, // % de translucidez (0 a 200)
  solido: 0, // % de fundo sólido por baixo (0 a 100)
  desfoque: 16, // px (0 a 30)
  brilho: 100, // % do reflexo (0 a 300)
  raio: 14, // px (0 a 28)
  altura: 38, // px (30 a 48)
  respiracao: 2, // % que encolhe ao passar o mouse (0 a 6)
  sombraLetras: 0, // % (0 a 100)
  ligados: { cor: false, vidro: true, desfoque: true, reflexo: true, contorno: true, sombraExterna: true, sombraInterna: false, sombraLetras: false, respiracao: true }
};

// Cartões: os painéis/caixas das telas. Usam a cor de fundo escolhida quando ligado.
// Por padrão os cartões usam o tema (desligado). A cor, o degradê e o acetinado só valem quando você liga e escolhe.
export const PADRAO_CARTAO = { cor: '', cor2: '', ligado: false, acetinado: true };
export const SUGESTAO_CARTAO = '#0c0c0d'; // cor mostrada no seletor enquanto você não escolheu nenhuma (preto acetinado)

// Faixa colorida atrás dos botões de amostra (só na tela de Configurações): o vidro só aparece com cor atrás para desfocar.
export const PADRAO_AMOSTRA = ['#1b2a4a', '#4a2150', '#0f3d3a'];

export const PADRAO_BOTOES = {
  comum: { ...base, ligados: { ...base.ligados } },
  principal: { ...base, vidro: 0, forca: 30, ligados: { ...base.ligados, cor: true, vidro: false } },
  perigo: { ...base, vidro: 0, forca: 80, sombraLetras: 50, cor: '#ff6b61', ligados: { ...base.ligados, cor: true, vidro: false, sombraInterna: true, sombraLetras: true } },
  cartao: { ...PADRAO_CARTAO },
  amostra: [...PADRAO_AMOSTRA]
};

// Estilos prontos: preenchem os números de uma vez (o escopo escolhido recebe). Cores e partes ligadas não mudam.
export const ESTILOS_PRONTOS = {
  sutil: { nome: 'Vidro sutil (padrão)', desfoque: 16, brilho: 100, respiracao: 2 },
  intenso: { nome: 'Vidro intenso', desfoque: 24, brilho: 240, respiracao: 3 },
  plano: { nome: 'Plano (sem vidro)', desfoque: 0, brilho: 0, respiracao: 0 }
};

const LIMITES = {
  forca: [10, 100], vidro: [0, 200], solido: [0, 100], desfoque: [0, 30], brilho: [0, 300], raio: [0, 28], altura: [30, 48],
  respiracao: [0, 6], sombraLetras: [0, 100]
};
const COR_HEX = /^#[0-9a-f]{6}$/i;

const normalizarUm = (entrada, padrao) => {
  const origem = entrada && typeof entrada === 'object' ? entrada : {};
  const saida = { ...padrao, ligados: { ...padrao.ligados } };
  for (const [campo, [minimo, maximo]] of Object.entries(LIMITES)) {
    const valor = Number(origem[campo]);
    // null, vazio e true/false não contam como número (senão virariam o mínimo do campo)
    if (origem[campo] != null && origem[campo] !== '' && typeof origem[campo] !== 'boolean' && Number.isFinite(valor)) {
      saida[campo] = Math.min(maximo, Math.max(minimo, Math.round(valor)));
    }
  }
  if (typeof origem.cor === 'string' && (origem.cor === '' || COR_HEX.test(origem.cor))) saida.cor = origem.cor.toLowerCase();
  const ligados = origem.ligados && typeof origem.ligados === 'object' ? origem.ligados : {};
  for (const parte of Object.keys(PARTES)) if (typeof ligados[parte] === 'boolean') saida.ligados[parte] = ligados[parte];
  return saida;
};

const normalizarCartao = (entrada) => {
  const o = entrada && typeof entrada === 'object' ? entrada : {};
  return {
    cor: typeof o.cor === 'string' && (o.cor === '' || COR_HEX.test(o.cor)) ? o.cor.toLowerCase() : PADRAO_CARTAO.cor,
    cor2: typeof o.cor2 === 'string' && (o.cor2 === '' || COR_HEX.test(o.cor2)) ? o.cor2.toLowerCase() : PADRAO_CARTAO.cor2, // segunda cor do degradê ('' = sem degradê)
    ligado: typeof o.ligado === 'boolean' ? o.ligado : PADRAO_CARTAO.ligado,
    acetinado: typeof o.acetinado === 'boolean' ? o.acetinado : PADRAO_CARTAO.acetinado
  };
};

// Aceita qualquer coisa (inclusive nada) e devolve os três botões completos e seguros: números dentro dos limites,
// cores só no formato #rrggbb e nada de campos desconhecidos (o que vem do disco nunca vira CSS sem passar por aqui).
export const normalizarBotoes = (entrada) => {
  const origem = entrada && typeof entrada === 'object' ? entrada : {};
  return {
    ...Object.fromEntries(TIPOS.map((tipo) => [tipo, normalizarUm(origem[tipo], PADRAO_BOTOES[tipo])])),
    cartao: normalizarCartao(origem.cartao),
    amostra: PADRAO_AMOSTRA.map((padrao, i) => (Array.isArray(origem.amostra) && typeof origem.amostra[i] === 'string' && COR_HEX.test(origem.amostra[i]) ? origem.amostra[i].toLowerCase() : padrao))
  };
};

// Luminância relativa (0 = preto, 1 = branco), como na regra de contraste da WCAG. Serve para escolher letra clara ou escura.
export const luminancia = (hex) => {
  const canal = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
};

// Cor de fundo de cada botão quando você não escolheu nenhuma.
const COR_PADRAO = { comum: null, principal: 'var(--destaque)', perigo: '#ff6b61' };
// Quanto a parte de baixo do degradê é mais fraca que a de cima (como no visual aprovado).
const RAZAO_BAIXO = { comum: 0.6, principal: 0.6, perigo: 0.775 };

// Tradução final: três botões -> variáveis de CSS (nome -> valor), prefixadas por --btn-<tipo>-.
export const variaveisDosBotoes = (botoes) => {
  const todos = normalizarBotoes(botoes);
  const variaveis = {};
  for (const tipo of TIPOS) {
    const b = todos[tipo];
    const l = b.ligados;
    const cor = b.cor || COR_PADRAO[tipo];
    const forca = l.cor && cor ? b.forca : 0; // sem cor (ou com a parte desligada): o fundo fica neutro
    const prefixo = `--btn-${tipo}-`;
    Object.assign(variaveis, {
      [`${prefixo}blur`]: `${l.desfoque ? b.desfoque : 0}px`,
      [`${prefixo}vidro`]: String(l.vidro ? b.vidro / 100 : 0),
      [`${prefixo}solido`]: String(b.solido / 100),
      [`${prefixo}brilho`]: String(l.reflexo ? b.brilho / 100 : 0),
      [`${prefixo}raio`]: `${b.raio}px`,
      [`${prefixo}altura`]: `${b.altura}px`,
      [`${prefixo}respira`]: String(l.respiracao ? 1 - b.respiracao / 100 : 1),
      [`${prefixo}letra`]: String(l.sombraLetras ? b.sombraLetras / 100 : 0),
      [`${prefixo}contorno`]: l.contorno ? '1' : '0',
      [`${prefixo}ext`]: l.sombraExterna ? '1' : '0',
      [`${prefixo}int`]: l.sombraInterna ? '1' : '0',
      [`${prefixo}cor`]: cor || 'transparent',
      [`${prefixo}forca`]: `${forca}%`,
      [`${prefixo}forca-baixo`]: `${Math.round(forca * RAZAO_BAIXO[tipo])}%`
    });
    // Letra do botão: clara, a não ser que a cor de fundo escolhida seja bem clara E forte (aí fica escura, para não sumir).
    if (tipo !== 'comum') {
      const hex = b.cor || (tipo === 'perigo' ? COR_PADRAO.perigo : '');
      const clara = hex && COR_HEX.test(hex) && luminancia(hex) > 0.55 && forca >= 60;
      variaveis[`${prefixo}texto`] = clara ? '#111111' : tipo === 'perigo' ? '#ffffff' : 'var(--texto)';
    }
  }
  return variaveis;
};

// Cores dos cartões: { '--superficie', '--texto' } quando ligado e com cor escolhida; senão {} (volta ao tema).
// A letra vira escura se o fundo escolhido for claro, para não sumir.
export const variaveisDosCartoes = (botoes) => {
  const { cartao } = normalizarBotoes(botoes);
  if (!cartao.ligado || !cartao.cor) return {}; // desligado ou sem cor: o tema manda (nada de acetinado)
  const brilho = cartao.acetinado
    ? 'linear-gradient(160deg, rgb(255 255 255 / 0.07) 0%, rgb(255 255 255 / 0.015) 45%, rgb(0 0 0 / 0.28) 100%)'
    : 'none';
  // Degradê: da cor de fundo para a segunda cor, com o acetinado (se ligado) por cima.
  const camadas = cartao.cor2 ? [brilho, `linear-gradient(160deg, ${cartao.cor}, ${cartao.cor2})`].filter((c) => c !== 'none').join(', ') : brilho;
  const claro = luminancia(cartao.cor) > 0.55 && (!cartao.cor2 || luminancia(cartao.cor2) > 0.55);
  return { '--superficie': cartao.cor, '--texto': claro ? '#111111' : '#d0cdcd', '--cartao-brilho': camadas };
};
