// Documento "offscreen": uma página invisível que o background cria só enquanto você grava.
// Por que ele existe? O service worker (background.js) NÃO pode capturar áudio nem usar
// AudioContext. Uma página invisível pode. Aqui acontece todo o trabalho pesado:
//
//   áudio da aba ─┐
//                 ├─► [mistura] ─┬─► MediaRecorder  (arquivo .webm para você ouvir depois)
//   microfone ────┘              └─► AudioWorklet ─► pedaços de ~20 s ─► Whisper ─► texto
//
// ATENÇÃO: documentos offscreen só têm chrome.runtime (sem chrome.storage).
// Por isso o estado é enviado ao background por mensagem e as reuniões vão para o IndexedDB.

import { pipeline, env } from './vendor/transformers.min.js';
import { salvarReuniao, salvarAudio } from './armazenamento.js';
import { gerarResumo } from './resumo.js';
import { textoTranscricao } from './formatar.js';

// A biblioteca baixa por padrão os arquivos .wasm de um CDN, mas a extensão só aceita código
// da própria pasta (regra de segurança). Então apontamos para a nossa pasta vendor/.
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
env.backends.onnx.wasm.numThreads = 1; // mais threads exigem "cross-origin isolation"; 1 é o caminho simples

const TAXA_WHISPER = 16000; // o Whisper só entende áudio a 16.000 amostras por segundo
const MIN_TRECHO = 15 * TAXA_WHISPER; // só procuramos uma pausa para cortar depois de 15 s...
const MAX_TRECHO = 28 * TAXA_WHISPER; // ...e cortamos à força aos 28 s (Whisper aceita até 30 s)
const BLOCOS_DE_PAUSA = 2; // 2 blocos de ~0,25 s em silêncio = pausa na fala
const LIMIAR_PAUSA = 0.01; // volume (RMS) abaixo disso = silêncio
const LIMIAR_VAZIO = 0.004; // trecho inteiro abaixo disso nem vai para o Whisper
const ALUCINACOES = /legendas?\s+pel[ao]|amara\.org|obrigad[oa] por assistir|inscreva-se|www\./i;

let sessao = null; // tudo sobre a gravação em andamento (null = nada gravando)
let estado = { fase: 'ocioso' };

// ---------- Comunicação com o background ----------

const avisarBackground = (tipo, extra = {}) =>
  chrome.runtime.sendMessage({ para: 'background', tipo, ...extra }).catch(() => {});

const publicar = (parcial) => {
  estado = { ...estado, ...parcial };
  avisarBackground('estado', { estado });
};

// ---------- Utilidades de áudio ----------

// RMS = "volume médio" de um pedaço de áudio (raiz da média dos quadrados).
const rms = (amostras) => {
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) soma += amostras[i] * amostras[i];
  return Math.sqrt(soma / (amostras.length || 1));
};

const concatenar = (blocos, total) => {
  const saida = new Float32Array(total);
  let posicao = 0;
  for (const bloco of blocos) {
    saida.set(bloco, posicao);
    posicao += bloco.length;
  }
  return saida;
};

// ---------- Modelo Whisper ----------

const carregarModelo = async (config) => {
  const arquivos = {}; // progresso de download de cada arquivo do modelo
  let ultimaAtualizacao = 0;

  const aoProgredir = (p) => {
    if (p.status !== 'progress' || !p.total) return;
    arquivos[p.file] = { carregado: p.loaded, total: p.total };
    if (Date.now() - ultimaAtualizacao < 500) return; // não inundar o background
    ultimaAtualizacao = Date.now();
    const lista = Object.values(arquivos);
    const total = lista.reduce((soma, a) => soma + a.total, 0);
    const carregado = lista.reduce((soma, a) => soma + a.carregado, 0);
    publicar({ modelo: { pronto: false, pct: Math.round((100 * carregado) / total) } });
  };

  const criar = (dispositivo) =>
    pipeline('automatic-speech-recognition', config.modeloWhisper, {
      device: dispositivo,
      progress_callback: aoProgredir
    });

  let transcritor;
  try {
    transcritor = await criar(config.usarGpu ? 'webgpu' : 'wasm');
  } catch (erro) {
    if (!config.usarGpu) throw erro;
    transcritor = await criar('wasm'); // GPU falhou: volta para o processador
  }
  publicar({ modelo: { pronto: true, pct: 100 } });
  return transcritor;
};

// ---------- Fila de transcrição ----------

