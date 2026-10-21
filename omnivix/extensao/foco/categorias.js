// categorias.js
// Le o titulo de uma tarefa (ou o titulo/site da aba aberta) e descobre a CATEGORIA a que ela
// pertence. As categorias principais sao as suas areas de trabalho do Vivaldi (areas.js);
// Casa, Saude, Financas e Pessoal completam o que nao tem area.
//
// Roda no seu computador, sem internet. Quando o servidor com IA estiver ligado ele podera
// refinar. Por enquanto sao regras simples, e a extensao APRENDE com voce: se voce mover uma
// tarefa para outra lista, as palavras dela passam a apontar para essa lista.
//
// Como as palavras sao comparadas: sem acento e sem diferenca de maiuscula/minuscula, por
// RADICAL (o comeco da palavra): "estud" vale para estudar, estudo, estudando.
// Um radical com "=" na frente so vale para a palavra exata ("=git").
// Este arquivo nao mexe na tela (usado tambem pelo background.js).

export const CATEGORIAS = [
  { nome: "Faculdade", radicais: ["facul", "universid", "aula", "prova", "seminar", "=tcc", "discipl", "infnet", "professor", "semestre", "monografia", "matricula", "moodle", "classroom"] },
  { nome: "Estudos", radicais: ["estud", "curso", "aprend", "tutorial", "livro", "leitura", "=git", "python", "javascript", "=sql", "revisar", "udemy", "coursera", "alura"] },
  { nome: "Projetos", radicais: ["extens", "codigo", "program", "=app", "=site", "=bug", "deploy", "repositor", "backend", "frontend", "feature", "implement", "corrigir", "desenvolv", "github", "gitlab", "stackoverflow", "localhost"] },
  { nome: "Vagas", radicais: ["empreg", "=vaga", "vagas", "curricul", "entrevist", "linkedin", "candidat", "portfolio", "salario", "freela", "gupy", "indeed", "glassdoor"] },
  { nome: "Emails", radicais: ["email", "gmail", "outlook", "=mail", "inbox", "responder", "mensag"] },
  { nome: "IAs", radicais: ["chatgpt", "claude", "gemini", "copilot", "=ias", "prompt", "perplexity", "anythingllm", "ollama"] },
  { nome: "Orion", radicais: ["orion"] },
  { nome: "Calendários", radicais: ["calendar", "agenda", "agendar", "reuniao", "compromisso", "marcar"] },
  { nome: "Redes sociais", radicais: ["instagram", "facebook", "tiktok", "twitter", "reddit", "discord", "whatsapp", "telegram", "redes", "publicar"] },
  { nome: "Compras", radicais: ["compr", "loja", "amazon", "mercadolivre", "shopee", "aliexpress", "pedido", "carrinho", "mercado", "supermercado"] },
  { nome: "Casa", radicais: ["aspirad", "limpar", "limpez", "lavar", "louca", "roupa", "cozinh", "faxina", "=casa", "lixo", "banheiro", "quarto", "arrumar"] },
  { nome: "Saúde", radicais: ["treino", "academia", "medic", "dentist", "consulta", "exame", "remedio", "terapia", "psicolog", "psiquiatr", "caminhada", "exercicio"] },
  { nome: "Finanças", radicais: ["pagar", "boleto", "fatura", "banco", "imposto", "parcela", "=pix", "orcamento", "financ"] },
  { nome: "Pessoal", radicais: ["amigo", "familia", "anivers", "presente", "viagem", "encontro"] },
];

// Palavras comuns que nao ensinam nada sobre a categoria.
const PALAVRAS_IGNORADAS = new Set([
  "para", "sobre", "fazer", "com", "uma", "que", "estou", "mais", "como", "das", "dos", "isso", "esse", "essa",
  "ainda", "muito", "fazendo", "hoje", "amanha", "depois", "preciso", "tenho", "pela", "pelo", "www", "com",
]);

export function normalizarTexto(texto) {
  return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function palavrasDe(titulo) {
  return normalizarTexto(titulo).split(/[^a-z0-9]+/).filter((p) => p.length >= 3);
}

function combinaRadical(palavra, radical) {
  return radical.startsWith("=") ? palavra === radical.slice(1) : palavra.startsWith(radical);
}

// Devolve o nome da categoria ou null (quando nao ha pista nenhuma).
// "aprendizado" e { palavra: nomeDaCategoria }, guardado quando voce move tarefas na mao.
export function classificar(titulo, aprendizado = {}) {
  const palavras = palavrasDe(titulo);
  const pontos = new Map();
  const somar = (nome, valor) => pontos.set(nome, (pontos.get(nome) || 0) + valor);

  for (const palavra of palavras) {
    if (Object.hasOwn(aprendizado, palavra)) somar(aprendizado[palavra], 3); // o que voce ensinou vale mais
    for (const categoria of CATEGORIAS) {
      if (categoria.radicais.some((r) => combinaRadical(palavra, r))) somar(categoria.nome, 1);
    }
  }

  let melhor = null;
  for (const [nome, valor] of pontos) {
    if (!melhor || valor > melhor.valor) melhor = { nome, valor };
  }
  return melhor ? melhor.nome : null;
}

// Palavras de um titulo que valem ser lembradas quando voce move a tarefa de lista.
export function palavrasParaAprender(titulo) {
  return palavrasDe(titulo).filter((p) => p.length >= 4 && !PALAVRAS_IGNORADAS.has(p));
}

// Acha uma lista pelo nome (sem acento e sem diferenca de maiuscula/minuscula).
export function listaPorNome(listas, nome) {
  const alvo = normalizarTexto(nome);
  return listas.find((lista) => normalizarTexto(lista.nome) === alvo) || null;
}

// Quantas palavras (de 4+ letras) duas frases tem em comum. Serve para casar o titulo de uma
// aba com o titulo de uma tarefa ("Prova de SQL - Infnet" com "estudar sql para prova").
export function palavrasEmComum(textoA, textoB) {
  const a = new Set(palavrasParaAprender(textoA));
  return palavrasParaAprender(textoB).filter((p) => a.has(p)).length;
}
