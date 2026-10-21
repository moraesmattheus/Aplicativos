const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { processosDeReuniaoAtivos, criarDetector } = require('../detector');

// Cria um arquivo temporario com a lista de "programas rodando" e aponta a simulacao para ele.
const simularProcessos = (lista) => {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'omnivix-')), 'processos.json');
  fs.writeFileSync(arquivo, JSON.stringify(lista));
  process.env.AGENTE_SIMULAR_PROCESSOS = arquivo;
};

test.afterEach(() => delete process.env.AGENTE_SIMULAR_PROCESSOS);

test('devolve só os programas de reunião da lista que estão rodando', async () => {
  simularProcessos(['zoom.exe', 'cpthost.exe', 'spotify.exe']);
  assert.deepEqual(await processosDeReuniaoAtivos(['cpthost.exe', 'ms-teams.exe']), ['cpthost.exe']);
});

test('sem nenhum programa de reunião rodando devolve lista vazia', async () => {
  simularProcessos(['zoom.exe', 'spotify.exe']);
  assert.deepEqual(await processosDeReuniaoAtivos(['cpthost.exe']), []);
});

test('lista vazia nas opções desliga o recurso', async () => {
  simularProcessos(['cpthost.exe']);
  assert.deepEqual(await processosDeReuniaoAtivos([]), []);
});

test('arquivo de simulação inválido não derruba o detector', async () => {
  process.env.AGENTE_SIMULAR_PROCESSOS = path.join(os.tmpdir(), 'nao-existe-omnivix.json');
  assert.deepEqual(await processosDeReuniaoAtivos(['cpthost.exe']), []);
});

test('reunião com microfone mudo: começa pelo programa aberto e para quando ele fecha', async () => {
  let agora = 0;
  let microfone = []; // mutado: o Windows não marca o microfone como em uso
  let abertos = ['cpthost.exe']; // mas o Zoom está numa reunião
  const eventos = [];
  const detector = criarDetector({
    lerAplicativos: async () => [...microfone, ...abertos],
    obterConfig: async () => ({ autoDetectarChamadas: true, segundosParaIniciar: 8, segundosParaParar: 25, ignorarApps: [] }),
    aoIniciar: (apps) => eventos.push(['inicio', apps]),
    aoParar: () => eventos.push(['fim']),
    agora: () => agora
  });

  await detector.verificar(); // t=0: acabou de aparecer
  assert.equal(detector.ativo, false);
  agora = 9000;
  await detector.verificar(); // t=9s: passou dos 8 s
  assert.deepEqual(eventos, [['inicio', ['cpthost.exe']]]);

  abertos = []; // saiu da reunião
  agora = 10000;
  await detector.verificar();
  agora = 40000; // 30 s livre (> 25 s)
  await detector.verificar();
  assert.deepEqual(eventos.at(-1), ['fim']);
});
