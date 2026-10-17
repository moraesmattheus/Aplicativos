// Editor da aparência dos botões (sliders, cores, estilos prontos e visualização ao vivo).
// Usado nas Configurações do app e da extensão. Devolve { ler, definir }: a página guarda o que ler() devolve.

import { PADRAO_BOTOES, ESTILOS_PRONTOS, normalizarBotoes } from './botoes-estilo.js';
import { aplicarBotoes } from './aparencia.js';

const el = (tag, props = {}, ...filhos) => {
  const no = Object.assign(document.createElement(tag), props);
  no.append(...filhos);
  return no;
};

// Cada controle numérico: [campo, rótulo, mínimo, máximo, unidade, dica]
const CONTROLES = [
  ['desfoque', 'Desfoque do vidro', 0, 30, ' px', 'Quanto o fundo atrás do botão fica borrado.'],
  ['vidro', 'Vidro (translucidez)', 0, 200, ' %', '0% = botão sólido; 100% = padrão; mais que isso = vidro mais marcado.'],
  ['brilho', 'Brilho (reflexo)', 0, 300, ' %', 'O fio de luz e o gradiente claro. 0% = sem nenhum reflexo.'],
  ['raio', 'Arredondamento', 0, 28, ' px', '0 = cantos retos; 28 = bem redondo.'],
  ['altura', 'Altura do botão', 30, 48, ' px', 'Mais baixo = mais fino e elegante.'],
  ['respiracao', 'Respiração ao passar o mouse', 0, 6, ' %', 'O quanto o botão encolhe e volta. 0 = não pulsa.'],
  ['sombraLetras', 'Sombra nas letras do vermelho', 0, 100, ' %', 'Sombra suave atrás do texto do botão Apagar.'],
  ['forcaPrincipal', 'Intensidade da cor do botão principal', 10, 100, ' %', 'Quanto da cor aparece no botão principal (ex.: Enviar ao Notion).'],
  ['forcaPerigo', 'Intensidade do vermelho (Apagar)', 30, 100, ' %', 'Quanto a cor aparece no botão vermelho.']
];

