// PROCESSO PRINCIPAL do Omnivix (app de bandeja): fica na bandeja do Windows, sem janela, e decide QUANDO gravar.
//
//   [detector.js]  um programa usou o microfone por alguns segundos ─┐
//   [agenda.js]    chegou a hora de uma aula/entrevista da agenda ───┼─► iniciarGravacao()
//   [atalho]       Ctrl+Alt+R ───────────────────────────────────────┘          │
//                                                                               ▼
//                          janela invisível (app/gravador.js) captura o áudio do computador + microfone,
//                          transcreve, separa os falantes, resume e envia ao Notion (app/gravacao.js)

const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, ipcMain, protocol, session, desktopCapturer, nativeImage, net, screen } = require('electron');
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

// Desenho mais fluido: rasterização e cópia de imagens pela placa de vídeo. O Chromium já acompanha a taxa de
// atualização do monitor (60, 120, 144 Hz...), então não existe um "limite de 60" para tirar: o que importa é
// cada quadro ser barato de desenhar, e por isso as animações usam só transform e opacity.
if (!process.env.AGENTE_SEM_GPU) { // (interruptor de diagnóstico: AGENTE_SEM_GPU=1 desliga estas opções)
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-zero-copy');
}

let estado = { fase: 'ocioso', origem: null }; // fase: ocioso | iniciando | gravando | finalizando
let bandeja = null;
let janelaGravador = null;
const janelas = {};
let detector = null;
let agenda = null;
let indicador = null; // janelinha flutuante "REC": o jeito mais seguro de saber, de relance, que está gravando
let mostrarIndicador = true;
let fecharMinimiza = true; // fechar a janela só minimiza (mantém o botão na barra de tarefas)
let saindo = false; // true quando o usuário escolheu Sair: aí fecha de verdade
let ultimoSinalGravador = 0; // quando o gravador falou pela última vez (se ficar mudo, ele travou)
let ultimoAlertaAvisado = null; // para avisar de cada problema uma vez só

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

