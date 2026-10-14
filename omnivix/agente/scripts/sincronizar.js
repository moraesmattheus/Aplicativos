// O "cérebro" (gravação, transcrição, resumo, Notion) vive na pasta da extensão e é compartilhado com este app.
// Este script copia esses arquivos para app/ antes de iniciar, para existir uma única versão de cada um.

const fs = require('node:fs');
const path = require('node:path');

const ORIGEM = path.join(__dirname, '..', '..', 'extensao');
const DESTINO = path.join(__dirname, '..', 'app');
const ARQUIVOS = [
  'armazenamento.js', 'formatar.js', 'resumo.js', 'gemini.js', 'notion.js', 'falantes.js',
  'transcricao-nuvem.js', 'pcm-worklet.js', 'gravacao.js', 'estilo.css', 'reunioes.html', 'reunioes.js'
];

if (!fs.existsSync(ORIGEM)) {
  console.error(`Não encontrei a pasta ${ORIGEM}.\nBaixe o repositório inteiro (as duas pastas ficam lado a lado).`);
  process.exit(1);
}
for (const arquivo of ARQUIVOS) fs.copyFileSync(path.join(ORIGEM, arquivo), path.join(DESTINO, arquivo));
console.log(`Sincronizados ${ARQUIVOS.length} arquivos de omnivix/extensao.`);
