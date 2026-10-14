// Popup: a janelinha que abre ao clicar no ícone da extensão.
// Ele fecha sozinho quando você clica fora, então NÃO guarda estado: sempre desenha a tela
// a partir de chrome.storage.session (onde o background salva o estado da gravação).

import { formatarTempo } from './formatar.js';
import { detectarReuniao, tituloDaReuniao } from './deteccao.js';

const tela = document.getElementById('tela');
let temporizador = null;

// Pequeno construtor de elementos HTML (evita innerHTML e, com isso, falhas de segurança).
const el = (tag, props = {}, ...filhos) => {
  const no = Object.assign(document.createElement(tag), props);
  no.append(...filhos);
  return no;
};

const abrirPagina = (arquivo) => chrome.tabs.create({ url: chrome.runtime.getURL(arquivo) });

const rodape = () =>
  el('div', { className: 'linha' },
    el('button', { textContent: '📄 Reuniões', onclick: () => abrirPagina('reunioes.html') }),
    el('button', { textContent: '⚙️ Configurações', onclick: () => abrirPagina('opcoes.html') })
  );

const iniciarGravacao = async (titulo, mostrarErro) => {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id || /^(chrome|vivaldi|edge|about|chrome-extension):/.test(aba.url ?? '')) {
    return mostrarErro('Abra a aba da reunião (Meet, Zoom web, Teams...) e clique de novo. Páginas internas do navegador não podem ser gravadas.');
  }
  try {
    // Só funciona dentro do clique do usuário: é a "autorização" para gravar ESTA aba.
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: aba.id });
    await chrome.runtime.sendMessage({ para: 'background', tipo: 'iniciar', streamId, titulo: titulo || tituloDaReuniao(aba) });
  } catch (erro) {
    // O navegador só libera a aba em que você clicou no ícone da extensão (regra de segurança).
    const precisaClicar = /invoked|activeTab|permission/i.test(erro.message);
    mostrarErro(precisaClicar
      ? 'Para gravar esta aba, use Alt+Shift+G nela, ou clique com o botão direito na página e escolha "Gravar ou parar reunião", ou clique no ícone do Omnivix com ela aberta.'
      : `Não consegui iniciar: ${erro.message}`);
  }
};

const telaOciosa = (reuniao) => {
  const titulo = el('input', { type: 'text', placeholder: 'Título da reunião (opcional)' });
  const erro = el('div', { className: 'aviso', hidden: true });
  const mostrarErro = (texto) => Object.assign(erro, { textContent: texto, hidden: false });
  return [
    el('h1', { textContent: '🎙️ Omnivix' }),
    reuniao
      ? el('div', { className: 'aviso', textContent: `Reunião detectada: ${reuniao}. É só clicar em gravar.` })
      : el('p', { className: 'suave', textContent: 'Grava a aba atual + seu microfone, transcreve e gera o resumo.' }),
    titulo,
    el('button', { className: 'principal', textContent: '● Iniciar gravação desta aba', onclick: () => iniciarGravacao(titulo.value.trim(), mostrarErro) }),
    erro,
    rodape()
  ];
};

const telaGravando = (estado) => {
  const tempo = el('div', { className: 'tempo' });
  const atualizarTempo = () => (tempo.textContent = formatarTempo((Date.now() - estado.inicio) / 1000));
  atualizarTempo();
  temporizador = setInterval(atualizarTempo, 1000);

  const modelo = estado.modelo;
  const carregando = modelo && !modelo.pronto;
  return [
    el('div', {}, el('span', { className: 'ponto' }), 'Gravando'),
    tempo,
    carregando
      ? el('div', {},
          el('div', { className: 'suave', textContent: `Baixando/carregando o Whisper: ${modelo.pct}% (só na 1ª vez demora)` }),
          el('div', { className: 'barra' }, el('div', { style: `width:${modelo.pct}%` })))
      : el('div', { className: 'suave', textContent: estado.pendentes ? `Transcrevendo (${estado.pendentes} trecho(s) na fila)...` : 'Transcrição em dia ✔' }),
    estado.aviso ? el('div', { className: 'aviso', textContent: estado.aviso }) : '',
    estado.ultimoTrecho ? el('div', { id: 'trecho', textContent: estado.ultimoTrecho }) : '',
    el('button', { className: 'perigo', textContent: '■ Parar e gerar resumo', onclick: () => chrome.runtime.sendMessage({ para: 'background', tipo: 'parar' }) }),
    rodape()
  ];
};

const desenhar = (estado = { fase: 'ocioso' }, reuniao = null) => {
  clearInterval(temporizador);
  const { fase } = estado;
  let conteudo;
  if (fase === 'gravando') conteudo = telaGravando(estado);
  else if (fase === 'iniciando') conteudo = [el('p', { textContent: 'Iniciando a gravação...' })];
  else if (fase === 'finalizando') conteudo = [el('h1', { textContent: '⏳ Finalizando' }), el('p', { className: 'suave', textContent: estado.etapa ?? 'Processando...' }), el('p', { className: 'suave', textContent: 'A página da reunião abre sozinha quando terminar.' })];
  else if (fase === 'erro') conteudo = [el('div', { className: 'aviso', textContent: `Erro: ${estado.mensagem}` }), el('button', { textContent: 'Tentar de novo', onclick: () => chrome.storage.session.set({ estado: { fase: 'ocioso' } }) })];
  else conteudo = telaOciosa(reuniao);
  tela.replaceChildren(...conteudo.filter(Boolean));
};

// Quando o background muda o estado, redesenhamos (exceto se for só a tela ociosa com texto digitado).
let faseAtual = null;
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area !== 'session' || !mudancas.estado) return;
  const novo = mudancas.estado.newValue;
  if (novo?.fase === 'ocioso' && faseAtual === 'ocioso') return;
  faseAtual = novo?.fase;
  desenhar(novo, reuniaoDetectada);
});

const [abaAtiva] = await chrome.tabs.query({ active: true, currentWindow: true });
const reuniaoDetectada = detectarReuniao(abaAtiva?.url);
const { estado } = await chrome.storage.session.get('estado');
faseAtual = estado?.fase ?? 'ocioso';
desenhar(estado, reuniaoDetectada);
