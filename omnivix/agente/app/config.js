// As configurações moram no processo principal (arquivo no disco, chaves criptografadas).
// Estas funções têm o mesmo nome das da extensão para as páginas compartilhadas funcionarem sem mudar.

export const carregarConfig = () => window.agente.lerConfig();
export const salvarConfig = (config) => window.agente.salvarConfig(config);
