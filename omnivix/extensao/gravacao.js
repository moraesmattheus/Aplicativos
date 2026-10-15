// NÚCLEO DA GRAVAÇÃO: usado pela extensão (offscreen.js) e pelo aplicativo de desktop (gravador.js).
// Aqui acontece todo o trabalho pesado. Tudo que muda de uma plataforma para outra (de onde vem o áudio,
// como se avisa o resto do programa) entra pelo "adaptador" recebido em configurar().
//
//   áudio da aba ──► [canal "Participantes"] ──┐
//                                              ├─► pedaços de fala ─► fila ─► Whisper/Groq ─► texto com falante
//   seu microfone ─► [canal "Você"] ───────────┘
//   (as duas fontes também são misturadas e gravadas num arquivo .webm)
//
// Como as duas fontes entram SEPARADAS, sabemos quem falou sem nenhuma IA: o que vem do microfone é
// "Você"; o que vem da aba são os outros. (Separar cada participante é feito depois, em falantes.js.)
//
// O adaptador precisa fornecer:
//   urlVendor            endereço da pasta vendor/ (arquivos .wasm do motor do Whisper)
//   abrirFluxos(params)  devolve { fluxoAba, fluxoMic, avisos }: o áudio dos OUTROS e o seu microfone
//   tocarDeVolta         (opcional, padrão true) true quando a captura deixa a fonte MUDA e precisamos tocar o som de volta
//                        (aba do navegador). Deve ser false se a captura é do áudio do computador inteiro (loopback):
//                        tocar de volta seria capturar o próprio som de novo, e isso cria eco.
//   semSaida             (opcional, padrão false) true = não abre nenhuma saída de áudio (nem uma silenciosa) no fone/caixas.
//                        Abrir uma saída pode mexer na qualidade do som com placas virtuais (ex.: equalizadores).
//   publicar(estado)     recebe o estado da gravação (para mostrar no ícone, popup etc.)
//   concluir(resumo)     chamado quando a reunião terminou de ser processada

import { pipeline, env } from './vendor/transformers.min.js';
import { salvarReuniao, salvarAudio } from './armazenamento.js';
import { gerarResumo } from './resumo.js';
import { identificarFalantes } from './falantes.js';
import { transcreverGroq } from './transcricao-nuvem.js';
import { transcreverAssemblyAI, respostaParaSegmentos } from './transcricao-assemblyai.js';
import { enviarAoNotion } from './notion.js';
import { textoTranscricao } from './formatar.js';

// A biblioteca baixa por padrão os arquivos .wasm de um CDN, mas a extensão só aceita código
// da própria pasta (regra de segurança). Então apontamos para a nossa pasta vendor/.
let adaptador = null;

export const configurar = (novoAdaptador) => {
  adaptador = novoAdaptador;
  env.allowLocalModels = false;
  env.backends.onnx.wasm.wasmPaths = adaptador.urlVendor;
  // Várias threads só funcionam com "cross-origin isolation" (ligada no manifest.json / no servidor do app).
  env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
};

const TAXA_WHISPER = 16000; // o Whisper só entende áudio a 16.000 amostras por segundo
const BLOCOS_DE_PAUSA = 2; // 2 blocos de ~0,25 s em silêncio = pausa na fala
const LIMIAR_PAUSA = 0.01; // volume (RMS) abaixo disso = silêncio
const LIMIAR_VAZIO = 0.004; // trecho inteiro abaixo disso nem vai para o transcritor
const ALUCINACOES = /legendas?\s+pel[ao]|amara\.org|obrigad[oa] por assistir|inscreva-se|www\./i;
const FALANTE_VOCE = 'Você';
const FALANTE_OUTROS = 'Participantes';

// Trechos menores = texto aparece mais rápido. Na nuvem, o trecho pode ser curtinho porque é rápido.
const duracaoDosTrechos = (motor) => (motor === 'groq' ? { min: 4, max: 15 } : { min: 8, max: 20 });

