// Página de configurações: lê o que está salvo, mostra nos campos e grava quando você clica em Salvar.

import { carregarConfig, salvarConfig } from './config.js';
import { descobrirDestino } from './notion.js';
import { chamarGemini, listarModelosGemini } from './gemini.js';

const $ = (id) => document.getElementById(id);
const CAMPOS_TEXTO = ['motorTranscricao', 'groqKey', 'groqModelo', 'assemblyKey', 'assemblyModelo', 'modeloWhisper', 'idioma', 'provedorResumo', 'geminiKey', 'geminiModelo', 'ollamaUrl', 'ollamaModelo', 'notionToken', 'destinoPadrao'];
const CAMPOS_MARCAR = ['usarGpu', 'identificarFalantes', 'salvarAudio', 'notionAuto', 'avisarReuniao'];

const el = (tag, props = {}, ...filhos) => {
  const no = Object.assign(document.createElement(tag), props);
  no.append(...filhos);
  return no;
};

// Uma linha da lista de tipos: nome, palavras para reconhecer, link do Notion, testar e remover.
const criarLinhaDestino = (destino) => {
  const nome = el('input', { type: 'text', value: destino.nome, placeholder: 'Ex.: Entrevista' });
  // textarea: o texto longo quebra de linha e aparece inteiro (antes ficava cortado)
  const descricao = el('textarea', { rows: 2, value: destino.descricao ?? '', placeholder: 'Ex.: entrevista, vaga, candidato, recrutador (separe por vírgula)' });
  const link = el('input', { type: 'text', value: destino.link ?? '', placeholder: 'Cole o link da página ou do banco no Notion' });
  const campo = (rotulo, entrada) => el('div', { className: 'campo' }, el('span', { className: 'rotulo', textContent: rotulo }), entrada);
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
  const linha = el('div', { className: 'destino' },
    campo('Tipo de reunião', nome), campo('Reconhecer por estas palavras', descricao), campo('Destino no Notion', link),
    el('div', { className: 'rodape' }, testar, el('button', { type: 'button', textContent: 'Remover', onclick: () => linha.remove() }), resultado));
  linha.ler = () => ({ nome: nome.value.trim(), descricao: descricao.value.trim(), link: link.value.trim() });
  return linha;
};

const mostrarCaixaDoMotor = () => {
  $('boxGroq').hidden = $('motorTranscricao').value !== 'groq';
  $('boxLocal').hidden = $('motorTranscricao').value !== 'local';
  $('boxAssembly').hidden = $('motorTranscricao').value !== 'assemblyai';
};

const mostrarCaixaDoProvedor = () => {
  $('boxGemini').hidden = $('provedorResumo').value !== 'gemini';
  $('boxOllama').hidden = $('provedorResumo').value !== 'ollama';
};

// Lista de reserva (usada até você clicar em "Buscar modelos"). Os nomes podem estar desatualizados.
const MODELOS_RESERVA = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']
  .map((id) => ({ id, nome: id, previa: /preview|exp/i.test(id) }));

// Preenche o seletor. O modelo já salvo sempre aparece, mesmo que a lista nova não o traga.
const preencherModelos = (modelos, escolhido) => {
  const lista = modelos.some((m) => m.id === escolhido) || !escolhido ? modelos : [{ id: escolhido, nome: escolhido, previa: false }, ...modelos];
  $('geminiModelo').replaceChildren(...lista.map((m) =>
    el('option', { value: m.id, textContent: `${m.nome === m.id ? m.id : `${m.nome} (${m.id})`}${m.previa ? ' - prévia' : ''}` })));
  if (escolhido) $('geminiModelo').value = escolhido;
};

const config = await carregarConfig();
preencherModelos(MODELOS_RESERVA, config.geminiModelo);
CAMPOS_TEXTO.forEach((campo) => ($(campo).value = config[campo]));
CAMPOS_MARCAR.forEach((campo) => ($(campo).checked = config[campo]));
config.destinos.forEach((d) => $('listaDestinos').append(criarLinhaDestino(d)));
$('novoDestino').addEventListener('click', () => $('listaDestinos').append(criarLinhaDestino({ nome: '' })));
mostrarCaixaDoProvedor();
mostrarCaixaDoMotor();
$('motorTranscricao').addEventListener('change', mostrarCaixaDoMotor);
$('provedorResumo').addEventListener('change', mostrarCaixaDoProvedor);

$('buscarModelos').addEventListener('click', async () => {
  const aviso = $('resultadoGemini');
  aviso.textContent = 'Buscando...';
  try {
    const modelos = await listarModelosGemini($('geminiKey').value.trim());
    if (!modelos.length) throw new Error('a chave não tem nenhum modelo disponível');
    // Prefere manter o que estava escolhido; se ele não existe mais, escolhe o primeiro estável.
    const atual = $('geminiModelo').value;
    preencherModelos(modelos, modelos.some((m) => m.id === atual) ? atual : modelos[0].id);
    aviso.textContent = `✅ ${modelos.length} modelos liberados para a sua chave`;
  } catch (erro) {
    aviso.textContent = `❌ ${erro.message}`;
  }
});

$('testarModelo').addEventListener('click', async () => {
  const aviso = $('resultadoGemini');
  aviso.textContent = 'Testando...';
  try {
    await chamarGemini([{ text: 'Responda apenas com o JSON {"ok": true}' }], { geminiKey: $('geminiKey').value.trim(), geminiModelo: $('geminiModelo').value });
    aviso.textContent = '✅ Funciona! Clique em Salvar.';
  } catch (erro) {
    aviso.textContent = `❌ ${erro.message}`;
  }
});

$('salvar').addEventListener('click', async () => {
  const nova = {};
  CAMPOS_TEXTO.forEach((campo) => (nova[campo] = $(campo).value.trim()));
  CAMPOS_MARCAR.forEach((campo) => (nova[campo] = $(campo).checked));
  nova.destinos = [...$('listaDestinos').children].map((linha) => linha.ler()).filter((d) => d.nome);
  await salvarConfig(nova);
  $('salvo').textContent = '✔ Salvo!';
  setTimeout(() => ($('salvo').textContent = ''), 2500);
});

// O navegador só mostra o pedido de permissão do microfone a páginas "de verdade" (como esta),
// não ao documento invisível. Uma vez permitido aqui, vale para a extensão toda.
$('permitirMic').addEventListener('click', async () => {
  try {
    const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
    fluxo.getTracks().forEach((faixa) => faixa.stop());
    $('resultadoMic').textContent = '✅ Microfone liberado!';
  } catch {
    $('resultadoMic').textContent = '❌ Negado. Clique no cadeado ao lado do endereço desta página e permita o microfone.';
  }
});
