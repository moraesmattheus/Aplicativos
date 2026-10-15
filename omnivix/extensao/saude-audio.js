// Mede se há SOM de verdade entrando na gravação. "Gravando" só prova que os canais de áudio abriram;
// se o Zoom estiver tocando em outro dispositivo, a gravação seria silêncio e nada avisaria. Aqui medimos isso.
// Sem nenhuma API do navegador: serve à extensão, ao app e aos testes.

export const LIMIAR_SOM = 0.004; // volume (RMS) a partir do qual consideramos que há som
export const SEGUNDOS_SEM_SOM_PARA_AVISAR = 30; // tempo sem nenhum som da reunião antes de alertar

// Um medidor por canal (um para o áudio da reunião, outro para o seu microfone).
export const criarMedidor = (agora = () => Date.now()) => {
  let nivel = 0;
  let ultimoSom = agora();
  return {
    // Chamado a cada bloco de áudio com o volume (RMS) do bloco.
    registrar(rmsDoBloco) {
      nivel = Math.max(rmsDoBloco, nivel * 0.85); // sobe na hora, desce devagar (a barra não fica tremendo)
      if (rmsDoBloco >= LIMIAR_SOM) ultimoSom = agora();
    },
    // Devolve o que a tela precisa: um nível de 0 a 1 para a barrinha e há quantos segundos não há som.
    ler() {
      return {
        nivel: Math.min(1, Math.sqrt(nivel) * 2.5), // raiz: voz normal já enche bem a barra
        semSomSeg: Math.round((agora() - ultimoSom) / 1000)
      };
    }
  };
};

// Junta os dois canais numa "saúde" e decide se precisa avisar o usuário.
//  - Áudio da reunião mudo por muito tempo = problema provável (dispositivo errado, reunião sem som, captura falhando).
//  - Microfone mudo NÃO é problema (você pode estar mutado de propósito): só mostramos a barra.
export const avaliarSaude = ({ aba, mic, microfone }, limiteSeg = SEGUNDOS_SEM_SOM_PARA_AVISAR) => {
  const alerta = aba.semSomSeg >= limiteSeg
    ? { tipo: 'sem-som', mensagem: `Sem som da reunião há ${aba.semSomSeg} s. Confira a saída de áudio do Zoom.` }
    : null;
  return { nivelAba: aba.nivel, nivelMic: microfone ? mic.nivel : null, semSomAbaSeg: aba.semSomSeg, microfone, alerta };
};