let sessao = null; // tudo sobre a gravação em andamento (null = nada gravando)
let estado = { fase: 'ocioso' };

// ---------- Estado ----------

const publicar = (parcial) => {
  estado = { ...estado, ...parcial };
  adaptador.publicar(estado);
};

export const emAndamento = () => sessao !== null;

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

// ---------- Modelo Whisper local ----------

// Para a placa de vídeo usamos os repositórios "onnx-community", que têm as versões certas (encoder fp32 + decoder q4).
const modeloParaGpu = (modelo) => modelo.replace('Xenova/', 'onnx-community/');

const carregarModelo = async (config, usarGpu) => {
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

  const opcoes = usarGpu
    ? { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } }
    : { device: 'wasm' };
  const nome = usarGpu ? modeloParaGpu(config.modeloWhisper) : config.modeloWhisper;
  const transcritor = await pipeline('automatic-speech-recognition', nome, { ...opcoes, progress_callback: aoProgredir });
  publicar({ modelo: { pronto: true, pct: 100 } });
  return transcritor;
};

// Tenta GPU; se algo der errado (sem WebGPU, modelo indisponível), cai para o processador.
const carregarComFallback = async (s) => {
  try {
    return await carregarModelo(s.config, s.usandoGpu);
  } catch (erro) {
    if (!s.usandoGpu) throw erro;
    s.usandoGpu = false;
    return carregarModelo(s.config, false);
  }
};

const transcreverLocal = async (s, audio) => {
  const opcoes = { chunk_length_s: 30, return_timestamps: false, task: 'transcribe' };
  if (s.config.idioma !== 'auto') opcoes.language = s.config.idioma;
  const executar = async () => ((await (await s.modelo)(audio, opcoes)).text ?? '').trim();
  try {
    return await executar();
  } catch (erro) {
    if (!s.usandoGpu) throw erro;
    // A GPU falhou no meio do caminho: recarrega no processador e tenta o mesmo trecho de novo.
    s.usandoGpu = false;
    s.modelo = carregarModelo(s.config, false);
    await registrarAviso('A placa de vídeo falhou; voltei para o processador (mais lento).');
    return executar();
  }
};

const transcreverTexto = async (s, audio) =>
  s.config.motorTranscricao === 'groq'
    ? (await transcreverGroq(audio, TAXA_WHISPER, s.config)).trim()
    : transcreverLocal(s, audio);

// ---------- Fila de transcrição ----------

const registrarAviso = async (texto) => {
  const { reuniao } = sessao;
  if (reuniao.avisos.includes(texto)) return;
  reuniao.avisos.push(texto);
  await salvarReuniao(reuniao);
  publicar({ aviso: texto });
};

const processarTrecho = async (s, canal, audio, inicioSeg) => {
  const texto = await transcreverTexto(s, audio);
  if (!texto || (texto.length < 80 && ALUCINACOES.test(texto))) return;

  const { segmentos } = s.reuniao;
  segmentos.push({ inicioSeg: Math.round(inicioSeg), falante: canal.falante, texto });
  segmentos.sort((a, b) => a.inicioSeg - b.inicioSeg); // dois canais terminam fora de ordem
  await salvarReuniao(s.reuniao); // salva a cada trecho: se algo travar, nada se perde
  publicar({ ultimoTrecho: `${canal.falante}: ${texto}` });
};

// Os trechos dos dois canais entram na MESMA fila: o transcritor processa UM por vez.
const enfileirar = (canal, audio, inicioSeg) => {
  const s = sessao;
  if (s.config.motorTranscricao === 'assemblyai') return; // este motor transcreve tudo ao parar (veja finalizar)
  if (rms(audio) < LIMIAR_VAZIO) return; // só silêncio: o Whisper "alucinaria" texto
  if (s.config.transcreverSoNoFim) { // não gasta processador durante a chamada: guarda o trecho para depois
    s.adiados.push([canal, audio, inicioSeg]);
    return;
  }
  colocarNaFila(canal, audio, inicioSeg);
};

