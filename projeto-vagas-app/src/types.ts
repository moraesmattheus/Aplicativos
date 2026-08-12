// Tipos centrais do app de vagas.
// Mantidos simples e serializáveis (JSON) para funcionar tanto com
// armazenamento local (AsyncStorage) quanto na nuvem (Firestore) depois.

export type Modalidade = 'Remoto' | 'Presencial' | 'Híbrido' | 'Indefinido';

export type Senioridade = 'Estágio' | 'Júnior' | 'Pleno' | 'Sênior' | 'Indefinido';

/** Uma vaga normalizada, vinda de qualquer fonte (Remotive, JSearch, etc.). */
export interface Job {
  /** id estável: `${source}:${idExterno}` */
  id: string;
  /** origem da vaga: 'remotive' | 'remoteok' | 'arbeitnow' | 'jsearch' | 'adzuna' | 'jooble' | 'sample' */
  source: string;
  titulo: string;
  empresa: string;
  /** texto do local (cidade/UF) ou "Remoto" */
  local: string;
  modalidade: Modalidade;
  descricao: string;
  /** skills/keywords extraídas da vaga */
  requisitos: string[];
  salario?: string;
  nivel?: Senioridade;
  tipo?: string; // CLT / PJ / etc.
  /** URL para ver detalhes / aplicar */
  link: string;
  dataPublicacao?: string; // ISO
  logo?: string;
}

/** Quebra do score por dimensão (pág. 10 do fluxograma). */
export interface ScoreBreakdown {
  skills: number; // 0-100
  cargo: number; // aderência de título/cargo
  senioridade: number;
  localizacao: number;
}

/** Vaga com o resultado do cálculo de compatibilidade contra o CV. */
export interface JobMatch extends Job {
  compatibilidade: number; // 0-100
  requisitosCompativeis: string[];
  requisitosFaltantes: string[];
  breakdown: ScoreBreakdown;
}

/** Faixas de priorização (pág. 18 do fluxograma). */
export type PriorityTier = 'maxima' | 'recomendada' | 'avaliar' | 'baixa' | 'descartar';

export interface PriorityMeta {
  tier: PriorityTier;
  label: string;
  acao: string;
  emoji: string;
  color: string;
}

export function priorityFor(score: number): PriorityMeta {
  if (score >= 85) return { tier: 'maxima', label: 'Prioridade máxima', acao: 'Candidatura automática/assistida', emoji: '🟢', color: '#1F9D55' };
  if (score >= 75) return { tier: 'recomendada', label: 'Recomendada', acao: 'Candidatura recomendada', emoji: '🟢', color: '#30D158' };
  if (score >= 60) return { tier: 'avaliar', label: 'Avaliar', acao: 'Mostrar ao usuário', emoji: '🟡', color: '#C2790B' };
  if (score >= 40) return { tier: 'baixa', label: 'Baixa prioridade', acao: 'Não aplicar automaticamente', emoji: '🟠', color: '#FF9F0A' };
  return { tier: 'descartar', label: 'Descartar', acao: 'Não recomendar', emoji: '🔴', color: '#D92D20' };
}

export type KanbanStage =
  | 'Salvas'
  | 'Aplicado'
  | 'Triagem'
  | 'Entrevista'
  | 'Proposta'
  | 'Encerrado';

export const KANBAN_STAGES: KanbanStage[] = [
  'Salvas',
  'Aplicado',
  'Triagem',
  'Entrevista',
  'Proposta',
  'Encerrado',
];

/** Rótulo amigável + emoji para cada coluna do Kanban. */
export const STAGE_META: Record<KanbanStage, { label: string; emoji: string; color: string }> = {
  Salvas: { label: 'Salvas', emoji: '🔖', color: '#8E8E93' },
  Aplicado: { label: 'Aplicado', emoji: '📨', color: '#0A84FF' },
  Triagem: { label: 'Em triagem', emoji: '🔎', color: '#FF9F0A' },
  Entrevista: { label: 'Entrevista', emoji: '🗓️', color: '#5E5CE6' },
  Proposta: { label: 'Proposta', emoji: '🤝', color: '#30D158' },
  Encerrado: { label: 'Encerrado', emoji: '📁', color: '#8E8E93' },
};

export interface StageChange {
  stage: KanbanStage;
  at: string; // ISO
}

/** Uma candidatura que o usuário salvou/aplicou — o "card" do Kanban. */
export interface Application {
  id: string; // igual ao Job.id
  job: Job;
  match: number; // 0-100 no momento em que foi salva
  stage: KanbanStage;
  createdAt: string; // ISO
  updatedAt: string; // ISO (última mudança de etapa)
  notes?: string;
  interviewAt?: string; // ISO datetime da entrevista marcada
  calendarEventId?: string; // id do evento no calendário do aparelho
  history: StageChange[];
}

/** O perfil/CV do usuário — base para o cálculo de compatibilidade. */
export interface Profile {
  nome: string;
  /** cargo desejado, ex.: "Desenvolvedor Front-end" */
  titulo: string;
  senioridade: Senioridade;
  cidade: string; // cidade para vagas presenciais (padrão: Florianópolis)
  aceitaRemoto: boolean;
  /** skills que você tem — o coração do match */
  competencias: string[];
  /** termos usados na busca das APIs (ex.: "react native", "frontend") */
  palavrasChave: string[];
  /** resumo livre do currículo (opcional, ajuda o match por texto) */
  resumo?: string;
  email?: string;
  telefone?: string;
  linkedin?: string;
  portfolio?: string;
  pretensaoSalarial?: string;
  /** tipos de contratação aceitos (pode ser mais de um): CLT / PJ / Estágio / Freelance */
  tiposContratacao?: string[];
}

export const DEFAULT_PROFILE: Profile = {
  nome: '',
  titulo: 'Analista de Performance',
  senioridade: 'Pleno',
  cidade: 'Florianópolis',
  aceitaRemoto: true,
  competencias: [
    'meta ads',
    'google ads',
    'google analytics',
    'google tag manager',
    'e-commerce',
    'performance marketing',
    'tráfego pago',
    'looker studio',
  ],
  palavrasChave: ['analista de performance', 'growth', 'e-commerce', 'marketing'],
  resumo: '',
  email: '',
  telefone: '',
  linkedin: '',
  portfolio: '',
  pretensaoSalarial: '',
  tiposContratacao: ['CLT', 'PJ'],
};