const registrarAviso = async (texto) => {
  const { reuniao } = sessao;
  if (reuniao.avisos.includes(texto)) return;
  reuniao.avisos.push(texto);
  await salvarReuniao(reuniao);
  publicar({ aviso: texto });
};

const transcreverTrecho = async (audio, inicioSeg) => {
  const transcritor = await sessao.modelo;
  const opcoes = { chunk_length_s: 30, return_timestamps: false, task: 'transcribe' };
  if (sessao.config.idioma !== 'auto') opcoes.language = sessao.config.idioma;

  const resultado = await transcritor(audio, opcoes);
  const texto = (resultado.text ?? '').trim();
  if (!texto || (texto.length < 80 && ALUCINACOES.test(texto))) return;

  sessao.reuniao.segmentos.push({ inicioSeg: Math.round(inicioSeg), texto });
  await salvarReuniao(sessao.reuniao); // salva a cada trecho: se algo travar, nada se perde
  publicar({ ultimoTrecho: texto });
};

// Os trechos entram numa fila: o Whisper processa UM por vez, na ordem.
const enfileirar = (audio, inicioSeg) => {
  const s = sessao;
  if (rms(audio) < LIMIAR_VAZIO) return; // só silêncio: o Whisper "alucinaria" texto
  s.pendentes++;
  publicar({ pendentes: s.pendentes });
  s.fila = s.fila
    .then(() => transcreverTrecho(audio, inicioSeg))
    .catch((erro) => registrarAviso(`Falha ao transcrever: ${erro.message ?? erro}`))
    .finally(() => {
      s.pendentes--;
      publicar({ pendentes: s.pendentes });
    });
};

const cortarTrecho = () => {
  const s = sessao;
  if (!s.totalAmostras) return;
  const audio = concatenar(s.blocos, s.totalAmostras);
  const inicioSeg = s.amostrasJaCortadas / TAXA_WHISPER;
  s.amostrasJaCortadas += audio.length;
  s.blocos = [];
  s.totalAmostras = 0;
  s.blocosSilenciosSeguidos = 0;
  enfileirar(audio, inicioSeg);
};

// Chamada ~4 vezes por segundo com um bloco de áudio novo.
const receberBloco = (bloco) => {
  const s = sessao;
  if (!s || s.finalizando) return;
  s.blocos.push(bloco);
  s.totalAmostras += bloco.length;
  s.blocosSilenciosSeguidos = rms(bloco) < LIMIAR_PAUSA ? s.blocosSilenciosSeguidos + 1 : 0;

  // Cortar numa pausa evita partir uma palavra ao meio.
  const achouPausa = s.blocosSilenciosSeguidos >= BLOCOS_DE_PAUSA && s.totalAmostras >= MIN_TRECHO;
  if (achouPausa || s.totalAmostras >= MAX_TRECHO) cortarTrecho();
};

// ---------- Iniciar ----------

const liberarFluxos = (...fluxos) => fluxos.forEach((f) => f?.getTracks().forEach((t) => t.stop()));

