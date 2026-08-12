// Motor de análise ATS (Applicant Tracking System) — roda 100% no aparelho.
// Simula a "leitura dos robôs de RH": pontua o currículo de 0-100, aponta o que
// está fraco e o que fazer, e EXTRAI os dados do CV para preencher o Perfil.
//
// Reaproveita o dicionário de skills (src/services/skills.ts) para reconhecer
// competências de Marketing/Performance/Tech no texto — mesma base do matching.
//
// Fase 2 (backend + Claude API) vai plugar aqui uma leitura profunda de PDF/DOCX
// e sugestões geradas por IA; a assinatura desta função foi pensada para isso.

import { Profile, Senioridade } from '@/types';
import { canonicalSet, extractSkills, normalize } from '@/services/skills';

/** Gravidade de um problema encontrado no currículo. */
export type Gravidade = 'alta' | 'media' | 'baixa';

/** Um problema apontado pelo ATS + a sugestão de correção. */
export interface AtsIssue {
  campo: string;
  gravidade: Gravidade;
  problema: string;
  sugestao: string;
}

/** Quebra do score por dimensão (0-100 cada). */
export interface AtsBreakdown {
  contato: number;
  palavrasChave: number;
  secoes: number;
  resultados: number;
  formato: number;
}

/** Dados extraídos do CV para preencher o Perfil automaticamente. */
export interface ExtractedCV {
  nome?: string;
  email?: string;
  telefone?: string;
  linkedin?: string;
  portfolio?: string;
  titulo?: string;
  senioridade?: Senioridade;
  competencias: string[];
  resumo?: string;
}

export type AtsNivel = 'excelente' | 'bom' | 'ajustes' | 'ruim';

export interface AtsResult {
  score: number; // 0-100
  nivel: AtsNivel;
  aprovado: boolean; // score alto o bastante para "subir" e preencher sozinho
  breakdown: AtsBreakdown;
  issues: AtsIssue[]; // ordenados por gravidade (alta primeiro)
  pontosFortes: string[];
  skillsEncontradas: string[];
  skillsDoCargoFaltando: string[];
  extracted: ExtractedCV;
  palavras: number;
}

/** Peso de cada dimensão no score final (soma = 100). */
const PESOS: Record<keyof AtsBreakdown, number> = {
  palavrasChave: 32,
  contato: 20,
  secoes: 18,
  resultados: 18,
  formato: 12,
};

// Cabeçalhos de seção que um ATS espera encontrar (em pt-BR e en).
const SECOES = {
  experiencia: ['experiencia', 'experiencia profissional', 'historico profissional', 'experience', 'trajetoria'],
  formacao: ['formacao', 'formacao academica', 'educacao', 'escolaridade', 'education', 'academico'],
  habilidades: ['habilidades', 'competencias', 'skills', 'conhecimentos', 'qualificacoes', 'ferramentas'],
  resumo: ['resumo', 'objetivo', 'sobre', 'perfil profissional', 'summary', 'objective'],
};

const VERBOS_ACAO = [
  'liderei', 'gerenciei', 'aumentei', 'reduzi', 'implementei', 'criei', 'desenvolvi', 'otimizei',
  'lancei', 'construi', 'coordenei', 'planejei', 'executei', 'analisei', 'automatizei', 'escalei',
  'conquistei', 'entreguei', 'gerei', 'melhorei', 'estruturei', 'negociei',
];

const SENIORIDADES: { termo: string; nivel: Senioridade }[] = [
  { termo: 'estagi', nivel: 'Estágio' },
  { termo: 'junior', nivel: 'Júnior' },
  { termo: 'pleno', nivel: 'Pleno' },
  { termo: 'senior', nivel: 'Sênior' },
];

// Cargos comuns para inferir o título quando não há cabeçalho explícito.
const CARGOS = [
  'analista de performance', 'analista de marketing', 'analista de trafego', 'gestor de trafego',
  'especialista em midia paga', 'growth', 'analista de growth', 'coordenador de marketing',
  'social media', 'analista de dados', 'analista de e-commerce', 'analista de bi',
  'desenvolvedor', 'desenvolvedora', 'engenheiro de software', 'designer', 'product manager',
];

