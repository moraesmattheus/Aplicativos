// Envia a reunião para o Notion usando a API oficial (https://developers.notion.com).
// Como funciona: você cria uma "integração" (um token), compartilha páginas/bancos com ela, e
// esta extensão cria páginas dentro deles. Cada TIPO de reunião tem o seu destino.

import { formatarTempo, textoTranscricao } from './formatar.js';

const API = 'https://api.notion.com/v1';
const VERSAO = '2022-06-28'; // versão da API (fixa, para o comportamento não mudar sozinho)
const LIMITE_TEXTO = 1900; // o Notion aceita no máximo 2000 caracteres por bloco de texto
const LIMITE_BLOCOS = 100; // e no máximo 100 blocos por pedido

class ErroNotion extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chamar = async (metodo, caminho, token, corpo) => {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const resposta = await fetch(API + caminho, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': VERSAO, 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    if (resposta.status === 429) {
      // "Muitos pedidos" (o Notion limita a ~3 por segundo): espera e tenta de novo.
      await esperar((Number(resposta.headers.get('retry-after')) || 1) * 1000);
      continue;
    }
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new ErroNotion(`Notion ${resposta.status}: ${dados.message ?? 'erro desconhecido'}`, resposta.status);
    return dados;
  }
  throw new ErroNotion('Notion: muitos pedidos seguidos, tente de novo em instantes', 429);
};

// Os links do Notion terminam com um código de 32 letras/números (o ID).
// Ex.: notion.so/Meu-Banco-1a2b3c...(32)?v=outroCodigo  -> o ID é o do CAMINHO, não o do "?v=".
export const extrairId = (link) => {
  const caminho = String(link).split(/[?#]/)[0].replace(/-/g, '');
  const encontrados = caminho.match(/[0-9a-f]{32}/gi);
  return encontrados ? encontrados.at(-1) : null;
};

const textoDe = (partes = []) => partes.map((p) => p.plain_text).join('');

// Descobre se o link é de um BANCO DE DADOS (cria uma linha) ou de uma PÁGINA (cria uma subpágina).
export const descobrirDestino = async (link, token) => {
  const id = extrairId(link);
  if (!id) throw new Error('não achei um endereço válido do Notion (cole o link da página ou do banco de dados)');

  try {
    const banco = await chamar('GET', `/databases/${id}`, token);
    const [propTitulo] = Object.entries(banco.properties).find(([, p]) => p.type === 'title');
    return { id, tipo: 'banco', propTitulo, nome: textoDe(banco.title) || 'Banco sem nome' };
  } catch (erro) {
    if (erro.status !== 400 && erro.status !== 404) throw erro; // 400 = "isso é uma página, não um banco"
  }

  try {
    const pagina = await chamar('GET', `/pages/${id}`, token);
    const titulo = Object.values(pagina.properties).find((p) => p.type === 'title');
    return { id, tipo: 'pagina', nome: textoDe(titulo?.title) || 'Página sem título' };
  } catch (erro) {
    if (erro.status === 404) {
      throw new Error('sem acesso: no Notion abra essa página, clique em ••• > Conexões e adicione a sua integração');
    }
    throw erro;
  }
};

// ---------- Montagem do conteúdo (blocos) ----------

const textoRico = (texto) => [{ type: 'text', text: { content: texto } }];

const fatiar = (texto) => {
  const partes = [];
  for (let i = 0; i < texto.length; i += LIMITE_TEXTO) partes.push(texto.slice(i, i + LIMITE_TEXTO));
  return partes.length ? partes : [''];
};

const paragrafos = (texto) =>
  fatiar(texto).map((parte) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: textoRico(parte) } }));

const cabecalho = (nivel, texto) => ({
  object: 'block', type: `heading_${nivel}`, [`heading_${nivel}`]: { rich_text: textoRico(texto) }
});

const marcador = (texto) => ({
  object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: textoRico(texto.slice(0, LIMITE_TEXTO)) }
});

const tarefa = (acao) => {
  const detalhes = [acao.responsavel && `responsável: ${acao.responsavel}`, acao.prazo && `prazo: ${acao.prazo}`]
    .filter(Boolean).join(', ');
  const texto = `${acao.tarefa}${detalhes ? ` (${detalhes})` : ''}`;
  return { object: 'block', type: 'to_do', to_do: { rich_text: textoRico(texto.slice(0, LIMITE_TEXTO)), checked: false } };
};

export const reuniaoParaBlocos = (reuniao) => {
  const { resumo } = reuniao;
  const meta = [new Date(reuniao.inicio).toLocaleString('pt-BR'), formatarTempo(reuniao.duracaoSeg), reuniao.categoria && `Tipo: ${reuniao.categoria}`]
    .filter(Boolean).join(' · ');
  const blocos = [...paragrafos(meta)];
  if (resumo) {
    blocos.push(cabecalho(2, 'Resumo'), ...paragrafos(resumo.resumo));
    if (resumo.topicos.length) blocos.push(cabecalho(3, 'Tópicos'), ...resumo.topicos.map(marcador));
    if (resumo.decisoes.length) blocos.push(cabecalho(3, 'Decisões'), ...resumo.decisoes.map(marcador));
    if (resumo.acoes.length) blocos.push(cabecalho(3, 'Itens de ação'), ...resumo.acoes.map(tarefa));
  }
  blocos.push(cabecalho(2, 'Transcrição'));
  textoTranscricao(reuniao.segmentos).split('\n').filter(Boolean).forEach((linha) => blocos.push(...paragrafos(linha)));
  return blocos;
};

// ---------- Escolha do destino e envio ----------

// Procura o destino do tipo da reunião; se não houver, usa o destino padrão.
export const destinoDoTipo = (categoria, config) => {
  const doTipo = config.destinos?.find((d) => d.nome === categoria && d.link?.trim());
  if (doTipo) return { link: doTipo.link, rotulo: doTipo.nome };
  if (config.destinoPadrao?.trim()) return { link: config.destinoPadrao, rotulo: 'padrão' };
  return null;
};

export const enviarAoNotion = async (reuniao, config) => {
  const token = config.notionToken?.trim();
  if (!token) throw new Error('falta o token do Notion nas Configurações');
  const alvo = destinoDoTipo(reuniao.categoria, config);
  if (!alvo) {
    throw new Error(`nenhum destino do Notion para "${reuniao.categoria ?? 'sem tipo'}" (configure o tipo ou um destino padrão)`);
  }

  const destino = await descobrirDestino(alvo.link, token);
  const titulo = textoRico(reuniao.titulo.slice(0, 200));
  const blocos = reuniaoParaBlocos(reuniao);

  const pagina = await chamar('POST', '/pages', token, {
    parent: destino.tipo === 'banco' ? { database_id: destino.id } : { page_id: destino.id },
    properties: destino.tipo === 'banco' ? { [destino.propTitulo]: { title: titulo } } : { title: { title: titulo } },
    children: blocos.slice(0, LIMITE_BLOCOS)
  });
  // O que passou de 100 blocos vai em pedidos seguintes, na mesma página.
  for (let i = LIMITE_BLOCOS; i < blocos.length; i += LIMITE_BLOCOS) {
    await chamar('PATCH', `/blocks/${pagina.id}/children`, token, { children: blocos.slice(i, i + LIMITE_BLOCOS) });
  }
  return { url: pagina.url, destino: destino.nome, tipo: alvo.rotulo };
};
