// Agregador de vagas: consulta várias APIs legítimas em paralelo, normaliza
// tudo para o tipo `Job` e devolve uma lista deduplicada.
//
// Fontes SEM chave (funcionam de cara): Remotive, RemoteOK, Arbeitnow.
// Fontes COM chave opcional (mais cobertura, inclui presencial em Floripa):
//   JSearch (Google for Jobs via RapidAPI), Adzuna, Jooble.
//
// Filosofia: cada fonte é isolada em try/catch — se uma cair, as outras seguem.

import { Job, Modalidade } from '@/types';
import { Settings } from '@/services/storage';
import { extractSkills, normalize } from '@/services/skills';

export interface SearchQuery {
  termo: string; // ex.: "react native"
  cidade: string; // ex.: "Florianópolis"
  remoto: boolean; // incluir vagas remotas?
}

type Source = { nome: string; run: (q: SearchQuery, s: Settings) => Promise<Job[]> };

const TIMEOUT_MS = 12000;

async function fetchJSON<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function inferModalidade(text: string, remoteFlag?: boolean): Modalidade {
  if (remoteFlag === true) return 'Remoto';
  const n = normalize(text);
  if (/(remote|remoto|home office|anywhere|worldwide|100% remoto)/.test(n)) return 'Remoto';
  if (/(h[íi]brido|hybrid)/.test(n)) return 'Híbrido';
  if (remoteFlag === false) return 'Presencial';
  return 'Indefinido';
}

/** Mantém remotas realmente acessíveis do Brasil/LATAM/global (evita "USA only"). */
function remotoAcessivel(local: string): boolean {
  const n = normalize(local);
  if (!n) return true;
  return /(worldwide|anywhere|global|latam|latin|america|brazil|brasil|emea|any)/.test(n) || !/only|apenas/.test(n);
}

function toJob(partial: Omit<Job, 'requisitos'> & { requisitos?: string[] }): Job {
  const requisitos =
    partial.requisitos && partial.requisitos.length > 0
      ? partial.requisitos
      : extractSkills(`${partial.titulo} ${partial.descricao}`);
  return { ...partial, requisitos };
}

// ------------------------------------------------------------------
// Fontes sem chave
// ------------------------------------------------------------------

