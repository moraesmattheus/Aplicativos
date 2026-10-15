// Janela invisível do app. Faz o mesmo papel do offscreen.js da extensão: capturar o áudio e
// entregar para o núcleo (gravacao.js). Só muda DE ONDE vem o áudio e como se fala com o programa.

import { configurar, iniciar, finalizar } from './gravacao.js';

const abrirFluxos = async ({ config } = {}) => {
  // Áudio do computador inteiro (a voz dos outros). O pedido exige vídeo, mas só queremos o som.
  const fluxoAba = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  fluxoAba.getVideoTracks().forEach((faixa) => {
    faixa.stop();
    fluxoAba.removeTrack(faixa);
  });
  if (!fluxoAba.getAudioTracks().length) {
    throw new Error('não consegui capturar o áudio do computador (no Windows precisa de 10 ou 11; no macOS, de permissão de gravação de tela)');
  }

  // Seu microfone.
  const avisos = [];
  let fluxoMic = null;
  try {
    if (config?.gravarMicrofone === false) throw new Error('microfone desligado nas configurações');
    fluxoMic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    avisos.push('Não consegui acessar o microfone: gravei só o áudio do computador. No Windows, veja Configurações > Privacidade > Microfone.');
  }
  return { fluxoAba, fluxoMic, avisos };
};

configurar({
  urlVendor: new URL('./vendor/', location.href).href,
  abrirFluxos,
  publicar: (estado) => window.agente.estadoGravacao(estado),
  concluir: (resumo) => window.agente.gravacaoFinalizada(resumo)
});

// Chamadas pelo processo principal (com "gesto de usuário" simulado, que o navegador exige para capturar).
window.agenteIniciar = (parametros) => iniciar(parametros);
window.agentePararGravacao = () => finalizar();
