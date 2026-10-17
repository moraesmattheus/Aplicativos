// Aplica na página a aparência dos botões que você escolheu em Configurações (variáveis --botao-* no <html>).
// Basta importar este arquivo: ele lê a configuração salva, aplica, e reaplica sozinho quando ela muda
// (na extensão, pelo armazenamento do navegador; no app, pelo aviso de "configuração mudou").

import { carregarConfig } from './config.js';
import { normalizarBotoes, variaveisDosBotoes } from './botoes-estilo.js';

// Aplica uma aparência (objeto salvo, possivelmente incompleto ou inválido: é normalizado antes de virar CSS).
export const aplicarBotoes = (botoes) => {
  if (typeof document === 'undefined') return; // fora do navegador (testes): nada a fazer
  for (const [nome, valor] of Object.entries(variaveisDosBotoes(normalizarBotoes(botoes)))) {
    document.documentElement.style.setProperty(nome, valor);
  }
};

const aplicarDaConfiguracao = async () => {
  try {
    aplicarBotoes((await carregarConfig()).botoes);
  } catch {
    aplicarBotoes(undefined); // sem configuração legível: fica o visual padrão
  }
};

if (typeof document !== 'undefined') {
  aplicarDaConfiguracao();
  // Extensão: a configuração mora no armazenamento do navegador.
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((mudancas, area) => {
      if (area === 'local' && mudancas.config) aplicarBotoes(mudancas.config.newValue?.botoes);
    });
  }
  // App de bandeja: o processo principal avisa quando o arquivo de configuração muda.
  if (globalThis.agente?.aoMudarConfig) globalThis.agente.aoMudarConfig(aplicarDaConfiguracao);
}
