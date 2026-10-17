// areas.js
// As AREAS DE TRABALHO do seu Vivaldi (copiadas das suas configuracoes em 06/10/2026).
// Cada area vira uma categoria/lista de tarefas e e usada para descobrir o que voce esta fazendo.
//
// Importante: extensoes nao conseguem ler os nomes das areas, so o "id" de cada aba
// (campo vivExtData). Por isso os nomes ficam aqui. Se voce criar, renomear ou apagar areas no
// Vivaldi, atualize esta lista (os ids estao em
// %LOCALAPPDATA%\Vivaldi\User Data\Default\Preferences, em vivaldi > workspaces > list).

export const AREAS_VIVALDI = [
  { id: "1791216005365", nome: "Faculdade" },
  { id: "1791216494103", nome: "Estudos" },
  { id: "1791216623113", nome: "Emails" },
  { id: "1791217156422", nome: "Vagas" },
  { id: "1791217343099", nome: "IAs" },
  { id: "1791217554405", nome: "Orion" },
  { id: "1791217853923", nome: "Calendários" },
  { id: "1791217990219", nome: "Redes sociais" },
  { id: "1791218114298", nome: "Compras" },
  { id: "1791245522902", nome: "Projetos" },
];

// O Vivaldi guarda a area de cada aba num texto JSON chamado "vivExtData". Se a versao do
// navegador nao informar, devolvemos null e a deteccao usa so o conteudo da aba.
export function lerAreaDaAba(aba) {
  try {
    const dados = aba.vivExtData ? JSON.parse(aba.vivExtData) : null;
    return dados && dados.workspaceId != null ? String(dados.workspaceId) : null;
  } catch {
    return null;
  }
}

export function areaPorId(id) {
  return AREAS_VIVALDI.find((area) => area.id === id) || null;
}
