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

  // Avisa (ícone + notificação) quando você entra numa reunião do Meet, Zoom, Teams etc.
  avisarReuniao: true,

  // Quem transcreve: 'local' (Whisper no seu PC, privado), 'groq' (nuvem, muito rápido) ou 'assemblyai' (nuvem, separa os falantes).
  motorTranscricao: 'local',
  groqKey: '',
  groqModelo: 'whisper-large-v3-turbo',

  // AssemblyAI (nuvem): transcreve ao parar e já separa os falantes. Veja créditos grátis no painel deles.
  assemblyKey: '',
  assemblyModelo: 'universal-3-pro',

  // Usa a placa de vídeo (WebGPU) para transcrever mais rápido no modo local. Se falhar, volta para o processador.
  usarGpu: true,

  // No fim, o Gemini separa as vozes dos participantes ("Pessoa 1", "Pessoa 2"...). Envia o ÁUDIO da aba ao Google.
  identificarFalantes: false,

  // false = não abre o seu microfone (só grava o áudio da aba). Útil em aulas em que você fica mudo e para
  // não mexer no áudio do fone Bluetooth, que muda de qualidade quando um programa abre o microfone.
  gravarMicrofone: true,

  // true = só transcreve depois que a reunião acabar (não pesa no computador durante a chamada).
  transcreverSoNoFim: false,

  // Guarda o áudio da reunião para você ouvir/baixar depois.
  salvarAudio: true,

  // Quem escreve o resumo: 'basico' (sem IA, 100% offline), 'gemini' (chave grátis) ou 'ollama' (IA local).
  provedorResumo: 'basico',
  geminiKey: '',
  geminiModelo: 'gemini-2.5-flash',
  ollamaUrl: 'http://localhost:11434',
  ollamaModelo: 'llama3.2',

  // Notion: token da integração, envio automático e os destinos por TIPO de reunião.
  notionToken: '',
  notionAuto: false,
  destinoPadrao: '', // para onde vai quando nenhum tipo combina
  destinos: [
    { nome: 'Entrevista', descricao: 'entrevista, vaga, candidato, recrutador, currículo, empresa, processo seletivo', link: '' },
    { nome: 'Aula da faculdade', descricao: 'aula, professor, matéria, disciplina, prova, trabalho, faculdade, engenharia de software', link: '' },
    { nome: 'Reunião de trabalho', descricao: 'reunião, projeto, equipe, cliente, prazo, entrega, sprint', link: '' }
  ]
};

export const carregarConfig = async () => {
  const { config } = await chrome.storage.local.get('config');
  return { ...CONFIG_PADRAO, ...config };
};

export const salvarConfig = (config) => chrome.storage.local.set({ config });
