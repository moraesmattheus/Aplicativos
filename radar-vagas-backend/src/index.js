// Cloudflare Worker — backend de IA do Radar de Vagas (Fase 2).
//
// Recebe um currículo (texto ou PDF em base64) e devolve uma análise ATS
// profunda feita pelo Google Gemini, no MESMO formato do ATS local do app
// (score, breakdown, issues, extracted) + um resumo escrito pela IA.
//
// A chave do Gemini vem do secret GEMINI_API_KEY (nunca fica no app).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, servico: 'radar-vagas-backend', modelo: env.GEMINI_MODEL || 'gemini-2.0-flash' });
    }

    if (request.method === 'POST' && url.pathname === '/cv') {
      if (!env.GEMINI_API_KEY) return json({ erro: 'GEMINI_API_KEY não configurada no Worker.' }, 500);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ erro: 'Body inválido (esperado JSON).' }, 400);
      }
      try {
        const resultado = await analisarCV(body, env);
        return json(resultado);
      } catch (e) {
        return json({ erro: e?.message || 'Falha na análise por IA.' }, 502);
      }
    }

    return json({ erro: 'Rota não encontrada.' }, 404);
  },
};

async function analisarCV(body, env) {
  const { texto, pdfBase64, mimeType, alvo } = body || {};
  if (!texto && !pdfBase64) throw new Error('Envie "texto" ou "pdfBase64" do currículo.');

  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const alvoTxt = alvo
    ? `Cargo-alvo: ${alvo.titulo || '—'}. Skills desejadas: ${(alvo.competencias || []).join(', ') || '—'}.`
    : 'Sem cargo-alvo específico.';

  const instrucao = `Você é um avaliador ATS (Applicant Tracking System) especialista em recrutamento no Brasil,
com foco em Marketing/Performance/Growth/E-commerce. Analise o CURRÍCULO abaixo e responda SOMENTE com
um JSON válido (sem markdown, sem comentários) neste formato exato:

{
  "score": <inteiro 0-100>,
  "nivel": "<excelente|bom|ajustes|ruim>",
  "breakdown": { "contato": <0-100>, "palavrasChave": <0-100>, "secoes": <0-100>, "resultados": <0-100>, "formato": <0-100> },
  "pontosFortes": ["<frase curta>", "..."],
  "issues": [ { "campo": "<Contato|Palavras-chave|Estrutura|Resultados|Formato>", "gravidade": "<alta|media|baixa>", "problema": "<o que está errado>", "sugestao": "<como corrigir, específico>" } ],
  "extracted": {
    "nome": "<ou vazio>", "email": "<ou vazio>", "telefone": "<ou vazio>",
    "linkedin": "<ou vazio>", "portfolio": "<ou vazio>",
    "titulo": "<cargo principal>", "senioridade": "<Estágio|Júnior|Pleno|Sênior ou vazio>",
    "competencias": ["<skill canônica>", "..."],
    "resumo": "<resumo profissional de 2-3 linhas>"
  },
  "resumoIA": "<parágrafo curto e honesto avaliando o currículo e o que priorizar>"
}

Regras: seja rigoroso mas justo; valorize métricas quantificadas (%, R$, números) e verbos de ação;
skills devem ser termos exatos (ex.: Meta Ads, Google Analytics, GA4, Looker Studio); escreva em
português. ${alvoTxt}`;

  const parts = [{ text: instrucao }];
  if (pdfBase64) {
    parts.push({ inline_data: { mime_type: mimeType || 'application/pdf', data: pdfBase64 } });
  } else {
    parts.push({ text: `\n\nCURRÍCULO:\n"""${texto}"""` });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Resposta vazia da IA.');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // tenta extrair o primeiro bloco { ... } caso venha com texto ao redor
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('IA não retornou JSON válido.');
    parsed = JSON.parse(m[0]);
  }

  return normalizar(parsed);
}

// Garante os campos e limites, para o app confiar no formato.
function normalizar(p) {
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const bd = p.breakdown || {};
  const ex = p.extracted || {};
  return {
    fonte: 'ia',
    score: clamp(p.score),
    nivel: ['excelente', 'bom', 'ajustes', 'ruim'].includes(p.nivel) ? p.nivel : nivelDoScore(clamp(p.score)),
    breakdown: {
      contato: clamp(bd.contato),
      palavrasChave: clamp(bd.palavrasChave),
      secoes: clamp(bd.secoes),
      resultados: clamp(bd.resultados),
      formato: clamp(bd.formato),
    },
    pontosFortes: Array.isArray(p.pontosFortes) ? p.pontosFortes.slice(0, 8).map(String) : [],
    issues: Array.isArray(p.issues)
      ? p.issues.slice(0, 20).map((i) => ({
          campo: String(i.campo || 'Geral'),
          gravidade: ['alta', 'media', 'baixa'].includes(i.gravidade) ? i.gravidade : 'media',
          problema: String(i.problema || ''),
          sugestao: String(i.sugestao || ''),
        }))
      : [],
    extracted: {
      nome: str(ex.nome),
      email: str(ex.email),
      telefone: str(ex.telefone),
      linkedin: str(ex.linkedin),
      portfolio: str(ex.portfolio),
      titulo: str(ex.titulo),
      senioridade: ['Estágio', 'Júnior', 'Pleno', 'Sênior'].includes(ex.senioridade) ? ex.senioridade : undefined,
      competencias: Array.isArray(ex.competencias) ? ex.competencias.map(String).slice(0, 40) : [],
      resumo: str(ex.resumo),
    },
    resumoIA: str(p.resumoIA),
  };
}

function str(v) {
  return v == null ? undefined : String(v).trim() || undefined;
}
function nivelDoScore(s) {
  if (s >= 82) return 'excelente';
  if (s >= 70) return 'bom';
  if (s >= 50) return 'ajustes';
  return 'ruim';
}
