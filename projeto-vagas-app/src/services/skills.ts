// Normalização e reconhecimento de skills.
// Muitas APIs de vaga só devolvem um texto de descrição — aqui extraímos
// as skills conhecidas desse texto para conseguir pontuar a compatibilidade.

/** remove acentos, baixa a caixa e apara espaços */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Grupos de sinônimos: qualquer termo do grupo é tratado como o primeiro (canônico).
const SYNONYM_GROUPS: string[][] = [
  ['javascript', 'js', 'ecmascript'],
  ['typescript', 'ts'],
  ['node.js', 'node', 'nodejs'],
  ['react', 'reactjs', 'react.js'],
  ['react native', 'reactnative', 'rn'],
  ['next.js', 'next', 'nextjs'],
  ['vue', 'vuejs', 'vue.js'],
  ['angular', 'angularjs'],
  ['html', 'html5'],
  ['css', 'css3'],
  ['postgresql', 'postgres', 'psql'],
  ['sql', 'mysql', 'sql server', 'sqlserver'],
  ['aws', 'amazon web services'],
  ['gcp', 'google cloud', 'google cloud platform'],
  ['ci/cd', 'cicd', 'ci cd'],
  ['rest', 'restful', 'rest api', 'apis rest', 'api rest'],
  ['ui/ux', 'ux/ui', 'ux', 'ui'],
  ['power bi', 'powerbi'],
  ['c#', 'csharp', 'c sharp'],
  ['.net', 'dotnet', 'dot net'],
  // marketing / performance / growth / e-commerce
  ['meta ads', 'facebook ads', 'instagram ads', 'ads manager', 'gerenciador de anúncios'],
  ['google ads', 'adwords', 'google adwords'],
  ['google analytics', 'ga4', 'analytics'],
  ['google tag manager', 'gtm', 'tag manager'],
  ['tráfego pago', 'trafego pago', 'mídia paga', 'midia paga', 'paid media'],
  ['e-commerce', 'ecommerce', 'e commerce'],
  ['looker studio', 'data studio', 'google data studio'],
  ['performance marketing', 'marketing de performance', 'performance'],
  ['social media', 'redes sociais'],
  ['seo', 'search engine optimization'],
  ['sem', 'search engine marketing'],
  ['email marketing', 'e-mail marketing'],
  ['rd station', 'rdstation'],
];

// Dicionário de skills reconhecíveis num texto. Cobre tech + termos gerais.
// (Só precisa conter o termo canônico; os sinônimos vêm do mapa acima.)
export const SKILL_DICTIONARY: string[] = [
  'javascript', 'typescript', 'node.js', 'react', 'react native', 'next.js', 'vue', 'angular',
  'svelte', 'html', 'css', 'sass', 'tailwind', 'redux', 'graphql', 'rest', 'python', 'django',
  'flask', 'fastapi', 'java', 'spring', 'kotlin', 'swift', 'php', 'laravel', 'ruby', 'rails',
  'go', 'rust', 'c#', '.net', 'c++', 'sql', 'postgresql', 'mongodb', 'redis', 'firebase',
  'docker', 'kubernetes', 'terraform', 'aws', 'gcp', 'azure', 'ci/cd', 'git', 'linux', 'jest',
  'cypress', 'figma', 'design systems', 'ui/ux', 'machine learning', 'data science', 'power bi',
  'excel', 'scrum', 'agile', 'kanban', 'jira', 'expo', 'flutter', 'dart', 'webpack', 'vite',
  // marketing / performance / growth / e-commerce
  'meta ads', 'google ads', 'google analytics', 'google tag manager', 'looker studio', 'seo', 'sem',
  'tráfego pago', 'performance marketing', 'growth', 'e-commerce', 'social media', 'copywriting',
  'email marketing', 'hubspot', 'rd station', 'crm', 'inbound', 'branding', 'shopify', 'vtex',
  'wordpress', 'canva', 'roas', 'cpa', 'cro', 'remarketing', 'mídia paga', 'marketing digital',
];

/** Mapa termo -> canônico, construído a partir dos grupos de sinônimos. */
const CANONICAL = (() => {
  const map = new Map<string, string>();
  for (const group of SYNONYM_GROUPS) {
    const canonical = group[0];
    for (const term of group) map.set(normalize(term), canonical);
  }
  return map;
})();

/** Converte um termo para sua forma canônica (resolvendo sinônimos). */
export function canonical(term: string): string {
  const n = normalize(term);
  return CANONICAL.get(n) ?? n;
}

/** Dedup de uma lista de skills já canonizadas. */
export function canonicalSet(terms: string[]): string[] {
  return Array.from(new Set(terms.map(canonical))).filter(Boolean);
}

/**
 * Extrai skills conhecidas de um texto livre (descrição da vaga).
 * Usa fronteiras para evitar falso-positivo (ex.: "go" dentro de "google").
 */
export function extractSkills(text: string): string[] {
  if (!text) return [];
  const hay = ` ${normalize(text)} `;
  const found = new Set<string>();

  const probe = (term: string, canonicalForm: string) => {
    const t = normalize(term);
    // termos com caracteres especiais (c#, .net, node.js) casam por inclusão simples
    const special = /[^a-z0-9 ]/.test(t);
    const hit = special ? hay.includes(t) : new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`).test(hay);
    if (hit) found.add(canonicalForm);
  };

  for (const skill of SKILL_DICTIONARY) probe(skill, canonical(skill));
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) probe(term, group[0]);
  }
  return Array.from(found);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
