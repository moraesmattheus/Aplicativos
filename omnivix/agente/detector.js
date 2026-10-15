// Descobre se há uma CHAMADA em andamento, olhando se algum programa está usando o microfone.
// (Reunião online = algum app, como o navegador, o Zoom ou o Teams, está com o microfone aberto.)
//
// No Windows, o sistema registra isso no Registro: para cada app existe LastUsedTimeStart e
// LastUsedTimeStop. Se Stop é 0, o app ainda está usando o microfone. É um registro que o próprio
// Windows usa para mostrar o ícone de microfone na barra de tarefas.

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');

const executar = promisify(execFile);
const CHAVE_MICROFONE =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone';

const lerValor = (linhas, nome) => {
  const linha = linhas.find((l) => l.startsWith(`${nome} `) || l.startsWith(`${nome}\t`));
  const hexa = linha?.match(/0x[0-9a-fA-F]+/)?.[0];
  return hexa ? BigInt(hexa) : null;
};

// Transforma a saída do comando "reg query ... /s" em [{ nome, emUso }].
const parsearConsentStore = (texto) => {
  const aplicativos = [];
  for (const bloco of texto.split(/\r?\n\s*\r?\n/)) {
    const linhas = bloco.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const cabecalho = linhas.find((l) => l.startsWith('HKEY_'));
    const inicio = lerValor(linhas, 'LastUsedTimeStart');
    const fim = lerValor(linhas, 'LastUsedTimeStop');
    if (!cabecalho || inicio === null || fim === null) continue;
    // Programas comuns aparecem como "C:#Program Files#Google#Chrome#Application#chrome.exe"
    const nome = cabecalho.split('\\').at(-1).split('#').at(-1).toLowerCase();
    aplicativos.push({ nome, emUso: inicio !== 0n && fim === 0n });
  }
  return aplicativos;
};

const processosRodando = async () => {
  const { stdout } = await executar('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return new Set([...stdout.matchAll(/^"([^"]+)"/gm)].map((m) => m[1].toLowerCase()));
};

const lerNoWindows = async () => {
  const { stdout } = await executar('reg', ['query', CHAVE_MICROFONE, '/s'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const emUso = parsearConsentStore(stdout).filter((a) => a.emUso);
  if (!emUso.length) return [];
  // O Windows às vezes deixa "em uso" preso quando um app trava: confirma que o programa ainda está aberto.
  const rodando = await processosRodando();
  return emUso.filter((a) => !a.nome.endsWith('.exe') || rodando.has(a.nome)).map((a) => a.nome);
};

// Programas que só ficam abertos DURANTE uma reunião. Servem de sinal mesmo com o microfone mudo
// (o Windows só marca o microfone "em uso" quando o programa realmente o abre, e muitos não abrem
// enquanto você está mutado). Ex.: o Zoom mantém o cptHost.exe aberto enquanto você está numa reunião.
// Devolve só os da lista que estão rodando agora.
const processosDeReuniaoAtivos = async (lista = []) => {
  if (!lista.length) return [];
  if (process.env.AGENTE_SIMULAR_PROCESSOS) {
    // Modo de simulação para testes: um arquivo JSON com os processos rodando, ex.: ["cpthost.exe"]
    try {
      const simulados = JSON.parse(fs.readFileSync(process.env.AGENTE_SIMULAR_PROCESSOS, 'utf8'));
      return lista.filter((nome) => simulados.includes(nome));
    } catch {
      return [];
    }
  }
  if (process.platform !== 'win32') return [];
  const rodando = await processosRodando();
  return lista.filter((nome) => rodando.has(nome));
};

// Linux (útil para desenvolver): programas com gravação ativa no PulseAudio/PipeWire.
const lerNoLinux = async () => {
  const { stdout } = await executar('pactl', ['list', 'source-outputs']).catch(() => ({ stdout: '' }));
  return [...stdout.matchAll(/application\.process\.binary = "([^"]+)"/g)].map((m) => m[1].toLowerCase());
};

// Devolve os nomes dos programas usando o microfone agora. (macOS: ainda sem detecção automática.)
const lerAplicativosEmUso = async () => {
  if (process.env.AGENTE_SIMULAR_MICROFONE) {
    // Modo de simulação para testes: um arquivo JSON com a lista, ex.: ["chrome.exe"]
    try {
      return JSON.parse(fs.readFileSync(process.env.AGENTE_SIMULAR_MICROFONE, 'utf8'));
    } catch {
      return [];
    }
  }
  if (process.platform === 'win32') return lerNoWindows();
  if (process.platform === 'linux') return lerNoLinux();
  return [];
};

// Transforma "microfone em uso agora" em dois eventos estáveis: "chamada começou" e "chamada acabou".
// Os tempos de espera evitam falsos alarmes (um "alô" rápido) e cortes no meio (alguém mutou).
const criarDetector = ({ lerAplicativos, obterConfig, aoIniciar, aoParar, intervaloMs = 3000, agora = () => Date.now() }) => {
  let ativo = false;
  let emUsoDesde = null;
  let livreDesde = null;
  let temporizador = null;
  let iniciando = false; // true enquanto um pedido de início está em andamento (evita pedir duas vezes)

  const verificar = async () => {
    const config = await obterConfig();
    if (!config.autoDetectarChamadas) return;
    let apps;
    try {
      apps = (await lerAplicativos()).filter((nome) => !config.ignorarApps.includes(nome));
    } catch {
      return; // não deu para ler agora: tenta de novo no próximo ciclo
    }
    const t = agora();
    if (apps.length) {
      livreDesde = null;
      emUsoDesde ??= t;
      if (!ativo && !iniciando && t - emUsoDesde >= config.segundosParaIniciar * 1000) {
        // Só consideramos "em chamada" se a gravação REALMENTE começou. Se o app recusar (ex.: ainda terminando a
        // reunião anterior) ou falhar, tentamos de novo no próximo ciclo, em vez de desistir para sempre.
        iniciando = true;
        try {
          ativo = (await aoIniciar(apps)) !== false; // aoIniciar que não devolve nada conta como "começou"
        } catch {
          ativo = false;
        } finally {
          iniciando = false;
        }
      }
    } else {
      emUsoDesde = null;
      livreDesde ??= t;
      if (ativo && t - livreDesde >= config.segundosParaParar * 1000) {
        ativo = false;
        aoParar();
      }
    }
  };

  return {
    verificar,
    iniciar: () => (temporizador ??= setInterval(verificar, intervaloMs)),
    parar: () => {
      clearInterval(temporizador);
      temporizador = null;
    },
    get ativo() {
      return ativo;
    }
  };
};

module.exports = { parsearConsentStore, lerAplicativosEmUso, processosDeReuniaoAtivos, criarDetector };
