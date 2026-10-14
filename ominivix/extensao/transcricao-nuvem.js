// Transcrição pela nuvem do Groq (Whisper large-v3-turbo): muito mais rápida que rodar no PC.
// O plano grátis não pede cartão, mas tem limite diário. O áudio do trecho é enviado ao Groq.

const CODIGOS_IDIOMA = { portuguese: 'pt', english: 'en', spanish: 'es' };

// O Groq espera um arquivo de áudio. Montamos um .wav (cabeçalho de 44 bytes + amostras de 16 bits).
export const float32ParaWav = (amostras, taxa) => {
  const buffer = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(buffer);
  const escrever = (posicao, texto) => [...texto].forEach((c, i) => v.setUint8(posicao + i, c.charCodeAt(0)));
  escrever(0, 'RIFF');
  v.setUint32(4, 36 + amostras.length * 2, true);
  escrever(8, 'WAVE');
  escrever(12, 'fmt ');
  v.setUint32(16, 16, true); // tamanho do bloco "fmt"
  v.setUint16(20, 1, true); // 1 = PCM
  v.setUint16(22, 1, true); // 1 canal (mono)
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por amostra
  v.setUint16(34, 16, true); // bits por amostra
  escrever(36, 'data');
  v.setUint32(40, amostras.length * 2, true);
  amostras.forEach((a, i) => {
    const limitada = Math.max(-1, Math.min(1, a));
    v.setInt16(44 + i * 2, limitada < 0 ? limitada * 0x8000 : limitada * 0x7fff, true);
  });
  return buffer;
};

const esperar = (segundos) => new Promise((resolve) => setTimeout(resolve, segundos * 1000));

export const transcreverGroq = async (audio, taxa, config) => {
  const formulario = new FormData();
  formulario.append('file', new Blob([float32ParaWav(audio, taxa)], { type: 'audio/wav' }), 'trecho.wav');
  formulario.append('model', config.groqModelo);
  formulario.append('response_format', 'json');
  formulario.append('temperature', '0');
  const idioma = CODIGOS_IDIOMA[config.idioma];
  if (idioma) formulario.append('language', idioma);

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const resposta = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.groqKey}` },
      body: formulario
    });
    if (resposta.status === 429) {
      // "Muitos pedidos": espera o tempo sugerido pelo servidor e tenta de novo.
      await esperar(Math.min(Number(resposta.headers.get('retry-after')) || 5 * tentativa, 30));
      continue;
    }
    if (!resposta.ok) throw new Error(`Groq respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 160)}`);
    return (await resposta.json()).text ?? '';
  }
  throw new Error('limite do plano grátis do Groq atingido; tente mais tarde ou use a transcrição local');
};
