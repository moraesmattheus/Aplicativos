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

const ROTULOS = { gravando: '🔴 gravando', processando: '⏳ processando', erro: '⚠️ erro', interrompida: '⚠️ interrompida', pronta: '' };

// Gravação "fantasma": diz que está gravando, mas o gravador parou de dar sinal de vida (o app foi fechado no meio).
// O sinal é renovado a cada 15 s; gravações antigas, sem sinal, só valem como fantasmas depois de 10 min.
const estaInterrompida = (r) =>
  r.status === 'gravando' && Date.now() - (r.atualizadaEm ?? r.inicio) > (r.atualizadaEm ? 90_000 : 600_000);

// O que mostrar no lugar do status: "interrompida" no lugar de "gravando" quando não há mais sinal.
const statusDe = (r) => (estaInterrompida(r) ? 'interrompida' : r.status);

const desenharLista = async () => {
  const reunioes = await listarReunioes();
  const itens = reunioes.map((r) =>
    el('button', {
      className: `item${r.id === reuniaoAberta?.id ? ' ativo' : ''}`,
      onclick: () => (location.hash = r.id)
    }, r.titulo, el('small', { textContent: `${new Date(r.inicio).toLocaleString('pt-BR')} ${ROTULOS[statusDe(r)] ?? ''}` }))
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

const emAndamentoAgora = (reuniao) => ['gravando', 'processando'].includes(reuniao.status) && !estaInterrompida(reuniao);

// ---------- Painel "ao vivo" (enquanto grava ou processa) ----------

let cacheAoVivo = { id: null, trechos: -1, topicos: [] };

// Assuntos até agora: as palavras mais faladas, calculadas aqui mesmo (sem IA, sem internet, de graça).
const assuntosAteAgora = async (reuniao, config) => {
  const n = reuniao.segmentos.length;
  if (cacheAoVivo.id === reuniao.id && cacheAoVivo.trechos === n) return cacheAoVivo.topicos;
  let topicos = [];
  if (n >= 3) {
    try {
      topicos = (await gerarResumo(textoTranscricao(reuniao.segmentos), { ...config, provedorResumo: 'basico' })).topicos ?? [];
    } catch {
      topicos = [];
    }
  }
  cacheAoVivo = { id: reuniao.id, trechos: n, topicos };
  return topicos;
};

const NOMES_MOTOR = { local: 'Whisper no seu PC', groq: 'Groq (nuvem)', assemblyai: 'AssemblyAI (nuvem)' };

const painelAoVivo = async (reuniao, config) => {
  const informacoes = reuniao.info ?? {};
  const tempo = el('span', { id: 'tempo-vivo', className: 'tempo-vivo', textContent: formatarTempo((Date.now() - reuniao.inicio) / 1000) });
  const etiquetas = [
    el('span', { className: 'tag', textContent: `Transcrição: ${NOMES_MOTOR[informacoes.motor] ?? 'ligada'}${informacoes.adiada ? ' (só no fim)' : ' (ao vivo)'}` }),
    el('span', { className: 'tag', textContent: informacoes.microfone === false ? '🎤 microfone desligado' : informacoes.microfone ? '🎤 microfone ligado' : '🎤 microfone: ?' })
  ];

  if (reuniao.status === 'processando') {
    return el('section', { className: 'ao-vivo' },
      el('div', { className: 'ao-vivo-topo' }, el('strong', { textContent: '⏳ Processando a reunião' })),
      el('p', { className: 'suave', textContent: 'Transcrevendo, resumindo e preparando o envio. Pode levar alguns minutos; esta tela atualiza sozinha.' }));
  }

  const topicos = await assuntosAteAgora(reuniao, config);
  const ultimas = reuniao.segmentos.slice(-6);
  const corpo = [];
  if (topicos.length) {
    corpo.push(el('h3', { textContent: 'Assuntos até agora' }),
      el('div', { className: 'etiquetas' }, ...topicos.map((t) => el('span', { className: 'tag', textContent: t }))),
      el('p', { className: 'suave', textContent: 'São as palavras mais faladas (cálculo local). O resumo completo, com decisões e itens de ação, sai quando a reunião terminar.' }));
  }
  if (ultimas.length) {
    corpo.push(el('h3', { textContent: 'Últimas falas' }), el('div', { className: 'falas' }, ...ultimas.map((seg) => linhaDeFala(reuniao, seg))));
  } else {
    corpo.push(el('p', { className: 'suave', textContent: informacoes.adiada
      ? 'Está gravando. O texto, os assuntos e o resumo aparecem quando a reunião terminar (a transcrição foi programada para o fim, para não pesar no computador). Para ver ao vivo, desmarque "Transcrever só depois que a reunião acabar" nas configurações e use o Groq.'
      : 'Está gravando. O primeiro trecho de texto aparece em alguns segundos...' }));
  }

  return el('section', { className: 'ao-vivo' },
    el('div', { className: 'ao-vivo-topo' }, el('span', { className: 'ponto-rec' }), el('strong', { textContent: 'Gravando agora' }), tempo),
    el('div', { className: 'etiquetas' }, ...etiquetas),
    ...corpo);
};

// Relógio do painel: avança a cada segundo sem redesenhar a tela inteira.
setInterval(() => {
  const campo = document.getElementById('tempo-vivo');
  if (campo && reuniaoAberta && reuniaoAberta.status === 'gravando') campo.textContent = formatarTempo((Date.now() - reuniaoAberta.inicio) / 1000);
}, 1000);

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
  const emAndamento = emAndamentoAgora(reuniao);
  const interrompida = estaInterrompida(reuniao);
  const aoVivo = emAndamento ? [await painelAoVivo(reuniao, config)] : [];
  const avisoInterrompida = interrompida
    ? [el('div', { className: 'aviso', textContent: 'Esta gravação parou de dar sinal: o app foi fechado durante a reunião, então o áudio não foi salvo. O que já tinha sido transcrito está abaixo. Você pode apagar esta reunião.' })]
    : [];

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
    el('div', { className: 'suave', textContent: `${new Date(reuniao.inicio).toLocaleString('pt-BR')} · ${formatarTempo(reuniao.status === 'gravando' && !interrompida ? (Date.now() - reuniao.inicio) / 1000 : reuniao.duracaoSeg)} ${ROTULOS[statusDe(reuniao)] ?? ''}` }),
    el('div', {}, 'Tipo: ', seletorTipo),
    ...aoVivo, ...avisoInterrompida, acoes, ...linhaNotion, ...avisos, ...(aoVivo.length ? [] : blocoResumo), transcricao, ...blocoAudio
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
  if (document.activeElement?.tagName === 'TEXTAREA') return;
  if (document.activeElement?.tagName === 'INPUT') return; // não atrapalha quem está digitando o título
  abrirDoEndereco();
}, 3000);
