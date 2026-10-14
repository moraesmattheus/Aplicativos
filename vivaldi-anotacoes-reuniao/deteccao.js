// Descobre, só pelo ENDEREÇO da aba, se ela é uma reunião em andamento.
// É uma aproximação: os sites mudam de endereço de vez em quando, então a lista é fácil de editar.

const PLATAFORMAS = [
  // Meet: a sala tem um código no formato abc-defg-hij
  { nome: 'Google Meet', regex: /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:[/?#]|$)/ },
  // Zoom pelo navegador: /wc/<número>/join, /wc/join/<número> ou /j/<número>
  { nome: 'Zoom', regex: /^https:\/\/[\w.-]*zoom\.(?:us|com)\/(?:wc|j)\// },
  // Teams: links de entrada e salas "light-meetings"
  { nome: 'Microsoft Teams', regex: /^https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/.*(?:meetingjoin|meetup-join|light-meetings|\/meet\/)/ },
  { nome: 'Webex', regex: /^https:\/\/[\w.-]*webex\.com\/(?:meet|wbxmjs)\// },
  { nome: 'Jitsi Meet', regex: /^https:\/\/meet\.jit\.si\/[\w-]{4,}/ }
];

export const detectarReuniao = (url = '') => PLATAFORMAS.find((p) => p.regex.test(url))?.nome ?? null;
