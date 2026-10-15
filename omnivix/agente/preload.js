// Ponte segura entre as telas (que não têm acesso ao computador) e o processo principal.
// Só o que está listado aqui fica disponível para as páginas, em window.agente.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agente', {
  lerConfig: () => ipcRenderer.invoke('config:ler'),
  salvarConfig: (config) => ipcRenderer.invoke('config:salvar', config),
  abrir: (nome, hash) => ipcRenderer.invoke('janela:abrir', nome, hash),
  alternarGravacao: () => ipcRenderer.invoke('gravacao:alternar'),
  estado: () => ipcRenderer.invoke('gravacao:estado'),
  // chamado quando o arquivo de configuração muda (por esta ou por outra janela, ou por fora do app)
  aoMudarConfig: (funcao) => ipcRenderer.on('config:mudou', () => funcao()),
  // usados só pela janela invisível que grava:
  estadoGravacao: (estado) => ipcRenderer.send('gravador:estado', estado),
  gravacaoFinalizada: (resumo) => ipcRenderer.send('gravador:finalizado', resumo)
});
