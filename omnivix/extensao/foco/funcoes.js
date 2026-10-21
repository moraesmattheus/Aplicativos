// funcoes.js
// Lista das funcoes da extensao (uma por icone). Usada pela barra de icones e pela pagina
// Ajustes. Para criar uma funcao nova: adicione uma linha aqui, uma pagina .html e um icone
// em icons/<icone>.png.
//   fixa: true = nao pode ser escondida (garante que voce sempre alcanca os Ajustes).
//   grupo: icones de grupos diferentes ficam separados por uma divisoria na barra vertical.

const FUNCOES = [
  { pagina: "briefing.html", nome: "Briefing", icone: "briefing", grupo: "uso" },
  { pagina: "tarefas.html", nome: "Tarefas", icone: "tarefas", grupo: "uso" },
  { pagina: "foco.html", nome: "Foco", icone: "foco", grupo: "uso" },
  { pagina: "abas.html", nome: "Abas", icone: "abas", grupo: "uso" },
  { pagina: "estatisticas.html", nome: "Estatísticas", icone: "estatisticas", grupo: "uso" },
  { pagina: "chat.html", nome: "Chat IA", icone: "chat", grupo: "ia" },
  { pagina: "calendario.html", nome: "Calendário", icone: "calendario", grupo: "ia" },
  { pagina: "notion.html", nome: "Notion", icone: "notion", grupo: "ia" },
  { pagina: "../popup.html", nome: "Gravar", icone: "gravar", grupo: "ia" },
  { pagina: "../reunioes.html", nome: "Reuniões", icone: "reunioes", grupo: "ia" },
  { pagina: "rotinas.html", nome: "Rotinas", icone: "rotinas", grupo: "ia" },
  { pagina: "mcp.html", nome: "MCP", icone: "mcp", grupo: "ia" },
  { pagina: "servidor.html", nome: "Servidor", icone: "servidor", grupo: "sistema" },
  { pagina: "ajustes.html", nome: "Ajustes", icone: "ajustes", grupo: "sistema", fixa: true },
];

// Desenha o icone de uma funcao: uma "pastilha" (forma e cores vem do CSS e dos Ajustes) com o
// simbolo dentro. O simbolo e uma imagem usada como MASCARA, por isso ele toma a cor do texto
// do seu tema. Veja .icone em base.css.
function criarIcone(funcao, traco) {
  const pastilha = document.createElement("span");
  pastilha.className = "icone";
  const brilho = document.createElement("span"); // recebe o brilho (drop-shadow)
  brilho.className = "glifo";
  const simbolo = document.createElement("i");
  // Espessura do traco: so aceita as 3 pastas que existem (nada vem de fora).
  const pasta = ["fino", "medio", "grosso"].includes(traco) ? traco : "fino";
  const imagem = `url(icons/glifos/${pasta}/${funcao.icone}.png)`; // nome vem da lista fechada acima
  simbolo.style.webkitMaskImage = imagem;
  simbolo.style.maskImage = imagem;
  brilho.append(simbolo);
  pastilha.append(brilho);
  return pastilha;
}

// Aplica a ordem escolhida: os ids em "ordem" vem primeiro; os que faltarem ficam no fim,
// na ordem padrao (assim uma funcao nova nunca "some").
function funcoesOrdenadas(ordem) {
  const posicao = (f) => {
    const i = ordem.indexOf(f.icone);
    return i === -1 ? ordem.length + FUNCOES.indexOf(f) : i;
  };
  return [...FUNCOES].sort((a, b) => posicao(a) - posicao(b));
}
