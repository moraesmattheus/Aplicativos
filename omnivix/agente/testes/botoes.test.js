const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const carregar = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'extensao', 'botoes-estilo.js')).href);

test('sem nada salvo, devolve a aparência padrão completa', async () => {
  const { normalizarBotoes, PADRAO_BOTOES } = await carregar();
  assert.deepEqual(normalizarBotoes(undefined), PADRAO_BOTOES);
  assert.deepEqual(normalizarBotoes(null), PADRAO_BOTOES);
  assert.deepEqual(normalizarBotoes('lixo'), PADRAO_BOTOES);
});

test('números fora do limite são cortados, e lixo vira o padrão daquele campo', async () => {
  const { normalizarBotoes, PADRAO_BOTOES } = await carregar();
  const b = normalizarBotoes({ desfoque: 999, vidro: -50, brilho: 'abc', raio: 7.6, altura: null, respiracao: 50 });
  assert.equal(b.desfoque, 30);
  assert.equal(b.vidro, 0);
  assert.equal(b.brilho, PADRAO_BOTOES.brilho); // "abc" não é número
  assert.equal(b.raio, 8); // arredonda
  assert.equal(b.altura, PADRAO_BOTOES.altura); // null não vira 0
  assert.equal(b.respiracao, 6);
});

test('só aceita cores no formato #rrggbb (nada de texto que poderia virar CSS estranho)', async () => {
  const { normalizarBotoes, PADRAO_BOTOES } = await carregar();
  assert.equal(normalizarBotoes({ corPerigo: '#AA3344' }).corPerigo, '#aa3344');
  assert.equal(normalizarBotoes({ corPerigo: 'red' }).corPerigo, PADRAO_BOTOES.corPerigo);
  assert.equal(normalizarBotoes({ corPerigo: 'red; background: url(//x)' }).corPerigo, PADRAO_BOTOES.corPerigo);
  assert.equal(normalizarBotoes({ corPrincipal: '' }).corPrincipal, ''); // vazio = usa o tema
  assert.equal(normalizarBotoes({ corPrincipal: 'javascript:1' }).corPrincipal, PADRAO_BOTOES.corPrincipal);
});

test('campos desconhecidos são ignorados', async () => {
  const { normalizarBotoes } = await carregar();
  assert.equal('hack' in normalizarBotoes({ hack: 1, desfoque: 5 }), false);
});

test('variáveis de CSS: padrão e valores personalizados', async () => {
  const { variaveisDosBotoes } = await carregar();
  const padrao = variaveisDosBotoes({});
  assert.equal(padrao['--botao-blur'], '16px');
  assert.equal(padrao['--botao-vidro'], '1');
  assert.equal(padrao['--botao-solido'], '0');
  assert.equal(padrao['--botao-respira'], '0.98');
  assert.equal(padrao['--botao-cor-principal'], 'var(--destaque)'); // sem cor própria: segue o tema
  const personalizado = variaveisDosBotoes({ vidro: 0, respiracao: 0, corPrincipal: '#3366ff', raio: 20 });
  assert.equal(personalizado['--botao-solido'], '1'); // sem vidro = sólido
  assert.equal(personalizado['--botao-respira'], '1'); // respiração desligada = escala 1 (não mexe)
  assert.equal(personalizado['--botao-cor-principal'], '#3366ff');
  assert.equal(personalizado['--botao-raio'], '20px');
});

test('letra do botão vermelho escurece se a cor escolhida for clara (contraste)', async () => {
  const { variaveisDosBotoes } = await carregar();
  assert.equal(variaveisDosBotoes({ corPerigo: '#ff6b61' })['--botao-texto-perigo'], '#ffffff');
  assert.equal(variaveisDosBotoes({ corPerigo: '#ffe066' })['--botao-texto-perigo'], '#111111');
  assert.equal(variaveisDosBotoes({ corPerigo: '#7a0010' })['--botao-texto-perigo'], '#ffffff');
});

test('estilos prontos existem e cada um é válido depois de normalizado', async () => {
  const { ESTILOS_PRONTOS, normalizarBotoes } = await carregar();
  assert.deepEqual(Object.keys(ESTILOS_PRONTOS), ['sutil', 'intenso', 'plano']);
  for (const [nome, estilo] of Object.entries(ESTILOS_PRONTOS)) {
    const { nome: _rotulo, ...valores } = estilo;
    assert.deepEqual(normalizarBotoes(valores), { ...normalizarBotoes(valores) }, nome);
    for (const [campo, valor] of Object.entries(valores)) assert.equal(normalizarBotoes(valores)[campo], valor, `${nome}.${campo} fora dos limites`);
  }
  assert.equal(normalizarBotoes(ESTILOS_PRONTOS.plano).vidro, 0);
});
