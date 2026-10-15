// PROCESSO PRINCIPAL do Omnivix (app de bandeja): fica na bandeja do Windows, sem janela, e decide QUANDO gravar.
//
//   [detector.js]  um programa usou o microfone por alguns segundos ─┐
//   [agenda.js]    chegou a hora de uma aula/entrevista da agenda ───┼─► iniciarGravacao()
//   [atalho]       Ctrl+Alt+R ───────────────────────────────────────┘          │
//                                                                               ▼
//                          janela invisível (app/gravador.js) captura o áudio do computador + microfone,
//                          transcreve, separa os falantes, resume e envia ao Notion (app/gravacao.js)

const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, ipcMain, protocol, session, desktopCapturer, nativeImage, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { carregarConfig, salvarConfig, existe, arquivoDeConfig } = require('./config-principal');
const { criarDetector, lerAplicativosEmUso, processosDeReuniaoAtivos } = require('./detector');
const { criarAgenda } = require('./agenda');

// Pasta de dados alternativa (útil para testes ou para um "modo portátil").
if (process.env.AGENTE_DADOS) app.setPath('userData', process.env.AGENTE_DADOS);

const PASTA_APP = path.join(__dirname, 'app');
const PASTA_VENDOR = path.join(__dirname, 'node_modules', '@huggingface', 'transformers', 'dist'); // motor do Whisper (arquivos .wasm)
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.json': 'application/json' };

// As páginas do app são servidas em app://local/ (e não file://) para o navegador embutido tratar como
// um site "seguro": isso libera o banco de dados (IndexedDB), o cache dos modelos e várias threads.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

if (!app.requestSingleInstanceLock()) app.quit(); // só uma cópia do agente por vez

let estado = { fase: 'ocioso', origem: null }; // fase: ocioso | iniciando | gravando | finalizando
let bandeja = null;
let janelaGravador = null;
const janelas = {};
let detector = null;
let agenda = null;

// ---------- Utilidades ----------

const avisar = (titulo, texto, aoClicar) => {
  if (!Notification.isSupported()) return;
  const notificacao = new Notification({ title: titulo, body: texto, silent: false });
  if (aoClicar) notificacao.on('click', aoClicar);
  notificacao.show();
};

const dataCurta = () => {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

const icone = (nome) => nativeImage.createFromPath(path.join(__dirname, 'assets', nome));

// ---------- Janelas ----------

const abrirJanela = (nome, hash = '') => {
  if (janelas[nome] && !janelas[nome].isDestroyed()) {
    janelas[nome].loadURL(`app://local/${nome}.html${hash ? `#${hash}` : ''}`);
    janelas[nome].show();
    janelas[nome].focus();
    return;
  }
  const janela = new BrowserWindow({
    width: nome === 'opcoes' ? 760 : 1100, height: 820, title: 'Omnivix', icon: icone('icone.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  janela.loadURL(`app://local/${nome}.html${hash ? `#${hash}` : ''}`);
  janelas[nome] = janela;
};

const criarJanelaGravador = () => {
  janelaGravador = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false // sem isso o Windows "adormece" a janela invisível e a transcrição trava
    }
  });
  janelaGravador.loadURL('app://local/gravador.html');
};

// ---------- Gravação ----------

const rodarNoGravador = (codigo) => janelaGravador.webContents.executeJavaScript(codigo, true); // true = "como se fosse um clique"

const iniciarGravacao = async ({ origem, titulo, contexto = '', tituloGenerico = false }) => {
  if (estado.fase !== 'ocioso') return false;
  estado = { fase: 'iniciando', origem };
  atualizarBandeja();
  const config = await carregarConfig();
  try {
    await rodarNoGravador(`window.agenteIniciar(${JSON.stringify({ titulo, contexto, tituloGenerico, config })})`);
  } catch (erro) {
    console.error('Falha ao iniciar a gravação:', erro);
    estado = { fase: 'ocioso', origem: null };
    atualizarBandeja();
    avisar('Não consegui gravar', String(erro.message ?? erro).replace(/^Error invoking.*?Error: /, ''));
    return false;
  }
  if (config.avisarAoIniciar) {
    avisar('Gravando reunião', `${titulo}. Avise os participantes de que está gravando. Clique para ver o painel.`, () => abrirJanela('reunioes'));
  }
  return true;
};

const pararGravacao = async () => {
  if (estado.fase !== 'gravando') return;
  estado = { ...estado, fase: 'finalizando' };
  atualizarBandeja();
  await rodarNoGravador('window.agentePararGravacao()').catch(() => {});
};

const alternarGravacao = () =>
  estado.fase === 'gravando'
    ? pararGravacao()
    : iniciarGravacao({ origem: 'manual', titulo: `Reunião ${dataCurta()}`, tituloGenerico: true });

// ---------- Bandeja ----------

const atualizarBandeja = () => {
  if (!bandeja) return;
  const gravando = estado.fase === 'gravando' || estado.fase === 'finalizando';
  bandeja.setImage(icone(gravando ? 'bandeja-gravando.png' : 'bandeja.png'));
  const texto = { ocioso: 'Omnivix: pronto', iniciando: 'Iniciando...', gravando: 'Gravando reunião...', finalizando: 'Finalizando (transcrevendo e resumindo)...' }[estado.fase];
  bandeja.setToolTip(texto);
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: texto, enabled: false },
    { type: 'separator' },
    { label: estado.fase === 'gravando' ? '■ Parar gravação' : '● Gravar agora', enabled: estado.fase === 'ocioso' || estado.fase === 'gravando', click: alternarGravacao },
    { label: 'Ver reuniões', click: () => abrirJanela('reunioes') },
    { label: 'Configurações', click: () => abrirJanela('opcoes') },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ]));
};

