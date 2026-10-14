// AudioWorklet: um pedacinho de código que roda DENTRO do motor de áudio do navegador,
// numa thread própria (por isso não trava a tela nem "engasga" o som).
//
// O navegador chama process() ~125 vezes por segundo entregando 128 amostras de áudio por vez.
// Aqui juntamos 4096 amostras (~0,25 s) e mandamos para o offscreen.js.

class CapturaPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.posicao = 0;
  }

  process(entradas) {
    const canal = entradas[0][0]; // primeira entrada, primeiro canal (já vem em mono)
    if (!canal) return true;
    for (let i = 0; i < canal.length; i++) {
      this.buffer[this.posicao++] = canal[i];
      if (this.posicao === this.buffer.length) {
        this.port.postMessage(this.buffer.slice());
        this.posicao = 0;
      }
    }
    return true; // true = "continue me chamando"
  }
}

registerProcessor('captura-pcm', CapturaPcm);
