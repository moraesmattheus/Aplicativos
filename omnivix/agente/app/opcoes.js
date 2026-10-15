// Página de configurações: lê o que está salvo, mostra nos campos e grava quando você clica em Salvar.

import { carregarConfig, salvarConfig } from './config.js';
import { descobrirDestino } from './notion.js';

const $ = (id) => document.getElementById(id);
const CAMPOS_TEXTO = ['motorTranscricao', 'groqKey', 'groqModelo', 'modeloWhisper', 'idioma', 'provedorResumo', 'geminiKey', 'geminiModelo', 'ollamaUrl', 'ollamaModelo', 'notionToken', 'destinoPadrao', 'atalho', 'agendaUrl', 'agendaPalavras'];
const CAMPOS_MARCAR = ['gravarMicrofone', 'transcreverSoNoFim', 'usarGpu', 'identificarFalantes', 'salvarAudio', 'notionAuto', 'autoDetectarChamadas', 'avisarAoIniciar', 'iniciarComWindows', 'agendaTodos'];

const el = (tag, props = {}, ...filhos) => {
  const no = Object.assign(document.createElement(tag), props);
  no.append(...filhos);
  return no;
};

// Uma linha da lista de tipos: nome, palavras para reconhecer, link do Notion, testar e remover.
const criarLinhaDestino = (destino) => {
  const nome = el('input', { type: 'text', value: destino.nome, placeholder: 'Tipo (ex.: Entrevista)' });
  const descricao = el('input', { type: 'text', value: destino.descricao ?? '', placeholder: 'Palavras para reconhecer (separe por vírgula)' });
  const link = el('input', { type: 'text', value: destino.link ?? '', placeholder: 'Link da página ou do banco no Notion', className: 'largo' });
  const resultado = el('span', { className: 'suave' });
  const testar = el('button', {
    type: 'button', textContent: 'Testar',
    onclick: async () => {
      resultado.textContent = 'Testando...';
      try {
        const alvo = await descobrirDestino(link.value, $('notionToken').value.trim());
        resultado.textContent = `✅ ${alvo.tipo === 'banco' ? 'Banco' : 'Página'} “${alvo.nome}”`;
      } catch (erro) {
        resultado.textContent = `❌ ${erro.message}`;
      }
    }
  });
  const linha = el('div', { className: 'destino' }, nome, descricao, link,
    el('div', { className: 'rodape' }, testar, el('button', { type: 'button', textContent: 'Remover', onclick: () => linha.remove() }), resultado));
  linha.ler = () => ({ nome: nome.value.trim(), descricao: descricao.value.trim(), link: link.value.trim() });
  return linha;
};

const mostrarCaixaDoMotor = () => {
  $('boxGroq').hidden = $('motorTranscricao').value !== 'groq';
  $('boxLocal').hidden = $('motorTranscricao').value !== 'local';
};

const mostrarCaixaDoProvedor = () => {
  $('boxGemini').hidden = $('provedorResumo').value !== 'gemini';
  $('boxOllama').hidden = $('provedorResumo').value !== 'ollama';
};

// ---------- Dispositivos de áudio (só para este app) ----------

// Põe uma opção "salva" no seletor (para o nome aparecer mesmo antes de carregar a lista).
const opcaoSalva = (seletor, id, nome) => {
  if (id && ![...seletor.options].some((o) => o.value === id)) seletor.append(el('option', { value: id, textContent: `${nome || 'dispositivo salvo'} (salvo)` }));
  seletor.value = id || '';
};