const criarBandeja = () => {
  try {
    bandeja = new Tray(icone('bandeja.png'));
    bandeja.on('click', () => abrirJanela('reunioes'));
    atualizarBandeja();
  } catch (erro) {
    console.error('Sem bandeja do sistema:', erro.message);
  }
};

// ---------- Gatilhos automáticos ----------

// Vigia o arquivo de configuração: quando ele muda (salvo numa janela ou alterado por fora), avisa todas as janelas.
// O atraso de 400 ms junta várias gravações seguidas num aviso só.
const vigiarConfig = () => {
  let espera = null;
  try {
    require('node:fs').watch(path.dirname(arquivoDeConfig()), (_evento, nome) => {
      if (nome !== 'config.json') return;
      clearTimeout(espera);
      espera = setTimeout(() => {
        const janelasAbertas = BrowserWindow.getAllWindows().filter((j) => !j.isDestroyed());
        if (process.env.AGENTE_DEBUG) console.log('config mudou: avisando', janelasAbertas.length, 'janelas');
        janelasAbertas.forEach((j) => j.webContents.send('config:mudou'));
      }, 400);
    });
  } catch (erro) {
    console.error('Não consegui vigiar o arquivo de configuração:', erro.message);
  }
};

const aplicarConfig = async () => {
  const config = await carregarConfig();
  app.setLoginItemSettings({
    openAtLogin: config.iniciarComWindows, openAsHidden: true, path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()]
  });
  globalShortcut.unregisterAll();
  if (config.atalho && !globalShortcut.register(config.atalho, alternarGravacao)) {
    console.error('Não consegui registrar o atalho', config.atalho);
  }
};

const iniciarGatilhos = () => {
  const meuExecutavel = path.basename(process.execPath).toLowerCase();
  detector = criarDetector({
    // O próprio agente usa o microfone ao gravar: não pode contar como "outro programa".
    // Dois sinais de reunião: algum programa usando o microfone, OU um programa de reunião aberto
    // (cobre quem entra mutado, como numa aula).
    lerAplicativos: async () => {
      const { processosDeReuniao } = await carregarConfig();
      const [usandoMicrofone, abertos] = await Promise.all([lerAplicativosEmUso(), processosDeReuniaoAtivos(processosDeReuniao)]);
      const sinais = [...new Set([...usandoMicrofone, ...abertos])].filter((nome) => nome !== meuExecutavel);
      if (process.env.AGENTE_DEBUG) console.log(new Date().toLocaleTimeString(), 'sinais:', sinais, '| fase:', estado.fase);
      return sinais;
    },
    obterConfig: carregarConfig,
    aoIniciar: () => (process.env.AGENTE_DEBUG && console.log('detector: reunião detectada, iniciando a gravação'), iniciarGravacao({ origem: 'microfone', titulo: `Reunião ${dataCurta()}`, tituloGenerico: true })),
    aoParar: () => estado.origem === 'microfone' && pararGravacao()
  });
  detector.iniciar();

  agenda = criarAgenda({
    buscarIcs: async (url) => {
      const resposta = await net.fetch(url);
      if (!resposta.ok) throw new Error(`agenda respondeu ${resposta.status}`);
      return resposta.text();
    },
    obterConfig: carregarConfig,
    aoIniciar: (evento) => iniciarGravacao({ origem: 'agenda', titulo: evento.titulo, contexto: `Evento do calendário: ${evento.titulo}` }),
    aoParar: () => estado.origem === 'agenda' && pararGravacao()
  });
  agenda.iniciar();
};