const colocarNaFila = (canal, audio, inicioSeg) => {
  const s = sessao;
  s.pendentes++;
  publicar({ pendentes: s.pendentes });
  s.fila = s.fila
    .then(() => processarTrecho(s, canal, audio, inicioSeg))
    .catch((erro) => registrarAviso(`Falha ao transcrever: ${erro.message ?? erro}`))
    .finally(() => {
      s.pendentes--;
      publicar({ pendentes: s.pendentes });
    });
};

// ---------- Canais (um por fonte de áudio) ----------

const criarCanal = (falante) => ({
  falante,
  blocos: [],
  total: 0,
  silenciosSeguidos: 0,
  amostrasJaCortadas: 0, // para saber em que segundo da reunião cada trecho começa
  temFala: false
});

const cortarTrecho = (canal) => {
  if (!canal.total) return;
  const audio = concatenar(canal.blocos, canal.total);
  const inicioSeg = canal.amostrasJaCortadas / TAXA_WHISPER;
  canal.amostrasJaCortadas += audio.length;
  canal.blocos = [];
  canal.total = 0;
  canal.silenciosSeguidos = 0;
  canal.temFala = false;
  enfileirar(canal, audio, inicioSeg);
};

// Chamada ~4 vezes por segundo, por canal, com um bloco de áudio novo.
const receberBloco = (canal, bloco) => {
  const s = sessao;
  if (!s || s.finalizando) return;
  const comVoz = rms(bloco) >= LIMIAR_PAUSA;

  canal.blocos.push(bloco);
  canal.total += bloco.length;

  if (!canal.temFala) {
    if (comVoz) {
      canal.temFala = true;
    } else {
      // Ainda ninguém falou neste canal: não acumulamos silêncio, só guardamos os 2 últimos blocos
      // (para não cortar o começo da primeira palavra). Isso faz o trecho começar NA fala.
      while (canal.blocos.length > 2) {
        const velho = canal.blocos.shift();
        canal.total -= velho.length;
        canal.amostrasJaCortadas += velho.length;
      }
      return;
    }
  }

  canal.silenciosSeguidos = comVoz ? 0 : canal.silenciosSeguidos + 1;
  const { min, max } = s.duracao;
  // Cortar numa pausa evita partir uma palavra ao meio; aos "max" segundos cortamos à força.
  const achouPausa = canal.silenciosSeguidos >= BLOCOS_DE_PAUSA && canal.total >= min * TAXA_WHISPER;
  if (achouPausa || canal.total >= max * TAXA_WHISPER) cortarTrecho(canal);
};

// ---------- Iniciar ----------

const liberarFluxos = (...fluxos) => fluxos.forEach((f) => f?.getTracks().forEach((t) => t.stop()));

const gravar = (fluxo, bitsPorSegundo) => {
  const pedacos = [];
  const gravador = new MediaRecorder(fluxo, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: bitsPorSegundo });
  gravador.ondataavailable = (evento) => evento.data.size && pedacos.push(evento.data);
  gravador.start(5000);
  return { gravador, pedacos };
};

const pararGravador = (gravador) =>
  new Promise((resolve) => {
    if (gravador.state === 'inactive') return resolve();
    gravador.onstop = resolve;
    gravador.stop();
  });

// Cria um "nó" que entrega o áudio bruto (ver pcm-worklet.js) e liga ao canal.
const criarCaptura = async (ctx, fonte, canal) => {
  const captura = new AudioWorkletNode(ctx, 'captura-pcm', {
    channelCount: 1,
    channelCountMode: 'explicit', // força mistura em mono
    outputChannelCount: [1]
  });
  fonte.connect(captura);
  captura.connect(ctx.destination); // saída é silêncio; só mantém o nó "ligado"
  captura.port.onmessage = (evento) => receberBloco(canal, evento.data);
};

