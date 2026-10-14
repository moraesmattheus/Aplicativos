import { totaisPorTarefa } from "./relogio.js";
// dicas.js
// Dicas AUTOMATICAS de produtividade, escolhidas pelo tempo que a tarefa esta levando e pelo
// seu proprio historico. Tom calmo, sem culpa e sem cobranca (laudo: ansiedade alta).
// So logica (sem tela). Quando o servidor com IA estiver ligado, ele podera dar dicas sob medida.

const DICAS_POR_CATEGORIA = {
  Faculdade: "Defina a menor entrega que já conta e comece por ela. Depois melhore, se sobrar tempo.",
  Estudos: "Estude 25 minutos e explique em voz alta, com suas palavras, o que entendeu.",
  Projetos: "Faça a menor mudança que funciona, teste, e só depois melhore. Anote o próximo passo antes de parar.",
  Vagas: "Candidate-se a uma vaga por vez e reaproveite o currículo base, mudando só o que a vaga pede.",
  Emails: "Responda em 2 minutos o que for rápido. O resto vira uma tarefa com data.",
  Orion: "Escreva em uma frase o resultado que você quer hoje no Orion e comece por ele.",
  Compras: "Faça uma lista antes de abrir a loja. Compre só o que está nela.",
  Casa: "Ponha uma música e faça como um desafio de 15 minutos. Parar no tempo também vale.",
  "Saúde": "Comece com 5 minutos. Começar é a parte difícil, o resto costuma seguir.",
  "Finanças": "Resolva uma conta agora e agende as outras para a data certa.",
};

// Media (em minutos) de tempo que as tarefas CONCLUIDAS dessa categoria levaram.
// So devolve se houver pelo menos 3 tarefas concluidas com tempo registrado.
export function mediaDaCategoria(categoria, tarefas, sessoes) {
  const totais = totaisPorTarefa(sessoes);
  const tempos = sessoes
    .filter((s) => s.categoria === categoria && !s.tarefaId.startsWith("ctx:"))
    .map((s) => s.tarefaId);
  const concluidas = [...new Set(tempos)].filter((id) => {
    const t = tarefas.find((x) => x.id === id);
    return t && t.feita;
  });
  if (concluidas.length < 3) return null;
  const soma = concluidas.reduce((acc, id) => acc + totais[id], 0);
  return Math.round(soma / concluidas.length / 60000);
}

// Escolhe UMA dica (ou null). minutosSessao = tempo seguido agora; minutosTotal = tempo da tarefa.
export function escolherDica({ categoria, minutosSessao, minutosTotal, media, temNota }) {
  if (media && minutosTotal >= 20 && minutosTotal > media * 2) {
    return `Está levando ${minutosTotal} min, mais que o seu normal em ${categoria} (média de ${media} min). Defina o que é "bom o bastante" e termine essa parte.`;
  }
  if (minutosSessao >= 50) {
    return "Tarefa longa. Divida em 3 passos pequenos (o botão + cria subtarefas) e faça só o primeiro.";
  }
  if (minutosSessao >= 25) {
    return "Já são 25 minutos seguidos. Uma pausa curta de 5 minutos ajuda a render mais. Levante e se mexa.";
  }
  if (minutosSessao >= 10 && !temNota) {
    return 'Escreva em uma frase em "Onde parei?". Se você for interrompido, retoma sem esforço.';
  }
  if (minutosSessao >= 3 && DICAS_POR_CATEGORIA[categoria]) return DICAS_POR_CATEGORIA[categoria];
  return null;
}