// ---------- Comunicação com as telas ----------

ipcMain.handle('config:ler', () => carregarConfig());
ipcMain.handle('config:salvar', async (_e, config) => {
  await salvarConfig(config);
  await aplicarConfig();
});
ipcMain.handle('janela:abrir', (_e, nome, hash) => abrirJanela(nome === 'opcoes' ? 'opcoes' : 'reunioes', hash));
ipcMain.handle('gravacao:alternar', () => alternarGravacao());
ipcMain.handle('gravacao:estado', () => estado);

ipcMain.on('gravador:estado', (_e, novo) => {
  if (novo.fase === 'gravando' && estado.fase === 'iniciando') estado = { ...estado, fase: 'gravando' };
  atualizarBandeja();
});

ipcMain.on('gravador:finalizado', (_e, reuniao) => {
  estado = { fase: 'ocioso', origem: null };
  atualizarBandeja();
  const extra = [reuniao.categoria && `Tipo: ${reuniao.categoria}`, reuniao.notion && 'enviada ao Notion'].filter(Boolean).join(' · ');
  avisar('Reunião salva', `${reuniao.titulo}${extra ? ` (${extra})` : ''}`, () => abrirJanela('reunioes', reuniao.id));
});

// ---------- Início do aplicativo ----------

app.whenReady().then(async () => {
  app.setAppUserModelId('br.mattheus.omnivix');
  const primeiraVez = !(await existe());

  protocol.handle('app', async (pedido) => {
    const caminho = decodeURIComponent(new URL(pedido.url).pathname);
    const base = caminho.startsWith('/vendor/') ? PASTA_VENDOR : PASTA_APP;
    const arquivo = path.resolve(base, `.${caminho.startsWith('/vendor/') ? caminho.slice(7) : caminho}`);
    if (!arquivo.startsWith(base + path.sep)) return new Response('proibido', { status: 403 });
    try {
      return new Response(await fs.readFile(arquivo), {
        headers: {
          'Content-Type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream',
          // Estes dois cabeçalhos liberam várias threads para o Whisper (cross-origin isolation).
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'same-origin'
        }
      });
    } catch {
      return new Response('não encontrado', { status: 404 });
    }
  });

  // Captura do áudio do computador: o app escolhe a fonte sozinho (sem janelinha de seleção).
  // "loopback" = tudo o que sai pelas caixas/fones, ou seja, a voz dos outros participantes.
  session.defaultSession.setDisplayMediaRequestHandler(async (_pedido, responder) => {
    const [tela] = await desktopCapturer.getSources({ types: ['screen'] });
    responder({ video: tela, audio: 'loopback' });
  });
  // O microfone é liberado automaticamente para as páginas do próprio app.
  session.defaultSession.setPermissionRequestHandler((_wc, permissao, responder) => responder(permissao === 'media'));

  criarJanelaGravador();
  criarBandeja();
  await aplicarConfig();
  vigiarConfig();
  iniciarGatilhos();

  if (primeiraVez) {
    abrirJanela('opcoes');
    avisar('Omnivix ativo', 'Fica na bandeja do Windows e grava sozinho quando você entra numa chamada.');
  }
});

// App de bandeja: continua rodando mesmo sem nenhuma janela aberta.
app.on('window-all-closed', () => {});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('second-instance', () => abrirJanela('reunioes'));