// Contexto de áudio do circuito de captura (16 kHz, o que o Whisper entende).
// Com "semSaida", pede um contexto sem dispositivo de saída (sinkId "none"); se o navegador não souber, volta ao normal.
const criarContexto = () => {
  if (adaptador.semSaida) {
    try {
      return new AudioContext({ sampleRate: TAXA_WHISPER, sinkId: { type: 'none' } });
    } catch {
      /* sem suporte: usa o contexto comum abaixo */
    }
  }
  return new AudioContext({ sampleRate: TAXA_WHISPER });
};

export const iniciar = async ({ titulo, contexto = '', tituloGenerico = false, config, ...paramsDaPlataforma }) => {
  if (sessao) throw new Error('Já existe uma gravação em andamento.');
  if (config.motorTranscricao === 'groq' && !config.groqKey) {
    throw new Error('Falta a chave do Groq nas Configurações (ou troque para a transcrição local).');
  }
  if (config.motorTranscricao === 'assemblyai' && !config.assemblyKey) {
    throw new Error('Falta a chave do AssemblyAI nas Configurações (ou troque o motor de transcrição).');
  }

  // 1) e 2) Áudio dos outros participantes + seu microfone (cada plataforma sabe como captar).
  const { fluxoAba, fluxoMic, avisos } = await adaptador.abrirFluxos({ ...paramsDaPlataforma, config });

  try {
    // 3) Monta o "circuito" de áudio.
    const ctx = criarContexto();
    await ctx.resume();
    await ctx.audioWorklet.addModule('pcm-worklet.js');

    const canalAba = criarCanal(FALANTE_OUTROS);
    const canalMic = criarCanal(FALANTE_VOCE);
    const fonteAba = ctx.createMediaStreamSource(fluxoAba);
    const destinoMistura = ctx.createMediaStreamDestination(); // aba + microfone juntos (arquivo de áudio)
    fonteAba.connect(destinoMistura);
    await criarCaptura(ctx, fonteAba, canalAba);

    if (fluxoMic) {
      const fonteMic = ctx.createMediaStreamSource(fluxoMic);
      fonteMic.connect(destinoMistura);
      await criarCaptura(ctx, fonteMic, canalMic);
    }

    // Ao capturar uma aba, o navegador a deixa MUDA. Reproduzimos o som para você continuar ouvindo.
    // (No app de bandeja a captura é do computador inteiro e NÃO muda o som: tocar de volta criaria eco.)
    const ctxSaida = adaptador.tocarDeVolta !== false ? new AudioContext() : null; // sem eco e sem abrir saída à toa
    ctxSaida?.createMediaStreamSource(fluxoAba).connect(ctxSaida.destination);

    // 4) Grava os arquivos de áudio em paralelo.
    const gravacaoMistura = gravar(destinoMistura.stream, 32000);
    let gravacaoAba = null; // só a aba: é o que o Gemini e o AssemblyAI usam para separar os participantes
    let gravacaoMic = null; // só o microfone: o AssemblyAI o transcreve à parte (tudo é "Você")
    const usaAssemblyAI = config.motorTranscricao === 'assemblyai';
    if ((config.identificarFalantes && config.geminiKey) || usaAssemblyAI) {
      const destinoAba = ctx.createMediaStreamDestination();
      fonteAba.connect(destinoAba);
      gravacaoAba = gravar(destinoAba.stream, 24000);
    }
    if (usaAssemblyAI && fluxoMic) {
      const destinoMic = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(fluxoMic).connect(destinoMic);
      gravacaoMic = gravar(destinoMic.stream, 24000);
    }

    const id = crypto.randomUUID();
    const inicio = Date.now();
    sessao = {
      id, inicio, config, contexto, tituloGenerico, ctx, ctxSaida, gravacaoMistura, gravacaoAba, gravacaoMic,
      fluxos: [fluxoAba, fluxoMic],
      duracao: duracaoDosTrechos(config.motorTranscricao),
      canais: [canalAba, canalMic],
      fila: Promise.resolve(), pendentes: 0, adiados: [], finalizando: false,
      usandoGpu: config.motorTranscricao === 'local' && config.usarGpu && !!navigator.gpu,
      modelo: null,
      reuniao: {
        id, titulo: titulo || 'Reunião sem título', inicio, duracaoSeg: 0, contexto,
        status: 'gravando', segmentos: [], resumo: null, temAudio: false, avisos
      }
    };
    await salvarReuniao(sessao.reuniao);

    // Se você fechar a aba gravada, o áudio acaba: finalizamos sozinhos.
    fluxoAba.getAudioTracks()[0].addEventListener('ended', () => finalizar());

    // Na nuvem não há modelo para baixar. No modo local, começa a carregar o Whisper já agora.
    if (config.motorTranscricao === 'local' && !config.transcreverSoNoFim) {
      sessao.modelo = carregarComFallback(sessao);
      sessao.modelo.catch((erro) => registrarAviso(`Não consegui carregar o Whisper: ${erro.message ?? erro}`));
    }

    publicar({
      fase: 'gravando', inicio, ultimoTrecho: '', pendentes: 0,
      aviso: avisos[0] ?? (usaAssemblyAI ? 'AssemblyAI: o texto aparece quando você parar a gravação.' : null),
      modelo: { pronto: config.motorTranscricao !== 'local', pct: 0 }
    });
  } catch (erro) {
    liberarFluxos(fluxoAba, fluxoMic);
    sessao = null;
    throw erro;
  }
};

