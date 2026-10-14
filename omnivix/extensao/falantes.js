// Identifica QUEM falou, usando o Gemini (aceita áudio). Roda uma vez, no fim da reunião,
// só sobre o áudio da ABA (as vozes dos outros participantes). O microfone já é "Você".

import { chamarGemini, lerJson } from './gemini.js';

// A API aceita pedidos de até 20 MB; em base64 o arquivo cresce ~33%, então o áudio pode ter ~14 MB.
const LIMITE_BYTES = 14 * 1024 * 1024;

const PROMPT = `Transcreva este áudio de reunião em português do Brasil, separando por falante.
Dê um rótulo a cada voz diferente: "Pessoa 1", "Pessoa 2"... Use SEMPRE o mesmo rótulo para a mesma voz do início ao fim.
Se alguém for chamado pelo nome durante a conversa, use esse nome no lugar do rótulo.
Não invente falas. Ignore ruídos e silêncio.
Responda SOMENTE com um JSON: [{"inicio":"mm:ss","falante":"Pessoa 1","texto":"..."}]`;

const blobParaBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });

// "01:05" -> 65, "1:02:03" -> 3723, 65 -> 65
export const paraSegundos = (valor) => {
  if (typeof valor === 'number') return valor;
  const partes = String(valor).split(':').map(Number);
  if (partes.some(Number.isNaN)) return 0;
  return partes.reduce((total, parte) => total * 60 + parte, 0);
};

export const normalizarSegmentos = (bruto) => {
  const lista = Array.isArray(bruto) ? bruto : (bruto?.segmentos ?? []);
  return lista
    .filter((item) => item?.texto && String(item.texto).trim())
    .map((item) => ({
      inicioSeg: Math.round(paraSegundos(item.inicio)),
      falante: String(item.falante ?? 'Pessoa 1').trim() || 'Pessoa 1',
      texto: String(item.texto).trim()
    }));
};

export const identificarFalantes = async (audioBlob, config) => {
  if (audioBlob.size > LIMITE_BYTES) {
    throw new Error('o áudio é grande demais para identificar falantes (limite ~14 MB, cerca de 80 min)');
  }
  const dados = await blobParaBase64(audioBlob);
  const texto = await chamarGemini(
    [{ inline_data: { mime_type: 'audio/webm', data: dados } }, { text: PROMPT }],
    config
  );
  return normalizarSegmentos(lerJson(texto));
};
