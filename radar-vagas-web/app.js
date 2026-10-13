/* Radar de Vagas (versao web). JavaScript puro, sem Expo e sem build.
 * Abre direto no navegador. Dados ficam no localStorage deste navegador.
 *
 * Organizacao do arquivo:
 *   1. Utilitarios          5. ATS (analise de curriculo)
 *   2. Skills               6. Estado e armazenamento
 *   3. Matching             7. Telas (render)
 *   4. Fontes de vagas      8. Eventos e inicializacao
 */
(function () {
  'use strict';

  /* =====================================================================
   * 1. UTILITARIOS
   * ===================================================================== */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Escapa texto vindo de fora (APIs, curriculo) antes de colocar em HTML.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // So aceita links http(s); qualquer outra coisa vira "#".
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : '#'; }
  // Remove acentos, baixa a caixa e apara espacos.
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function uniq(arr) { return Array.from(new Set(arr)); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function parseList(s) {
    return String(s || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function fmtDateTime(s) {
    var d = new Date(s);
    if (isNaN(d)) return '';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }
  function fmtDate(s) {
    var d = new Date(s);
    return isNaN(d) ? '' : d.toLocaleDateString('pt-BR');
  }
  function stripHtml(html) {
    // DOMParser nao executa scripts: e seguro para extrair so o texto.
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* =====================================================================
   * 2. SKILLS (normalizacao e sinonimos)
   * ===================================================================== */
  var SYNONYM_GROUPS = [
    ['javascript', 'js', 'ecmascript'], ['typescript', 'ts'], ['node.js', 'node', 'nodejs'],
    ['react', 'reactjs', 'react.js'], ['react native', 'reactnative', 'rn'], ['next.js', 'next', 'nextjs'],
    ['vue', 'vuejs', 'vue.js'], ['angular', 'angularjs'], ['html', 'html5'], ['css', 'css3'],
    ['postgresql', 'postgres', 'psql'], ['sql', 'mysql', 'sql server', 'sqlserver'],
    ['aws', 'amazon web services'], ['gcp', 'google cloud', 'google cloud platform'],
    ['ci/cd', 'cicd', 'ci cd'], ['rest', 'restful', 'rest api', 'apis rest', 'api rest'],
    ['ui/ux', 'ux/ui', 'ux', 'ui'], ['power bi', 'powerbi'], ['c#', 'csharp', 'c sharp'],
    ['.net', 'dotnet', 'dot net'],
    ['meta ads', 'facebook ads', 'instagram ads', 'ads manager', 'gerenciador de anuncios'],
    ['google ads', 'adwords', 'google adwords'], ['google analytics', 'ga4', 'analytics'],
    ['google tag manager', 'gtm', 'tag manager'],
    ['trafego pago', 'midia paga', 'paid media'], ['e-commerce', 'ecommerce', 'e commerce'],
    ['looker studio', 'data studio', 'google data studio'],
    ['performance marketing', 'marketing de performance', 'performance'],
    ['social media', 'redes sociais'], ['seo', 'search engine optimization'],
    ['sem', 'search engine marketing'], ['email marketing', 'e-mail marketing'],
    ['rd station', 'rdstation']
  ];

  var SKILL_DICTIONARY = [
    'javascript', 'typescript', 'node.js', 'react', 'react native', 'next.js', 'vue', 'angular',
    'svelte', 'html', 'css', 'sass', 'tailwind', 'redux', 'graphql', 'rest', 'python', 'django',
    'flask', 'fastapi', 'java', 'spring', 'kotlin', 'swift', 'php', 'laravel', 'ruby', 'rails',
    'go', 'rust', 'c#', '.net', 'c++', 'sql', 'postgresql', 'mongodb', 'redis', 'firebase',
    'docker', 'kubernetes', 'terraform', 'aws', 'gcp', 'azure', 'ci/cd', 'git', 'linux', 'jest',
    'cypress', 'figma', 'design systems', 'ui/ux', 'machine learning', 'data science', 'power bi',
    'excel', 'scrum', 'agile', 'kanban', 'jira', 'expo', 'flutter', 'dart', 'webpack', 'vite',
    'meta ads', 'google ads', 'google analytics', 'google tag manager', 'looker studio', 'seo', 'sem',
    'trafego pago', 'performance marketing', 'growth', 'e-commerce', 'social media', 'copywriting',
    'email marketing', 'hubspot', 'rd station', 'crm', 'inbound', 'branding', 'shopify', 'vtex',
    'wordpress', 'canva', 'roas', 'cpa', 'cro', 'remarketing', 'midia paga', 'marketing digital'
  ];

  // Mapa termo -> forma canonica (o primeiro de cada grupo de sinonimos).
  var CANONICAL = (function () {
    var map = {};
    SYNONYM_GROUPS.forEach(function (group) {
      group.forEach(function (term) { map[norm(term)] = group[0]; });
    });
    return map;
  })();

  function canonical(term) {
    var n = norm(term);
    return CANONICAL[n] || n;
  }
  function canonicalSet(terms) {
    return uniq((terms || []).map(canonical)).filter(Boolean);
  }
  // Extrai skills conhecidas de um texto (com fronteira de palavra: "go" nao casa com "google").
  function extractSkills(text) {
    if (!text) return [];
    var hay = ' ' + norm(text) + ' ';
    var found = {};
    function probe(term, canon) {
      var t = norm(term);
      var special = /[^a-z0-9 ]/.test(t);
      var hit = special
        ? hay.indexOf(t) !== -1
        : new RegExp('(^|[^a-z0-9])' + escapeRe(t) + '([^a-z0-9]|$)').test(hay);
      if (hit) found[canon] = true;
    }
    SKILL_DICTIONARY.forEach(function (s) { probe(s, canonical(s)); });
    SYNONYM_GROUPS.forEach(function (g) { g.forEach(function (t) { probe(t, g[0]); }); });
    return Object.keys(found);
  }

  /* =====================================================================
   * 3. MATCHING (compatibilidade vaga x perfil)
   * ===================================================================== */
  function priorityFor(score) {
    if (score >= 85) return { label: 'Prioridade máxima', color: '#1f9d55' };
    if (score >= 75) return { label: 'Recomendada', color: '#2fae5b' };
    if (score >= 60) return { label: 'Avaliar', color: '#c2790b' };
    if (score >= 40) return { label: 'Baixa prioridade', color: '#e07a00' };
    return { label: 'Descartar', color: '#d92d20' };
  }

  function jobRequirements(job) {
    var declared = job.requisitos || [];
    var fromText = extractSkills(job.titulo + ' ' + job.descricao);
    return canonicalSet(declared.concat(fromText));
  }

  function localMatchesCity(local, cidade) {
    var l = norm(local), c = norm(cidade);
    if (!c) return true;
    var apelidos = c.indexOf('florianopolis') !== -1
      ? [c, 'floripa', 'florianopolis sc', 'grande florianopolis'] : [c];
    return apelidos.some(function (a) { return l.indexOf(a) !== -1; }) || l.indexOf(c) !== -1;
  }
  // Regra do produto: remoto vale (se o perfil aceita); presencial/hibrido so na cidade do perfil.
  function passesLocationFilter(job, profile) {
    if (job.modalidade === 'Remoto') return !!profile.aceitaRemoto;
    if (job.modalidade === 'Presencial' || job.modalidade === 'Híbrido') {
      return localMatchesCity(job.local, profile.cidade);
    }
    return true;
  }

  function titleAffinity(job, profile) {
    var titulo = norm(job.titulo);
    var alvo = [profile.titulo].concat(profile.palavrasChave || []).map(norm).filter(Boolean);
    if (!alvo.length) return 0;
    var palavras = uniq(alvo.join(' ').split(/\s+/).filter(function (w) { return w.length > 2; }));
    if (!palavras.length) return 0;
    var hits = palavras.filter(function (p) { return titulo.indexOf(p) !== -1; }).length;
    return Math.min(1, hits / palavras.length);
  }
  function seniorityAffinity(job, profile) {
    if (!job.nivel || job.nivel === 'Indefinido' || profile.senioridade === 'Indefinido') return 0.5;
    var ordem = ['Estágio', 'Júnior', 'Pleno', 'Sênior'];
    var a = ordem.indexOf(job.nivel), b = ordem.indexOf(profile.senioridade);
    if (a < 0 || b < 0) return 0.5;
    var dist = Math.abs(a - b);
    return dist === 0 ? 1 : dist === 1 ? 0.6 : 0.2;
  }

  function computeMatch(job, profile) {
    var requisitos = jobRequirements(job);
    var minhas = canonicalSet(profile.competencias);
    var compativeis = requisitos.filter(function (r) { return minhas.indexOf(r) !== -1; });
    var faltantes = requisitos.filter(function (r) { return minhas.indexOf(r) === -1; });

    var cargo = titleAffinity(job, profile) * 100;
    var skills = requisitos.length ? (compativeis.length / requisitos.length) * 100 : cargo;
    var senioridade = seniorityAffinity(job, profile) * 100;
    var localizacao = passesLocationFilter(job, profile) ? 100 : 0;
    var score = clamp(Math.round(skills * 0.6 + cargo * 0.2 + senioridade * 0.12 + localizacao * 0.08), 0, 100);

    return Object.assign({}, job, {
      requisitos: requisitos,
      compatibilidade: score,
      requisitosCompativeis: compativeis,
      requisitosFaltantes: faltantes,
      breakdown: {
        skills: Math.round(skills), cargo: Math.round(cargo),
        senioridade: Math.round(senioridade), localizacao: Math.round(localizacao)
      }
    });
  }

  function rankJobs(jobs, profile) {
    var seen = {};
    return jobs
      .filter(function (j) {
        if (seen[j.id]) return false;
        seen[j.id] = true;
        return passesLocationFilter(j, profile);
      })
      .map(function (j) { return computeMatch(j, profile); })
      .sort(function (a, b) { return b.compatibilidade - a.compatibilidade; });
  }

  /* =====================================================================
   * 4. FONTES DE VAGAS (APIs publicas, sem chave)
   * ===================================================================== */
  var TIMEOUT_MS = 12000;

  function fetchJSON(url, opts) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, Object.assign({}, opts || {}, { signal: ctrl.signal }))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(t); });
  }

  function remotoAcessivel(local) {
    var n = norm(local);
    if (!n) return true;
    return /(worldwide|anywhere|global|latam|latin|america|brazil|brasil|emea|any)/.test(n) || !/only|apenas/.test(n);
  }
  function toJob(p) {
    var requisitos = p.requisitos && p.requisitos.length ? p.requisitos : extractSkills(p.titulo + ' ' + p.descricao);
    return Object.assign({}, p, { requisitos: requisitos });
  }

  var SOURCES = [
    {
      nome: 'Remotive',
      run: function (q) {
        if (!q.remoto) return Promise.resolve([]);
        var url = 'https://remotive.com/api/remote-jobs?search=' + encodeURIComponent(q.termo) + '&limit=40';
        return fetchJSON(url).then(function (data) {
          return (data.jobs || [])
            .filter(function (j) { return remotoAcessivel(j.candidate_required_location); })
            .map(function (j) {
              return toJob({
                id: 'remotive:' + j.id, source: 'remotive', titulo: j.title, empresa: j.company_name,
                local: j.candidate_required_location || 'Remoto', modalidade: 'Remoto',
                descricao: stripHtml(j.description), requisitos: j.tags || [],
                salario: j.salary || undefined, tipo: j.job_type || undefined,
                link: j.url, dataPublicacao: j.publication_date
              });
            });
        });
      }
    },
    {
      nome: 'RemoteOK',
      run: function (q) {
        if (!q.remoto) return Promise.resolve([]);
        return fetchJSON('https://remoteok.com/api').then(function (data) {
          var termo = norm(q.termo);
          return (Array.isArray(data) ? data : [])
            .filter(function (j) { return j.position && j.url; })
            .filter(function (j) {
              var hay = norm(j.position + ' ' + (j.tags || []).join(' ') + ' ' + (j.description || ''));
              return !termo || hay.indexOf(termo) !== -1 ||
                termo.split(' ').some(function (w) { return w.length > 2 && hay.indexOf(w) !== -1; });
            })
            .filter(function (j) { return remotoAcessivel(j.location || ''); })
            .slice(0, 40)
            .map(function (j) {
              return toJob({
                id: 'remoteok:' + (j.id || j.slug), source: 'remoteok', titulo: j.position,
                empresa: j.company || 'Empresa', local: j.location || 'Remoto', modalidade: 'Remoto',
                descricao: stripHtml(j.description || ''), requisitos: j.tags || [],
                link: j.url, dataPublicacao: j.date
              });
            });
        });
      }
    },
    {
      nome: 'Arbeitnow',
      run: function (q) {
        return fetchJSON('https://www.arbeitnow.com/api/job-board-api').then(function (data) {
          var termo = norm(q.termo);
          return (data.data || [])
            .filter(function (j) {
              var hay = norm(j.title + ' ' + (j.tags || []).join(' '));
              return !termo || termo.split(' ').some(function (w) { return w.length > 2 && hay.indexOf(w) !== -1; });
            })
            .filter(function (j) { return j.remote ? q.remoto : false; })
            .slice(0, 25)
            .map(function (j) {
              return toJob({
                id: 'arbeitnow:' + j.slug, source: 'arbeitnow', titulo: j.title, empresa: j.company_name,
                local: j.location || 'Remoto', modalidade: 'Remoto',
                descricao: stripHtml(j.description), requisitos: j.tags || [],
                tipo: (j.job_types || [])[0], link: j.url
              });
            });
        });
      }
    },
    {
      nome: 'Gupy',
      run: function (q) {
        var base = 'https://employability-portal.gupy.io/api/v1/jobs?jobName=' + encodeURIComponent(q.termo) + '&limit=40';
        return Promise.all([0, 40, 80].map(function (offset) {
          return fetchJSON(base + '&offset=' + offset, { headers: { Accept: 'application/json' } })
            .catch(function (e) { return { data: [], _erro: e }; });
        })).then(function (pages) {
          // Se as 3 paginas falharam, avisa em vez de fingir "0 vagas".
          if (pages.every(function (p) { return p._erro; })) throw pages[0]._erro;
          var all = [];
          pages.forEach(function (p) { all = all.concat(p.data || []); });
          return all.map(function (j) {
            var remoto = j.isRemoteWork === true || /remot/i.test(j.workplaceType || '');
            var hibrido = /hybrid|h[íi]brid/i.test(j.workplaceType || '');
            var local = remoto ? 'Remoto' : ([j.city, j.state].filter(Boolean).join(', ') || 'Brasil');
            return toJob({
              id: 'gupy:' + (j.id || norm(j.name || '')), source: 'gupy', titulo: j.name || 'Vaga',
              empresa: j.companyName || j.careerPageName || 'Empresa', local: local,
              modalidade: remoto ? 'Remoto' : hibrido ? 'Híbrido' : 'Presencial',
              descricao: stripHtml(j.description || ''), tipo: j.type,
              link: j.jobUrl || j.careerPageUrl || '', dataPublicacao: j.publishedDate
            });
          }).filter(function (j) { return j.link; });
        });
      }
    }
  ];

  // Vagas FICTICIAS para demonstracao (funcionam sem internet).
  var SAMPLE_JOBS = [
    { id: 'sample:1', source: 'sample', titulo: 'Analista de Performance Pleno', empresa: 'Loja Exemplo', local: 'Remoto', modalidade: 'Remoto',
      descricao: 'Gestão de campanhas em Meta Ads e Google Ads, análise no Google Analytics (GA4) e dashboards em Looker Studio para e-commerce.',
      requisitos: ['meta ads', 'google ads', 'google analytics', 'looker studio', 'e-commerce'], salario: 'R$ 6.000 - R$ 8.000', nivel: 'Pleno', tipo: 'CLT', link: '', dataPublicacao: '2026-09-20' },
    { id: 'sample:2', source: 'sample', titulo: 'Gestor de Tráfego Pago', empresa: 'Agência Floripa Digital', local: 'Florianópolis, SC', modalidade: 'Híbrido',
      descricao: 'Planejamento e otimização de tráfego pago, remarketing e CRO. Google Tag Manager e relatórios para clientes.',
      requisitos: ['trafego pago', 'google tag manager', 'remarketing', 'cro'], salario: 'R$ 5.500 - R$ 7.500', nivel: 'Pleno', tipo: 'PJ', link: '', dataPublicacao: '2026-09-28' },
    { id: 'sample:3', source: 'sample', titulo: 'Growth Marketing Sênior', empresa: 'Startup Horizonte', local: 'Remoto', modalidade: 'Remoto',
      descricao: 'Estratégia de growth, experimentos, SEO, email marketing e CRM com HubSpot. Foco em ROAS e CPA.',
      requisitos: ['growth', 'seo', 'email marketing', 'hubspot', 'roas', 'cpa'], salario: 'R$ 10.000 - R$ 13.000', nivel: 'Sênior', tipo: 'CLT', link: '', dataPublicacao: '2026-10-02' },
    { id: 'sample:4', source: 'sample', titulo: 'Analista de E-commerce Júnior', empresa: 'Mercado Sul', local: 'Florianópolis - SC', modalidade: 'Presencial',
      descricao: 'Gestão de catálogo e campanhas em marketplace e Shopify, apoio em Google Analytics e planilhas no Excel.',
      requisitos: ['e-commerce', 'shopify', 'google analytics', 'excel'], salario: 'R$ 3.500 - R$ 4.500', nivel: 'Júnior', tipo: 'CLT', link: '', dataPublicacao: '2026-10-05' },
    { id: 'sample:5', source: 'sample', titulo: 'Desenvolvedor Front-End React', empresa: 'TechBrasil', local: 'São Paulo, SP', modalidade: 'Presencial',
      descricao: 'Interfaces com React, TypeScript e Next.js. Code reviews e cerimônias ágeis.',
      requisitos: ['react', 'typescript', 'html', 'css', 'git'], salario: 'R$ 7.000 - R$ 9.000', nivel: 'Pleno', tipo: 'CLT', link: '', dataPublicacao: '2026-09-12' }
  ];

  /* =====================================================================
   * 5. ATS (analise de curriculo, 100% no navegador)
   * ===================================================================== */
  var PESOS = { palavrasChave: 32, contato: 20, secoes: 18, resultados: 18, formato: 12 };
  var SECOES = {
    experiencia: ['experiencia', 'experiencia profissional', 'historico profissional', 'experience', 'trajetoria'],
    formacao: ['formacao', 'formacao academica', 'educacao', 'escolaridade', 'education', 'academico'],
    habilidades: ['habilidades', 'competencias', 'skills', 'conhecimentos', 'qualificacoes', 'ferramentas'],
    resumo: ['resumo', 'objetivo', 'sobre', 'perfil profissional', 'summary', 'objective']
  };
  var VERBOS_ACAO = ['liderei', 'gerenciei', 'aumentei', 'reduzi', 'implementei', 'criei', 'desenvolvi', 'otimizei',
    'lancei', 'construi', 'coordenei', 'planejei', 'executei', 'analisei', 'automatizei', 'escalei',
    'conquistei', 'entreguei', 'gerei', 'melhorei', 'estruturei', 'negociei'];
  var SENIORIDADES = [['estagi', 'Estágio'], ['junior', 'Júnior'], ['pleno', 'Pleno'], ['senior', 'Sênior']];
  var CARGOS = ['analista de performance', 'analista de marketing', 'analista de trafego', 'gestor de trafego',
    'especialista em midia paga', 'growth', 'analista de growth', 'coordenador de marketing', 'social media',
    'analista de dados', 'analista de e-commerce', 'analista de bi', 'desenvolvedor', 'desenvolvedora',
    'engenheiro de software', 'designer', 'product manager'];
  var NIVEL_META = {
    excelente: { label: 'Excelente', color: '#1f9d55', frase: 'Currículo pronto para os robôs de RH.' },
    bom: { label: 'Bom', color: '#2fae5b', frase: 'Passa no ATS. Uns ajustes deixam perfeito.' },
    ajustes: { label: 'Precisa de ajustes', color: '#c2790b', frase: 'Corrija os pontos abaixo antes de enviar.' },
    ruim: { label: 'Precisa melhorar', color: '#d92d20', frase: 'O ATS provavelmente barraria. Priorize as correções.' }
  };

  function matchOne(texto, re) { var m = texto.match(re); return m ? m[0] : undefined; }
  function titleCase(s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function normalizeUrl(u) { return u.replace(/^https?:\/\//i, '').replace(/^www\./i, ''); }
  function temSecao(n, apelidos) { return apelidos.some(function (a) { return n.indexOf(norm(a)) !== -1; }); }
  function nivelDoScore(s) { return s >= 82 ? 'excelente' : s >= 70 ? 'bom' : s >= 50 ? 'ajustes' : 'ruim'; }
  function ordemGravidade(g) { return g === 'alta' ? 3 : g === 'media' ? 2 : 1; }

  function detectNome(linhas, email) {
    var cand = linhas.slice(0, 4);
    for (var i = 0; i < cand.length; i++) {
      var l = cand[i], p = l.split(/\s+/);
      if (p.length >= 2 && p.length <= 4 && l.length <= 40 && !/\d|@|http/.test(l)) return l;
    }
    if (email) return titleCase(email.split('@')[0].replace(/[._-]+/g, ' '));
    return undefined;
  }
  function detectTitulo(n, linhas) {
    for (var i = 0; i < CARGOS.length; i++) if (n.indexOf(norm(CARGOS[i])) !== -1) return titleCase(CARGOS[i]);
    var cand = linhas[1];
    if (cand && cand.length <= 45 && cand.indexOf('@') === -1 && /[a-zA-Z]/.test(cand)) return cand;
    return undefined;
  }
  function detectSenioridade(n) {
    for (var i = 0; i < SENIORIDADES.length; i++) if (n.indexOf(SENIORIDADES[i][0]) !== -1) return SENIORIDADES[i][1];
    return undefined;
  }
  function detectResumo(texto) {
    var n = norm(texto);
    for (var i = 0; i < SECOES.resumo.length; i++) {
      var idx = n.indexOf(norm(SECOES.resumo[i]));
      if (idx >= 0) {
        var trecho = texto.slice(idx).split(/\r?\n/).slice(1).join(' ').trim();
        if (trecho.length > 30) return trecho.slice(0, 320).trim();
      }
    }
    return undefined;
  }

  function analyzeCV(textoBruto, alvo) {
    var texto = textoBruto || '';
    var n = norm(texto);
    var linhas = texto.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var palavras = n.split(/\s+/).filter(Boolean).length;
    var issues = [], pontosFortes = [];

    var email = matchOne(texto, /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    var telefone = matchOne(texto, /(\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/);
    var linkedin = matchOne(texto, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-z0-9-_%]+/i);
    var portfolio = matchOne(texto, /(?:https?:\/\/)?(?:www\.)?(?:github\.com|behance\.net|dribbble\.com|[a-z0-9-]+\.(?:com|com\.br|dev|io|me))\/[a-z0-9-_%./]*/i);
    var skills = canonicalSet(extractSkills(texto));

    var extracted = {
      nome: detectNome(linhas, email), email: email,
      telefone: telefone ? telefone.trim() : undefined,
      linkedin: linkedin ? normalizeUrl(linkedin) : undefined,
      portfolio: portfolio && !(linkedin && linkedin.indexOf(portfolio) !== -1) ? normalizeUrl(portfolio) : undefined,
      titulo: detectTitulo(n, linhas), senioridade: detectSenioridade(n),
      competencias: skills, resumo: detectResumo(texto)
    };

    // 1. Contato
    var contato = 0;
    if (email) contato += 45; else issues.push({ campo: 'Contato', gravidade: 'alta', problema: 'Nenhum e-mail encontrado.', sugestao: 'Coloque um e-mail profissional no topo do currículo.' });
    if (telefone) contato += 30; else issues.push({ campo: 'Contato', gravidade: 'media', problema: 'Telefone não localizado.', sugestao: 'Inclua um telefone com DDD, ex.: (48) 99999-9999.' });
    if (linkedin) contato += 25; else issues.push({ campo: 'Contato', gravidade: 'media', problema: 'LinkedIn ausente.', sugestao: 'Adicione a URL do seu LinkedIn. Recrutadores quase sempre procuram.' });
    contato = Math.min(100, contato);
    if (contato >= 70) pontosFortes.push('Dados de contato completos e legíveis.');

    // 2. Palavras-chave
    var desejadas = alvo ? canonicalSet(alvo.competencias) : [];
    var faltando = desejadas.filter(function (s) { return skills.indexOf(s) === -1; });
    var densidade = Math.min(1, skills.length / 10);
    var cobertura = desejadas.length ? (desejadas.length - faltando.length) / desejadas.length : densidade;
    var palavrasChave = Math.round((densidade * 0.5 + cobertura * 0.5) * 100);
    if (!skills.length) issues.push({ campo: 'Palavras-chave', gravidade: 'alta', problema: 'Nenhuma competência técnica reconhecida.', sugestao: 'Cite ferramentas e skills exatas (ex.: Meta Ads, Google Analytics, GA4, Looker Studio).' });
    else if (skills.length < 5) issues.push({ campo: 'Palavras-chave', gravidade: 'media', problema: 'Só ' + skills.length + ' competência(s) reconhecida(s).', sugestao: 'Liste mais ferramentas/skills que você domina. O ATS filtra por palavras exatas.' });
    else pontosFortes.push(skills.length + ' competências reconhecidas pelo ATS.');
    if (faltando.length) issues.push({ campo: 'Palavras-chave', gravidade: 'media', problema: 'Faltam ' + faltando.length + ' skill(s) do seu cargo-alvo: ' + faltando.slice(0, 6).join(', ') + '.', sugestao: 'Se você tem essas skills, inclua-as no currículo com o nome exato.' });

    // 3. Secoes
    var tExp = temSecao(n, SECOES.experiencia), tFor = temSecao(n, SECOES.formacao);
    var tHab = temSecao(n, SECOES.habilidades), tRes = temSecao(n, SECOES.resumo);
    var secoesOk = [tExp, tFor, tHab, tRes].filter(Boolean).length;
    var secoes = Math.round((secoesOk / 4) * 100);
    if (!tExp) issues.push({ campo: 'Estrutura', gravidade: 'alta', problema: 'Seção de experiência não identificada.', sugestao: 'Crie um bloco claro "Experiência profissional" com cargo, empresa e período.' });
    if (!tHab) issues.push({ campo: 'Estrutura', gravidade: 'media', problema: 'Seção de habilidades/competências ausente.', sugestao: 'Adicione um bloco "Competências". O ATS lê essa seção primeiro.' });
    if (!tFor) issues.push({ campo: 'Estrutura', gravidade: 'baixa', problema: 'Formação acadêmica não identificada.', sugestao: 'Inclua "Formação acadêmica" com curso e instituição.' });
    if (!tRes) issues.push({ campo: 'Estrutura', gravidade: 'baixa', problema: 'Sem resumo/objetivo no topo.', sugestao: 'Abra com 2-3 linhas de resumo profissional com suas palavras-chave.' });
    if (secoesOk >= 3) pontosFortes.push('Estrutura de seções bem definida.');

    // 4. Resultados
    var numeros = (texto.match(/(\d+[.,]?\d*\s?%|r\$\s?\d|\d{2,})/gi) || []).length;
    var verbos = VERBOS_ACAO.filter(function (v) { return n.indexOf(v) !== -1; }).length;
    var resultados = Math.min(100, Math.round(Math.min(1, numeros / 6) * 60 + Math.min(1, verbos / 5) * 40));
    if (numeros < 2) issues.push({ campo: 'Resultados', gravidade: 'alta', problema: 'Poucos números/métricas.', sugestao: 'Quantifique conquistas: "reduzi CPA em 30%", "gerenciei R$ 200k/mês em mídia".' });
    if (verbos < 2) issues.push({ campo: 'Resultados', gravidade: 'media', problema: 'Poucos verbos de ação.', sugestao: 'Comece frases com verbos: liderei, aumentei, otimizei, implementei.' });
    if (numeros >= 4 && verbos >= 3) pontosFortes.push('Conquistas quantificadas com verbos de ação.');

    // 5. Formato
    var formato = 100;
    if (palavras < 150) { formato -= 55; issues.push({ campo: 'Formato', gravidade: 'alta', problema: 'Currículo muito curto (' + palavras + ' palavras).', sugestao: 'Um CV de 1 página costuma ter 300-600 palavras. Detalhe mais suas experiências.' }); }
    else if (palavras > 1200) { formato -= 30; issues.push({ campo: 'Formato', gravidade: 'baixa', problema: 'Currículo longo (' + palavras + ' palavras).', sugestao: 'Enxugue para 1-2 páginas focando no relevante para a vaga.' }); }
    if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(texto)) { formato -= 15; issues.push({ campo: 'Formato', gravidade: 'baixa', problema: 'Emojis/símbolos que o ATS pode não ler.', sugestao: 'Evite emojis e caracteres especiais no corpo do currículo.' }); }
    formato = Math.max(0, formato);
    if (formato >= 85) pontosFortes.push('Tamanho e formatação adequados para leitura automática.');

    var breakdown = { contato: contato, palavrasChave: palavrasChave, secoes: secoes, resultados: resultados, formato: formato };
    var score = Math.round(Object.keys(PESOS).reduce(function (acc, k) { return acc + (breakdown[k] / 100) * PESOS[k]; }, 0));
    issues.sort(function (a, b) { return ordemGravidade(b.gravidade) - ordemGravidade(a.gravidade); });

    return {
      score: score, nivel: nivelDoScore(score), aprovado: score >= 70, breakdown: breakdown,
      issues: issues, pontosFortes: pontosFortes, skillsEncontradas: skills,
      skillsDoCargoFaltando: faltando, extracted: extracted, palavras: palavras
    };
  }

  // Junta os dados do CV no perfil sem apagar o que ja existe quando o CV nao trouxe a informacao.
  function mergeExtractedIntoProfile(atual, cv) {
    function pick(novo, velho) { return novo !== undefined && novo !== null && novo !== '' ? novo : velho; }
    var comp = cv.competencias && cv.competencias.length
      ? uniq(cv.competencias.concat(atual.competencias || [])) : atual.competencias;
    return Object.assign({}, atual, {
      nome: pick(cv.nome, atual.nome), email: pick(cv.email, atual.email),
      telefone: pick(cv.telefone, atual.telefone), linkedin: pick(cv.linkedin, atual.linkedin),
      portfolio: pick(cv.portfolio, atual.portfolio), titulo: pick(cv.titulo, atual.titulo),
      senioridade: pick(cv.senioridade, atual.senioridade), resumo: pick(cv.resumo, atual.resumo),
      competencias: comp
    });
  }

  // Converte a resposta do backend de IA para o mesmo formato do ATS local.
  function paraAtsResult(d, texto) {
    function num(v) { return clamp(Math.round(Number(v) || 0), 0, 100); }
    var ex = (d && d.extracted) || {};
    var bd = (d && d.breakdown) || {};
    var comp = Array.isArray(ex.competencias) ? ex.competencias : [];
    var score = num(d && d.score);
    return {
      score: score, nivel: d.nivel || nivelDoScore(score), aprovado: score >= 70,
      breakdown: { contato: num(bd.contato), palavrasChave: num(bd.palavrasChave), secoes: num(bd.secoes), resultados: num(bd.resultados), formato: num(bd.formato) },
      issues: Array.isArray(d.issues) ? d.issues : [], pontosFortes: Array.isArray(d.pontosFortes) ? d.pontosFortes : [],
      skillsEncontradas: comp, skillsDoCargoFaltando: [],
      extracted: { nome: ex.nome, email: ex.email, telefone: ex.telefone, linkedin: ex.linkedin, portfolio: ex.portfolio, titulo: ex.titulo, senioridade: ex.senioridade, competencias: comp, resumo: ex.resumo },
      palavras: texto ? texto.split(/\s+/).filter(Boolean).length : 0, resumoIA: d.resumoIA
    };
  }

  function chamarBackendIA(input) {
    var base = (state.settings.backend || '').trim().replace(/\/+$/, '');
    if (!base) return Promise.reject(new Error('Configure a URL do backend em Config.'));
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 45000);
    return fetch(base + '/cv', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input), signal: ctrl.signal
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.erro) throw new Error(data.erro || 'Backend respondeu ' + res.status + '.');
        return paraAtsResult(data, input.texto);
      });
    }).finally(function () { clearTimeout(t); });
  }

  /* =====================================================================
   * 6. ESTADO E ARMAZENAMENTO (localStorage)
   * ===================================================================== */
  var KEYS = { profile: 'rv.profile', apps: 'rv.apps', settings: 'rv.settings' };
  var STAGES = ['Salvas', 'Aplicado', 'Triagem', 'Entrevista', 'Proposta', 'Encerrado'];
  var STAGE_LABEL = { Salvas: 'Salvas', Aplicado: 'Aplicado', Triagem: 'Em triagem', Entrevista: 'Entrevista', Proposta: 'Proposta', Encerrado: 'Encerrado' };

  var DEFAULT_PROFILE = {
    nome: '', titulo: 'Analista de Performance', senioridade: 'Pleno', cidade: 'Florianópolis', aceitaRemoto: true,
    competencias: ['meta ads', 'google ads', 'google analytics', 'google tag manager', 'e-commerce', 'performance marketing', 'tráfego pago', 'looker studio'],
    palavrasChave: ['analista de performance', 'growth', 'e-commerce', 'marketing'],
    resumo: '', email: '', telefone: '', linkedin: '', portfolio: '', pretensaoSalarial: '', tiposContratacao: ['CLT', 'PJ']
  };
  var DEFAULT_SETTINGS = { backend: 'https://radar-vagas-backend.radar-vagas.workers.dev', exemplos: false };

  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Não foi possível salvar neste navegador (armazenamento bloqueado ou cheio).'); return false; }
  }

  var state = {
    profile: Object.assign({}, DEFAULT_PROFILE, load(KEYS.profile, {})),
    apps: load(KEYS.apps, []),
    settings: Object.assign({}, DEFAULT_SETTINGS, load(KEYS.settings, {})),
    ranked: [],
    cv: null,        // ultimo resultado da analise
    cvPdf: null      // { base64, nome } quando um PDF foi carregado
  };
  if (!Array.isArray(state.apps)) state.apps = [];

  function saveApps() { save(KEYS.apps, state.apps); }
  function findApp(id) { return state.apps.filter(function (a) { return a.id === id; })[0]; }

  function addOrMoveApp(match, stage) {
    var now = new Date().toISOString();
    var existente = findApp(match.id);
    if (existente) {
      if (existente.stage !== stage) {
        existente.stage = stage; existente.updatedAt = now;
        existente.history.push({ stage: stage, at: now });
      }
    } else {
      state.apps.push({
        id: match.id, job: stripMatch(match), match: match.compatibilidade, stage: stage,
        createdAt: now, updatedAt: now, notes: '', interviewAt: '', history: [{ stage: stage, at: now }]
      });
    }
    saveApps();
  }
  // Guarda so os campos da vaga (sem o calculo de match) no Kanban.
  function stripMatch(m) {
    return { id: m.id, source: m.source, titulo: m.titulo, empresa: m.empresa, local: m.local,
      modalidade: m.modalidade, descricao: (m.descricao || '').slice(0, 600), requisitos: m.requisitos || [],
      salario: m.salario, nivel: m.nivel, tipo: m.tipo, link: m.link, dataPublicacao: m.dataPublicacao };
  }

  /* =====================================================================
   * 7. TELAS (render)
   * ===================================================================== */
  var TABS = ['inicio', 'vagas', 'kanban', 'curriculo', 'perfil', 'config'];

  // ---------- Inicio ----------
  function renderInicio() {
    var p = state.profile;
    $('#inicio-saudacao').textContent = p.nome ? 'Olá, ' + p.nome + '. Aqui está o resumo da sua busca.' : 'Bem-vindo. Preencha o Perfil para começar.';
    var aplicadas = state.apps.filter(function (a) { return a.stage !== 'Salvas'; });
    var entrevistas = state.apps.filter(function (a) { return a.stage === 'Entrevista' || a.interviewAt; });
    var media = state.apps.length ? Math.round(state.apps.reduce(function (s, a) { return s + (a.match || 0); }, 0) / state.apps.length) : 0;
    var comRetorno = aplicadas.filter(function (a) { return ['Triagem', 'Entrevista', 'Proposta'].indexOf(a.stage) !== -1; }).length;
    var taxa = aplicadas.length ? Math.round((comRetorno / aplicadas.length) * 100) : 0;
    $('#stats').innerHTML =
      stat(aplicadas.length, 'Candidaturas') + stat(entrevistas.length, 'Entrevistas') +
      stat(media + '%', 'Match médio') + stat(taxa + '%', 'Taxa de retorno');

    var agora = Date.now();
    var proximas = state.apps.filter(function (a) { return a.interviewAt && new Date(a.interviewAt).getTime() >= agora; })
      .sort(function (a, b) { return new Date(a.interviewAt) - new Date(b.interviewAt); });
    $('#proximas-entrevistas').innerHTML = proximas.length
      ? proximas.map(function (a) {
          return '<div class="list-item"><b>' + esc(a.job.titulo) + '</b><div class="job-meta">' + esc(a.job.empresa) + ' · ' + esc(fmtDateTime(a.interviewAt)) + '</div></div>';
        }).join('')
      : '<p class="empty">Nenhuma entrevista marcada. No Kanban, defina a data em uma candidatura.</p>';

    var acoes = [];
    var salvas = state.apps.filter(function (a) { return a.stage === 'Salvas'; }).length;
    if (salvas) acoes.push('Você tem ' + salvas + ' vaga(s) salva(s) para decidir se aplica.');
    var semRetorno = state.apps.filter(function (a) { return a.stage === 'Aplicado' && (agora - new Date(a.updatedAt).getTime()) > 7 * 86400000; }).length;
    if (semRetorno) acoes.push(semRetorno + ' candidatura(s) há mais de 7 dias sem resposta. Hora do follow-up.');
    if (!state.profile.nome) acoes.push('Complete o Perfil para melhorar o cálculo de compatibilidade.');
    $('#acoes-pendentes').innerHTML = acoes.length
      ? acoes.map(function (t) { return '<div class="list-item">' + esc(t) + '</div>'; }).join('')
      : '<p class="empty">Tudo em dia.</p>';
  }
  function stat(valor, rotulo) { return '<div class="stat"><b>' + esc(valor) + '</b><span>' + esc(rotulo) + '</span></div>'; }

  // ---------- Vagas ----------
  function renderBuscaForm() {
    var p = state.profile;
    if (!$('#busca-termo').value) $('#busca-termo').value = (p.palavrasChave && p.palavrasChave[0]) || p.titulo || '';
    if (!$('#busca-cidade').value) $('#busca-cidade').value = p.cidade || '';
    $('#busca-remoto').checked = $('#busca-remoto').dataset.touched ? $('#busca-remoto').checked : !!p.aceitaRemoto;
  }

  function jobCardHtml(m) {
    var pr = priorityFor(m.compatibilidade);
    var ja = findApp(m.id);
    var amostra = m.source === 'sample';
    var chipsOk = m.requisitosCompativeis.map(function (r) { return '<span class="chip hit">' + esc(r) + '</span>'; }).join('');
    var chipsMiss = m.requisitosFaltantes.slice(0, 8).map(function (r) { return '<span class="chip miss">' + esc(r) + '</span>'; }).join('');
    var b = m.breakdown;
    function barra(rot, v) { return '<div class="bar-label"><span>' + rot + '</span><span>' + v + '%</span></div><div class="bar"><i style="width:' + clamp(v, 0, 100) + '%"></i></div>'; }
    var abrir = amostra
      ? '<span class="source-tag sample-tag">vaga de exemplo (fictícia)</span>'
      : '<a class="btn small" href="' + esc(safeUrl(m.link)) + '" target="_blank" rel="noopener noreferrer">Abrir vaga</a>';
    return '<article class="card job" data-id="' + esc(m.id) + '">' +
      '<div class="job-head"><div><h3 class="job-title">' + esc(m.titulo) + '</h3>' +
      '<div class="job-meta">' + esc(m.empresa) + ' · ' + esc(m.local) + ' · ' + esc(m.modalidade) +
      (m.nivel ? ' · ' + esc(m.nivel) : '') + (m.salario ? ' · ' + esc(m.salario) : '') + '</div></div>' +
      '<div class="badge" style="background:' + pr.color + '">' + m.compatibilidade + '%<small>' + esc(pr.label) + '</small></div></div>' +
      '<div>' + chipsOk + chipsMiss + '</div>' +
      '<details class="breakdown"><summary>Ver detalhes do cálculo</summary>' +
      barra('Skills', b.skills) + barra('Cargo', b.cargo) + barra('Senioridade', b.senioridade) + barra('Localização', b.localizacao) +
      '</details>' +
      '<div class="row">' + abrir +
      '<button class="btn small" data-act="salvar">' + (ja ? 'Salva no Kanban' : 'Salvar') + '</button>' +
      '<button class="btn small primary" data-act="aplicar">' + (ja && ja.stage !== 'Salvas' ? 'Marcada como aplicada' : 'Marcar como aplicada') + '</button>' +
      '<span class="source-tag">' + esc(m.source) + (m.dataPublicacao ? ' · ' + esc(fmtDate(m.dataPublicacao)) : '') + '</span></div></article>';
  }

  function renderVagas() {
    $('#vagas-lista').innerHTML = state.ranked.slice(0, 60).map(jobCardHtml).join('');
  }

  function doSearch() {
    var q = {
      termo: $('#busca-termo').value.trim(),
      cidade: $('#busca-cidade').value.trim(),
      remoto: $('#busca-remoto').checked
    };
    if (!q.termo) { toast('Digite um cargo ou palavra-chave.'); return; }
    var btn = $('#btn-buscar');
    btn.disabled = true; btn.textContent = 'Buscando...';
    $('#fontes-status').innerHTML = '';
    $('#vagas-resumo').textContent = 'Consultando as fontes de vagas...';

    Promise.all(SOURCES.map(function (s) {
      return s.run(q).then(
        function (jobs) { return { nome: s.nome, ok: true, jobs: jobs }; },
        function (e) { return { nome: s.nome, ok: false, jobs: [], erro: e && e.message }; }
      );
    })).then(function (res) {
      $('#fontes-status').innerHTML = res.map(function (r) {
        return r.ok
          ? '<span class="chip ok">' + esc(r.nome) + ': ' + r.jobs.length + ' vaga(s)</span>'
          : '<span class="chip fail" title="' + esc(r.erro || '') + '">' + esc(r.nome) + ': indisponível no navegador</span>';
      }).join('');
      var jobs = [];
      res.forEach(function (r) { jobs = jobs.concat(r.jobs); });
      var usouExemplos = false;
      if (state.settings.exemplos || jobs.length === 0) { jobs = jobs.concat(SAMPLE_JOBS); usouExemplos = true; }
      var alvo = Object.assign({}, state.profile, { cidade: q.cidade, aceitaRemoto: q.remoto });
      state.ranked = rankJobs(jobs, alvo);
      $('#vagas-resumo').textContent = state.ranked.length + ' vaga(s) compatíveis com o filtro, da maior para a menor compatibilidade.' +
        (usouExemplos ? ' Inclui vagas de exemplo (fictícias).' : '');
      renderVagas();
    }).finally(function () { btn.disabled = false; btn.textContent = 'Buscar vagas'; });
  }

  function showSamples() {
    var alvo = Object.assign({}, state.profile, {
      cidade: $('#busca-cidade').value.trim() || state.profile.cidade,
      aceitaRemoto: $('#busca-remoto').checked
    });
    state.ranked = rankJobs(SAMPLE_JOBS, alvo);
    $('#fontes-status').innerHTML = '<span class="chip">Modo exemplo: sem acessar a internet</span>';
    $('#vagas-resumo').textContent = state.ranked.length + ' vaga(s) de exemplo (fictícias) compatíveis com o filtro.';
    renderVagas();
  }

  // ---------- Kanban ----------
  function renderKanban() {
    $('#kanban').innerHTML = STAGES.map(function (st) {
      var cards = state.apps.filter(function (a) { return a.stage === st; });
      return '<section class="col" aria-label="' + esc(STAGE_LABEL[st]) + '"><h3>' + esc(STAGE_LABEL[st]) +
        ' <span class="count">' + cards.length + '</span></h3>' +
        (cards.length ? cards.map(kcardHtml).join('') : '<p class="empty">Vazio</p>') + '</section>';
    }).join('');
  }
  function kcardHtml(a) {
    var opts = STAGES.map(function (s) { return '<option value="' + s + '"' + (s === a.stage ? ' selected' : '') + '>' + esc(STAGE_LABEL[s]) + '</option>'; }).join('');
    var pr = priorityFor(a.match || 0);
    var abrir = a.job.source !== 'sample' && a.job.link
      ? '<a class="btn small" href="' + esc(safeUrl(a.job.link)) + '" target="_blank" rel="noopener noreferrer">Abrir</a>' : '';
    var ics = a.interviewAt ? '<button class="btn small" data-act="ics">Baixar .ics</button>' : '';
    return '<div class="kcard" data-id="' + esc(a.id) + '"><b>' + esc(a.job.titulo) + '</b>' +
      '<div class="job-meta">' + esc(a.job.empresa) + ' · <span style="color:' + pr.color + '">' + (a.match || 0) + '%</span></div>' +
      '<label>Etapa<select data-field="stage">' + opts + '</select></label>' +
      '<label>Entrevista (data e hora)<input type="datetime-local" data-field="interviewAt" value="' + esc(a.interviewAt || '') + '"></label>' +
      '<label>Anotações<textarea rows="2" data-field="notes">' + esc(a.notes || '') + '</textarea></label>' +
      '<div class="row">' + abrir + ics + '<button class="btn small danger" data-act="remover">Remover</button></div></div>';
  }

  // ---------- Agenda: gera arquivo .ics (abre no Google Calendar, Outlook, Apple) ----------
  function icsEscape(t) { return String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function buildIcs(a) {
    var start = new Date(a.interviewAt);
    var end = new Date(start.getTime() + 60 * 60000);
    function alarma(trigger, txt) { return ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + txt, 'TRIGGER:' + trigger, 'END:VALARM']; }
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Radar de Vagas//PT-BR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + a.id.replace(/[^a-z0-9]/gi, '') + '-' + start.getTime() + '@radar-de-vagas',
      'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
      'SUMMARY:' + icsEscape('Entrevista: ' + a.job.titulo + ' (' + a.job.empresa + ')'),
      'DESCRIPTION:' + icsEscape(a.notes || ''),
      'LOCATION:' + icsEscape(a.job.local || '')]
      .concat(alarma('-P1D', 'Entrevista amanhã'), alarma('-PT1H', 'Entrevista em 1 hora'), alarma('-PT15M', 'Entrevista em 15 minutos'))
      .concat(['END:VEVENT', 'END:VCALENDAR']).join('\r\n');
  }
  function download(nome, conteudo, tipo) {
    var url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    var a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- Curriculo ----------
  function barraHtml(rot, v) {
    return '<div class="bar-label"><span>' + esc(rot) + '</span><span>' + v + '%</span></div><div class="bar"><i style="width:' + clamp(v, 0, 100) + '%"></i></div>';
  }
  function renderCv() {
    var r = state.cv;
    var box = $('#cv-resultado');
    if (!r) { box.innerHTML = ''; return; }
    var meta = NIVEL_META[r.nivel] || NIVEL_META.ajustes;
    var ex = r.extracted || {};
    var exLinhas = [['Nome', ex.nome], ['E-mail', ex.email], ['Telefone', ex.telefone], ['LinkedIn', ex.linkedin],
      ['Portfólio', ex.portfolio], ['Cargo', ex.titulo], ['Senioridade', ex.senioridade]]
      .filter(function (x) { return x[1]; })
      .map(function (x) { return '<li><b>' + esc(x[0]) + ':</b> ' + esc(x[1]) + '</li>'; }).join('');
    box.innerHTML =
      '<div class="card"><div class="score-wrap">' +
      '<div class="score-ring" style="--pct:' + r.score + ';--ring:' + meta.color + '"><span>' + r.score + '</span></div>' +
      '<div><h3 style="color:' + meta.color + '">' + esc(meta.label) + '</h3><p class="muted" style="margin:0">' + esc(meta.frase) + '</p>' +
      (r.palavras ? '<p class="hint">' + r.palavras + ' palavras analisadas</p>' : '') + '</div></div></div>' +
      (r.resumoIA ? '<div class="card"><h3>Avaliação da IA</h3><p>' + esc(r.resumoIA) + '</p></div>' : '') +
      '<div class="card"><h3>Detalhe da nota</h3>' +
      barraHtml('Contato', r.breakdown.contato) + barraHtml('Palavras-chave', r.breakdown.palavrasChave) +
      barraHtml('Seções', r.breakdown.secoes) + barraHtml('Resultados', r.breakdown.resultados) + barraHtml('Formato', r.breakdown.formato) + '</div>' +
      (r.pontosFortes.length ? '<div class="card"><h3>Pontos fortes</h3><ul class="clean">' + r.pontosFortes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '') +
      (r.issues.length ? '<div class="card"><h3>O que melhorar</h3>' + r.issues.map(function (i) {
        return '<div class="issue ' + esc(i.gravidade) + '"><b>' + esc(i.campo) + '</b>: ' + esc(i.problema) + '<small>' + esc(i.sugestao) + '</small></div>';
      }).join('') + '</div>' : '') +
      (r.skillsEncontradas.length ? '<div class="card"><h3>Competências reconhecidas</h3>' + r.skillsEncontradas.map(function (s) { return '<span class="chip hit">' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="card"><h3>Dados encontrados</h3>' + (exLinhas ? '<ul class="clean">' + exLinhas + '</ul>' : '<p class="empty">Nada identificado.</p>') +
      '<div class="row"><button class="btn primary" id="btn-aplicar-perfil">Preencher meu perfil com estes dados</button></div></div>';
  }

  // ---------- Perfil ----------
  function fillPerfilForm() {
    var f = $('#form-perfil'), p = state.profile;
    ['nome', 'titulo', 'senioridade', 'cidade', 'resumo', 'email', 'telefone', 'linkedin', 'portfolio', 'pretensaoSalarial'].forEach(function (k) {
      f.elements[k].value = p[k] || '';
    });
    f.elements.aceitaRemoto.checked = !!p.aceitaRemoto;
    f.elements.competencias.value = (p.competencias || []).join(', ');
    f.elements.palavrasChave.value = (p.palavrasChave || []).join(', ');
    $$('input[name=tc]', f).forEach(function (c) { c.checked = (p.tiposContratacao || []).indexOf(c.value) !== -1; });
  }
  function readPerfilForm() {
    var f = $('#form-perfil');
    var p = {};
    ['nome', 'titulo', 'senioridade', 'cidade', 'resumo', 'email', 'telefone', 'linkedin', 'portfolio', 'pretensaoSalarial'].forEach(function (k) { p[k] = f.elements[k].value.trim(); });
    p.aceitaRemoto = f.elements.aceitaRemoto.checked;
    p.competencias = parseList(f.elements.competencias.value);
    p.palavrasChave = parseList(f.elements.palavrasChave.value);
    p.tiposContratacao = $$('input[name=tc]:checked', f).map(function (c) { return c.value; });
    return p;
  }

  // ---------- Config ----------
  function renderConfig() {
    $('#cfg-backend').value = state.settings.backend || '';
    $('#cfg-exemplos').checked = !!state.settings.exemplos;
  }

  /* =====================================================================
   * 8. EVENTOS E INICIALIZACAO
   * ===================================================================== */
  function go(tab) {
    if (TABS.indexOf(tab) === -1) tab = 'inicio';
    TABS.forEach(function (t) { $('#tab-' + t).hidden = t !== tab; });
    $$('.navbtn').forEach(function (b) {
      if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    $('#toast').hidden = true; // o aviso da tela anterior nao deve cobrir a nova tela
    if (tab === 'inicio') renderInicio();
    if (tab === 'vagas') { renderBuscaForm(); renderVagas(); }
    if (tab === 'kanban') renderKanban();
    if (tab === 'perfil') fillPerfilForm();
    if (tab === 'config') renderConfig();
    window.scrollTo(0, 0);
  }

  function bindEvents() {
    $$('.navbtn').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.tab); }); });
    window.addEventListener('hashchange', function () { go(location.hash.replace('#', '')); });

    // Inicio
    $('#btn-demo').addEventListener('click', function () {
      var alvo = state.profile;
      var ranked = rankJobs(SAMPLE_JOBS, Object.assign({}, alvo, { aceitaRemoto: true }));
      var estagios = ['Aplicado', 'Entrevista', 'Salvas', 'Triagem', 'Proposta'];
      var amanha = new Date(Date.now() + 2 * 86400000); amanha.setHours(14, 0, 0, 0);
      var pad = function (n) { return String(n).padStart(2, '0'); };
      var local = amanha.getFullYear() + '-' + pad(amanha.getMonth() + 1) + '-' + pad(amanha.getDate()) + 'T' + pad(amanha.getHours()) + ':' + pad(amanha.getMinutes());
      ranked.forEach(function (m, i) {
        if (findApp(m.id)) return;
        addOrMoveApp(m, estagios[i % estagios.length]);
        var a = findApp(m.id);
        if (a.stage === 'Entrevista') { a.interviewAt = local; a.notes = 'Preparar cases de campanhas e métricas (ROAS, CPA).'; }
      });
      saveApps(); renderInicio(); toast('Dados de demonstração carregados. Veja a aba Kanban.');
    });
    $('#btn-limpar-demo').addEventListener('click', function () {
      if (!state.apps.length) { toast('Não há candidaturas para limpar.'); return; }
      if (!confirm('Remover TODAS as candidaturas do Kanban?')) return;
      state.apps = []; saveApps(); renderInicio(); toast('Candidaturas removidas.');
    });

    // Vagas
    $('#form-busca').addEventListener('submit', function (e) { e.preventDefault(); doSearch(); });
    $('#btn-exemplos').addEventListener('click', showSamples);
    $('#busca-remoto').addEventListener('change', function () { this.dataset.touched = '1'; });
    $('#vagas-lista').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var card = btn.closest('.job');
      var m = state.ranked.filter(function (x) { return x.id === card.dataset.id; })[0];
      if (!m) return;
      if (btn.dataset.act === 'salvar') { addOrMoveApp(m, findApp(m.id) ? findApp(m.id).stage : 'Salvas'); toast('Vaga salva no Kanban.'); }
      if (btn.dataset.act === 'aplicar') { addOrMoveApp(m, 'Aplicado'); toast('Marcada como aplicada no Kanban.'); }
      renderVagas();
    });

    // Kanban
    var kb = $('#kanban');
    kb.addEventListener('change', function (e) {
      var el = e.target, card = el.closest('.kcard');
      if (!card || !el.dataset.field) return;
      var a = findApp(card.dataset.id);
      if (!a) return;
      if (el.dataset.field === 'stage') {
        a.stage = el.value; a.updatedAt = new Date().toISOString(); a.history.push({ stage: el.value, at: a.updatedAt });
        saveApps(); renderKanban(); return;
      }
      a[el.dataset.field] = el.value; saveApps();
      if (el.dataset.field === 'interviewAt') renderKanban();
    });
    kb.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var a = findApp(btn.closest('.kcard').dataset.id);
      if (!a) return;
      if (btn.dataset.act === 'remover') {
        if (!confirm('Remover esta candidatura?')) return;
        state.apps = state.apps.filter(function (x) { return x.id !== a.id; }); saveApps(); renderKanban();
      }
      if (btn.dataset.act === 'ics') download('entrevista-' + a.job.empresa.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.ics', buildIcs(a), 'text/calendar;charset=utf-8');
    });

    // Curriculo
    $('#cv-arquivo').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var nomeEl = $('#cv-arquivo-nome');
      var ehPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      if (file.size > 6 * 1024 * 1024) { toast('Arquivo grande demais (limite de 6 MB).'); this.value = ''; return; }
      var reader = new FileReader();
      reader.onerror = function () { toast('Não consegui ler o arquivo.'); };
      if (ehPdf) {
        reader.onload = function () {
          var s = String(reader.result || '');
          state.cvPdf = { base64: s.slice(s.indexOf(',') + 1), nome: file.name };
          nomeEl.textContent = 'PDF carregado: ' + file.name + ' (use "Analisar com IA")';
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = function () { state.cvPdf = null; $('#cv-texto').value = String(reader.result || ''); nomeEl.textContent = file.name; };
        reader.readAsText(file);
      }
    });
    $('#btn-analisar').addEventListener('click', function () {
      var t = $('#cv-texto').value.trim();
      if (!t) { toast(state.cvPdf ? 'PDF só funciona com "Analisar com IA".' : 'Cole o texto do currículo primeiro.'); return; }
      state.cv = analyzeCV(t, state.profile); renderCv();
    });
    $('#btn-analisar-ia').addEventListener('click', function () {
      var t = $('#cv-texto').value.trim();
      if (!t && !state.cvPdf) { toast('Cole o texto ou carregue um arquivo primeiro.'); return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Analisando...';
      var input = state.cvPdf && !t
        ? { pdfBase64: state.cvPdf.base64, mimeType: 'application/pdf', alvo: state.profile }
        : { texto: t, alvo: state.profile };
      chamarBackendIA(input).then(function (r) { state.cv = r; renderCv(); })
        .catch(function (err) { toast('IA indisponível: ' + (err && err.message ? err.message : 'erro desconhecido') + ' Use a análise local.'); })
        .finally(function () { btn.disabled = false; btn.textContent = 'Analisar com IA'; });
    });
    $('#cv-resultado').addEventListener('click', function (e) {
      if (e.target.id !== 'btn-aplicar-perfil' || !state.cv) return;
      state.profile = mergeExtractedIntoProfile(state.profile, state.cv.extracted);
      save(KEYS.profile, state.profile); toast('Perfil atualizado com os dados do currículo.');
    });

    // Perfil
    $('#form-perfil').addEventListener('submit', function (e) {
      e.preventDefault();
      state.profile = readPerfilForm(); save(KEYS.profile, state.profile); toast('Perfil salvo.');
    });

    // Config
    $('#btn-salvar-backend').addEventListener('click', function () {
      state.settings.backend = $('#cfg-backend').value.trim(); save(KEYS.settings, state.settings); toast('Backend salvo.');
    });
    $('#btn-testar-backend').addEventListener('click', function () {
      var base = $('#cfg-backend').value.trim().replace(/\/+$/, '');
      var st = $('#cfg-backend-status');
      if (!base) { st.textContent = 'Digite a URL primeiro.'; return; }
      st.textContent = 'Testando...';
      fetchJSON(base + '/').then(function (d) { st.textContent = d && d.ok ? 'Conectado. Modelo: ' + (d.modelo || 'desconhecido') : 'Respondeu, mas não parece o backend certo.'; })
        .catch(function () { st.textContent = 'Não consegui conectar. Confira a URL e sua internet.'; });
    });
    $('#cfg-exemplos').addEventListener('change', function () { state.settings.exemplos = this.checked; save(KEYS.settings, state.settings); });
    $('#btn-exportar').addEventListener('click', function () {
      download('radar-de-vagas-backup.json', JSON.stringify({ profile: state.profile, apps: state.apps, settings: state.settings }, null, 2), 'application/json');
    });
    $('#cfg-importar').addEventListener('change', function () {
      var file = this.files && this.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var d = JSON.parse(String(reader.result));
          if (d.profile) state.profile = Object.assign({}, DEFAULT_PROFILE, d.profile);
          if (Array.isArray(d.apps)) state.apps = d.apps;
          if (d.settings) state.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings);
          save(KEYS.profile, state.profile); saveApps(); save(KEYS.settings, state.settings);
          renderConfig(); toast('Backup restaurado.');
        } catch (err) { toast('Arquivo de backup inválido.'); }
      };
      reader.readAsText(file);
    });
    $('#btn-apagar-tudo').addEventListener('click', function () {
      if (!confirm('Apagar perfil, candidaturas e configurações deste navegador?')) return;
      try { Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); }); } catch (e) {}
      state.profile = Object.assign({}, DEFAULT_PROFILE); state.apps = []; state.settings = Object.assign({}, DEFAULT_SETTINGS);
      state.ranked = []; state.cv = null; state.cvPdf = null;
      renderConfig(); toast('Todos os dados foram apagados.');
    });
  }

  bindEvents();
  go(location.hash.replace('#', '') || 'inicio');
})();