// ---------- Parar e finalizar ----------

// Motor AssemblyAI: envia o áudio dos participantes (com separação de falantes) e o do microfone ("Você").
const transcreverNoAssemblyAI = async (s) => {
  const { reuniao, config } = s;
  const fontes = [
    { gravacao: s.gravacaoAba, rotulo: null, nome: 'dos participantes' },
    { gravacao: s.gravacaoMic, rotulo: FALANTE_VOCE, nome: 'do seu microfone' }
  ].filter((f) => f.gravacao?.pedacos.length);

  const resultados = await Promise.allSettled(fontes.map(async (fonte) => {
    publicar({ etapa: `Transcrevendo o áudio ${fonte.nome} (AssemblyAI)...` });
    const audio = new Blob(fonte.gravacao.pedacos, { type: 'audio/webm' });
    return respostaParaSegmentos(await transcreverAssemblyAI(audio, config), fonte.rotulo);
  }));

  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') return reuniao.segmentos.push(...resultado.value);
    // Um áudio sem nenhuma fala (ex.: microfone mudo) não é erro de verdade.
    if (/spoken audio|no speech/i.test(String(resultado.reason?.message))) return;
    reuniao.avisos.push(`Falha ao transcrever o áudio ${fontes[i].nome}: ${resultado.reason?.message ?? resultado.reason}`);
  });
  reuniao.segmentos.sort((a, b) => a.inicioSeg - b.inicioSeg);
};

// Troca a transcrição das vozes dos outros (rótulo genérico) pela versão do Gemini, com um nome por pessoa.
const separarParticipantes = async (s) => {
  const { reuniao, config } = s;
  if (config.motorTranscricao === 'assemblyai') return; // o AssemblyAI já separou os falantes
  if (!s.gravacaoAba?.pedacos.length) return;
  publicar({ etapa: 'Identificando quem falou (Gemini)...' });
  try {
    const audioAba = new Blob(s.gravacaoAba.pedacos, { type: 'audio/webm' });
    const dosParticipantes = await identificarFalantes(audioAba, config);
    if (!dosParticipantes.length) throw new Error('nenhuma fala encontrada');
    const suaVoz = reuniao.segmentos.filter((seg) => seg.falante === FALANTE_VOCE);
    reuniao.segmentos = [...suaVoz, ...dosParticipantes].sort((a, b) => a.inicioSeg - b.inicioSeg);
  } catch (erro) {
    reuniao.avisos.push(`Não consegui separar os participantes (${erro.message}). Mantive "${FALANTE_OUTROS}".`);
  }
};

