// Gera resumo, tópicos, decisões e itens de ação a partir da transcrição.
// Todos os provedores devolvem o MESMO formato:
//   { resumo: string, topicos: string[], decisoes: string[], acoes: [{ tarefa, responsavel, prazo }], origem }

const PROMPT = (transcricao) => `Você é um assistente que escreve atas de reunião em português do Brasil.
Abaixo está a transcrição automática de uma reunião (pode ter erros de reconhecimento de voz).
Responda SOMENTE com um JSON válido neste formato:
{"resumo":"parágrafo curto com o essencial","topicos":["..."],"decisoes":["..."],"acoes":[{"tarefa":"...","responsavel":"nome ou null","prazo":"prazo ou null"}]}
Regras: não invente nada que não foi dito; se não houver decisões ou ações, use listas vazias.

TRANSCRIÇÃO:
${transcricao}`;

// ---------- Provedor 1: resumo básico (sem IA, 100% offline) ----------

const STOPWORDS = new Set(
  'a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que e é ser foi são mas ou se já não sim como mais muito eu você ele ela nós eles elas isso isto esse essa aqui ali então tá né aí também ter tem têm temos vai vamos pra pro está estão estou tipo coisa'.split(' ')
);

const REGEX_ACAO =
  /\b(vou|vamos|precisamos|preciso|temos que|tenho que|tem que|combinado|ficou de|fica de|responsável|prazo|até (amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|o fim|o final|dia \d+)|enviar|mandar|agendar|marcar|revisar|finalizar)\b/i;

const palavrasRelevantes = (frase) =>
  (frase.toLowerCase().match(/[a-zà-ú]{4,}/g) ?? []).filter((p) => !STOPWORDS.has(p));

const resumoBasico = (transcricao) => {
  const limpo = transcricao.replace(/\[\d+:\d{2}(:\d{2})?\]\s*/g, '');
  const frases = limpo
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 25);

  const frequencia = new Map();
  frases.forEach((f) => palavrasRelevantes(f).forEach((p) => frequencia.set(p, (frequencia.get(p) ?? 0) + 1)));

  // Nota de cada frase = soma da frequência das suas palavras / raiz do tamanho (para não favorecer frases enormes).
  const pontuadas = frases.map((frase, posicao) => {
    const palavras = palavrasRelevantes(frase);
    const nota = palavras.reduce((s, p) => s + frequencia.get(p), 0) / Math.sqrt(palavras.length || 1);
    return { frase, posicao, nota };
  });

  const escolhidas = [...pontuadas]
    .sort((a, b) => b.nota - a.nota)
    .slice(0, 5)
    .sort((a, b) => a.posicao - b.posicao) // volta para a ordem em que foram ditas
    .map((p) => p.frase);

  const topicos = [...frequencia.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([palavra]) => palavra);

  const acoes = frases.filter((f) => REGEX_ACAO.test(f)).slice(0, 10).map((tarefa) => ({ tarefa, responsavel: null, prazo: null }));

  return {
    resumo: escolhidas.join(' ') || 'Transcrição curta demais para resumir.',
    topicos,
    decisoes: [],
    acoes,
    origem: 'basico'
  };
};

// ---------- Provedor 2: Google Gemini (chave grátis em aistudio.google.com) ----------

const chamarGemini = async (transcricao, config) => {
  if (!config.geminiKey) throw new Error('falta a chave do Gemini nas Configurações');
  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModelo}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: PROMPT(transcricao) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    }
  );
  if (!resposta.ok) throw new Error(`Gemini respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  const dados = await resposta.json();
  return dados.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
};

// ---------- Provedor 3: Ollama (IA rodando no seu PC) ----------

const chamarOllama = async (transcricao, config) => {
  const resposta = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModelo,
      stream: false,
      format: 'json',
      messages: [{ role: 'user', content: PROMPT(transcricao) }]
    })
  });
  if (!resposta.ok) throw new Error(`Ollama respondeu ${resposta.status}`);
  const dados = await resposta.json();
  return dados.message?.content ?? '';
};

// ---------- Utilidades ----------

const lerJson = (texto) => {
  const semCercas = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(semCercas);
};

const comoLista = (valor) => (Array.isArray(valor) ? valor.map(String) : []);

const normalizar = (bruto, origem) => ({
  resumo: String(bruto.resumo ?? ''),
  topicos: comoLista(bruto.topicos),
  decisoes: comoLista(bruto.decisoes),
  acoes: (Array.isArray(bruto.acoes) ? bruto.acoes : []).map((a) => ({
    tarefa: String(a.tarefa ?? a),
    responsavel: a.responsavel && a.responsavel !== 'null' ? String(a.responsavel) : null,
    prazo: a.prazo && a.prazo !== 'null' ? String(a.prazo) : null
  })),
  origem
});

export const gerarResumo = async (transcricao, config) => {
  if (config.provedorResumo === 'gemini') return normalizar(lerJson(await chamarGemini(transcricao, config)), 'gemini');
  if (config.provedorResumo === 'ollama') return normalizar(lerJson(await chamarOllama(transcricao, config)), 'ollama');
  return resumoBasico(transcricao);
};