const remotive: Source = {
  nome: 'Remotive',
  run: async (q) => {
    if (!q.remoto) return [];
    type R = {
      jobs: {
        id: number;
        title: string;
        company_name: string;
        candidate_required_location: string;
        job_type: string;
        url: string;
        description: string;
        publication_date: string;
        tags: string[];
        salary: string;
      }[];
    };
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q.termo)}&limit=40`;
    const data = await fetchJSON<R>(url);
    return (data.jobs ?? [])
      .filter((j) => remotoAcessivel(j.candidate_required_location))
      .map((j) =>
        toJob({
          id: `remotive:${j.id}`,
          source: 'remotive',
          titulo: j.title,
          empresa: j.company_name,
          local: j.candidate_required_location || 'Remoto',
          modalidade: 'Remoto',
          descricao: stripHtml(j.description),
          requisitos: j.tags,
          salario: j.salary || undefined,
          tipo: j.job_type || undefined,
          link: j.url,
          dataPublicacao: j.publication_date,
        }),
      );
  },
};

const remoteok: Source = {
  nome: 'RemoteOK',
  run: async (q) => {
    if (!q.remoto) return [];
    type Item = {
      id?: string;
      slug?: string;
      position?: string;
      company?: string;
      location?: string;
      tags?: string[];
      description?: string;
      url?: string;
      date?: string;
      legal?: string;
    };
    const data = await fetchJSON<Item[]>('https://remoteok.com/api', {
      headers: { 'User-Agent': 'vagas-app' },
    });
    const termo = normalize(q.termo);
    return (Array.isArray(data) ? data : [])
      .filter((j) => j.position && j.url)
      .filter((j) => {
        const hay = normalize(`${j.position} ${(j.tags ?? []).join(' ')} ${j.description ?? ''}`);
        return !termo || hay.includes(termo) || termo.split(' ').some((w) => w.length > 2 && hay.includes(w));
      })
      .filter((j) => remotoAcessivel(j.location ?? ''))
      .slice(0, 40)
      .map((j) =>
        toJob({
          id: `remoteok:${j.id ?? j.slug}`,
          source: 'remoteok',
          titulo: j.position!,
          empresa: j.company ?? 'Empresa',
          local: j.location || 'Remoto',
          modalidade: 'Remoto',
          descricao: stripHtml(j.description ?? ''),
          requisitos: j.tags,
          link: j.url!,
          dataPublicacao: j.date,
        }),
      );
  },
};

const arbeitnow: Source = {
  nome: 'Arbeitnow',
  run: async (q) => {
    type R = {
      data: {
        slug: string;
        title: string;
        company_name: string;
        location: string;
        remote: boolean;
        url: string;
        description: string;
        tags: string[];
        job_types: string[];
        created_at: number;
      }[];
    };
    const data = await fetchJSON<R>('https://www.arbeitnow.com/api/job-board-api');
    const termo = normalize(q.termo);
    return (data.data ?? [])
      .filter((j) => {
        const hay = normalize(`${j.title} ${(j.tags ?? []).join(' ')}`);
        return !termo || termo.split(' ').some((w) => w.length > 2 && hay.includes(w));
      })
      .filter((j) => (j.remote ? q.remoto : false)) // Arbeitnow é fora do BR; só faz sentido remoto aqui
      .slice(0, 25)
      .map((j) =>
        toJob({
          id: `arbeitnow:${j.slug}`,
          source: 'arbeitnow',
          titulo: j.title,
          empresa: j.company_name,
          local: j.location || 'Remoto',
          modalidade: 'Remoto',
          descricao: stripHtml(j.description),
          requisitos: j.tags,
          tipo: (j.job_types ?? [])[0],
          link: j.url,
        }),
      );
  },
};

// Gupy — API pública do portal de vagas (sem chave). Cobre muitas empresas BR
// que usam o Gupy como ATS. Endpoint público que alimenta o portal employability.
const gupy: Source = {
  nome: 'Gupy',
  run: async (q) => {
    type R = {
      data?: {
        id?: number;
        name?: string;
        careerPageName?: string;
        companyName?: string;
        jobUrl?: string;
        careerPageUrl?: string;
        workplaceType?: string; // 'remote' | 'on-site' | 'hybrid'
        isRemoteWork?: boolean;
        city?: string;
        state?: string;
        country?: string;
        type?: string; // 'effective' (CLT) / 'internship' / ...
        publishedDate?: string;
        description?: string;
      }[];
    };
    // host correto: employability-portal (o antigo portal.api.gupy.io saiu do ar / 404)
    const base = `https://employability-portal.gupy.io/api/v1/jobs?jobName=${encodeURIComponent(q.termo)}&limit=40`;
    // busca 3 páginas em paralelo (até ~100-120 vagas); página que falhar não derruba as outras
    const pages = await Promise.all(
      [0, 40, 80].map((offset) =>
        fetchJSON<R>(`${base}&offset=${offset}`, { headers: { Accept: 'application/json' } }).catch(
          () => ({ data: [] }) as R,
        ),
      ),
    );
    return pages
      .flatMap((p) => p.data ?? [])
      .map((j) => {
        const remoto = j.isRemoteWork === true || /remot/i.test(j.workplaceType ?? '');
        const hibrido = /hybrid|h[íi]brid/i.test(j.workplaceType ?? '');
        const local = remoto ? 'Remoto' : [j.city, j.state].filter(Boolean).join(', ') || 'Brasil';
        return toJob({
          id: `gupy:${j.id ?? normalize(j.name ?? '')}`,
          source: 'gupy',
          titulo: j.name ?? 'Vaga',
          empresa: j.companyName || j.careerPageName || 'Empresa',
          local,
          modalidade: remoto ? 'Remoto' : hibrido ? 'Híbrido' : 'Presencial',
          descricao: stripHtml(j.description ?? ''),
          tipo: j.type,
          link: j.jobUrl || j.careerPageUrl || '',
          dataPublicacao: j.publishedDate,
        });
      })
      .filter((j) => j.link);
  },
};

// ------------------------------------------------------------------
// Fontes com chave opcional
// ------------------------------------------------------------------