export const finalizar = async () => {
  const s = sessao;
  if (!s || s.finalizando) return;
  s.finalizando = true;
  publicar({ fase: 'finalizando', etapa: 'Terminando a transcrição...' });

  try {
    s.canais.forEach(cortarTrecho); // o que sobrou nos buffers vai para a fila
    if (s.adiados.length) { // transcrição adiada: agora que a chamada acabou, pode usar o processador à vontade
      publicar({ etapa: 'Transcrevendo a reunião...' });
      if (s.config.motorTranscricao === 'local') {
        s.modelo = carregarComFallback(s);
        s.modelo.catch((erro) => registrarAviso(`Não consegui carregar o Whisper: ${erro.message ?? erro}`));
      }
      s.adiados.forEach(([canal, audio, inicioSeg]) => colocarNaFila(canal, audio, inicioSeg));
    }

    await Promise.all([
      pararGravador(s.gravacaoMistura.gravador),
      s.gravacaoAba && pararGravador(s.gravacaoAba.gravador),
      s.gravacaoMic && pararGravador(s.gravacaoMic.gravador)
    ]);
    liberarFluxos(...s.fluxos);
    await Promise.allSettled([s.ctx.close(), s.ctxSaida?.close()]);

    await s.fila; // espera o transcritor terminar tudo que está na fila
    if (s.config.motorTranscricao === 'assemblyai') await transcreverNoAssemblyAI(s);

    const { reuniao, config } = s;
    reuniao.duracaoSeg = Math.round((Date.now() - s.inicio) / 1000);
    reuniao.status = 'processando';
    await salvarReuniao(reuniao);

    await separarParticipantes(s);

    const transcricao = textoTranscricao(reuniao.segmentos);
    if (transcricao.trim()) {
      publicar({ etapa: 'Gerando o resumo...' });
      try {
        reuniao.resumo = await gerarResumo(transcricao, config, `${reuniao.titulo}. ${s.contexto}`.trim());
      } catch (erro) {
        reuniao.avisos.push(`O resumo com "${config.provedorResumo}" falhou (${erro.message}). Usei o resumo básico.`);
        reuniao.resumo = await gerarResumo(transcricao, { ...config, provedorResumo: 'basico' }, `${reuniao.titulo}. ${s.contexto}`.trim());
      }
    } else {
      reuniao.avisos.push('Nenhuma fala foi reconhecida na gravação.');
    }

    reuniao.categoria = reuniao.resumo?.categoria ?? null; // tipo escolhido pela IA (Entrevista, Aula...)
    if (s.tituloGenerico && reuniao.resumo?.titulo) reuniao.titulo = reuniao.resumo.titulo; // a IA dá nome a reuniões sem título

    if (config.notionAuto && config.notionToken) {
      publicar({ etapa: 'Enviando ao Notion...' });
      try {
        reuniao.notion = await enviarAoNotion(reuniao, config);
      } catch (erro) {
        reuniao.avisos.push(`Não consegui enviar ao Notion (${erro.message}). Você pode tentar de novo na página da reunião.`);
      }
    }

    if (config.salvarAudio && s.gravacaoMistura.pedacos.length) {
      await salvarAudio(s.id, new Blob(s.gravacaoMistura.pedacos, { type: 'audio/webm' }));
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
  adaptador.concluir({ id: s.id, titulo: s.reuniao.titulo, categoria: s.reuniao.categoria ?? null, notion: s.reuniao.notion ?? null });
};