/**
 * Analisa o texto de um currículo e devolve o score ATS + diagnóstico + extração.
 * `alvo` (opcional) é o perfil-alvo: usamos as competências dele para medir o
 * "gap de palavras-chave" contra a vaga que a pessoa quer.
 */
export function analyzeCV(textoBruto: string, alvo?: Profile): AtsResult {
  const texto = textoBruto ?? '';
  const n = normalize(texto);
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const palavras = n.split(/\s+/).filter(Boolean).length;

  const issues: AtsIssue[] = [];
  const pontosFortes: string[] = [];

  // ---------- Extração de dados ----------
  const email = matchOne(texto, /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const telefone = matchOne(
    texto,
    /(\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/,
  );
  const linkedin = matchOne(texto, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-z0-9-_%]+/i);
  const portfolio = matchOne(
    texto,
    /(?:https?:\/\/)?(?:www\.)?(?:github\.com|behance\.net|dribbble\.com|[a-z0-9-]+\.(?:com|com\.br|dev|io|me))\/[a-z0-9-_%./]*/i,
  );
  const skills = canonicalSet(extractSkills(texto));
  const senioridade = detectSenioridade(n);
  const titulo = detectTitulo(n, linhas);
  const nome = detectNome(linhas, email);
  const resumo = detectResumo(texto);

  const extracted: ExtractedCV = {
    nome,
    email,
    telefone: telefone?.trim(),
    linkedin: linkedin ? normalizeUrl(linkedin) : undefined,
    portfolio: portfolio && !linkedin?.includes(portfolio) ? normalizeUrl(portfolio) : undefined,
    titulo,
    senioridade,
    competencias: skills,
    resumo,
  };

  // ---------- 1. Contato (20) ----------
  let contato = 0;
  if (email) contato += 45; else issues.push({ campo: 'Contato', gravidade: 'alta', problema: 'Nenhum e-mail encontrado.', sugestao: 'Coloque um e-mail profissional no topo do currículo.' });
  if (telefone) contato += 30; else issues.push({ campo: 'Contato', gravidade: 'media', problema: 'Telefone não localizado.', sugestao: 'Inclua um telefone com DDD, ex.: (48) 99999-9999.' });
  if (linkedin) contato += 25; else issues.push({ campo: 'Contato', gravidade: 'media', problema: 'LinkedIn ausente.', sugestao: 'Adicione a URL do seu LinkedIn — recrutadores quase sempre procuram.' });
  contato = Math.min(100, contato);
  if (contato >= 70) pontosFortes.push('Dados de contato completos e legíveis.');

  // ---------- 2. Palavras-chave / skills (32) ----------
  const desejadas = alvo ? canonicalSet(alvo.competencias) : [];
  const faltando = desejadas.filter((s) => !skills.includes(s));
  // base: quantidade de skills reconhecidas (satura em ~10) + cobertura do cargo-alvo
  const densidade = Math.min(1, skills.length / 10);
  const cobertura = desejadas.length > 0 ? (desejadas.length - faltando.length) / desejadas.length : densidade;
  const palavrasChave = Math.round((densidade * 0.5 + cobertura * 0.5) * 100);
  if (skills.length === 0) {
    issues.push({ campo: 'Palavras-chave', gravidade: 'alta', problema: 'Nenhuma competência técnica reconhecida.', sugestao: 'Cite ferramentas e skills exatas (ex.: Meta Ads, Google Analytics, GA4, Looker Studio).' });
  } else if (skills.length < 5) {
    issues.push({ campo: 'Palavras-chave', gravidade: 'media', problema: `Só ${skills.length} competência(s) reconhecida(s).`, sugestao: 'Liste mais ferramentas/skills que você domina — o ATS filtra por palavras exatas.' });
  } else {
    pontosFortes.push(`${skills.length} competências reconhecidas pelo ATS.`);
  }
  if (faltando.length > 0) {
    issues.push({
      campo: 'Palavras-chave',
      gravidade: 'media',
      problema: `Faltam ${faltando.length} skill(s) do seu cargo-alvo: ${faltando.slice(0, 6).join(', ')}.`,
      sugestao: 'Se você tem essas skills, inclua-as no currículo com o nome exato.',
    });
  }

  // ---------- 3. Seções essenciais (18) ----------
  const temExperiencia = temSecao(n, SECOES.experiencia);
  const temFormacao = temSecao(n, SECOES.formacao);
  const temHabilidades = temSecao(n, SECOES.habilidades);
  const temResumo = temSecao(n, SECOES.resumo);
  const secoesOk = [temExperiencia, temFormacao, temHabilidades, temResumo].filter(Boolean).length;
  const secoes = Math.round((secoesOk / 4) * 100);
  if (!temExperiencia) issues.push({ campo: 'Estrutura', gravidade: 'alta', problema: 'Seção de experiência não identificada.', sugestao: 'Crie um bloco claro "Experiência profissional" com cargo, empresa e período.' });
  if (!temHabilidades) issues.push({ campo: 'Estrutura', gravidade: 'media', problema: 'Seção de habilidades/competências ausente.', sugestao: 'Adicione um bloco "Competências" — o ATS lê essa seção primeiro.' });
  if (!temFormacao) issues.push({ campo: 'Estrutura', gravidade: 'baixa', problema: 'Formação acadêmica não identificada.', sugestao: 'Inclua "Formação acadêmica" com curso e instituição.' });
  if (!temResumo) issues.push({ campo: 'Estrutura', gravidade: 'baixa', problema: 'Sem resumo/objetivo no topo.', sugestao: 'Abra com 2-3 linhas de resumo profissional com suas palavras-chave.' });
  if (secoesOk >= 3) pontosFortes.push('Estrutura de seções bem definida.');

  // ---------- 4. Resultados quantificados (18) ----------
  const numeros = (texto.match(/(\d+[.,]?\d*\s?%|r\$\s?\d|\d{2,})/gi) || []).length;
  const verbos = VERBOS_ACAO.filter((v) => n.includes(v)).length;
  const resultados = Math.min(100, Math.round(Math.min(1, numeros / 6) * 60 + Math.min(1, verbos / 5) * 40));
  if (numeros < 2) issues.push({ campo: 'Resultados', gravidade: 'alta', problema: 'Poucos números/métricas.', sugestao: 'Quantifique conquistas: "reduzi CPA em 30%", "gerenciei R$ 200k/mês em mídia".' });
  if (verbos < 2) issues.push({ campo: 'Resultados', gravidade: 'media', problema: 'Poucos verbos de ação.', sugestao: 'Comece frases com verbos: liderei, aumentei, otimizei, implementei.' });
  if (numeros >= 4 && verbos >= 3) pontosFortes.push('Conquistas quantificadas com verbos de ação.');

  // ---------- 5. Formato / tamanho (12) ----------
  let formato = 100;
  if (palavras < 150) { formato -= 55; issues.push({ campo: 'Formato', gravidade: 'alta', problema: `Currículo muito curto (${palavras} palavras).`, sugestao: 'Um CV de 1 página costuma ter 300-600 palavras. Detalhe mais suas experiências.' }); }
  else if (palavras > 1200) { formato -= 30; issues.push({ campo: 'Formato', gravidade: 'baixa', problema: `Currículo longo (${palavras} palavras).`, sugestao: 'Enxugue para 1-2 páginas focando no relevante para a vaga.' }); }
  if (temEmojiOuSimbolo(texto)) { formato -= 15; issues.push({ campo: 'Formato', gravidade: 'baixa', problema: 'Emojis/símbolos que o ATS pode não ler.', sugestao: 'Evite emojis e caracteres especiais no corpo do currículo.' }); }
  formato = Math.max(0, formato);
  if (formato >= 85) pontosFortes.push('Tamanho e formatação adequados para leitura automática.');

  // ---------- Score final ----------
  const breakdown: AtsBreakdown = { contato, palavrasChave, secoes, resultados, formato };
  const score = Math.round(
    (Object.keys(PESOS) as (keyof AtsBreakdown)[]).reduce(
      (acc, k) => acc + (breakdown[k] / 100) * PESOS[k],
      0,
    ),
  );

  issues.sort((a, b) => ordemGravidade(b.gravidade) - ordemGravidade(a.gravidade));

  return {
    score,
    nivel: nivelDoScore(score),
    aprovado: score >= 70,
    breakdown,
    issues,
    pontosFortes,
    skillsEncontradas: skills,
    skillsDoCargoFaltando: faltando,
    extracted,
    palavras,
  };
}

/**
 * Mescla os dados extraídos do CV no perfil atual, sem apagar o que já existe
 * quando o CV não trouxe a informação. Retorna um novo Profile pronto p/ salvar.
 */
export function mergeExtractedIntoProfile(atual: Profile, cv: ExtractedCV): Profile {
  const merge = <T,>(novo: T | undefined, velho: T): T =>
    novo !== undefined && novo !== null && (typeof novo !== 'string' || novo.length > 0) ? novo : velho;

  const competencias = cv.competencias.length > 0
    ? Array.from(new Set([...cv.competencias, ...atual.competencias]))
    : atual.competencias;

  return {
    ...atual,
    nome: merge(cv.nome, atual.nome),
    email: merge(cv.email, atual.email),
    telefone: merge(cv.telefone, atual.telefone),
    linkedin: merge(cv.linkedin, atual.linkedin),
    portfolio: merge(cv.portfolio, atual.portfolio),
    titulo: merge(cv.titulo, atual.titulo),
    senioridade: merge(cv.senioridade, atual.senioridade),
    resumo: merge(cv.resumo, atual.resumo),
    competencias,
  };
}

export const NIVEL_META: Record<AtsNivel, { label: string; emoji: string; color: string; frase: string }> = {
  excelente: { label: 'Excelente', emoji: '🟢', color: '#1F9D55', frase: 'Currículo pronto para os robôs de RH.' },
  bom: { label: 'Bom', emoji: '🟢', color: '#30D158', frase: 'Passa no ATS — uns ajustes deixam perfeito.' },
  ajustes: { label: 'Precisa de ajustes', emoji: '🟡', color: '#C2790B', frase: 'Corrija os pontos abaixo antes de enviar.' },
  ruim: { label: 'Precisa melhorar', emoji: '🔴', color: '#D92D20', frase: 'O ATS provavelmente barraria — priorize as correções.' },
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function nivelDoScore(s: number): AtsNivel {
  if (s >= 82) return 'excelente';
  if (s >= 70) return 'bom';
  if (s >= 50) return 'ajustes';
  return 'ruim';
}

function ordemGravidade(g: Gravidade): number {
  return g === 'alta' ? 3 : g === 'media' ? 2 : 1;
}

function matchOne(texto: string, re: RegExp): string | undefined {
  const m = texto.match(re);
  return m ? m[0] : undefined;
}

function normalizeUrl(u: string): string {
  return u.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
}

function temSecao(n: string, apelidos: string[]): boolean {
  return apelidos.some((a) => n.includes(normalize(a)));
}

function detectSenioridade(n: string): Senioridade | undefined {
  for (const s of SENIORIDADES) if (n.includes(s.termo)) return s.nivel;
  return undefined;
}

function detectTitulo(n: string, linhas: string[]): string | undefined {
  for (const cargo of CARGOS) if (n.includes(normalize(cargo))) return titleCase(cargo);
  // fallback: a 2ª linha costuma ser o cargo (a 1ª é o nome)
  const cand = linhas[1];
  if (cand && cand.length <= 45 && !cand.includes('@') && /[a-zA-Z]/.test(cand)) return cand;
  return undefined;
}

function detectNome(linhas: string[], email?: string): string | undefined {
  for (const l of linhas.slice(0, 4)) {
    const palavras = l.split(/\s+/);
    const pareceNome = palavras.length >= 2 && palavras.length <= 4 && l.length <= 40 && !/\d|@|http/.test(l);
    if (pareceNome) return l;
  }
  // fallback: parte antes do @ do e-mail
  if (email) return titleCase(email.split('@')[0].replace(/[._-]+/g, ' '));
  return undefined;
}

function detectResumo(texto: string): string | undefined {
  const n = normalize(texto);
  for (const chave of SECOES.resumo) {
    const idx = n.indexOf(normalize(chave));
    if (idx >= 0) {
      const trecho = texto.slice(idx).split(/\r?\n/).slice(1).join(' ').trim();
      if (trecho.length > 30) return trecho.slice(0, 320).trim();
    }
  }
  return undefined;
}

function temEmojiOuSimbolo(texto: string): boolean {
  return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(texto);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
