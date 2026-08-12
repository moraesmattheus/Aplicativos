// Cliente do backend de IA (Fase 2). Chama o Cloudflare Worker que usa o Gemini
// para analisar o currículo. Se o backend não estiver configurado, o app segue
// usando o ATS local (src/services/ats.ts) — este módulo é só a ponte.
//
// A chave da IA NUNCA passa por aqui: ela vive como secret no Worker. O app só
// conhece a URL pública do backend (configurada em Perfil → ⚙️ Configurações).

import { AtsResult } from '@/services/ats';
import { Profile } from '@/types';

export interface AiCVResult extends AtsResult {
  /** parágrafo escrito pela IA avaliando o currículo (extra além do ATS local). */
  resumoIA?: string;
}

export interface AnalisarIAInput {
  texto?: string;
  pdfBase64?: string;
  mimeType?: string;
  alvo?: Profile;
}

/** Envia o CV ao backend e devolve o resultado no formato do ATS (para a mesma UI). */
export async function analisarCVComIA(backendUrl: string, input: AnalisarIAInput): Promise<AiCVResult> {
  const base = backendUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('URL do backend de IA não configurada.');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${base}/cv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.erro) {
      throw new Error(data?.erro || `Backend respondeu ${res.status}.`);
    }
    return paraAtsResult(data, input);
  } finally {
    clearTimeout(timeout);
  }
}

/** Confere rapidamente se o backend está de pé. */
export async function pingBackend(backendUrl: string): Promise<boolean> {
  try {
    const base = backendUrl.trim().replace(/\/+$/, '');
    const res = await fetch(`${base}/`, { method: 'GET' });
    const d = await res.json().catch(() => ({}));
    return res.ok && d?.ok === true;
  } catch {
    return false;
  }
}

// Mapeia a resposta do Worker para o AtsResult que a tela de Currículo já sabe renderizar.
function paraAtsResult(d: any, input: AnalisarIAInput): AiCVResult {
  const competencias: string[] = Array.isArray(d?.extracted?.competencias) ? d.extracted.competencias : [];
  const score = Math.max(0, Math.min(100, Math.round(Number(d?.score) || 0)));
  const bd = d?.breakdown || {};
  const palavras = input.texto ? input.texto.split(/\s+/).filter(Boolean).length : 0;

  return {
    score,
    nivel: d?.nivel ?? 'ajustes',
    aprovado: score >= 70,
    breakdown: {
      contato: n(bd.contato),
      palavrasChave: n(bd.palavrasChave),
      secoes: n(bd.secoes),
      resultados: n(bd.resultados),
      formato: n(bd.formato),
    },
    issues: Array.isArray(d?.issues) ? d.issues : [],
    pontosFortes: Array.isArray(d?.pontosFortes) ? d.pontosFortes : [],
    skillsEncontradas: competencias,
    skillsDoCargoFaltando: [],
    extracted: {
      nome: d?.extracted?.nome,
      email: d?.extracted?.email,
      telefone: d?.extracted?.telefone,
      linkedin: d?.extracted?.linkedin,
      portfolio: d?.extracted?.portfolio,
      titulo: d?.extracted?.titulo,
      senioridade: d?.extracted?.senioridade,
      competencias,
      resumo: d?.extracted?.resumo,
    },
    palavras,
    resumoIA: d?.resumoIA,
  };
}

function n(v: any): number {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
}
