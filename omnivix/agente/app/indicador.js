// Lógica do indicador flutuante de gravação. Recebe o estado do app (processo principal) e só desenha.
// O relógio roda aqui (1 vez por segundo) a partir do instante em que a gravação começou.

const $ = (id) => document.getElementById(id);
const dois = (n) => String(n).padStart(2, '0');
const formatar = (segundos) => {
  const h = Math.floor(segundos / 3600);
  return `${h ? `${h}:` : ''}${dois(Math.floor((segundos % 3600) / 60))}:${dois(segundos % 60)}`;
};

let estado = { fase: 'ocioso' };

const desenhar = () => {
  const { fase, inicioMs, saude, alerta, falha, esperando, origem } = estado;
  const pilula = $('pilula');
  // Uma "classe de estado" só: cada uma muda a cor do ponto e do contorno por transição suave.
  const classe = falha ? 'falha' : alerta ? 'alerta' : fase;
  pilula.className = `pilula ${classe}${fase === 'ocioso' || fase === 'iniciando' ? ' vazio' : ''}`;

  if (falha) {
    $('titulo').textContent = 'NÃO ESTÁ GRAVANDO';
    $('tempo').textContent = '';
    $('detalhe').textContent = falha;
  } else if (esperando) {
    $('titulo').textContent = 'AGUARDANDO';
    $('tempo').textContent = '';
    $('detalhe').textContent = esperando;
  } else if (fase === 'iniciando') {
    $('titulo').textContent = 'INICIANDO';
    $('tempo').textContent = '';
    $('detalhe').textContent = 'Abrindo o áudio...';
  } else if (fase === 'finalizando') {
    $('titulo').textContent = 'FINALIZANDO';
    $('tempo').textContent = '';
    $('detalhe').textContent = 'Transcrevendo e resumindo...';
  } else if (fase === 'gravando') {
    $('titulo').textContent = alerta ? 'ATENÇÃO' : 'REC';
    $('tempo').textContent = inicioMs ? formatar(Math.max(0, Math.floor((Date.now() - inicioMs) / 1000))) : '';
    $('detalhe').textContent = alerta
      ? alerta.mensagem
      : origem === 'microfone' ? 'Reunião detectada, gravando' : origem === 'agenda' ? 'Gravando (agenda)' : 'Gravando';
  }

  // Barrinhas: reunião (verde) e microfone (azul). O microfone só aparece se estiver ligado.
  $('barra-aba').style.transform = `scaleY(${saude?.nivelAba ?? 0})`;
  $('barra-mic').style.transform = `scaleY(${saude?.nivelMic ?? 0})`;
  document.querySelector('.nivel.mic').classList.toggle('desligado', saude ? saude.nivelMic === null : true);
};

window.agente.aoMudarIndicador((novo) => {
  estado = novo;
  desenhar();
});
window.agente.estadoIndicador().then((inicial) => {
  estado = inicial;
  desenhar();
});
$('abrir').addEventListener('click', () => window.agente.abrir('reunioes'));
setInterval(() => estado.fase === 'gravando' && desenhar(), 1000); // só o relógio e o desenho: leve
