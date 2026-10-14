const test = require('node:test');
const assert = require('node:assert/strict');
const { eventosEntre, combina, criarAgenda } = require('../agenda');

// Agenda de exemplo: aula toda segunda às 19h (America/Sao_Paulo, repete), uma entrevista avulsa,
// um evento "dia inteiro" e um cancelado.
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//teste//PT
BEGIN:VEVENT
UID:aula-semanal
DTSTART;TZID=America/Sao_Paulo:20260105T190000
DTEND;TZID=America/Sao_Paulo:20260105T213000
RRULE:FREQ=WEEKLY;BYDAY=MO
SUMMARY:Aula de Algoritmos
END:VEVENT
BEGIN:VEVENT
UID:entrevista
DTSTART:20261014T150000Z
DTEND:20261014T160000Z
SUMMARY:Entrevista presencial - Acme
END:VEVENT
BEGIN:VEVENT
UID:feriado
DTSTART;VALUE=DATE:20261014
DTEND;VALUE=DATE:20261015
SUMMARY:Aula (dia inteiro, deve ser ignorado)
END:VEVENT
BEGIN:VEVENT
UID:cancelada
DTSTART:20261014T170000Z
DTEND:20261014T180000Z
STATUS:CANCELLED
SUMMARY:Reunião cancelada
END:VEVENT
END:VCALENDAR`;

test('expande a aula semanal e mantém o horário certo (fuso de São Paulo)', () => {
  const lista = eventosEntre(ICS, new Date('2026-10-10T00:00:00Z'), new Date('2026-10-20T00:00:00Z'));
  const aulas = lista.filter((e) => e.titulo === 'Aula de Algoritmos');
  assert.deepEqual(aulas.map((e) => e.inicio.toISOString()), ['2026-10-12T22:00:00.000Z', '2026-10-19T22:00:00.000Z']);
  assert.equal(aulas[0].fim.toISOString(), '2026-10-13T00:30:00.000Z');
  assert.ok(lista.some((e) => e.titulo.startsWith('Entrevista')));
  assert.ok(!lista.some((e) => e.titulo.includes('dia inteiro')), 'dia inteiro é ignorado');
  assert.ok(!lista.some((e) => e.titulo.includes('cancelada')), 'cancelado é ignorado');
});

test('palavras-chave ignoram acento e maiúsculas', () => {
  assert.equal(combina('REUNIÃO de projeto', 'aula, reuniao', false), true);
  assert.equal(combina('Dentista', 'aula, reuniao', false), false);
  assert.equal(combina('Dentista', '', true), true);
});

const montarAgenda = (config) => {
  let t = Date.parse('2026-10-12T21:55:00Z'); // 18h55 em São Paulo
  const log = [];
  const agenda = criarAgenda({
    buscarIcs: async () => ICS,
    obterConfig: async () => ({ agendaUrl: 'https://x/ics', agendaPalavras: 'aula, entrevista', agendaTodos: false, ...config }),
    aoIniciar: (e) => log.push(['inicio', e.titulo]),
    aoParar: (e) => log.push(['fim', e.titulo]),
    agora: () => t
  });
  return { agenda, log, ir: (iso) => (t = Date.parse(iso)) };
};

test('inicia 1 min antes da aula, não repete e encerra 2 min depois do fim', async () => {
  const { agenda, log, ir } = montarAgenda({});
  await agenda.verificar();
  assert.deepEqual(log, [], '18h55: cedo demais');
  ir('2026-10-12T21:59:10Z'); await agenda.verificar();
  assert.deepEqual(log, [['inicio', 'Aula de Algoritmos']]);
  ir('2026-10-12T23:00:00Z'); await agenda.verificar();
  assert.equal(log.length, 1, 'durante a aula não inicia de novo');
  ir('2026-10-13T00:31:00Z'); await agenda.verificar();
  assert.equal(log.length, 1, 'ainda dentro da margem de 2 min');
  ir('2026-10-13T00:33:00Z'); await agenda.verificar();
  assert.deepEqual(log.at(-1), ['fim', 'Aula de Algoritmos']);
});

test('evento sem palavra-chave só grava se "gravar todos" estiver ligado', async () => {
  const sem = montarAgenda({ agendaPalavras: 'dentista' });
  sem.ir('2026-10-12T22:10:00Z'); await sem.agenda.verificar();
  assert.deepEqual(sem.log, []);
  const todos = montarAgenda({ agendaPalavras: 'dentista', agendaTodos: true });
  todos.ir('2026-10-12T22:10:00Z'); await todos.agenda.verificar();
  assert.deepEqual(todos.log, [['inicio', 'Aula de Algoritmos']]);
});

test('sem endereço de agenda não faz nada; sem internet usa a última cópia', async () => {
  const vazio = montarAgenda({ agendaUrl: '' });
  vazio.ir('2026-10-12T22:10:00Z'); await vazio.agenda.verificar();
  assert.deepEqual(vazio.log, []);

  let t = Date.parse('2026-10-12T21:00:00Z'); let online = true; const log = [];
  const agenda = criarAgenda({
    buscarIcs: async () => { if (!online) throw new Error('sem rede'); return ICS; },
    obterConfig: async () => ({ agendaUrl: 'u', agendaPalavras: 'aula', agendaTodos: false }),
    aoIniciar: (e) => log.push(e.titulo), aoParar: () => {}, agora: () => t
  });
  await agenda.verificar();           // baixa e guarda
  online = false; t = Date.parse('2026-10-12T22:30:00Z'); // 20 min depois: cache vencido, rede fora
  await agenda.verificar();
  assert.deepEqual(log, ['Aula de Algoritmos']);
});
