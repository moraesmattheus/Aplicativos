// Service worker: o "gerente" da extensão. Não grava nada sozinho; só coordena.
//   popup  ──(iniciar/parar)──►  background  ──►  offscreen (grava e transcreve)
//   offscreen ──(estado/finalizado)──► background ──► badge "REC" + abre a página da reunião
//
// Importante: o service worker "dorme" quando fica ocioso, então NÃO guardamos estado em variáveis.
// O estado vai para chrome.storage.session (some quando o navegador fecha), que o popup também lê.

import { carregarConfig } from './config.js';

const OCIOSO = { fase: 'ocioso' };

const definirEstado = async (estado) => {
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

// Ao abrir o navegador não há gravação nenhuma: zera o badge.
chrome.runtime.onStartup.addListener(() => definirEstado(OCIOSO));
chrome.runtime.onInstalled.addListener(() => definirEstado(OCIOSO));
