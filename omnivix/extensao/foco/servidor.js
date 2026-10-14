// servidor.js
// Pagina "Servidor": mostra se o backend local esta ligado. Chama so a rota /health, que nao
// exige senha e nao devolve nenhum dado seu. O endereco e sempre o do SEU computador (127.0.0.1).

const ENDERECO = "http://127.0.0.1:8787"; // mesma porta do comando de iniciar o servidor
const elEstado = document.getElementById("estado");
const elDetalhe = document.getElementById("detalhe");
const elBotao = document.getElementById("btn-verificar");

async function verificar() {
  elEstado.textContent = "Verificando...";
  elDetalhe.textContent = "";
  try {
    // AbortSignal.timeout: desiste depois de 3 s, para a tela nao ficar presa esperando.
    const resposta = await fetch(`${ENDERECO}/health`, { signal: AbortSignal.timeout(3000) });
    const dados = await resposta.json();
    if (resposta.ok && dados.ok === true) {
      elEstado.textContent = "Servidor ligado";
      elDetalhe.textContent = `Respondendo em ${ENDERECO}.`;
      return;
    }
    elEstado.textContent = "Servidor respondeu algo inesperado";
  } catch {
    elEstado.textContent = "Servidor desligado";
    elDetalhe.textContent = "Tudo que não depende de IA continua funcionando normalmente.";
  }
}

elBotao.addEventListener("click", verificar);
verificar();
// Confere de novo a cada 15 s enquanto a pagina estiver aberta.
setInterval(verificar, 15000);
