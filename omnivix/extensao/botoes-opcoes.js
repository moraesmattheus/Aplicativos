// Editor da aparência dos botões. Três botões (comum, principal, Apagar), cada um com TODAS as opções, mais a aba
// "Todos juntos", que altera os três de uma vez. Cada parte do botão (vidro, reflexo, contorno, sombras, respiração, cor)
// tem uma caixa para ligar ou desligar: você escolhe o que tirar de cada botão.
// Usado nas Configurações do app e da extensão. Devolve { ler, definir }: a página guarda o que ler() devolve.

import { TIPOS, NOMES_DOS_TIPOS, PARTES, PADRAO_BOTOES, PADRAO_CARTAO, SUGESTAO_CARTAO, PADRAO_AMOSTRA, ESTILOS_PRONTOS, normalizarBotoes } from './botoes-estilo.js';
import { aplicarBotoes } from './aparencia.js';

const el = (tag, props = {}, ...filhos) => {
  const no = Object.assign(document.createElement(tag), props);
  no.append(...filhos);
  return no;
};

// [campo, rótulo, mínimo, máximo, unidade, dica, parte que o liga/desliga (ou null)]
const CONTROLES = [
  ['forca', 'Intensidade da cor de fundo', 10, 100, ' %', 'Quanto da cor aparece no fundo do botão.', 'cor'],
  ['vidro', 'Vidro (translucidez)', 0, 200, ' %', 'O gradiente claro e transparente. 0% = nenhum.', 'vidro'],
  ['solido', 'Fundo sólido por baixo', 0, 100, ' %', '0% = transparente; 100% = botão sólido.', null],
  ['desfoque', 'Desfoque do fundo', 0, 30, ' px', 'Quanto o que está atrás do botão fica borrado.', 'desfoque'],
  ['brilho', 'Brilho (reflexo)', 0, 300, ' %', 'O fio de luz e o gradiente claro no topo.', 'reflexo'],
  ['raio', 'Arredondamento', 0, 28, ' px', '0 = cantos retos; 28 = bem redondo.', null],
  ['altura', 'Altura do botão', 30, 48, ' px', 'Mais baixo = mais fino e elegante.', null],
  ['respiracao', 'Respiração ao passar o mouse', 0, 6, ' %', 'O quanto o botão encolhe e volta.', 'respiracao'],
  ['sombraLetras', 'Sombra nas letras', 0, 100, ' %', 'Sombra suave atrás do texto.', 'sombraLetras']
];

const ABAS = [['todos', 'Todos juntos'], ['comum', 'Comum'], ['principal', 'Principal'], ['perigo', 'Apagar'], ['cartao', 'Cartões']];

