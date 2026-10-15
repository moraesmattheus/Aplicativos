// Janela invisível do app. Faz o mesmo papel do offscreen.js da extensão: capturar o áudio e
// entregar para o núcleo (gravacao.js). Só muda DE ONDE vem o áudio e como se fala com o programa.

import { configurar, iniciar, finalizar } from './gravacao.js';

// Sem tratamento nenhum do navegador: o som sai como entrou (eco, ruído e ganho ficam por conta de quem fala).
const SEM_PROCESSAMENTO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

const abrirFluxos = async ({ config } = {}) => {
  const avisos = [];
  let fluxoAba = null;

  // Áudio dos outros, opção 1: uma ENTRADA escolhida por você (ex.: Virtual Audio Cable). Não captura a saída
  // do Windows, então não mexe no som que você ouve.
  if (config?.entradaOutrosId) {
    try {
      fluxoAba = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: config.entradaOutrosId }, ...SEM_PROCESSAMENTO } });
    } catch {
      avisos.push(`Não consegui abrir a entrada "${config.entradaOutrosNome || 'escolhida'}"; usei o áudio do computador.`);
    }
  }

  // Opção 2 (padrão): áudio do computador inteiro. O pedido exige vídeo, mas só queremos o som.
  if (!fluxoAba) {
    // O pedido exige vídeo, mas só queremos o som: pede o menor vídeo possível (1 quadro por segundo, minúsculo)
    // para a captura de tela não pesar. Se o sistema recusar essas medidas, tenta do jeito comum.
    try {
      fluxoAba = await navigator.mediaDevices.getDisplayMedia({ video: { width: 16, height: 16, frameRate: 1 }, audio: true });
    } catch {
      fluxoAba = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    }
    fluxoAba.getVideoTracks().forEach((faixa) => {
      faixa.stop();
      fluxoAba.removeTrack(faixa);
    });
    if (!fluxoAba.getAudioTracks().length) {
      throw new Error('não consegui capturar o áudio do computador (no Windows precisa de 10 ou 11; no macOS, de permissão de gravação de tela)');
    }
  }

  // Seu microfone: o escolhido nas opções (ou o padrão do Windows, se você não escolheu nenhum).
  let fluxoMic = null;
  try {
    if (config?.gravarMicrofone === false) throw new Error('microfone desligado nas configurações');
    const escolhido = config?.microfoneId ? { deviceId: { exact: config.microfoneId } } : {};
    fluxoMic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, ...escolhido } });
  } catch {
    avisos.push(config?.gravarMicrofone === false
      ? 'Microfone desligado nas configurações: gravei só o áudio dos outros.'
      : 'Não consegui acessar o microfone: gravei só o áudio dos outros. Veja Configurações do Windows > Privacidade > Microfone, ou a escolha do microfone nas opções do app.');
  }
  return { fluxoAba, fluxoMic, avisos };
};

configurar({
  urlVendor: new URL('./vendor/', location.href).href,
  abrirFluxos,
  semSaida: true, // o app só ouve: não abre saída de áudio no fone (evita mexer na qualidade com FxSound e similares)
  tocarDeVolta: false, // a captura é do áudio do computador (loopback): tocar de volta cria eco de caverna
  publicar: (estado) => window.agente.estadoGravacao(estado),
  concluir: (resumo) => window.agente.gravacaoFinalizada(resumo)
});

// Chamadas pelo processo principal (com "gesto de usuário" simulado, que o navegador exige para capturar).
window.agenteIniciar = (parametros) => iniciar(parametros);
window.agentePararGravacao = () => finalizar();
