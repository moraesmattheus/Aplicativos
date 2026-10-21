// Lê o seu calendário (arquivo .ics do Google Agenda) e inicia/encerra a gravação nos horários dos eventos.
// Serve para o que não tem chamada: aula presencial, entrevista presencial...
//
// Como pegar o endereço: Google Agenda > Configurações > (seu calendário) > "Endereço secreto no formato iCal".
// Qualquer pessoa com esse endereço lê sua agenda: não compartilhe.

const ical = require('node-ical');

const MARGEM_ANTES_MS = 60 * 1000; // começa 1 minuto antes
const MARGEM_DEPOIS_MS = 2 * 60 * 1000; // termina 2 minutos depois
const RENOVAR_ICS_MS = 15 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const semAcento = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const textoDe = (valor) => (typeof valor === 'object' && valor !== null ? String(valor.val ?? '') : String(valor ?? ''));

const combina = (titulo, palavras, todos) => {
  if (todos) return true;
  const alvo = semAcento(titulo);
  return palavras.split(',').map((p) => semAcento(p.trim())).filter(Boolean).some((p) => alvo.includes(p));
};

// Todos os eventos (inclusive repetições semanais etc.) que acontecem entre "de" e "ate".
const eventosEntre = (textoIcs, de, ate) => {
  const resultado = [];
  for (const evento of Object.values(ical.sync.parseICS(textoIcs))) {
    if (evento.type !== 'VEVENT' || evento.status === 'CANCELLED' || evento.datetype === 'date') continue; // ignora "dia inteiro"
    const instancias = ical.expandRecurringEvent(evento, { from: de, to: ate, expandOngoing: true });
    for (const i of instancias) {
      if (i.isFullDay) continue;
      resultado.push({ id: `${evento.uid}|${i.start.toISOString()}`, titulo: textoDe(i.summary) || 'Evento', inicio: i.start, fim: i.end });
    }
  }
  return resultado.sort((a, b) => a.inicio - b.inicio);
};

const criarAgenda = ({ buscarIcs, obterConfig, aoIniciar, aoParar, intervaloMs = 30000, agora = () => Date.now() }) => {
  let cache = { url: '', texto: '', em: 0 };
  let atual = null; // evento que estamos gravando
  const jaTratados = new Set(); // não regravar um evento que você parou de propósito
  let temporizador = null;

  const atualizarCache = async (url) => {
    if (cache.url === url && agora() - cache.em < RENOVAR_ICS_MS) return true;
    try {
      cache = { url, texto: await buscarIcs(url), em: agora() };
      return true;
    } catch {
      return cache.url === url && Boolean(cache.texto); // sem internet: usa a última cópia
    }
  };

  const verificar = async () => {
    const config = await obterConfig();
    if (!config.agendaUrl || !(await atualizarCache(config.agendaUrl))) return;
    const t = agora();

    if (atual && t >= atual.fim.getTime() + MARGEM_DEPOIS_MS) {
      const terminou = atual;
      atual = null;
      aoParar(terminou);
    }
    if (atual) return;

    const eventos = eventosEntre(cache.texto, new Date(t - DIA_MS), new Date(t + DIA_MS));
    const chegou = eventos.find(
      (e) =>
        !jaTratados.has(e.id) &&
        t >= e.inicio.getTime() - MARGEM_ANTES_MS &&
        t < e.fim.getTime() &&
        combina(e.titulo, config.agendaPalavras, config.agendaTodos)
    );
    if (chegou) {
      jaTratados.add(chegou.id);
      atual = chegou;
      aoIniciar(chegou);
    }
  };

  return {
    verificar,
    iniciar: () => (temporizador ??= setInterval(verificar, intervaloMs)),
    parar: () => {
      clearInterval(temporizador);
      temporizador = null;
    }
  };
};

module.exports = { eventosEntre, combina, criarAgenda };