export const montarEditorDeBotoes = (raiz, inicial) => {
  let valor = normalizarBotoes(inicial);
  let escopo = 'todos'; // 'todos' ou um dos tipos
  const alvos = () => (escopo === 'todos' ? TIPOS : escopo === 'cartao' ? [] : [escopo]);
  const mexeNosCartoes = () => escopo === 'todos' || escopo === 'cartao'; // a cor de fundo vale também para o card inteiro

  const avisarMudanca = () => {
    globalThis.__botoesEditando = true; // há edição em andamento: configuração vinda de fora não pode apagar o que você está mexendo
    aplicarBotoes(valor); // visualização ao vivo: a própria página de Configurações já muda na hora
    raiz.dispatchEvent(new Event('change', { bubbles: true })); // a página marca "há alterações não salvas"
  };
  // Muda um campo em todos os botões do escopo atual.
  const definirCampo = (campo, novo) => {
    const cartao = campo === 'cor' && mexeNosCartoes() ? { ...valor.cartao, cor: novo } : valor.cartao;
    valor = normalizarBotoes({ ...Object.fromEntries(TIPOS.map((t) => [t, alvos().includes(t) ? { ...valor[t], [campo]: novo } : valor[t]])), cartao });
  };
  const definirParte = (parte, ligada) => {
    const cartao = parte === 'cor' && mexeNosCartoes() ? { ...valor.cartao, ligado: ligada } : valor.cartao;
    valor = normalizarBotoes({ ...Object.fromEntries(TIPOS.map((t) => [t, alvos().includes(t) ? { ...valor[t], ligados: { ...valor[t].ligados, [parte]: ligada } } : valor[t]])), cartao });
  };

  // ---------- amostra: os três botões de verdade (clicar em um escolhe a aba dele) ----------
  const amostras = {
    comum: el('button', { type: 'button', textContent: 'Botão comum' }),
    principal: el('button', { type: 'button', className: 'principal', textContent: 'Enviar ao Notion' }),
    perigo: el('button', { type: 'button', className: 'perigo', textContent: 'Apagar' })
  };
  for (const [tipo, botao] of Object.entries(amostras)) botao.addEventListener('click', () => escolherEscopo(tipo));

  // ---------- cores da faixa atrás dos botões (só da amostra) ----------
  const faixa = el('div', { className: 'amostra-botoes' }, amostras.comum, amostras.principal, amostras.perigo);
  const coresFaixa = PADRAO_AMOSTRA.map((_, i) => {
    const entrada = el('input', { type: 'color', id: `botao-faixa-${i + 1}`, ariaLabel: `Cor ${i + 1} da faixa` });
    entrada.addEventListener('input', () => {
      valor = normalizarBotoes({ ...valor, amostra: valor.amostra.map((c, j) => (j === i ? entrada.value : c)) });
      desenhar();
      avisarMudanca();
    });
    return entrada;
  });
  const botaoFaixaPadrao = el('button', { type: 'button', textContent: 'Cores padrão da faixa' });
  botaoFaixaPadrao.addEventListener('click', () => {
    valor = normalizarBotoes({ ...valor, amostra: PADRAO_AMOSTRA });
    desenhar();
    avisarMudanca();
  });
  const linhaFaixa = el('div', { className: 'cor-botao' }, el('span', {}, 'Cores da faixa atrás dos botões'), ...coresFaixa, botaoFaixaPadrao);

  // ---------- abas ----------
  const botoesDeAba = Object.fromEntries(ABAS.map(([id, rotulo]) => [id, el('button', { type: 'button', textContent: rotulo, role: 'tab' })]));
  for (const [id, botao] of Object.entries(botoesDeAba)) botao.addEventListener('click', () => escolherEscopo(id));
  function escolherEscopo(id) {
    escopo = id;
    desenhar();
  }

  // ---------- estilo pronto (vale para o escopo atual) ----------
  const seletorEstilo = el('select', { id: 'estiloBotoes', ariaLabel: 'Estilo pronto' },
    el('option', { value: '', textContent: 'Escolher um estilo pronto...' }),
    ...Object.entries(ESTILOS_PRONTOS).map(([id, e]) => el('option', { value: id, textContent: e.nome })));
  seletorEstilo.addEventListener('change', () => {
    const pronto = ESTILOS_PRONTOS[seletorEstilo.value];
    if (!pronto) return;
    const { nome: _nome, ...valores } = pronto;
    for (const [campo, numero] of Object.entries(valores)) definirCampo(campo, numero);
    seletorEstilo.value = '';
    desenhar();
    avisarMudanca();
  });

  // ---------- cor de fundo ----------
  const entradaCor = el('input', { type: 'color', id: 'botao-cor', ariaLabel: 'Cor de fundo' });
  const botaoCorPadrao = el('button', { type: 'button', textContent: 'Cor padrão', title: 'Volta à cor que este botão tinha de fábrica' });
  entradaCor.addEventListener('input', () => {
    if (escopo === 'cartao') valor = normalizarBotoes({ ...valor, cartao: { ...valor.cartao, cor: entradaCor.value, ligado: true } });
    else {
      definirCampo('cor', entradaCor.value);
      definirParte('cor', true); // escolheu uma cor: a parte "cor de fundo" liga sozinha
    }
    desenhar();
    avisarMudanca();
  });
  botaoCorPadrao.addEventListener('click', () => {
    if (escopo === 'cartao') valor = normalizarBotoes({ ...valor, cartao: PADRAO_CARTAO });
    else definirCampo('cor', '');
    desenhar();
    avisarMudanca();
  });

  // ---------- sliders ----------
  const sliders = {};
  const linhas = CONTROLES.map(([campo, rotulo, minimo, maximo, unidade, dica, parte]) => {
    const entrada = el('input', { type: 'range', min: String(minimo), max: String(maximo), step: '1', id: `botao-${campo}` });
    const saida = el('output', { className: 'suave', htmlFor: entrada.id });
    entrada.addEventListener('input', () => {
      definirCampo(campo, Number(entrada.value));
      if (parte) { definirParte(parte, true); desenhar(); } // mexeu no controle: a parte liga sozinha
      saida.textContent = `${entrada.value}${unidade}`;
      avisarMudanca();
    });
    sliders[campo] = { entrada, saida, unidade, parte };
    return el('label', { className: 'linha-botao' }, el('span', {}, rotulo, el('small', { textContent: dica })), el('span', { className: 'controle-botao' }, entrada, saida));
  });

  // ---------- partes que o usuário pode tirar ----------
  const caixas = {};
  const grade = el('div', { className: 'grade' }, ...Object.entries(PARTES).map(([parte, rotulo]) => {
    const caixa = el('input', { type: 'checkbox', id: `botao-parte-${parte}` });
    caixa.addEventListener('change', () => {
      definirParte(parte, caixa.checked);
      desenhar();
      avisarMudanca();
    });
    caixas[parte] = caixa;
    return el('label', {}, caixa, rotulo);
  }));
  const partes = el('fieldset', { className: 'partes-botao' }, el('legend', { textContent: 'O que este botão tem' }),
    el('p', { className: 'suave', textContent: 'Desmarque para TIRAR aquela parte do botão. As opções de cima só valem para as partes marcadas.' }), grade);

  // ---------- restaurar ----------
  const restaurarEste = el('button', { type: 'button', textContent: 'Restaurar este botão' });
  restaurarEste.addEventListener('click', () => {
    valor = normalizarBotoes({ ...Object.fromEntries(TIPOS.map((t) => [t, alvos().includes(t) ? PADRAO_BOTOES[t] : valor[t]])), cartao: mexeNosCartoes() ? PADRAO_CARTAO : valor.cartao });
    desenhar();
    avisarMudanca();
  });
  const restaurarTudo = el('button', { type: 'button', textContent: 'Restaurar tudo' });
  restaurarTudo.addEventListener('click', () => {
    valor = normalizarBotoes(PADRAO_BOTOES);
    desenhar();
    avisarMudanca();
  });

  // Aba Cartões: liga/desliga a cor dos painéis (a cor em si usa o seletor de cor de fundo)
  const caixaCartao = el('input', { type: 'checkbox', id: 'botao-cartao-ligado' });
  caixaCartao.addEventListener('change', () => {
    valor = normalizarBotoes({ ...valor, cartao: { ...valor.cartao, ligado: caixaCartao.checked } });
    desenhar();
    avisarMudanca();
  });
  const caixaAcetinado = el('input', { type: 'checkbox', id: 'botao-cartao-acetinado' });
  caixaAcetinado.addEventListener('change', () => {
    valor = normalizarBotoes({ ...valor, cartao: { ...valor.cartao, acetinado: caixaAcetinado.checked } });
    desenhar();
    avisarMudanca();
  });
  const entradaCor2 = el('input', { type: 'color', id: 'botao-cartao-cor2', ariaLabel: 'Segunda cor do degradê' });
  const botaoSemDegrade = el('button', { type: 'button', textContent: 'Sem degradê' });
  entradaCor2.addEventListener('input', () => {
    valor = normalizarBotoes({ ...valor, cartao: { ...valor.cartao, cor2: entradaCor2.value, ligado: true } });
    desenhar();
    avisarMudanca();
  });
  botaoSemDegrade.addEventListener('click', () => {
    valor = normalizarBotoes({ ...valor, cartao: { ...valor.cartao, cor2: '' } });
    desenhar();
    avisarMudanca();
  });
  const rotuloCartao = el('div', { className: 'suave' },
    el('div', { className: 'cor-botao' }, el('span', {}, 'Degradê: segunda cor'), entradaCor2, botaoSemDegrade),
    el('label', {}, caixaCartao, ' Usar esta cor nos cartões (painéis e caixas das telas)'),
    el('label', {}, caixaAcetinado, ' Brilho acetinado (reflexo suave, como cetim)'));

  const painel = el('div', { className: 'painel-botao', role: 'tabpanel' },
    el('label', {}, 'Estilo pronto', seletorEstilo),
    el('div', { className: 'cor-botao' }, el('span', {}, 'Cor de fundo (vale também para o card inteiro)'), entradaCor, botaoCorPadrao), rotuloCartao,
    ...linhas, partes,
    el('p', {}, restaurarEste, ' ', restaurarTudo));

  raiz.replaceChildren(
    el('p', { className: 'suave', textContent: 'Escolha "Todos juntos" para mudar os três de uma vez, ou um botão para mexer só nele. Mexa à vontade: muda na hora aqui e vale para as outras telas depois de Salvar. Passe o mouse nos botões para ver a respiração.' }),
    faixa, linhaFaixa,
    el('div', { className: 'abas-botao', role: 'tablist' }, ...Object.values(botoesDeAba)),
    painel);

  // Média dos valores de um campo nos botões do escopo; "misto" se forem diferentes.
  const resumo = (campo) => {
    const lista = alvos().map((t) => valor[t][campo]);
    return { valor: Math.round(lista.reduce((a, b) => a + b, 0) / lista.length), misto: new Set(lista).size > 1 };
  };

  // Põe o estado atual nos controles (tudo depende do escopo escolhido).
  function desenhar() {
    for (const [id, botao] of Object.entries(botoesDeAba)) botao.setAttribute('aria-selected', String(id === escopo));
    for (const [tipo, botao] of Object.entries(amostras)) botao.setAttribute('aria-pressed', String(alvos().includes(tipo)));
    faixa.style.background = `linear-gradient(120deg, ${valor.amostra[0]} 0%, ${valor.amostra[1]} 50%, ${valor.amostra[2]} 100%)`;
    coresFaixa.forEach((entrada, i) => { if (document.activeElement !== entrada) entrada.value = valor.amostra[i]; });
    botaoFaixaPadrao.disabled = valor.amostra.every((c, i) => c === PADRAO_AMOSTRA[i]);
    const soCartao = escopo === 'cartao';
    for (const no of [...linhas, partes, seletorEstilo.parentElement]) no.hidden = soCartao; // Cartões só têm cor
    rotuloCartao.hidden = !soCartao;
    for (const [campo, { entrada, saida, unidade, parte }] of Object.entries(soCartao ? {} : sliders)) {
      const r = resumo(campo);
      entrada.value = String(r.valor);
      saida.textContent = r.misto ? 'misto' : `${r.valor}${unidade}`;
      entrada.disabled = false; // sempre disponível: mexer no controle liga a parte dele
    }
    for (const [parte, caixa] of Object.entries(soCartao ? {} : caixas)) {
      const ligadas = alvos().map((t) => valor[t].ligados[parte]);
      caixa.checked = ligadas.every(Boolean);
      caixa.indeterminate = !caixa.checked && ligadas.some(Boolean); // alguns têm, outros não
    }
    if (soCartao) {
      if (document.activeElement !== entradaCor) entradaCor.value = valor.cartao.cor || SUGESTAO_CARTAO; // não mexe no seletor enquanto ele está aberto
      botaoCorPadrao.disabled = !valor.cartao.cor;
      caixaCartao.checked = valor.cartao.ligado;
      caixaAcetinado.checked = valor.cartao.acetinado;
      if (document.activeElement !== entradaCor2) entradaCor2.value = valor.cartao.cor2 || valor.cartao.cor || SUGESTAO_CARTAO;
      botaoSemDegrade.disabled = !valor.cartao.cor2;
    } else {
      const primeiro = alvos()[0];
      if (document.activeElement !== entradaCor) entradaCor.value = valor[primeiro].cor || corPadraoEmHex(primeiro); // idem
      botaoCorPadrao.disabled = alvos().every((t) => !valor[t].cor);
    }
  }

  desenhar();

  return {
    ler: () => normalizarBotoes(valor),
    definir: (novo) => {
      valor = normalizarBotoes(novo);
      globalThis.__botoesEditando = false; // tela recarregada com o que está salvo
      desenhar();
      aplicarBotoes(valor);
    }
  };
};

// O seletor de cor não aceita "vazio": mostra a cor que o botão tem de fábrica (a de destaque do tema, no principal).
const corPadraoEmHex = (tipo) => {
  if (tipo === 'perigo') return '#ff6b61';
  if (tipo === 'comum') return '#ffffff';
  const lona = document.createElement('canvas').getContext('2d');
  lona.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--destaque').trim() || '#dcdcdc';
  return /^#[0-9a-f]{6}$/i.test(lona.fillStyle) ? lona.fillStyle : '#dcdcdc';
};
