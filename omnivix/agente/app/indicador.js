// Lógica do indicador flutuante de gravação. Recebe o estado do app (processo principal) e só desenha.
// QUEM decide se a pílula está compacta ou expandida é o processo principal (ele vê onde o mouse está, mesmo sobre a
// área de arraste, onde a página não recebe eventos de mouse). Aqui só aplicamos o que ele mandar.

const $ = (id) => document.getElementById(id);
const dois = (n) => String(n).padStart(2, '0');
const formatar = (segundos) => {
  const h = Math.floor(segundos / 3600);
  return `${h ? `${h}:` : ''}${dois(Math.floor((segundos % 3600) / 60))}:${dois(segundos % 60)}`;
};

let estado = { fase: 'ocioso' };

const decorrido = () => (estado.inicioMs ? formatar(Math.max(0, Math.floor((Date.now() - estado.inicioMs) / 1000))) : '');

const desenhar = () => {
  const { fase, saude, alerta, falha, esperando, origem, expandido, fixado } = estado;
  const pilula = $('pilula');
  // Uma "classe de estado" só: cada uma muda a cor do ponto e do contorno por transição suave.
  const classe = falha ? 'falha' : alerta ? 'alerta' : fase;
  pilula.className = `pilula ${expandido ? 'expandida' : 'compacta'} ${classe}${fase === 'ocioso' || fase === 'iniciando' ? ' vazio' : ''}${fixado ? ' fixada' : ''}`;

  let titulo = 'REC';
  let detalhe = '';
  let compacto = decorrido() || 'REC';
  if (falha) {
    titulo = 'NÃO ESTÁ GRAVANDO'; detalhe = falha; compacto = 'Falha';
  } else if (esperando) {
    titulo = 'AGUARDANDO'; detalhe = esperando; compacto = 'Aguarde';
  } else if (fase === 'iniciando') {
    titulo = 'INICIANDO'; detalhe = 'Abrindo o áudio...'; compacto = 'Iniciando';
  } else if (fase === 'finalizando') {
    titulo = 'FINALIZANDO'; detalhe = 'Transcrevendo e resumindo...'; compacto = 'Finalizando';
  } else if (fase === 'gravando') {
    titulo = alerta ? 'ATENÇÃO' : 'REC';
    detalhe = alerta ? alerta.mensagem : origem === 'microfone' ? 'Reunião detectada, gravando' : origem === 'agenda' ? 'Gravando (agenda)' : 'Gravando';
    if (alerta) compacto = 'Atenção';
  }
  $('titulo').textContent = titulo;
  $('tempo').textContent = fase === 'gravando' && !falha && !esperando ? decorrido() : '';
  $('detalhe').textContent = detalhe;
  $('texto-compacto').textContent = compacto;

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
$('abrir').addEventListener('click', (evento) => {
  evento.stopPropagation(); // abrir o painel não deve também "fixar" a pílula
  window.agente.abrir('reunioes');
});
// Clique na pílula: fixa aberta (ou solta). Passar o mouse já a expande sozinho.
$('pilula').addEventListener('click', () => window.agente.fixarIndicador());
setInterval(() => estado.fase === 'gravando' && desenhar(), 1000); // só o relógio e o desenho: leve