export const montarEditorDeBotoes = (raiz, inicial) => {
  let valor = normalizarBotoes(inicial);
  const campos = {}; // campo -> { entrada, saida }

  const avisarMudanca = () => {
    aplicarBotoes(valor); // visualização ao vivo: a própria página de Configurações já muda na hora
    raiz.dispatchEvent(new Event('change', { bubbles: true })); // a página marca "há alterações não salvas"
  };

  // ---- estilos prontos ----
  const seletorEstilo = el('select', { id: 'estiloBotoes', ariaLabel: 'Estilo pronto dos botões' },
    ...Object.entries(ESTILOS_PRONTOS).map(([id, e]) => el('option', { value: id, textContent: e.nome })),
    el('option', { value: 'personalizado', textContent: 'Personalizado' }));
  seletorEstilo.addEventListener('change', () => {
    const pronto = ESTILOS_PRONTOS[seletorEstilo.value];
    if (!pronto) return;
    const { nome: _nome, ...valores } = pronto;
    valor = normalizarBotoes({ ...valor, ...valores, estilo: seletorEstilo.value });
    desenhar();
    avisarMudanca();
  });

  // ---- sliders ----
  const linhas = CONTROLES.map(([campo, rotulo, minimo, maximo, unidade, dica]) => {
    const entrada = el('input', { type: 'range', min: String(minimo), max: String(maximo), step: '1', id: `botao-${campo}` });
    const saida = el('output', { className: 'suave', htmlFor: entrada.id });
    entrada.addEventListener('input', () => {
      valor = normalizarBotoes({ ...valor, [campo]: Number(entrada.value), estilo: 'personalizado' });
      seletorEstilo.value = 'personalizado';
      saida.textContent = `${valor[campo]}${unidade}`;
      avisarMudanca();
    });
    campos[campo] = { entrada, saida, unidade };
    return el('label', { className: 'linha-botao' },
      el('span', {}, rotulo, el('small', { textContent: dica })),
      el('span', { className: 'controle-botao' }, entrada, saida));
  });

  // ---- cores ----
  const entradaPrincipal = el('input', { type: 'color', id: 'botao-corPrincipal', ariaLabel: 'Cor do botão principal' });
  const entradaPerigo = el('input', { type: 'color', id: 'botao-corPerigo', ariaLabel: 'Cor do botão vermelho' });
  const usarTema = el('button', { type: 'button', textContent: 'Usar a cor do tema', title: 'O botão principal volta a seguir a cor de destaque do seu tema' });
  entradaPrincipal.addEventListener('input', () => {
    valor = normalizarBotoes({ ...valor, corPrincipal: entradaPrincipal.value, estilo: 'personalizado' });
    seletorEstilo.value = 'personalizado';
    avisarMudanca();
  });
  usarTema.addEventListener('click', () => {
    valor = normalizarBotoes({ ...valor, corPrincipal: '' });
    desenhar();
    avisarMudanca();
  });
  entradaPerigo.addEventListener('input', () => {
    valor = normalizarBotoes({ ...valor, corPerigo: entradaPerigo.value, estilo: 'personalizado' });
    seletorEstilo.value = 'personalizado';
    avisarMudanca();
  });

  const restaurar = el('button', { type: 'button', textContent: 'Restaurar o padrão' });
  restaurar.addEventListener('click', () => {
    valor = normalizarBotoes(PADRAO_BOTOES);
    desenhar();
    avisarMudanca();
  });

  // ---- visualização: botões de verdade sobre um fundo colorido (o vidro só aparece com algo atrás para desfocar) ----
  const amostra = el('div', { className: 'amostra-botoes', ariaHidden: 'true' },
    el('button', { type: 'button', textContent: 'Botão comum', tabIndex: -1 }),
    el('button', { type: 'button', className: 'principal', textContent: 'Enviar ao Notion', tabIndex: -1 }),
    el('button', { type: 'button', className: 'perigo', textContent: 'Apagar', tabIndex: -1 }));

  raiz.replaceChildren(
    el('p', { className: 'suave', textContent: 'Muda na hora aqui; vale para as outras telas depois de Salvar. Dica: passe o mouse nos botões abaixo para ver a respiração.' }),
    amostra,
    el('label', {}, 'Estilo pronto', seletorEstilo),
    ...linhas,
    el('div', { className: 'cores-botao' },
      el('label', {}, 'Cor do botão principal', entradaPrincipal, usarTema),
      el('label', {}, 'Cor do botão vermelho (Apagar)', entradaPerigo)),
    el('p', {}, restaurar));

  // Põe os valores atuais nos controles.
  function desenhar() {
    seletorEstilo.value = valor.estilo in ESTILOS_PRONTOS || valor.estilo === 'personalizado' ? valor.estilo : 'personalizado';
    for (const [campo, { entrada, saida, unidade }] of Object.entries(campos)) {
      entrada.value = String(valor[campo]);
      saida.textContent = `${valor[campo]}${unidade}`;
    }
    // O seletor de cor não aceita "vazio": mostra a cor de destaque atual do tema quando o botão segue o tema.
    entradaPrincipal.value = valor.corPrincipal || corDoTema();
    entradaPerigo.value = valor.corPerigo;
    usarTema.disabled = !valor.corPrincipal;
  }

  desenhar();

  return {
    ler: () => normalizarBotoes(valor),
    definir: (novo) => {
      valor = normalizarBotoes(novo);
      desenhar();
      aplicarBotoes(valor);
    }
  };
};

// Converte a cor de destaque atual do tema (qualquer formato CSS) em #rrggbb, para o seletor de cor.
const corDoTema = () => {
  const lona = document.createElement('canvas').getContext('2d');
  lona.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--destaque').trim() || '#dcdcdc';
  return /^#[0-9a-f]{6}$/i.test(lona.fillStyle) ? lona.fillStyle : '#dcdcdc';
};
