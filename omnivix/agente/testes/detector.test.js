const test = require('node:test');
const assert = require('node:assert/strict');
const { parsearConsentStore, criarDetector } = require('../detector');

// Saída real (formato) do comando: reg query "...ConsentStore\microphone" /s
const SAIDA_REG = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone
    Value    REG_SZ    Allow

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged
    Value    REG_SZ    Allow

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\\C:#Program Files#Google#Chrome#Application#chrome.exe
    Value    REG_SZ    Allow
    LastUsedTimeStart    REG_QWORD    0x1dc5a1b2c3d4e5f
    LastUsedTimeStop    REG_QWORD    0x0

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\\C:#Users#Ana#AppData#Local#Vivaldi#Application#vivaldi.exe
    Value    REG_SZ    Allow
    LastUsedTimeStart    REG_QWORD    0x1dc5a000000aaaa
    LastUsedTimeStop    REG_QWORD    0x1dc5a1111111111

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\MSTeams_8wekyb3d8bbwe
    Value    REG_SZ    Allow
    LastUsedTimeStart    REG_QWORD    0x1dc5a1b2c3d0000
    LastUsedTimeStop    REG_QWORD    0x0

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\\C:#Apps#nunca.exe
    Value    REG_SZ    Allow
    LastUsedTimeStart    REG_QWORD    0x0
    LastUsedTimeStop    REG_QWORD    0x0
`;

test('lê quem está usando o microfone no formato do Registro do Windows', () => {
  const apps = parsearConsentStore(SAIDA_REG.replace(/\n/g, '\r\n'));
  assert.deepEqual(apps.map((a) => [a.nome, a.emUso]), [
    ['chrome.exe', true],
    ['vivaldi.exe', false], // já parou (Stop diferente de 0)
    ['msteams_8wekyb3d8bbwe', true], // app da Loja
    ['nunca.exe', false] // nunca usou
  ]);
});

const novoRelogio = () => {
  let t = 1_000_000;
  return { agora: () => t, passar: (s) => (t += s * 1000) };
};

const montar = (lista, extra = {}) => {
  const relogio = novoRelogio();
  const eventos = [];
  const config = { autoDetectarChamadas: true, segundosParaIniciar: 8, segundosParaParar: 25, ignorarApps: ['audiodg.exe'], ...extra };
  const detector = criarDetector({
    lerAplicativos: async () => lista.atual,
    obterConfig: async () => config,
    aoIniciar: (apps) => eventos.push(['inicio', apps]),
    aoParar: () => eventos.push(['fim']),
    agora: relogio.agora
  });
  return { detector, relogio, eventos, config };
};

test('só considera chamada depois de alguns segundos (ignora um "alô" rápido)', async () => {
  const lista = { atual: ['chrome.exe'] };
  const { detector, relogio, eventos } = montar(lista);
  await detector.verificar();
  relogio.passar(5); await detector.verificar();
  assert.equal(eventos.length, 0);
  lista.atual = []; relogio.passar(3); await detector.verificar(); // soltou o microfone antes de 8 s
  lista.atual = ['chrome.exe']; relogio.passar(3); await detector.verificar();
  relogio.passar(5); await detector.verificar();
  assert.equal(eventos.length, 0, 'o relógio de 8 s reinicia quando o microfone foi solto');
  relogio.passar(4); await detector.verificar();
  assert.deepEqual(eventos, [['inicio', ['chrome.exe']]]);
});

test('só encerra após o microfone ficar livre por um tempo (mutar não corta)', async () => {
  const lista = { atual: ['chrome.exe'] };
  const { detector, relogio, eventos } = montar(lista);
  await detector.verificar(); relogio.passar(9); await detector.verificar();
  assert.equal(detector.ativo, true);
  lista.atual = []; await detector.verificar();
  relogio.passar(20); await detector.verificar();
  lista.atual = ['chrome.exe']; await detector.verificar(); // voltou a falar
  lista.atual = []; relogio.passar(1); await detector.verificar();
  relogio.passar(24); await detector.verificar();
  assert.deepEqual(eventos.map((e) => e[0]), ['inicio'], 'ainda não encerrou');
  relogio.passar(2); await detector.verificar();
  assert.deepEqual(eventos.map((e) => e[0]), ['inicio', 'fim']);
  assert.equal(detector.ativo, false);
});

test('programas da lista de ignorados nunca contam', async () => {
  const lista = { atual: ['audiodg.exe'] };
  const { detector, relogio, eventos } = montar(lista);
  await detector.verificar(); relogio.passar(60); await detector.verificar();
  assert.equal(eventos.length, 0);
});

test('detecção desligada nas configurações não faz nada', async () => {
  const lista = { atual: ['chrome.exe'] };
  const { detector, relogio, eventos } = montar(lista, { autoDetectarChamadas: false });
  await detector.verificar(); relogio.passar(60); await detector.verificar();
  assert.equal(eventos.length, 0);
});

test('erro ao ler o sistema não derruba o detector', async () => {
  const relogio = novoRelogio();
  let falhar = true;
  const detector = criarDetector({
    lerAplicativos: async () => { if (falhar) throw new Error('reg falhou'); return ['zoom.exe']; },
    obterConfig: async () => ({ autoDetectarChamadas: true, segundosParaIniciar: 1, segundosParaParar: 1, ignorarApps: [] }),
    aoIniciar: () => {}, aoParar: () => {}, agora: relogio.agora
  });
  await detector.verificar();
  falhar = false; await detector.verificar(); relogio.passar(2); await detector.verificar();
  assert.equal(detector.ativo, true);
});