// Mede o volume mais alto por 2,5 s: "tem sinal" ou "silêncio".
const medirNivel = async (abrirFluxo) => {
  const fluxo = await abrirFluxo();
  let ctx;
  try {
    ctx = new AudioContext({ sinkId: { type: 'none' } }); // sem abrir saída de áudio
  } catch {
    ctx = new AudioContext();
  }
  const analisador = ctx.createAnalyser();
  ctx.createMediaStreamSource(fluxo).connect(analisador);
  const amostras = new Float32Array(analisador.fftSize);
  let pico = 0;
  const fim = Date.now() + 2500;
  while (Date.now() < fim) {
    analisador.getFloatTimeDomainData(amostras);
    for (const v of amostras) pico = Math.max(pico, Math.abs(v));
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  fluxo.getTracks().forEach((faixa) => faixa.stop());
  await ctx.close();
  return pico;
};

const textoDoNivel = (pico) => (pico < 0.005 ? 'sem som (silêncio). Fale ou toque algo e teste de novo.' : `ok, sinal detectado (${Math.round(Math.min(1, pico) * 100)}%)`);

const testar = async (botao, destino, abrirFluxo) => {
  botao.disabled = true;
  destino.textContent = 'testando por 2 segundos...';
  try {
    destino.textContent = textoDoNivel(await medirNivel(abrirFluxo));
  } catch (erro) {
    destino.textContent = `não abriu: ${erro.message}`;
  } finally {
    botao.disabled = false;
  }
};

$('carregarDispositivos').addEventListener('click', async () => {
  const aviso = $('statusDispositivos');
  aviso.textContent = 'carregando...';
  try {
    // Os nomes só aparecem depois de uma permissão de microfone: abre o padrão por um instante e fecha.
    (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((faixa) => faixa.stop());
    const entradas = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
    const preencher = (seletor, primeira, escolhido) => {
      seletor.replaceChildren(el('option', { value: '', textContent: primeira }), ...entradas.map((d) => el('option', { value: d.deviceId, textContent: d.label || 'Entrada sem nome' })));
      seletor.value = entradas.some((d) => d.deviceId === escolhido) ? escolhido : '';
    };
    // A saída padrão do Windows é a que o "Áudio do computador" captura (no seu caso, o FxSound Speakers).
    const saidaPadrao = (await navigator.mediaDevices.enumerateDevices()).find((d) => d.kind === 'audiooutput' && d.deviceId === 'default');
    const nomeSaida = (saidaPadrao?.label ?? '').replace(/^(Padrão|Default)\s*-\s*/i, '');
    preencher($('microfoneId'), 'Padrão do Windows', $('microfoneId').value);
    preencher($('entradaOutrosId'), nomeSaida ? `Áudio do computador: ${nomeSaida} (saída padrão do Windows)` : 'Áudio do computador (padrão)', $('entradaOutrosId').value);
    $('saidaCapturada').textContent = nomeSaida ? `Hoje o app captura a saída: ${nomeSaida}` : '';
    aviso.textContent = `${entradas.length} entradas encontradas`;
  } catch (erro) {
    aviso.textContent = `não consegui listar: ${erro.message}`;
  }
});

$('testarMicrofone').addEventListener('click', () => testar($('testarMicrofone'), $('nivelMicrofone'), () =>
  navigator.mediaDevices.getUserMedia({ audio: $('microfoneId').value ? { deviceId: { exact: $('microfoneId').value } } : true })));

$('testarOutros').addEventListener('click', () => testar($('testarOutros'), $('nivelOutros'), async () => {
  if ($('entradaOutrosId').value) return navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: $('entradaOutrosId').value }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const fluxo = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); // áudio do computador
  fluxo.getVideoTracks().forEach((faixa) => { faixa.stop(); fluxo.removeTrack(faixa); });
  return fluxo;
}));

const config = await carregarConfig();
opcaoSalva($('microfoneId'), config.microfoneId, config.microfoneNome);
opcaoSalva($('entradaOutrosId'), config.entradaOutrosId, config.entradaOutrosNome);
CAMPOS_TEXTO.forEach((campo) => ($(campo).value = config[campo]));
CAMPOS_MARCAR.forEach((campo) => ($(campo).checked = config[campo]));
$('ignorarApps').value = config.ignorarApps.join('\n');
$('processosDeReuniao').value = (config.processosDeReuniao ?? []).join('\n');
config.destinos.forEach((d) => $('listaDestinos').append(criarLinhaDestino(d)));
$('novoDestino').addEventListener('click', () => $('listaDestinos').append(criarLinhaDestino({ nome: '' })));
mostrarCaixaDoProvedor();
mostrarCaixaDoMotor();
$('motorTranscricao').addEventListener('change', mostrarCaixaDoMotor);
$('provedorResumo').addEventListener('change', mostrarCaixaDoProvedor);

$('salvar').addEventListener('click', async () => {
  const nova = {};
  CAMPOS_TEXTO.forEach((campo) => (nova[campo] = $(campo).value.trim()));
  CAMPOS_MARCAR.forEach((campo) => (nova[campo] = $(campo).checked));
  nova.ignorarApps = $('ignorarApps').value.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);
  nova.processosDeReuniao = $('processosDeReuniao').value.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);
  const nomeEscolhido = (seletor) => (seletor.value ? seletor.selectedOptions[0].textContent.replace(/ \(salvo\)$/, '') : '');
  nova.microfoneId = $('microfoneId').value;
  nova.microfoneNome = nomeEscolhido($('microfoneId'));
  nova.entradaOutrosId = $('entradaOutrosId').value;
  nova.entradaOutrosNome = nomeEscolhido($('entradaOutrosId'));
  nova.segundosParaIniciar = config.segundosParaIniciar;
  nova.segundosParaParar = config.segundosParaParar;
  nova.destinos = [...$('listaDestinos').children].map((linha) => linha.ler()).filter((d) => d.nome);
  await salvarConfig(nova);
  $('salvo').textContent = '✔ Salvo!';
  setTimeout(() => ($('salvo').textContent = ''), 2500);
});