const jsearch: Source = {
  nome: 'JSearch (Google for Jobs)',
  run: async (q, s) => {
    // Token vindo das Configurações (AsyncStorage → storage.ts → Settings).
    // trim() evita header inválido quando a chave é colada com espaços.
    const chave = s.jsearchKey?.trim();
    if (!chave) return [];
    // JSearch v5: endpoint mudou p/ /search-v2 e as vagas vêm em data.jobs (antes era data direto).
    type Vaga = {
      job_id: string;
      job_title: string;
      employer_name: string;
      employer_logo?: string;
      job_city?: string;
      job_state?: string;
      job_country?: string;
      job_is_remote?: boolean;
      job_apply_link: string;
      job_description: string;
      job_employment_type?: string;
      job_posted_at_datetime_utc?: string;
    };
    type R = { data?: { jobs?: Vaga[]; cursor?: string } };
    // Presencial/híbrido: foca na cidade. Remoto: busca no Brasil + remotas
    // (o Google for Jobs já traz vagas mundiais remotas junto).
    const busca = q.remoto ? `${q.termo} Brazil` : `${q.termo} in ${q.cidade}, Brazil`;
    const params = new URLSearchParams({ query: busca, num_pages: '1', country: 'br', date_posted: 'all' });
    const url = `https://jsearch.p.rapidapi.com/search-v2?${params.toString()}`;
    const data = await fetchJSON<R>(url, {
      headers: { 'X-RapidAPI-Key': chave, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
    });
    return (data.data?.jobs ?? []).map((j) =>
      toJob({
        id: `jsearch:${j.job_id}`,
        source: 'jsearch',
        titulo: j.job_title,
        empresa: j.employer_name,
        local: j.job_is_remote ? 'Remoto' : [j.job_city, j.job_state].filter(Boolean).join(', ') || 'Brasil',
        modalidade: j.job_is_remote ? 'Remoto' : inferModalidade(j.job_description, false),
        descricao: stripHtml(j.job_description ?? ''),
        salario: undefined,
        tipo: j.job_employment_type,
        link: j.job_apply_link,
        dataPublicacao: j.job_posted_at_datetime_utc,
        logo: j.employer_logo,
      }),
    );
  },
};

const adzuna: Source = {
  nome: 'Adzuna',
  run: async (q, s) => {
    if (!s.adzunaAppId || !s.adzunaAppKey) return [];
    type R = {
      results: {
        id: string;
        title: string;
        company: { display_name: string };
        location: { display_name: string };
        description: string;
        redirect_url: string;
        created: string;
        salary_min?: number;
        salary_max?: number;
        contract_time?: string;
      }[];
    };
    const params = new URLSearchParams({
      app_id: s.adzunaAppId,
      app_key: s.adzunaAppKey,
      results_per_page: '40',
      what: q.termo,
      where: q.cidade,
      'content-type': 'application/json',
    });
    const url = `https://api.adzuna.com/v1/api/jobs/br/search/1?${params.toString()}`;
    const data = await fetchJSON<R>(url);
    return (data.results ?? []).map((j) =>
      toJob({
        id: `adzuna:${j.id}`,
        source: 'adzuna',
        titulo: j.title,
        empresa: j.company?.display_name ?? 'Empresa',
        local: j.location?.display_name ?? q.cidade,
        modalidade: inferModalidade(`${j.title} ${j.description} ${j.location?.display_name ?? ''}`),
        descricao: stripHtml(j.description ?? ''),
        salario: j.salary_min ? formatSalario(j.salary_min, j.salary_max) : undefined,
        tipo: j.contract_time,
        link: j.redirect_url,
        dataPublicacao: j.created,
      }),
    );
  },
};

const jooble: Source = {
  nome: 'Jooble',
  run: async (q, s) => {
    if (!s.joobleKey) return [];
    type R = {
      jobs: {
        id?: number;
        title: string;
        location: string;
        snippet: string;
        salary: string;
        source: string;
        type: string;
        link: string;
        company: string;
        updated: string;
      }[];
    };
    const data = await fetchJSON<R>(`https://br.jooble.org/api/${s.joobleKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: q.termo, location: q.cidade }),
    });
    return (data.jobs ?? []).map((j, i) =>
      toJob({
        id: `jooble:${j.id ?? i}-${normalize(j.title).slice(0, 20)}`,
        source: 'jooble',
        titulo: j.title,
        empresa: j.company || j.source || 'Empresa',
        local: j.location || q.cidade,
        modalidade: inferModalidade(`${j.title} ${j.snippet} ${j.location}`),
        descricao: stripHtml(j.snippet ?? ''),
        salario: j.salary || undefined,
        tipo: j.type || undefined,
        link: j.link,
        dataPublicacao: j.updated,
      }),
    );
  },
};

const SOURCES: Source[] = [remotive, remoteok, arbeitnow, gupy, jsearch, adzuna, jooble];

// ------------------------------------------------------------------
// API pública do módulo
// ------------------------------------------------------------------

export interface SearchResult {
  jobs: Job[];
  fontesOk: string[];
  fontesErro: string[];
}

/** Consulta todas as fontes disponíveis em paralelo e devolve vagas deduplicadas. */
export async function searchJobs(query: SearchQuery, settings: Settings): Promise<SearchResult> {
  const fontesOk: string[] = [];
  const fontesErro: string[] = [];

  const results = await Promise.all(
    SOURCES.map(async (src) => {
      try {
        const jobs = await src.run(query, settings);
        if (jobs.length > 0) fontesOk.push(src.nome);
        return jobs;
      } catch {
        fontesErro.push(src.nome);
        return [] as Job[];
      }
    }),
  );

  return { jobs: dedupe(results.flat()), fontesOk, fontesErro };
}

/** Lista quais fontes com chave estão ativas (para mostrar no app). */
export function fontesComChave(s: Settings): { nome: string; ativa: boolean }[] {
  return [
    { nome: 'JSearch (Google for Jobs)', ativa: !!s.jsearchKey },
    { nome: 'Adzuna', ativa: !!(s.adzunaAppId && s.adzunaAppKey) },
    { nome: 'Jooble', ativa: !!s.joobleKey },
  ];
}

function dedupe(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const j of jobs) {
    const key = `${normalize(j.titulo)}|${normalize(j.empresa)}`;
    if (seen.has(key) || seen.has(j.id)) continue;
    seen.add(key);
    seen.add(j.id);
    out.push(j);
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatSalario(min: number, max?: number): string {
  const f = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
  return max && max !== min ? `${f(min)} - ${f(max)}` : f(min);
}
