// Configurações do usuário, guardadas em chrome.storage.local.
// Este arquivo é importado por: background.js, popup.js, opcoes.js e reunioes.js.

export const CONFIG_PADRAO = {
  // Modelo de transcrição (Whisper). Maior = mais preciso, porém mais lento e mais pesado.
  //   whisper-tiny  ≈ 40 MB  (rápido, erra bastante)
  //   whisper-base  ≈ 80 MB  (equilibrado)  <- padrão
  //   whisper-small ≈ 250 MB (melhor para português, exige PC bom)
  modeloWhisper: 'Xenova/whisper-base',

  // Idioma falado nas reuniões. 'auto' deixa o Whisper detectar sozinho.
  idioma: 'portuguese',

  // Quem transcreve: 'local' (Whisper no seu PC, privado) ou 'groq' (nuvem, MUITO mais rápido, chave grátis).
  motorTranscricao: 'local',
  groqKey: '',
  groqModelo: 'whisper-large-v3-turbo',

  // Usa a placa de vídeo (WebGPU) para transcrever mais rápido no modo local. Se falhar, volta para o processador.
  usarGpu: true,

  // No fim, o Gemini separa as vozes dos participantes ("Pessoa 1", "Pessoa 2"...). Envia o ÁUDIO da aba ao Google.
  identificarFalantes: false,

  // Guarda o áudio da reunião para você ouvir/baixar depois.
  salvarAudio: true,

  // Quem escreve o resumo: 'basico' (sem IA, 100% offline), 'gemini' (chave grátis) ou 'ollama' (IA local).
  provedorResumo: 'basico',
  geminiKey: '',
  geminiModelo: 'gemini-2.5-flash',
  ollamaUrl: 'http://localhost:11434',
  ollamaModelo: 'llama3.2'
};

export const carregarConfig = async () => {
  const { config } = await chrome.storage.local.get('config');
  return { ...CONFIG_PADRAO, ...config };
};

export const salvarConfig = (config) => chrome.storage.local.set({ config });
