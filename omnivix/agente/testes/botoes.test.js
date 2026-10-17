const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const carregar = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'extensao', 'botoes-estilo.js')).href);

test('sem nada salvo, devolve os três botões completos com o visual padrão', async () => {
  const { normalizarBotoes, PADRAO_BOTOES } = await carregar();
  assert.deepEqual(normalizarBotoes(undefined), PADRAO_BOTOES);
  assert.deepEqual(normalizarBotoes(null), PADRAO_BOTOES);
  assert.deepEqual(normalizarBotoes('lixo'), PADRAO_BOTOES);
  assert.deepEqual(Object.keys(PADRAO_BOTOES), ['comum', 'principal', 'perigo', 'cartao', 'amostra']);
});

test('cada botão tem o conjunto completo de opções e todas as partes', async () => {
  const { PADRAO_BOTOES, PARTES } = await carregar();
  for (const [tipo, b] of Object.entries(PADRAO_BOTOES).filter(([n]) => !['cartao', 'amostra'].includes(n))) {
    for (const campo of ['cor', 'forca', 'vidro', 'desfoque', 'brilho', 'raio', 'altura', 'respiracao', 'sombraLetras']) assert.ok(campo in b, `${tipo} sem ${campo}`);
    assert.deepEqual(Object.keys(b.ligados).sort(), Object.keys(PARTES).sort(), `${tipo}: partes ligáveis`);
  }
});

test('mudar um botão não mexe nos outros dois', async () => {
  const { normalizarBotoes } = await carregar();
  const b = normalizarBotoes({ perigo: { raio: 28, cor: '#2e8b57' } });
  assert.equal(b.perigo.raio, 28);
  assert.equal(b.perigo.cor, '#2e8b57');
  assert.equal(b.comum.raio, 14);
  assert.equal(b.principal.raio, 14);
  assert.equal(b.comum.cor, '');
});

test('números fora do limite são cortados, e lixo vira o padrão daquele campo', async () => {
  const { normalizarBotoes, PADRAO_BOTOES } = await carregar();
  const b = normalizarBotoes({ comum: { desfoque: 999, vidro: -50, brilho: 'abc', raio: 7.6, altura: null, respiracao: 50, solido: true } }).comum;
  assert.equal(b.desfoque, 30);
  assert.equal(b.vidro, 0);
  assert.equal(b.brilho, PADRAO_BOTOES.comum.brilho); // "abc" não é número
  assert.equal(b.raio, 8); // arredonda
  assert.equal(b.altura, PADRAO_BOTOES.comum.altura); // null não vira o mínimo
  assert.equal(b.respiracao, 6);
  assert.equal(b.solido, PADRAO_BOTOES.comum.solido); // true não é número
});

test('só aceita cores no formato #rrggbb (nada que possa virar CSS estranho)', async () => {
  const { normalizarBotoes, PADRAO_BOTOES } = await carregar();
  assert.equal(normalizarBotoes({ comum: { cor: '#AA3344' } }).comum.cor, '#aa3344');
  assert.equal(normalizarBotoes({ perigo: { cor: 'red' } }).perigo.cor, PADRAO_BOTOES.perigo.cor);
  assert.equal(normalizarBotoes({ perigo: { cor: 'red; background: url(//x)' } }).perigo.cor, PADRAO_BOTOES.perigo.cor);
  assert.equal(normalizarBotoes({ principal: { cor: '' } }).principal.cor, ''); // vazio = cor padrão do botão
});

test('partes só aceitam verdadeiro/falso; o resto é ignorado', async () => {
  const { normalizarBotoes, PADRAO_BOTOES } = await carregar();
  const b = normalizarBotoes({ perigo: { ligados: { sombraInterna: false, reflexo: 'sim', inventada: true } } }).perigo;
  assert.equal(b.ligados.sombraInterna, false);
  assert.equal(b.ligados.reflexo, PADRAO_BOTOES.perigo.ligados.reflexo); // 'sim' não é boolean
  assert.equal('inventada' in b.ligados, false);
});

