// Motor de compatibilidade: calcula quanto uma vaga combina com o CV.
// Evolui a lógica original (match exato de requisitos) com:
//  - normalização + sinônimos de skills
//  - extração de skills da descrição quando a vaga não traz requisitos
//  - bônus por aderência de cargo/senioridade
//  - filtro de localização (remoto OK; presencial só na cidade do perfil)

import { Job, JobMatch, Profile } from '@/types';
import { canonical, canonicalSet, extractSkills, normalize } from '@/services/skills';

/** Requisitos efetivos da vaga: os declarados + os extraídos da descrição. */
export function jobRequirements(job: Job): string[] {
  const declared = job.requisitos ?? [];
  const fromText = extractSkills(`${job.titulo} ${job.descricao}`);
  return canonicalSet([...declared, ...fromText]);
}

/**
 * Retorna true se a vaga passa no filtro de localização do perfil.
 * Regra de ouro: presencial só vale se for na cidade do perfil.
 */
export function passesLocationFilter(job: Job, profile: Profile): boolean {
  if (job.modalidade === 'Remoto') return profile.aceitaRemoto;
  // Presencial ou Híbrido: só vale se for na cidade do perfil.
  if (job.modalidade === 'Presencial' || job.modalidade === 'Híbrido') {
    return localMatchesCity(job.local, profile.cidade);
  }
  // Indefinido: não descarta, deixa o usuário decidir na tela.
  return true;
}

function localMatchesCity(local: string, cidade: string): boolean {
  const l = normalize(local);
  const c = normalize(cidade);
  if (!c) return true;
  // aceita "Florianopolis", "Florianópolis - SC", "Floripa"
  const apelidos = c.includes('florianopolis') ? [c, 'floripa', 'florianopolis sc', 'grande florianopolis'] : [c];
  return apelidos.some((a) => l.includes(a)) || l.includes(c);
}

/** Calcula a compatibilidade (0-100) entre uma vaga e o perfil. */
export function computeMatch(job: Job, profile: Profile): JobMatch {
  const requisitos = jobRequirements(job);
  const minhas = canonicalSet(profile.competencias);
  const minhasSet = new Set(minhas);

  const compativeis = requisitos.filter((r) => minhasSet.has(r));
  const faltantes = requisitos.filter((r) => !minhasSet.has(r));

  // Dimensões do breakdown (0-100 cada).
  const skills = requisitos.length > 0 ? (compativeis.length / requisitos.length) * 100 : titleAffinity(job, profile) * 100;
  const cargo = titleAffinity(job, profile) * 100;
  const senioridade = seniorityAffinity(job, profile) * 100;
  const localizacao = passesLocationFilter(job, profile) ? 100 : 0;

  // Score final = média ponderada das dimensões.
  const score = Math.max(
    0,
    Math.min(100, Math.round(skills * 0.6 + cargo * 0.2 + senioridade * 0.12 + localizacao * 0.08)),
  );

  return {
    ...job,
    requisitos,
    compatibilidade: score,
    requisitosCompativeis: compativeis,
    requisitosFaltantes: faltantes,
    breakdown: {
      skills: Math.round(skills),
      cargo: Math.round(cargo),
      senioridade: Math.round(senioridade),
      localizacao: Math.round(localizacao),
    },
  };
}

/** 0..1 — quanto o título da vaga combina com o cargo/palavras-chave do perfil. */
function titleAffinity(job: Job, profile: Profile): number {
  const titulo = normalize(job.titulo);
  const alvo = [profile.titulo, ...profile.palavrasChave].map(normalize).filter(Boolean);
  if (alvo.length === 0) return 0;
  const palavras = new Set(alvo.flatMap((t) => t.split(/\s+/)).filter((w) => w.length > 2));
  if (palavras.size === 0) return 0;
  let hits = 0;
  for (const p of palavras) if (titulo.includes(p)) hits++;
  return Math.min(1, hits / palavras.size);
}

/** 0..1 — proximidade de senioridade. */
function seniorityAffinity(job: Job, profile: Profile): number {
  if (!job.nivel || job.nivel === 'Indefinido' || profile.senioridade === 'Indefinido') return 0.5;
  const ordem = ['Estágio', 'Júnior', 'Pleno', 'Sênior'];
  const a = ordem.indexOf(job.nivel);
  const b = ordem.indexOf(profile.senioridade);
  if (a < 0 || b < 0) return 0.5;
  const dist = Math.abs(a - b);
  return dist === 0 ? 1 : dist === 1 ? 0.6 : 0.2;
}

// A priorização por faixas vive em types.ts (priorityFor) para casar com o fluxograma.

/**
 * Aplica filtro de localização e ordena por compatibilidade (desc).
 * É o pipeline principal que as telas usam.
 */
export function rankJobs(jobs: Job[], profile: Profile): JobMatch[] {
  const seen = new Set<string>();
  return jobs
    .filter((j) => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return passesLocationFilter(j, profile);
    })
    .map((j) => computeMatch(j, profile))
    .sort((a, b) => b.compatibilidade - a.compatibilidade);
}
