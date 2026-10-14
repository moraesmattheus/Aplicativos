// Funções "puras" de formatação (recebem dados, devolvem texto; não mexem em nada fora delas).

export const formatarTempo = (segundosTotais) => {
  const horas = Math.floor(segundosTotais / 3600);
  const minutos = String(Math.floor((segundosTotais % 3600) / 60)).padStart(2, '0');
  const segundos = String(Math.floor(segundosTotais % 60)).padStart(2, '0');
  return horas > 0 ? `${horas}:${minutos}:${segundos}` : `${minutos}:${segundos}`;
};

export const textoTranscricao = (segmentos) =>
  segmentos.map((s) => `[${formatarTempo(s.inicioSeg)}] ${s.texto}`).join('\n');

const lista = (itens) => itens.map((item) => `- ${item}`).join('\n');

const linhaAcao = (acao) => {
  const detalhes = [acao.responsavel && `responsável: ${acao.responsavel}`, acao.prazo && `prazo: ${acao.prazo}`]
    .filter(Boolean)
    .join(', ');
  return `- [ ] ${acao.tarefa}${detalhes ? ` (${detalhes})` : ''}`;
};

// Monta o texto em Markdown (dá para colar direto numa página do Notion!).
export const reuniaoParaMarkdown = (reuniao) => {
  const { resumo } = reuniao;
  const partes = [`# ${reuniao.titulo}`, `${new Date(reuniao.inicio).toLocaleString('pt-BR')} · ${formatarTempo(reuniao.duracaoSeg)}`];
  if (resumo) {
    partes.push('## Resumo', resumo.resumo);
    if (resumo.topicos.length) partes.push('## Tópicos', lista(resumo.topicos));
    if (resumo.decisoes.length) partes.push('## Decisões', lista(resumo.decisoes));
    if (resumo.acoes.length) partes.push('## Itens de ação', resumo.acoes.map(linhaAcao).join('\n'));
  }
  partes.push('## Transcrição', textoTranscricao(reuniao.segmentos));
  return partes.join('\n\n');
};
