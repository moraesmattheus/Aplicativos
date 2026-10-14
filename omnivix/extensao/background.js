// Service worker: o "gerente" da extensão. Não grava nada sozinho; só coordena.
//   popup  ──(iniciar/parar)──►  background  ──►  offscreen (grava e transcreve)
//   offscreen ──(estado/finalizado)──► background ──► badge "REC" + abre a página da reunião
//
// Importante: o service worker "dorme" quando fica ocioso, então NÃO guardamos estado em variáveis.
// O estado vai para chrome.storage.session (some quando o navegador fecha), que o popup também lê.

import './foco/fundo-foco.js'; // tarefas, tempo automático, Pomodoro, abas e abrir o painel
import { carregarConfig } from './config.js';
import { detectarReuniao, tituloDaReuniao } from './deteccao.js';

const OCIOSO = { fase: 'ocioso' };

// Abas em que já mostramos o aviso "reunião detectada" (guardado em storage.session porque o service worker dorme).
const lerAvisadas = async () => (await chrome.storage.session.get('avisadas')).avisadas ?? [];

// text: null = "tira o aviso desta aba e volta ao texto global" (por exemplo, REC).
const limparAviso = async (tabId) => {
  await chrome.action.setBadgeText({ tabId, text: null }).catch(() => {});
  await chrome.notifications.clear(`reuniao-${tabId}`);
};

const limparTodosOsAvisos = async () => {
  const avisadas = await lerAvisadas();
  await Promise.all(avisadas.map(limparAviso));
  await chrome.storage.session.set({ avisadas: [] });
};

const definirEstado = async (estado) => {
  if (estado.fase !== 'ocioso') await limparTodosOsAvisos(); // começou a gravar: o aviso não faz mais sentido
  await chrome.storage.session.set({ estado });
  const texto = { gravando: 'REC', iniciando: '...', finalizando: '...' }[estado.fase] ?? '';
  await chrome.action.setBadgeText({ text: texto });
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
};

const garantirOffscreen = async () => {
  const existentes = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existentes.length) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Capturar o áudio da aba e do microfone e transcrever a reunião.'
  });
};

const enviarAoOffscreen = async (mensagem) => {
  try {
    await chrome.runtime.sendMessage({ para: 'offscreen', ...mensagem });
  } catch {
    // O documento pode ainda estar terminando de carregar: tenta de novo uma vez.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await chrome.runtime.sendMessage({ para: 'offscreen', ...mensagem });
  }
};

const encerrarOffscreen = async () => {
  try {
    await chrome.offscreen.closeDocument();
  } catch {
    /* já estava fechado */
  }
};

const tratar = async (mensagem) => {
  switch (mensagem.tipo) {
    case 'iniciar': {
      await definirEstado({ fase: 'iniciando' });
      const config = await carregarConfig();
      await garantirOffscreen();
      await enviarAoOffscreen({ tipo: 'iniciar', streamId: mensagem.streamId, titulo: mensagem.titulo, config });
      return { ok: true };
    }
    case 'parar':
      await enviarAoOffscreen({ tipo: 'parar' });
      return { ok: true };
    case 'estado':
      await definirEstado(mensagem.estado);
      return { ok: true };
    case 'finalizado':
      await definirEstado(OCIOSO);
      await chrome.tabs.create({ url: chrome.runtime.getURL(`reunioes.html#${mensagem.id}`) });
      await encerrarOffscreen();
      return { ok: true };
    case 'erro-fatal':
      await definirEstado({ fase: 'erro', mensagem: mensagem.mensagem });
      await encerrarOffscreen();
      return { ok: true };
    default:
      return { ok: false };
  }
};

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.para !== 'background') return;
  tratar(mensagem)
    .then(responder)
    .catch((erro) => responder({ erro: String(erro) }));
  return true; // "vou responder de forma assíncrona"
});

// ---------- Começar/parar sem abrir o painel: atalho e menu do botão direito ----------
// O navegador só deixa gravar o áudio de uma aba depois de um gesto seu NAQUELA aba (clicar no ícone,
// usar o atalho ou o menu de contexto). Estes dois cobrem o caso em que o painel já estava aberto e
// você trocou de aba.

const avisarSimples = (id, titulo, mensagem) =>
  chrome.notifications.create(id, { type: 'basic', iconUrl: 'icones/128.png', title: titulo, message: mensagem });

const alternarGravacaoNaAba = async (aba) => {
  const { estado } = await chrome.storage.session.get('estado');
  if (estado?.fase === 'gravando') {
    await enviarAoOffscreen({ tipo: 'parar' });
    return;
  }
  if (!aba?.id || /^(chrome|vivaldi|edge|about|chrome-extension):/.test(aba.url ?? '')) {
    avisarSimples('reuniao-aviso', 'Abra a aba da reunião', 'Páginas internas do navegador não podem ser gravadas.');
    return;
  }
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: aba.id });
    await tratar({ tipo: 'iniciar', streamId, titulo: tituloDaReuniao(aba) });
  } catch (erro) {
    avisarSimples('reuniao-aviso', 'Não consegui gravar esta aba', String(erro.message ?? erro));
  }
};

chrome.commands.onCommand.addListener(async (comando, aba) => {
  if (comando !== 'gravar-reuniao') return;
  await alternarGravacaoNaAba(aba ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() =>
    chrome.contextMenus.create({ id: 'gravar-reuniao', title: 'Gravar ou parar reunião (Omnivix)', contexts: ['page'] })
  );
});

chrome.contextMenus.onClicked.addListener((info, aba) => {
  if (info.menuItemId === 'gravar-reuniao') alternarGravacaoNaAba(aba);
});

// ---------- Detecção de reunião ----------

const avisarReuniao = async (tabId, plataforma) => {
  const avisadas = await lerAvisadas();
  if (avisadas.includes(tabId)) return;
  await chrome.storage.session.set({ avisadas: [...avisadas, tabId] });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#e8590c' });
  await chrome.action.setBadgeText({ tabId, text: '?' });
  await chrome.notifications.create(`reuniao-${tabId}`, {
    type: 'basic',
    iconUrl: 'icones/128.png',
    title: `Reunião detectada (${plataforma})`,
    message: 'Clique no ícone do Omnivix e depois em Gravar.',
    priority: 1
  });
};

chrome.tabs.onUpdated.addListener(async (tabId, mudanca, aba) => {
  if (!mudanca.url && mudanca.status !== 'complete') return;
  const plataforma = detectarReuniao(aba.url);
  const avisadas = await lerAvisadas();
  if (!plataforma) {
    // A aba saiu da reunião: remove o aviso, se havia.
    if (avisadas.includes(tabId)) {
      await limparAviso(tabId);
      await chrome.storage.session.set({ avisadas: avisadas.filter((id) => id !== tabId) });
    }
    return;
  }
  const { config } = await chrome.storage.local.get('config');
  const { estado } = await chrome.storage.session.get('estado');
  if (config?.avisarReuniao === false || (estado && estado.fase !== 'ocioso')) return;
  await avisarReuniao(tabId, plataforma);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const avisadas = await lerAvisadas();
  if (avisadas.includes(tabId)) await chrome.storage.session.set({ avisadas: avisadas.filter((id) => id !== tabId) });
});

// Ao abrir o navegador não há gravação nenhuma: zera o badge.
chrome.runtime.onStartup.addListener(() => definirEstado(OCIOSO));
chrome.runtime.onInstalled.addListener(() => definirEstado(OCIOSO));
