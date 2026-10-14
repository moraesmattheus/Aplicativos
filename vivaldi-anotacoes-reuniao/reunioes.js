// Página que lista as reuniões gravadas e mostra resumo, itens de ação e transcrição.
// A reunião aberta é guardada no endereço (#id), então o botão "voltar" e o recarregar funcionam.

import { listarReunioes, obterReuniao, salvarReuniao, apagarReuniao, obterAudio } from './armazenamento.js';
import { carregarConfig } from './config.js';
import { gerarResumo } from './resumo.js';
import { enviarAoNotion } from './notion.js';
import { formatarTempo, textoTranscricao, reuniaoParaMarkdown } from './formatar.js';

const listaEl = document.getElementById('lista');
const detalheEl = document.getElementById('detalhe');
let urlAudio = null;
let reuniaoAberta = null;
let transcricaoAberta = null; // lembra se você abriu a transcrição (null = ainda não escolheu)

const el = (tag, props = {}, ...filhos) => {
  const no = Object.assign(document.createElement(tag), props);
  no.append(...filhos);
  return no;
};

const baixarTexto = (nome, texto, tipo = 'text/markdown') => {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  el('a', { href: url, download: nome }).click();
  URL.revokeObjectURL(url);
};

const nomeArquivo = (reuniao) =>
  `${reuniao.titulo.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60)}-${new Date(reuniao.inicio).toISOString().slice(0, 10)}`;

const ROTULOS = { gravando: '🔴 gravando', processando: '⏳ processando', erro: '⚠️ erro', pronta: '' };

const desenharLista = async () => {
  const reunioes = await listarReunioes();
  const itens = reunioes.map((r) =>
    el('button', {
      className: `item${r.id === reuniaoAberta?.id ? ' ativo' : ''}`,
      onclick: () => (location.hash = r.id)
    }, r.titulo, el('small', { textContent: `${new Date(r.inicio).toLocaleString('pt-BR')} ${ROTULOS[r.status] ?? ''}` }))
  );
  listaEl.replaceChildren(...(itens.length ? itens : [el('p', { className: 'suave', textContent: 'Nenhuma reunião ainda. Grave a primeira pelo ícone da extensão!' })]));
};

const secaoLista = (titulo, itens, criarItem = (t) => el('li', { textContent: t })) =>
  itens.length ? [el('h2', { textContent: titulo }), el('ul', {}, ...itens.map(criarItem))] : [];

const itemAcao = (acao) => {
  const li = el('li');
  const caixa = el('input', { type: 'checkbox', onchange: () => li.classList.toggle('feito', caixa.checked) });
  li.append(caixa, ` ${acao.tarefa} `);
  if (acao.responsavel) li.append(el('span', { className: 'tag', textContent: `👤 ${acao.responsavel}` }), ' ');
  if (acao.prazo) li.append(el('span', { className: 'tag', textContent: `📅 ${acao.prazo}` }));
  return li;
};

// Cada falante ganha uma cor fixa (a mesma pessoa sempre tem a mesma cor).
const CORES = ['#5b5bd6', '#d6336c', '#2f9e44', '#e8590c', '#1c7ed6', '#9c36b5', '#0b7285'];
const corDoFalante = (nome = '') => CORES[[...nome].reduce((soma, c) => soma + c.charCodeAt(0), 0) % CORES.length];

// Clicar no nome renomeia o falante em TODA a reunião (ex.: "Pessoa 1" -> "Maria").
const renomearFalante = async (reuniao, nomeAntigo) => {
  const novo = prompt(`Novo nome para "${nomeAntigo}":`, nomeAntigo)?.trim();
  if (!novo || novo === nomeAntigo) return;
  reuniao.segmentos.forEach((seg) => seg.falante === nomeAntigo && (seg.falante = novo));
  await salvarReuniao(reuniao);
  desenharDetalhe(reuniao);
};

const linhaDeFala = (reuniao, seg) =>
  el('div', { className: 'fala' },
    el('span', { className: 'hora', textContent: formatarTempo(seg.inicioSeg) }),
    seg.falante
      ? el('button', { className: 'falante', textContent: seg.falante, title: 'Clique para renomear', style: `color:${corDoFalante(seg.falante)}`, onclick: () => renomearFalante(reuniao, seg.falante) })
      : '',
    el('span', { textContent: seg.texto })
  );

const refazerResumo = async (reuniao) => {
  const config = await carregarConfig();
  try {
    reuniao.resumo = await gerarResumo(textoTranscricao(reuniao.segmentos), config);
    reuniao.categoria ??= reuniao.resumo.categoria; // só define o tipo se você ainda não escolheu um
  } catch (erro) {
    alert(`O resumo falhou: ${erro.message}\nVerifique as Configurações.`);
    return;
  }
  await salvarReuniao(reuniao);
  desenharDetalhe(reuniao);
};

const emAndamentoAgora = (reuniao) => ['gravando', 'processando'].includes(reuniao.status);

