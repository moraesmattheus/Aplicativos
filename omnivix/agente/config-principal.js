// Configurações do app, guardadas num arquivo JSON na pasta de dados do usuário.
// As chaves secretas (Groq, Gemini, Notion) são criptografadas com o cofre do sistema (no Windows, o DPAPI),
// quando disponível: só o seu usuário do Windows consegue ler.

const { app, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const CONFIG_PADRAO = {
  // ---- Gravação automática ----
  autoDetectarChamadas: true, // começa quando um programa passa a usar o microfone
  segundosParaIniciar: 8, // microfone em uso por tanto tempo = é uma chamada
  segundosParaParar: 25, // microfone livre por tanto tempo = a chamada acabou
  ignorarApps: ['speechruntime.exe', 'searchhost.exe', 'searchapp.exe', 'audiodg.exe'], // não são chamadas
  processosDeReuniao: ['cpthost.exe'], // programas abertos só durante reuniões (Zoom): valem mesmo com o microfone mudo
  avisarAoIniciar: true, // notificação "Gravando..." (para você e para não esquecer de avisar os participantes)
  iniciarComWindows: true,
  atalho: 'Control+Alt+R', // liga/desliga a gravação manualmente

  // ---- Agenda (aulas e entrevistas presenciais) ----
  agendaUrl: '', // endereço secreto .ics do Google Agenda
  agendaPalavras: 'aula, entrevista, reunião, reuniao, meeting, call',
  agendaTodos: false, // true = grava qualquer evento do calendário

  // ---- Transcrição, resumo e Notion (mesmos da extensão) ----
  idioma: 'portuguese',
  modeloWhisper: 'Xenova/whisper-base',
  motorTranscricao: 'local',
  groqKey: '',
  groqModelo: 'whisper-large-v3-turbo',
  usarGpu: true,
  gravarMicrofone: true, // false = não abre o microfone (só o áudio do computador)
  // Dispositivos só para este app (não mudam o padrão do Windows). Vazio = padrão.
  microfoneId: '', microfoneNome: '', // qual microfone grava a SUA voz
  entradaOutrosId: '', entradaOutrosNome: '', // vazio = áudio do computador; senão, uma ENTRADA (ex.: Virtual Audio Cable)
  transcreverSoNoFim: true, // não pesa no computador durante a chamada; transcreve quando ela acaba
  identificarFalantes: false,
  salvarAudio: true,
  provedorResumo: 'basico',
  geminiKey: '',
  geminiModelo: 'gemini-2.5-flash',
  ollamaUrl: 'http://localhost:11434',
  ollamaModelo: 'llama3.2',
  notionToken: '',
  notionAuto: false,
  destinoPadrao: '',
  destinos: [
    { nome: 'Entrevista', descricao: 'entrevista, vaga, candidato, recrutador, currículo, empresa, processo seletivo', link: '' },
    { nome: 'Aula da faculdade', descricao: 'aula, professor, matéria, disciplina, prova, trabalho, faculdade, engenharia de software', link: '' },
    { nome: 'Reunião de trabalho', descricao: 'reunião, projeto, equipe, cliente, prazo, entrega, sprint', link: '' }
  ]
};

const SEGREDOS = ['groqKey', 'geminiKey', 'notionToken'];
const PREFIXO = 'enc:';

const arquivoDeConfig = () => path.join(app.getPath('userData'), 'config.json');

const proteger = (valor) =>
  valor && safeStorage.isEncryptionAvailable() ? PREFIXO + safeStorage.encryptString(valor).toString('base64') : valor;

const revelar = (valor) => {
  if (typeof valor !== 'string' || !valor.startsWith(PREFIXO)) return valor;
  try {
    return safeStorage.decryptString(Buffer.from(valor.slice(PREFIXO.length), 'base64'));
  } catch {
    return ''; // veio de outro usuário/computador: não dá para ler
  }
};

const existe = async () => fs.access(arquivoDeConfig()).then(() => true, () => false);

const carregarConfig = async () => {
  let salvo = {};
  try {
    salvo = JSON.parse(await fs.readFile(arquivoDeConfig(), 'utf8'));
  } catch {
    /* primeira execução: usa os padrões */
  }
  for (const chave of SEGREDOS) if (salvo[chave]) salvo[chave] = revelar(salvo[chave]);
  return { ...CONFIG_PADRAO, ...salvo };
};

const salvarConfig = async (config) => {
  const paraDisco = { ...config };
  for (const chave of SEGREDOS) paraDisco[chave] = proteger(paraDisco[chave]);
  await fs.mkdir(path.dirname(arquivoDeConfig()), { recursive: true });
  await fs.writeFile(arquivoDeConfig(), JSON.stringify(paraDisco, null, 2));
};

module.exports = { CONFIG_PADRAO, carregarConfig, salvarConfig, existe };
