// Banco de dados das reuniões, usando IndexedDB (o "banco de dados" que todo navegador tem).
//
// Por que IndexedDB e não chrome.storage?
//   1. O documento "offscreen" (que grava o áudio) NÃO tem acesso a chrome.storage, mas tem IndexedDB.
//   2. IndexedDB guarda arquivos grandes (o áudio) sem problema.
//   3. Todas as páginas da extensão compartilham o mesmo banco (mesma "origem").
//
// Duas "gavetas" (object stores): 'reunioes' (texto, resumo...) e 'audios' (o arquivo de som).

const NOME_BANCO = 'anotacoes-reuniao';
const VERSAO = 1;

const abrirBanco = () =>
  new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO, VERSAO);
    // Roda só na primeira vez (ou quando a VERSAO sobe): cria as gavetas.
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore('reunioes', { keyPath: 'id' });
      pedido.result.createObjectStore('audios', { keyPath: 'id' });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });

// Executa UMA operação dentro de uma "transação" (tudo-ou-nada) e devolve o resultado.
const transacao = async (gaveta, modo, operacao) => {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = banco.transaction(gaveta, modo);
    const pedido = operacao(tx.objectStore(gaveta));
    tx.oncomplete = () => {
      banco.close();
      resolve(pedido.result);
    };
    tx.onerror = tx.onabort = () => {
      banco.close();
      reject(tx.error);
    };
  });
};

export const salvarReuniao = (reuniao) => transacao('reunioes', 'readwrite', (g) => g.put(reuniao));

export const obterReuniao = (id) => transacao('reunioes', 'readonly', (g) => g.get(id));

export const listarReunioes = async () => {
  const todas = await transacao('reunioes', 'readonly', (g) => g.getAll());
  return todas.sort((a, b) => b.inicio - a.inicio); // mais recentes primeiro
};

export const apagarReuniao = async (id) => {
  await transacao('reunioes', 'readwrite', (g) => g.delete(id));
  await transacao('audios', 'readwrite', (g) => g.delete(id));
};

export const salvarAudio = (id, blob) => transacao('audios', 'readwrite', (g) => g.put({ id, blob }));

export const obterAudio = async (id) => {
  const registro = await transacao('audios', 'readonly', (g) => g.get(id));
  return registro?.blob ?? null;
};