const desenharDetalhe = async (reuniao) => {
  const config = await carregarConfig();
  if (urlAudio) URL.revokeObjectURL(urlAudio);
  urlAudio = null;
  const { resumo } = reuniao;

  const titulo = el('input', {
    className: 'titulo', value: reuniao.titulo, ariaLabel: 'Título da reunião',
    onchange: async () => {
      reuniao.titulo = titulo.value.trim() || 'Reunião sem título';
      await salvarReuniao(reuniao);
      desenharLista();
    }
  });

  const tipos = (config.destinos ?? []).map((d) => d.nome).filter(Boolean);
  const seletorTipo = el('select', {
    style: 'width:auto', ariaLabel: 'Tipo da reunião',
    onchange: async () => {
      reuniao.categoria = seletorTipo.value || null;
      await salvarReuniao(reuniao);
    }
  }, el('option', { value: '', textContent: 'Sem tipo' }),
    ...tipos.map((tipo) => el('option', { value: tipo, textContent: tipo, selected: tipo === reuniao.categoria })));

  const enviarNotion = async (botao) => {
    if (reuniao.notion && !confirm('Esta reunião já foi enviada. Criar outra página no Notion?')) return;
    botao.disabled = true;
    botao.textContent = 'Enviando...';
    try {
      reuniao.notion = await enviarAoNotion(reuniao, config);
      await salvarReuniao(reuniao);
    } catch (erro) {
      alert(`Não consegui enviar ao Notion: ${erro.message}`);
    }
    desenharDetalhe(reuniao);
  };

  const acoes = el('div', { className: 'acoes' },
    el('button', { textContent: '📋 Copiar (Markdown)', onclick: () => navigator.clipboard.writeText(reuniaoParaMarkdown(reuniao)) }),
    el('button', { className: 'principal', textContent: '📤 Enviar ao Notion', disabled: !config.notionToken || emAndamentoAgora(reuniao), onclick: (e) => enviarNotion(e.target) }),
    el('button', { textContent: '⬇️ Baixar .md', onclick: () => baixarTexto(`${nomeArquivo(reuniao)}.md`, reuniaoParaMarkdown(reuniao)) }),
    el('button', { textContent: '🔄 Refazer resumo', disabled: !reuniao.segmentos.length, onclick: () => refazerResumo(reuniao) }),
    el('button', {
      className: 'perigo', textContent: '🗑 Apagar',
      onclick: async () => {
        if (!confirm('Apagar esta reunião (texto e áudio)?')) return;
        await apagarReuniao(reuniao.id);
        location.hash = '';
      }
    })
  );

  const linhaNotion = reuniao.notion
    ? [el('div', {}, '✅ No Notion: ', el('a', { href: reuniao.notion.url, target: '_blank', rel: 'noopener', textContent: `${reuniao.notion.destino} (${reuniao.notion.tipo})` }))]
    : [];

  const avisos = reuniao.avisos.map((a) => el('div', { className: 'aviso', textContent: a }));
  const emAndamento = reuniao.status === 'gravando' || reuniao.status === 'processando';

  const blocoResumo = resumo
    ? [
        el('h2', { textContent: `Resumo ${resumo.origem === 'basico' ? '(básico, sem IA)' : `(${resumo.origem})`}` }),
        el('p', { textContent: resumo.resumo }),
        ...secaoLista('Tópicos', resumo.topicos),
        ...secaoLista('Decisões', resumo.decisoes),
        ...secaoLista('Itens de ação', resumo.acoes, itemAcao)
      ]
    : [el('p', { className: 'suave', textContent: emAndamento ? 'O resumo aparece quando a reunião terminar.' : 'Sem resumo.' })];

  const transcricao = el('details', { open: transcricaoAberta ?? !resumo, ontoggle: (e) => (transcricaoAberta = e.target.open) },
    el('summary', { textContent: `Transcrição (${reuniao.segmentos.length} trechos)` }),
    reuniao.segmentos.length ? el('div', { className: 'falas' }, ...reuniao.segmentos.map((seg) => linhaDeFala(reuniao, seg))) : el('p', { className: 'suave', textContent: '(vazia)' })
  );

  const blocoAudio = [];
  if (reuniao.temAudio) {
    const blob = await obterAudio(reuniao.id);
    if (blob) {
      urlAudio = URL.createObjectURL(blob);
      blocoAudio.push(
        el('h2', { textContent: 'Áudio' }),
        el('audio', { controls: true, src: urlAudio }),
        el('a', { href: urlAudio, download: `${nomeArquivo(reuniao)}.webm`, textContent: 'Baixar áudio (.webm)' })
      );
    }
  }

  detalheEl.replaceChildren(
    titulo,
    el('div', { className: 'suave', textContent: `${new Date(reuniao.inicio).toLocaleString('pt-BR')} · ${formatarTempo(reuniao.duracaoSeg)} ${ROTULOS[reuniao.status] ?? ''}` }),
    el('div', {}, 'Tipo: ', seletorTipo),
    acoes, ...linhaNotion, ...avisos, ...blocoResumo, transcricao, ...blocoAudio
  );
};

const abrirDoEndereco = async () => {
  const id = location.hash.slice(1);
  if (id !== reuniaoAberta?.id) transcricaoAberta = null;
  reuniaoAberta = id ? await obterReuniao(id) : null;
  if (reuniaoAberta) await desenharDetalhe(reuniaoAberta);
  else detalheEl.replaceChildren(el('p', { className: 'suave', textContent: 'Escolha uma reunião na lista.' }));
  desenharLista();
};

window.addEventListener('hashchange', abrirDoEndereco);
await abrirDoEndereco();

// Enquanto uma reunião está sendo gravada/processada, atualiza a tela a cada 3 segundos.
setInterval(async () => {
  if (!reuniaoAberta || !['gravando', 'processando'].includes(reuniaoAberta.status)) return;
  if (document.activeElement?.tagName === 'INPUT') return; // não atrapalha quem está digitando o título
  abrirDoEndereco();
}, 3000);
