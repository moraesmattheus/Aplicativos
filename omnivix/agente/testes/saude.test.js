const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { criarDetector } = require('../detector');

// O módulo é ESM (compartilhado com a extensão); carregamos com import dinâmico.
const carregar = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'extensao', 'saude-audio.js')).href);

test('medidor: com som, o tempo sem som volta a zero e o nível sobe', async () => {
  const { criarMedidor } = await carregar();
  let agora = 0;
  const m = criarMedidor(() => agora);
  agora = 10_000;
  m.registrar(0.05); // voz normal
  assert.equal(m.ler().semSomSeg, 0);
  assert.ok(m.ler().nivel > 0.4, `nível muito baixo: ${m.ler().nivel}`);
});

test('medidor: silêncio acumula segundos sem som e o nível desce devagar', async () => {
  const { criarMedidor } = await carregar();
  let agora = 0;
  const m = criarMedidor(() => agora);
  m.registrar(0.05);
  const nivelComSom = m.ler().nivel;
  agora = 45_000;
  m.registrar(0.0001); // só ruído de fundo
  const lido = m.ler();
  assert.equal(lido.semSomSeg, 45);
  assert.ok(lido.nivel < nivelComSom && lido.nivel > 0, 'o nível deve descer, mas não zerar de uma vez');
});

test('saúde: sem som da reunião por 30 s gera alerta; antes disso não', async () => {
  const { avaliarSaude } = await carregar();
  const mic = { nivel: 0, semSomSeg: 99 };
  assert.equal(avaliarSaude({ aba: { nivel: 0, semSomSeg: 29 }, mic, microfone: true }).alerta, null);
  const saude = avaliarSaude({ aba: { nivel: 0, semSomSeg: 31 }, mic, microfone: true });
  assert.equal(saude.alerta.tipo, 'sem-som');
  assert.match(saude.alerta.mensagem, /31 s/);
});

test('saúde: microfone mudo NÃO gera alerta (você pode estar mutado de propósito)', async () => {
  const { avaliarSaude } = await carregar();
  const saude = avaliarSaude({ aba: { nivel: 0.5, semSomSeg: 0 }, mic: { nivel: 0, semSomSeg: 600 }, microfone: true });
  assert.equal(saude.alerta, null);
  assert.equal(saude.nivelMic, 0);
});

test('saúde: sem microfone ligado, a barra do microfone vem nula', async () => {
  const { avaliarSaude } = await carregar();
  const saude = avaliarSaude({ aba: { nivel: 0.3, semSomSeg: 1 }, mic: { nivel: 0, semSomSeg: 1 }, microfone: false });
  assert.equal(saude.nivelMic, null);
});

// ---------- Detector: não pode "achar que já está gravando" se o início falhou ----------

const configPadrao = { autoDetectarChamadas: true, segundosParaIniciar: 8, segundosParaParar: 25, ignorarApps: [] };

test('detector: se iniciar a gravação falhar, tenta de novo no próximo ciclo (antes desistia para sempre)', async () => {
  let agora = 0;
  const tentativas = [];
  let aceitar = false; // o app está ocupado terminando a reunião anterior
  const detector = criarDetector({
    lerAplicativos: async () => ['zoom.exe'],
    obterConfig: async () => configPadrao,
    aoIniciar: async () => { tentativas.push(agora); return aceitar; },
    aoParar: () => {},
    agora: () => agora
  });
  await detector.verificar();       // t=0: apareceu
  agora = 9000; await detector.verificar();   // passou de 8 s: tenta e é recusado
  assert.equal(detector.ativo, false, 'não pode marcar como ativo se a gravação não começou');
  agora = 12000; await detector.verificar();  // tenta de novo
  assert.equal(tentativas.length, 2);
  aceitar = true;
  agora = 15000; await detector.verificar();  // agora aceita
  assert.equal(detector.ativo, true);
  agora = 18000; await detector.verificar();  // e não tenta mais
  assert.equal(tentativas.length, 3);
});

test('detector: aoIniciar antigo (que não devolve nada) continua funcionando', async () => {
  let agora = 0;
  let chamadas = 0;
  const detector = criarDetector({
    lerAplicativos: async () => ['zoom.exe'],
    obterConfig: async () => configPadrao,
    aoIniciar: () => { chamadas++; },
    aoParar: () => {},
    agora: () => agora
  });
  await detector.verificar();
  agora = 9000; await detector.verificar();
  assert.equal(detector.ativo, true);
  assert.equal(chamadas, 1);
});
