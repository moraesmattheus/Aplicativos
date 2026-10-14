# Instruções permanentes para o Claude neste repositório

## Perfil de quem usa
- Mattheus está começando a faculdade de Engenharia de Software e precisa aprender do zero.
- Explique tudo em português, passo a passo, principalmente código.
- Não use travessão longo (—) em nenhuma resposta.
- Uma instrução por vez, em blocos curtos (TDAH).

## Regra de apps inspirados em apps existentes (OBRIGATÓRIA)

Sempre que o Mattheus quiser criar, copiar a ideia ou melhorar um app que já existe, para uso próprio
ou para vender (MRR), siga o guia abaixo ANTES de escrever código. Ele define o porteiro de perguntas,
a lista para produto comercial, a segurança e as regras para não perder a conta do Claude.

@docs/regra-apps-inspirados.md

## Regra do REA (Reverse Engineer Anything)

Pasta local do REA: `C:\Users\matth\Documents\Github\REA Eng reversa`

Toda vez que o REA for usado (qualquer ferramenta ou comando do REA, por exemplo
`rea-agents`, `open_binary`, `analyze_javascript_application`), ANTES de começar
a análise ou de criar qualquer coisa, faça esta pergunta:

> "Este é um app novo?"

- **Se for um app novo:** peça ao Mattheus para apertar o **+ do grupo de apps**
  para criar um novo projeto. Só continue depois que ele confirmar que o projeto foi criado.
- **Se não for um app novo:** siga normalmente com o trabalho no projeto atual.

Observações:
- A pergunta vale para cada uso do REA, mesmo que o app anterior fosse outro.
- Não presuma a resposta. Sempre pergunte.
- Depois da pergunta acima, siga também a seção "Uso seguro do REA" abaixo.

## Uso seguro do REA (evitar bloqueio da conta e problemas legais)

Base: Política de Uso da Anthropic, termos do Claude Code e o aviso de uso responsável do próprio REA (`DISCLAIMER.md`).
Analisar software é permitido quando é dentro do que a política aceita (software do próprio usuário,
com autorização, para aprender, depurar ou pesquisa de segurança autorizada). O que causa bloqueio
é contornar proteções, violar propriedade intelectual e tentar burlar as travas do Claude.

### Antes de analisar qualquer programa, pergunte (uma pergunta por vez)
1. "O programa é seu, ou você tem permissão ou licença que permita analisá-lo?"
2. "Qual é o objetivo? Entender uma ideia de funcionalidade, aprender, depurar ou segurança autorizada?"

Se a resposta à primeira for "não" ou "não sei", não use o REA nesse programa.

### NUNCA fazer
- Contornar proteções: DRM, verificação de licença, anti-cheat, autenticação ou proteção contra bots.
- Copiar código, textos, imagens, ícones, fontes ou dados do programa analisado.
- Executar, interceptar tráfego ou interagir com serviços de terceiros sem autorização.
- Insistir depois de uma recusa do Claude. Se o Claude recusar ou aparecer um bloqueio de segurança,
  PARAR, não reformular várias vezes para driblar e avisar o Mattheus. (Um bloqueio isolado não é
  violação, mas repetir tentativas de burlar a trava é.)
- Usar a assinatura do Claude em ferramentas de terceiros ou compartilhar a conta. Usar apenas o
  Claude Code oficial (o REA entra nele como servidor MCP). Para automações, usar chave de API.

### Inspirar-se em ideias (permitido)
- Ideias, conceitos de funcionalidade e organização de telas podem inspirar o projeto.
- Implementar SEMPRE com código próprio, escrito do zero a partir da descrição do comportamento
  (o que a pessoa vê e faz), nunca a partir do código ou dos recursos do programa original.
- Se algo só puder ser reproduzido copiando código ou recursos, não reproduzir. Descrever a ideia
  e escrever do zero.

### Documentação pública do projeto (README, CHANGELOG, commits, comentários)
- Não citar nomes de produtos de referência, nem nomes de arquivos, pastas ou símbolos do programa
  analisado. Descrever só a funcionalidade do projeto.
- Registrar cada análise em uma nota PRIVADA, fora do repositório público, em
  `C:\Users\matth\Documents\notas-rea\` (data, alvo, base de autorização, objetivo, o que se aprendeu).
  Essa nota é o que protege o Mattheus se alguém questionar a origem de uma ideia.
- Usar um produto de referência como INTEGRAÇÃO (funcionalidade, skill, conector) é permitido e pode
  ser documentado normalmente, pois é usar o produto do jeito que ele foi feito para ser usado.
