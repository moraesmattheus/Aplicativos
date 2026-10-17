// Aparência dos botões: valores padrão, estilos prontos, validação e a tradução para variáveis de CSS.
// Sem nenhuma API do navegador: serve à extensão, ao app e aos testes. O CSS (estilo.css) só lê as variáveis geradas aqui.

export const PADRAO_BOTOES = {
  estilo: 'sutil', // nome do estilo pronto escolhido por último (só informativo)
  desfoque: 16, // px de desfoque do que está atrás do vidro (0 a 30)
  vidro: 100, // % de translucidez do vidro (0 = botão sólido, 200 = vidro bem marcado)
  brilho: 100, // % do reflexo: fio de luz e gradiente claro (0 = sem nenhum reflexo)
  raio: 14, // px de arredondamento (0 a 28)
  altura: 38, // px de altura mínima (30 a 48)
  respiracao: 2, // % que o botão encolhe ao passar o mouse (0 = não pulsa)
  sombraLetras: 50, // % da sombra atrás das letras do botão vermelho (0 = sem sombra)
  forcaPrincipal: 30, // % de cor do botão principal (10 a 100)
  forcaPerigo: 80, // % de cor do botão vermelho (30 a 100)
  corPrincipal: '', // vazio = usa a cor de destaque do tema
  corPerigo: '#ff6b61'
};

// Estilos prontos: preenchem os controles de uma vez. As cores, o arredondamento e a altura ficam como você deixou.
export const ESTILOS_PRONTOS = {
  sutil: { nome: 'Vidro sutil (padrão)', desfoque: 16, vidro: 100, brilho: 100, respiracao: 2, sombraLetras: 50, forcaPrincipal: 30, forcaPerigo: 80 },
  intenso: { nome: 'Vidro intenso', desfoque: 24, vidro: 170, brilho: 240, respiracao: 3, sombraLetras: 60, forcaPrincipal: 45, forcaPerigo: 90 },
  plano: { nome: 'Plano (sem vidro)', desfoque: 0, vidro: 0, brilho: 0, respiracao: 0, sombraLetras: 30, forcaPrincipal: 30, forcaPerigo: 85 }
};

const LIMITES = {
  desfoque: [0, 30], vidro: [0, 200], brilho: [0, 300], raio: [0, 28], altura: [30, 48],
  respiracao: [0, 6], sombraLetras: [0, 100], forcaPrincipal: [10, 100], forcaPerigo: [30, 100]
};
const COR_HEX = /^#[0-9a-f]{6}$/i;

// Aceita qualquer coisa (inclusive nada) e devolve um objeto completo e seguro: números dentro dos limites,
// cores só no formato #rrggbb, e nada de campos desconhecidos (o que vem do disco nunca vira CSS sem passar por aqui).
export const normalizarBotoes = (entrada) => {
  const origem = entrada && typeof entrada === 'object' ? entrada : {};
  const saida = { ...PADRAO_BOTOES };
  for (const [campo, [minimo, maximo]] of Object.entries(LIMITES)) {
    const valor = Number(origem[campo]);
    // null, vazio e true/false não contam como número (senão virariam o mínimo do campo)
    if (origem[campo] != null && origem[campo] !== '' && typeof origem[campo] !== 'boolean' && Number.isFinite(valor)) saida[campo] = Math.min(maximo, Math.max(minimo, Math.round(valor)));
  }
  if (typeof origem.corPrincipal === 'string' && (origem.corPrincipal === '' || COR_HEX.test(origem.corPrincipal))) saida.corPrincipal = origem.corPrincipal.toLowerCase();
  if (typeof origem.corPerigo === 'string' && COR_HEX.test(origem.corPerigo)) saida.corPerigo = origem.corPerigo.toLowerCase();
  if (typeof origem.estilo === 'string' && (origem.estilo in ESTILOS_PRONTOS || origem.estilo === 'personalizado')) saida.estilo = origem.estilo;
  return saida;
};

// Luminância relativa (0 = preto, 1 = branco), como na regra de contraste da WCAG. Serve para escolher letra clara ou escura.
export const luminancia = (hex) => {
  const canal = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
};

// Tradução final: objeto de aparência -> variáveis de CSS (nome -> valor). É isto que a página aplica no <html>.
export const variaveisDosBotoes = (botoes) => {
  const b = normalizarBotoes(botoes);
  return {
    '--botao-blur': `${b.desfoque}px`,
    '--botao-vidro': String(b.vidro / 100),
    '--botao-solido': String(Math.max(0, 1 - b.vidro / 100)), // quanto de "fundo sólido" entra quando o vidro é menos que 100%
    '--botao-brilho': String(b.brilho / 100),
    '--botao-raio': `${b.raio}px`,
    '--botao-altura': `${b.altura}px`,
    '--botao-respira': String(1 - b.respiracao / 100),
    '--botao-sombra-letra': String(b.sombraLetras / 100),
    '--botao-cor-principal': b.corPrincipal || 'var(--destaque)',
    '--botao-forca-principal': `${b.forcaPrincipal}%`,
    '--botao-forca-principal-baixo': `${Math.round(b.forcaPrincipal * 0.6)}%`,
    '--botao-cor-perigo': b.corPerigo,
    '--botao-forca-perigo': `${b.forcaPerigo}%`,
    '--botao-forca-perigo-baixo': `${Math.round(b.forcaPerigo * 0.775)}%`,
    // Letra do botão vermelho: branca, a não ser que a cor escolhida seja clara (aí fica escura, para não sumir).
    '--botao-texto-perigo': luminancia(b.corPerigo) > 0.55 ? '#111111' : '#ffffff'
  };
};
