// Transcrição pela nuvem do AssemblyAI. Diferente do Groq (que recebe trechos curtos durante a reunião),
// aqui o áudio INTEIRO é enviado ao parar: o AssemblyAI já devolve cada fala com o número do falante,
// então "Pessoa 1", "Pessoa 2"... saem prontos, sem precisar do Gemini para separar as vozes.
// Este arquivo não usa nenhuma API de extensão (só fetch), por isso também serve ao app de bandeja.

const BASE = 'https://api.assemblyai.com/v2';
const CODIGOS_IDIOMA = { portuguese: 'pt', english: 'en', spanish: 'es' };
const LIMITE_ESPERA_MS = 45 * 60 * 1000; // desiste depois de 45 min esperando o resultado

const esperar = (segundos) => new Promise((resolve) => setTimeout(resolve, segundos * 1000));

// Uma chamada à API. A chave vai no cabeçalho "authorization" (nunca no endereço).
const chamar = async (caminho, chave, opcoes = {}) => {
  const resposta = await fetch(`${BASE}${caminho}`, { ...opcoes, headers: { authorization: chave, ...opcoes.headers } });
  if (!resposta.ok) throw new Error(`AssemblyAI respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  return resposta.json();
};

// Envia o áudio (Blob), pede a transcrição com separação de falantes e espera ficar pronta.
export const transcreverAssemblyAI = async (audio, config, pausaSeg = 3) => {
  const chave = config.assemblyKey;
  if (!chave) throw new Error('falta a chave do AssemblyAI nas Configurações');

  // 1) Envio do arquivo: devolve um endereço temporário que só o AssemblyAI entende.
  const { upload_url } = await chamar('/upload', chave, {
    method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: audio
  });

  // 2) Pedido de transcrição. O modelo escolhido vai primeiro; o universal-2 é o plano B.
  const pedido = {
    audio_url: upload_url,
    speech_models: [...new Set([config.assemblyModelo || 'universal-3-pro', 'universal-2'])],
    speaker_labels: true
  };
  const idioma = CODIGOS_IDIOMA[config.idioma];
  if (idioma) pedido.language_code = idioma;
  else pedido.language_detection = true; // "detectar automaticamente"
  const { id } = await chamar('/transcript', chave, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pedido)
  });

  // 3) Espera: pergunta a cada poucos segundos até ficar pronta (ou dar erro).
  const limite = Date.now() + LIMITE_ESPERA_MS;
  while (Date.now() < limite) {
    await esperar(pausaSeg);
    const resposta = await chamar(`/transcript/${id}`, chave);
    if (resposta.status === 'completed') return resposta;
    if (resposta.status === 'error') throw new Error(resposta.error ?? 'erro desconhecido');
  }
  throw new Error('demorou demais para ficar pronta');
};

// Converte a resposta no formato da reunião: [{ inicioSeg, falante, texto }].
// rotuloFixo: usado no áudio do microfone (todas as falas são "Você"). Sem ele, a letra do falante
// ("A", "B"...) vira "Pessoa 1", "Pessoa 2"... na ordem em que cada voz aparece.
export const respostaParaSegmentos = (resposta, rotuloFixo = null) => {
  const nomes = new Map();
  const falas = resposta?.utterances?.length
    ? resposta.utterances
    : resposta?.text ? [{ start: 0, speaker: 'A', text: resposta.text }] : [];
  return falas
    .filter((fala) => fala.text?.trim())
    .map((fala) => {
      let falante = rotuloFixo;
      if (!falante) {
        if (!nomes.has(fala.speaker)) nomes.set(fala.speaker, `Pessoa ${nomes.size + 1}`);
        falante = nomes.get(fala.speaker);
      }
      return { inicioSeg: Math.round((fala.start ?? 0) / 1000), falante, texto: fala.text.trim() };
    });
};
