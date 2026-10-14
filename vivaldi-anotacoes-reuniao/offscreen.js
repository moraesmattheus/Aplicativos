// Documento "offscreen": uma página invisível que o background cria só enquanto você grava.
// Por que ele existe? O service worker (background.js) NÃO pode capturar áudio nem usar AudioContext.
// Uma página invisível pode. Todo o trabalho pesado está em gravacao.js; aqui ficam só as partes
// específicas de extensão: de onde vem o áudio (a aba) e como falar com o background.
//
// ATENÇÃO: documentos offscreen só têm chrome.runtime (sem chrome.storage).
// Por isso o estado vai ao background por mensagem e as reuniões vão para o IndexedDB.

import { configurar, iniciar, finalizar } from './gravacao.js';

const avisarBackground = (tipo, extra = {}) =>
  chrome.runtime.sendMessage({ para: 'background', tipo, ...extra }).catch(() => {});

const abrirFluxos = async ({ streamId }) => {
  // Áudio da aba (o streamId foi gerado pelo popup quando você clicou).
  const fluxoAba = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false
  });

  // Microfone (opcional): precisa ter sido liberado antes na página de Configurações.
  const avisos = [];
  let fluxoMic = null;
  try {
    fluxoMic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    avisos.push('Microfone não liberado: gravei só o áudio da aba. Em Configurações, clique em "Permitir microfone".');
  }
  return { fluxoAba, fluxoMic, avisos };
};

configurar({
  urlVendor: chrome.runtime.getURL('vendor/'),
  abrirFluxos,
  publicar: (estado) => avisarBackground('estado', { estado }),
  concluir: ({ id }) => avisarBackground('finalizado', { id })
});

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.para !== 'offscreen') return;
  responder({ ok: true });
  if (mensagem.tipo === 'iniciar') {
    iniciar(mensagem).catch((erro) => avisarBackground('erro-fatal', { mensagem: erro.message ?? String(erro) }));
  }
  if (mensagem.tipo === 'parar') finalizar();
});
