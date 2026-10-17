// Descobre, só pelo ENDEREÇO da aba, se ela é uma reunião em andamento.
// É uma aproximação: os sites mudam de endereço de vez em quando, então a lista é fácil de editar.

const PLATAFORMAS = [
  // Meet: sala com código abc-defg-hij, ou entrada por apelido/telefone (/lookup/...)
  { nome: 'Google Meet', regex: /^https:\/\/meet\.google\.com\/(?:[a-z]{3}-[a-z]{4}-[a-z]{3}|lookup\/[\w-]+)(?:[/?#]|$)/ },
  // Zoom pelo navegador: /wc/<número>/join, /wc/join/<número>, /wc/<número>/start ou /j/<número>
  { nome: 'Zoom', regex: /^https:\/\/[\w.-]*zoom\.(?:us|com)\/(?:wc\/|j\/|s\/)/ },
  // Teams: link de entrada, "light-meetings", Teams novo (v2) e o Teams pessoal (teams.live.com/meet)
  { nome: 'Microsoft Teams', regex: /^https:\/\/(?:teams\.microsoft\.com|teams\.live\.com|[\w-]+\.teams\.microsoft\.com)\/(?:.*(?:meetingjoin|meetup-join|light-meetings)|meet\/|v2\/\?.*meeting)/ },
  { nome: 'Webex', regex: /^https:\/\/[\w.-]*webex\.com\/(?:meet|wbxmjs|webappng)\// },
  { nome: 'Jitsi Meet', regex: /^https:\/\/meet\.jit\.si\/[\w-]{4,}/ }
];

export const detectarReuniao = (url = '') => PLATAFORMAS.find((p) => p.regex.test(url))?.nome ?? null;

// Título padrão da gravação: "Zoom: Aula de SQL" (a plataforma vem do endereço, o resto do título da aba).
export const tituloDaReuniao = (aba = {}) => {
  const plataforma = detectarReuniao(aba.url);
  const base = (aba.title ?? '').trim() || 'Reunião';
  return plataforma && !base.toLowerCase().includes(plataforma.toLowerCase()) ? `${plataforma}: ${base}` : base;
};
