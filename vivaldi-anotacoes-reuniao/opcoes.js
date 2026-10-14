// Página de configurações: lê o que está salvo, mostra nos campos e grava quando você clica em Salvar.

import { carregarConfig, salvarConfig } from './config.js';

const $ = (id) => document.getElementById(id);
const CAMPOS_TEXTO = ['motorTranscricao', 'groqKey', 'groqModelo', 'modeloWhisper', 'idioma', 'provedorResumo', 'geminiKey', 'geminiModelo', 'ollamaUrl', 'ollamaModelo'];
const CAMPOS_MARCAR = ['usarGpu', 'identificarFalantes', 'salvarAudio'];

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
mostrarCaixaDoProvedor();
mostrarCaixaDoMotor();
$('motorTranscricao').addEventListener('change', mostrarCaixaDoMotor);
$('provedorResumo').addEventListener('change', mostrarCaixaDoProvedor);

$('salvar').addEventListener('click', async () => {
  const nova = {};
  CAMPOS_TEXTO.forEach((campo) => (nova[campo] = $(campo).value.trim()));
  CAMPOS_MARCAR.forEach((campo) => (nova[campo] = $(campo).checked));
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