test('campos e botões desconhecidos são ignorados', async () => {
  const { normalizarBotoes } = await carregar();
  const b = normalizarBotoes({ hack: 1, comum: { hack: 2, desfoque: 5 } });
  assert.equal('hack' in b, false);
  assert.equal('hack' in b.comum, false);
  assert.equal(b.comum.desfoque, 5);
});

test('variáveis de CSS: cada botão tem as suas, com o padrão aprovado', async () => {
  const { variaveisDosBotoes } = await carregar();
  const v = variaveisDosBotoes({});
  assert.equal(v['--btn-comum-blur'], '16px');
  assert.equal(v['--btn-comum-forca'], '0%'); // comum não tem cor de fundo por padrão
  assert.equal(v['--btn-comum-vidro'], '1');
  assert.equal(v['--btn-principal-vidro'], '0'); // principal e perigo não têm o gradiente claro de vidro
  assert.equal(v['--btn-principal-cor'], 'var(--destaque)'); // segue o tema
  assert.equal(v['--btn-perigo-cor'], '#ff6b61');
  assert.equal(v['--btn-perigo-forca'], '80%');
  assert.equal(v['--btn-perigo-int'], '1'); // sombra por dentro só no vermelho
  assert.equal(v['--btn-comum-int'], '0');
  assert.equal(v['--btn-perigo-letra'], '0.5');
  assert.equal(v['--btn-comum-letra'], '0');
  assert.equal(v['--btn-perigo-respira'], '0.98');
});

test('desligar uma parte de UM botão zera só o efeito dela naquele botão', async () => {
  const { variaveisDosBotoes } = await carregar();
  const v = variaveisDosBotoes({ perigo: { ligados: { desfoque: false, reflexo: false, contorno: false, sombraExterna: false, sombraInterna: false, sombraLetras: false, respiracao: false, cor: false } } });
  assert.equal(v['--btn-perigo-blur'], '0px');
  assert.equal(v['--btn-perigo-brilho'], '0');
  assert.equal(v['--btn-perigo-contorno'], '0');
  assert.equal(v['--btn-perigo-ext'], '0');
  assert.equal(v['--btn-perigo-int'], '0');
  assert.equal(v['--btn-perigo-letra'], '0');
  assert.equal(v['--btn-perigo-respira'], '1'); // sem respiração = escala 1
  assert.equal(v['--btn-perigo-forca'], '0%'); // sem cor de fundo
  assert.equal(v['--btn-comum-blur'], '16px'); // os outros botões continuam como estavam
  assert.equal(v['--btn-principal-int'], '0');
});

test('o botão comum pode ganhar cor de fundo', async () => {
  const { variaveisDosBotoes } = await carregar();
  const v = variaveisDosBotoes({ comum: { cor: '#3366ff', ligados: { cor: true } } });
  assert.equal(v['--btn-comum-cor'], '#3366ff');
  assert.equal(v['--btn-comum-forca'], '30%');
  assert.equal(v['--btn-comum-forca-baixo'], '18%');
  // com a parte "cor" desligada a cor escolhida fica guardada, mas não aparece
  const sem = variaveisDosBotoes({ comum: { cor: '#3366ff', ligados: { cor: false } } });
  assert.equal(sem['--btn-comum-forca'], '0%');
});

test('"sem vidro" com fundo sólido: o botão fica plano', async () => {
  const { variaveisDosBotoes } = await carregar();
  const v = variaveisDosBotoes({ comum: { vidro: 100, solido: 100, ligados: { vidro: false, desfoque: false } } });
  assert.equal(v['--btn-comum-vidro'], '0');
  assert.equal(v['--btn-comum-solido'], '1');
  assert.equal(v['--btn-comum-blur'], '0px');
});