const iniciar = async ({ streamId, titulo, config }) => {
  if (sessao) throw new Error('Já existe uma gravação em andamento.');

  // 1) Áudio da aba (o streamId foi gerado pelo popup quando você clicou).
  const fluxoAba = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false
  });

  // 2) Microfone (opcional): precisa ter sido liberado antes na página de Configurações.
  const avisos = [];
  let fluxoMic = null;
  try {
    fluxoMic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  } catch {
    avisos.push('Microfone não liberado: gravei só o áudio da aba. Em Configurações, clique em "Permitir microfone".');
  }

  try {
    // 3) Monta o "circuito" de áudio.
    const ctx = new AudioContext({ sampleRate: TAXA_WHISPER });
    await ctx.resume();
    const mistura = ctx.createGain();
    const destino = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(fluxoAba).connect(mistura);
    if (fluxoMic) ctx.createMediaStreamSource(fluxoMic).connect(mistura);
    mistura.connect(destino);

    await ctx.audioWorklet.addModule('pcm-worklet.js');
    const captura = new AudioWorkletNode(ctx, 'captura-pcm', {
      channelCount: 1,
      channelCountMode: 'explicit', // força mistura em mono
      outputChannelCount: [1]
    });
    mistura.connect(captura);
    captura.connect(ctx.destination); // saída é silêncio; só mantém o nó "ligado"

    // Ao capturar uma aba, o navegador a deixa MUDA. Reproduzimos o som para você continuar ouvindo.
    const ctxSaida = new AudioContext();
    ctxSaida.createMediaStreamSource(fluxoAba).connect(ctxSaida.destination);

    // 4) Grava o arquivo de áudio em paralelo.
    const gravador = new MediaRecorder(destino.stream, { mimeType: 'audio/webm;codecs=opus' });
    const pedacos = [];
    gravador.ondataavailable = (evento) => evento.data.size && pedacos.push(evento.data);
    gravador.start(5000);

    const id = crypto.randomUUID();
    const inicio = Date.now();
    sessao = {
      id, inicio, config, ctx, ctxSaida, gravador, pedacos,
      fluxos: [fluxoAba, fluxoMic],
      blocos: [], totalAmostras: 0, blocosSilenciosSeguidos: 0, amostrasJaCortadas: 0,
      fila: Promise.resolve(), pendentes: 0, finalizando: false,
      modelo: null,
      reuniao: {
        id, titulo: titulo || 'Reunião sem título', inicio, duracaoSeg: 0,
        status: 'gravando', segmentos: [], resumo: null, temAudio: false, avisos
      }
    };
    await salvarReuniao(sessao.reuniao);

    captura.port.onmessage = (evento) => receberBloco(evento.data);
    // Se você fechar a aba gravada, o áudio acaba: finalizamos sozinhos.
    fluxoAba.getAudioTracks()[0].addEventListener('ended', () => finalizar());

    // Começa a baixar/carregar o Whisper já agora (a gravação não espera por ele).
    sessao.modelo = carregarModelo(config);
    sessao.modelo.catch((erro) => registrarAviso(`Não consegui carregar o Whisper: ${erro.message ?? erro}`));

    publicar({ fase: 'gravando', inicio, aviso: avisos[0] ?? null, ultimoTrecho: '', pendentes: 0, modelo: { pronto: false, pct: 0 } });
  } catch (erro) {
    liberarFluxos(fluxoAba, fluxoMic);
    sessao = null;
    throw erro;
  }
};

// ---------- Parar e finalizar ----------

const finalizar = async () => {
  const s = sessao;
  if (!s || s.finalizando) return;
  s.finalizando = true;
  publicar({ fase: 'finalizando', etapa: 'Terminando a transcrição...' });

  try {
    cortarTrecho(); // o que sobrou no buffer vai para a fila

    const gravadorParou = new Promise((resolve) => (s.gravador.onstop = resolve));
    if (s.gravador.state !== 'inactive') s.gravador.stop();
    await gravadorParou;
    liberarFluxos(...s.fluxos);
    await Promise.allSettled([s.ctx.close(), s.ctxSaida.close()]);

    await s.fila; // espera o Whisper terminar tudo que está na fila

    const { reuniao, config } = s;
    reuniao.duracaoSeg = Math.round((Date.now() - s.inicio) / 1000);
    reuniao.status = 'processando';
    await salvarReuniao(reuniao);

    const transcricao = textoTranscricao(reuniao.segmentos);
    if (transcricao.trim()) {
      publicar({ etapa: 'Gerando o resumo...' });
      try {
        reuniao.resumo = await gerarResumo(transcricao, config);
      } catch (erro) {
        reuniao.avisos.push(`O resumo com "${config.provedorResumo}" falhou (${erro.message}). Usei o resumo básico.`);
        reuniao.resumo = await gerarResumo(transcricao, { ...config, provedorResumo: 'basico' });
      }
    } else {
      reuniao.avisos.push('Nenhuma fala foi reconhecida na gravação.');
    }

    if (config.salvarAudio && s.pedacos.length) {
      await salvarAudio(s.id, new Blob(s.pedacos, { type: 'audio/webm' }));
      reuniao.temAudio = true;
    }
    reuniao.status = 'pronta';
    await salvarReuniao(reuniao);
  } catch (erro) {
    s.reuniao.status = 'erro';
    s.reuniao.avisos.push(`Erro ao finalizar: ${erro.message ?? erro}`);
    await salvarReuniao(s.reuniao);
  }

  sessao = null;
  avisarBackground('finalizado', { id: s.id });
};

// ---------- Mensagens vindas do background ----------

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.para !== 'offscreen') return;
  responder({ ok: true });
  if (mensagem.tipo === 'iniciar') {
    iniciar(mensagem).catch((erro) => avisarBackground('erro-fatal', { mensagem: erro.message ?? String(erro) }));
  }
  if (mensagem.tipo === 'parar') finalizar();
});