const abrirJanela = (nome, hash = '', { minimizada = false } = {}) => {
  if (janelas[nome] && !janelas[nome].isDestroyed()) {
    janelas[nome].loadURL(`app://local/${nome}.html${hash ? `#${hash}` : ''}`);
    if (janelas[nome].isMinimized()) janelas[nome].restore();
    janelas[nome].show();
    janelas[nome].focus();
    return;
  }
  const janela = new BrowserWindow({
    width: nome === 'opcoes' ? 760 : 1100, height: 820, title: 'Omnivix', icon: icone('icone.png'), autoHideMenuBar: true,
    backgroundColor: '#000000', // sem isso a janela pisca branca antes de a página carregar
    show: false, // só mostra quando a página já está pronta
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  janela.once('ready-to-show', () => {
    if (minimizada) {
      janela.showInactive(); // aparece só como botão na barra de tarefas, sem roubar o foco
      janela.minimize();
    } else {
      janela.show();
    }
    atualizarBarraDeTarefas();
  });
  // No X: se "manter na barra de tarefas" estiver ligado, só minimiza (o botão continua lá). "Sair" no menu da bandeja fecha de vez.
  if (nome === 'reunioes') {
    janela.on('close', (evento) => {
      if (saindo || !fecharMinimiza) return;
      evento.preventDefault();
      janela.minimize();
    });
  }
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
  janelaGravador.webContents.on('render-process-gone', (_evento, detalhes) => {
    // O gravador caiu no meio de uma gravação: avisa claramente e prepara um novo, em vez de seguir "gravando" de mentira.
    if (estado.fase !== 'ocioso') {
      estado = { fase: 'ocioso', origem: null, falha: { mensagem: `O gravador fechou inesperadamente (${detalhes.reason}). Esta gravação foi perdida.`, ate: Date.now() + 30000 } };
      avisar('A gravação parou', 'O gravador fechou inesperadamente.');
    }
    criarJanelaGravador();
    atualizarBandeja();
    atualizarIndicador();
  });
};

// ---------- Gravação ----------

const rodarNoGravador = (codigo) => janelaGravador.webContents.executeJavaScript(codigo, true); // true = "como se fosse um clique"

const iniciarGravacao = async ({ origem, titulo, contexto = '', tituloGenerico = false }) => {
  if (estado.fase === 'finalizando') {
    // Ainda processando a reunião anterior (pode levar minutos). Quem pediu automaticamente tenta de novo sozinho,
    // e a tela mostra por que ainda não começou, em vez de ficar parecendo que nada aconteceu.
    estado = { ...estado, esperando: { mensagem: origem === 'manual' ? 'Ainda terminando a reunião anterior. Tente de novo em instantes.' : 'Terminando a reunião anterior; a nova começa em seguida.', ate: Date.now() + 8000 } };
    atualizarIndicador();
    return false;
  }
  if (estado.fase !== 'ocioso') return false;
  estado = { fase: 'iniciando', origem };
  ultimoAlertaAvisado = null;
  atualizarBandeja();
  atualizarIndicador();
  const config = await carregarConfig();
  if (process.env.AGENTE_DEBUG) console.log('config lida pelo app: groq', Boolean(config.groqKey), '| gemini', Boolean(config.geminiKey), '| notion', Boolean(config.notionToken), '| motor', config.motorTranscricao, '| criptografia', require('electron').safeStorage.isEncryptionAvailable(), '| pasta', app.getPath('userData'));
  try {
    await rodarNoGravador(`window.agenteIniciar(${JSON.stringify({ titulo, contexto, tituloGenerico, config })})`);
  } catch (erro) {
    console.error('Falha ao iniciar a gravação:', erro);
    const ilegiveis = config.segredosIlegiveis ?? [];
    const motivo = ilegiveis.length
      ? `Não consegui ler as chaves salvas (${ilegiveis.join(', ')}). Abra as Configurações e cole-as de novo.`
      : String(erro.message ?? erro).replace(/^Error invoking.*?Error: /, '');
    // A falha fica VISÍVEL por 20 s (pílula vermelha e ícone de alerta na bandeja), além da notificação, que o Windows pode esconder.
    estado = { fase: 'ocioso', origem: null, falha: { mensagem: motivo, ate: Date.now() + 20000 } };
    atualizarBandeja();
    atualizarIndicador();
    setTimeout(() => { atualizarBandeja(); atualizarIndicador(); }, 20500);
    avisar('Não consegui gravar', motivo);
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
  atualizarIndicador();
  await rodarNoGravador('window.agentePararGravacao()').catch(() => {});
};

const alternarGravacao = () =>
  estado.fase === 'gravando'
    ? pararGravacao()
    : iniciarGravacao({ origem: 'manual', titulo: `Reunião ${dataCurta()}`, tituloGenerico: true });

// ---------- Bandeja ----------

// ---------- O que mostrar ao usuário (a verdade sobre a gravação) ----------

const falhaAtiva = () => (estado.falha && Date.now() < estado.falha.ate ? estado.falha.mensagem : null);
const esperandoAtivo = () => (estado.esperando && Date.now() < estado.esperando.ate ? estado.esperando.mensagem : null);

// Problema "ao vivo": o gravador parou de responder, ou a reunião ficou sem som por muito tempo.
const alertaAtual = () => {
  if (estado.fase !== 'gravando') return null;
  if (ultimoSinalGravador && Date.now() - ultimoSinalGravador > 10000) {
    return { tipo: 'gravador-parado', mensagem: 'O gravador parou de responder: a gravação pode estar parada.' };
  }
  return estado.saude?.alerta ?? null;
};

const formatarDuracao = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const dois = (n) => String(n).padStart(2, '0');
  const h = Math.floor(total / 3600);
  return `${h ? `${h}:` : ''}${dois(Math.floor((total % 3600) / 60))}:${dois(total % 60)}`;
};

const textoDoEstado = () => {
  const falha = falhaAtiva();
  if (falha) return `NÃO está gravando: ${falha}`;
  const alerta = alertaAtual();
  if (alerta) return `ATENÇÃO: ${alerta.mensagem}`;
  const espera = esperandoAtivo();
  if (espera) return espera;
  if (estado.fase === 'gravando') return `Gravando há ${formatarDuracao(Date.now() - (estado.inicioMs ?? Date.now()))}`;
  return { ocioso: 'Omnivix: pronto', iniciando: 'Iniciando...', finalizando: 'Finalizando (transcrevendo e resumindo)...' }[estado.fase];
};

// Avisa de cada problema uma vez (notificação). O indicador e a bandeja continuam mostrando enquanto durar.
const verificarAlerta = () => {
  const alerta = alertaAtual();
  if (!alerta) {
    ultimoAlertaAvisado = null;
    return;
  }
  if (alerta.tipo === ultimoAlertaAvisado) return;
  ultimoAlertaAvisado = alerta.tipo;
  avisar('Atenção: a gravação tem um problema', alerta.mensagem, () => abrirJanela('reunioes'));
};

// ---------- Bandeja ----------

// ---------- Botão na barra de tarefas ----------

// Bolinha no botão do app (vermelha = gravando, âmbar = problema) e barra "pulsando" enquanto finaliza.
const atualizarBarraDeTarefas = () => {
  const janela = janelas.reunioes;
  if (!janela || janela.isDestroyed()) return;
  const problema = Boolean(falhaAtiva() || alertaAtual());
  try {
    if (problema) janela.setOverlayIcon(icone('bandeja-alerta.png'), 'Atenção: problema na gravação');
    else if (estado.fase === 'gravando') janela.setOverlayIcon(icone('bandeja-gravando.png'), 'Gravando');
    else janela.setOverlayIcon(null, '');
    janela.setProgressBar(estado.fase === 'finalizando' ? 2 : -1); // 2 = indeterminada (pulsa); -1 = apagada
    if (problema && !janela.isFocused()) janela.flashFrame(true); // pisca o botão para chamar atenção
  } catch (erro) {
    console.error('Barra de tarefas:', erro.message);
  }
};

const atualizarBandeja = () => {
  if (!bandeja) return;
  const gravando = estado.fase === 'gravando' || estado.fase === 'finalizando';
  const problema = Boolean(falhaAtiva() || alertaAtual());
  bandeja.setImage(icone(problema ? 'bandeja-alerta.png' : gravando ? 'bandeja-gravando.png' : 'bandeja.png'));
  const texto = textoDoEstado();
  bandeja.setToolTip(texto.slice(0, 120)); // o Windows corta dicas muito longas
  atualizarBarraDeTarefas();
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

// ---------- Indicador flutuante "REC" ----------

const LARGURA_INDICADOR = 330;
const ALTURA_INDICADOR = 72;

const criarIndicador = () => {
  const area = screen.getPrimaryDisplay().workArea;
  indicador = new BrowserWindow({
    width: LARGURA_INDICADOR, height: ALTURA_INDICADOR,
    x: area.x + area.width - LARGURA_INDICADOR - 16, y: area.y + area.height - ALTURA_INDICADOR - 16,
    frame: false, transparent: true, resizable: false, hasShadow: false, skipTaskbar: true, show: false,
    focusable: false, // nunca rouba o foco do Zoom/Teams
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  indicador.setAlwaysOnTop(true, 'screen-saver'); // fica acima até de janelas em tela cheia
  indicador.setContentProtection(true); // some de compartilhamentos de tela e capturas (os participantes não veem)
  indicador.loadURL('app://local/indicador.html');
};

const dadosDoIndicador = () => ({
  fase: estado.fase, origem: estado.origem, inicioMs: estado.inicioMs ?? null, saude: estado.saude ?? null,
  alerta: alertaAtual(), falha: falhaAtiva(), esperando: esperandoAtivo()
});

// Mostra, esconde e atualiza a pílula conforme o estado real da gravação.
const atualizarIndicador = () => {
  if (!indicador || indicador.isDestroyed()) return;
  const visivel = mostrarIndicador && (estado.fase !== 'ocioso' || falhaAtiva() || esperandoAtivo());
  if (process.env.AGENTE_DEBUG) console.log('indicador:', visivel ? 'visível' : 'oculto', '| fase:', estado.fase, '| alerta:', alertaAtual()?.tipo ?? '-', '| nível reunião:', estado.saude?.nivelAba?.toFixed(2) ?? '-', '| sem som há:', estado.saude?.semSomAbaSeg ?? '-', 's');
  if (!visivel) {
    if (indicador.isVisible()) indicador.hide();
    return;
  }
  if (!indicador.isVisible()) indicador.showInactive(); // aparece sem tirar o foco de quem está na reunião
  indicador.webContents.send('indicador:estado', dadosDoIndicador());
};

ipcMain.handle('indicador:estado', () => dadosDoIndicador());

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
    args: [...(app.isPackaged ? [] : [app.getAppPath()]), '--iniciado-com-windows'] // para abrir só minimizado no login
  });
  mostrarIndicador = config.mostrarIndicador !== false;
  fecharMinimiza = config.fecharMinimiza !== false;
  atualizarIndicador();
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
  ultimoSinalGravador = Date.now(); // o gravador está vivo
  if (novo.fase === 'gravando' && estado.fase === 'iniciando') estado = { ...estado, fase: 'gravando', inicioMs: Date.now(), falha: null, esperando: null };
  if ('saude' in novo && estado.fase !== 'ocioso') estado = { ...estado, saude: novo.saude };
  verificarAlerta();
  atualizarBandeja();
  atualizarIndicador();
});

ipcMain.on('gravador:finalizado', (_e, reuniao) => {
  estado = { fase: 'ocioso', origem: null };
  ultimoAlertaAvisado = null;
  atualizarBandeja();
  atualizarIndicador();
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
    // thumbnailSize 0x0: não precisamos de miniatura nenhuma, e gerá-las travava o app na hora de gravar
    const [tela] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    responder({ video: tela, audio: 'loopback' });
  });
  // O microfone é liberado automaticamente para as páginas do próprio app.
  session.defaultSession.setPermissionRequestHandler((_wc, permissao, responder) => responder(permissao === 'media'));

  criarJanelaGravador();
  criarBandeja();
  criarIndicador();
  await aplicarConfig();
  // Vigia a cada 2 s: atualiza o tempo na bandeja, percebe um gravador travado e mantém o indicador em dia.
  setInterval(() => {
    if (estado.fase === 'ocioso' && !falhaAtiva() && !esperandoAtivo()) return;
    verificarAlerta();
    atualizarBandeja();
    atualizarIndicador();
  }, 2000);
  vigiarConfig();
  iniciarGatilhos();

  // A janela Reuniões abre sempre ao iniciar: é ela que dá ao app um botão na barra de tarefas. Se foi o Windows que abriu o
  // app no login, ela fica só minimizada, sem atrapalhar.
  abrirJanela('reunioes', '', { minimizada: process.argv.includes('--iniciado-com-windows') });

  if (primeiraVez) {
    abrirJanela('opcoes');
    avisar('Omnivix ativo', 'Fica na bandeja do Windows e grava sozinho quando você entra numa chamada.');
  }
});

// App de bandeja: continua rodando mesmo sem nenhuma janela aberta.
app.on('window-all-closed', () => {});
app.on('before-quit', () => { saindo = true; }); // a partir daqui, fechar a janela fecha de verdade
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('second-instance', () => abrirJanela('reunioes'));