test('letra do botão: clara por padrão, escura só se a cor de fundo for clara e forte (contraste)', async () => {
  const { variaveisDosBotoes } = await carregar();
  assert.equal(variaveisDosBotoes({})['--btn-perigo-texto'], '#ffffff');
  assert.equal(variaveisDosBotoes({ perigo: { cor: '#ffe066' } })['--btn-perigo-texto'], '#111111'); // amarelo forte (80%)
  assert.equal(variaveisDosBotoes({ perigo: { cor: '#ffe066', forca: 20 } })['--btn-perigo-texto'], '#ffffff'); // amarelo fraco: fundo continua escuro
  assert.equal(variaveisDosBotoes({ perigo: { cor: '#7a0010' } })['--btn-perigo-texto'], '#ffffff');
  assert.equal(variaveisDosBotoes({})['--btn-principal-texto'], 'var(--texto)');
});

test('estilos prontos existem e cada um é válido', async () => {
  const { ESTILOS_PRONTOS, normalizarBotoes } = await carregar();
  assert.deepEqual(Object.keys(ESTILOS_PRONTOS), ['sutil', 'intenso', 'plano']);
  for (const [nome, estilo] of Object.entries(ESTILOS_PRONTOS)) {
    const { nome: _rotulo, ...valores } = estilo;
    const normal = normalizarBotoes({ comum: valores }).comum;
    for (const [campo, valor] of Object.entries(valores)) assert.equal(normal[campo], valor, `${nome}.${campo} fora dos limites`);
  }
});

test('cartões: por padrão seguem o tema; ligados, a cor escolhida vira a superfície e a letra acompanha o contraste', async () => {
  const { variaveisDosCartoes, normalizarBotoes } = await carregar();
  assert.deepEqual(variaveisDosCartoes({}), {}); // padrão: nada muda, o tema manda
  assert.deepEqual(variaveisDosCartoes({ cartao: { cor: '#224466', ligado: false } }), {}); // cor guardada, mas desligada
  assert.deepEqual(variaveisDosCartoes({ cartao: { ligado: true } }), {}); // ligado sem cor: nada
  const ligado = variaveisDosCartoes({ cartao: { cor: '#0c0c0d', ligado: true } });
  assert.equal(ligado['--superficie'], '#0c0c0d');
  assert.match(ligado['--cartao-brilho'], /linear-gradient/); // acetinado ligado por padrão quando a cor está ligada
  assert.equal(variaveisDosCartoes({ cartao: { cor: '#0c0c0d', ligado: true, acetinado: false } })['--cartao-brilho'], 'none');
  assert.equal(variaveisDosCartoes({ cartao: { cor: '#224466', ligado: true } })['--texto'], '#d0cdcd');
  assert.equal(variaveisDosCartoes({ cartao: { cor: '#f5f5dc', ligado: true } })['--texto'], '#111111'); // fundo claro: letra escura
  assert.equal(normalizarBotoes({ cartao: { cor: 'red; x', ligado: 'sim' } }).cartao.cor, ''); // lixo vira o padrão
});

test('cartões: segunda cor cria um degradê (e sem ela não há degradê)', async () => {
  const { variaveisDosCartoes, normalizarBotoes } = await carregar();
  const com = variaveisDosCartoes({ cartao: { cor: '#1b2a4a', cor2: '#4a2150', ligado: true } })['--cartao-brilho'];
  assert.match(com, /linear-gradient\(160deg, #1b2a4a, #4a2150\)/);
  assert.doesNotMatch(variaveisDosCartoes({ cartao: { cor: '#1b2a4a', ligado: true } })['--cartao-brilho'], /#/);
  assert.equal(normalizarBotoes({ cartao: { cor2: 'url(x)' } }).cartao.cor2, '');
});

test('faixa colorida da amostra: três cores válidas, o resto volta ao padrão', async () => {
  const { normalizarBotoes, PADRAO_AMOSTRA } = await carregar();
  assert.deepEqual(normalizarBotoes({}).amostra, PADRAO_AMOSTRA);
  assert.deepEqual(normalizarBotoes({ amostra: ['#FF0000', 'red', '#00ff00'] }).amostra, ['#ff0000', PADRAO_AMOSTRA[1], '#00ff00']);
  assert.deepEqual(normalizarBotoes({ amostra: 'lixo' }).amostra, PADRAO_AMOSTRA);
});
