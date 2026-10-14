// Página de configurações: lê o que está salvo, mostra nos campos e grava quando você clica em Salvar.

import { carregarConfig, salvarConfig } from './config.js';
import { descobrirDestino } from './notion.js';

const $ = (id) => document.getElementById(id);
const CAMPOS_TEXTO = ['motorTranscricao', 'groqKey', 'groqModelo', 'modeloWhisper', 'idioma', 'provedorResumo', 'geminiKey', 'geminiModelo', 'ollamaUrl', 'ollamaModelo', 'notionToken', 'destinoPadrao'];
const CAMPOS_MARCAR = ['usarGpu', 'identificarFalantes', 'salvarAudio', 'notionAuto'];

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

const config = await carregarConfig();
CAMPOS_TEXTO.forEach((campo) => ($(campo).value = config[campo]));
CAMPOS_MARCAR.forEach((campo) => ($(campo).checked = config[campo]));
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
