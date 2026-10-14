# Regra para apps inspirados em apps existentes

Objetivo: construir versões melhores, para uso próprio ou para vender (MRR), **sem ban de conta e sem problema legal**.

Resumo em uma frase: **inspirar sim, copiar não. Ideia e função são livres. Código, marca, visual e dados dos outros não.**

> Isto é um guia prático e não substitui um advogado. Antes de COBRAR de clientes, faça uma revisão jurídica rápida.

---

## 0. Porteiro (o Claude pergunta ANTES de começar qualquer app inspirado em outro)

Uma pergunta por vez:

1. "Qual é a ideia ou função que você quer? Descreva com as suas palavras."
2. "É só para uso próprio ou vai ser vendido (MRR)?"
3. "Qual será a base? (a) escrito do zero, (b) código aberto com licença compatível, (c) API oficial do serviço."

Depois classifique em **Modo A (uso próprio)** ou **Modo B (comercial)** e siga as regras abaixo.
Se for Modo B, o Claude aplica a lista da seção 2 e avisa o que falta antes de qualquer cobrança.

---

## 1. Vale para os dois modos (A e B)

**Pode:**
- Usar a ideia, a função e a organização geral de uma tela.
- Aprender usando o app normalmente, lendo a documentação pública e observando o comportamento.
- Escrever tudo do zero, a partir da descrição do que a pessoa vê e faz.
- Partir de um projeto de **código aberto** com licença compatível, respeitando a licença.

**Não pode:**
- Copiar código, textos, imagens, ícones, fontes, sons ou dados do app original.
- Contornar paywall, trial, licença, DRM, login ou limite de uso. "Não pagar" tem que significar **construir a sua versão**, nunca burlar a cobrança de ninguém.
- Fazer scraping ou usar APIs não oficiais contra os termos do serviço.
- Usar o REA em um app de terceiros sem permissão (ver `CLAUDE.md`, seção "Uso seguro do REA").

**Como conseguir de graça, de forma legal:**
1. Alternativa de código aberto que você hospeda (self-host).
2. Plano gratuito do serviço original.
3. Construir o recurso você mesmo (é o que a gente faz aqui).

---

## 2. Só para o Modo B (produto comercial / MRR)

Marque cada item antes de cobrar.

**Identidade própria**
- [ ] Nome, logo, paleta, ícones, textos e layout característico **diferentes** do app original.
- [ ] Nome sem a marca do concorrente (nem "alternativa ao X" no nome).
- [ ] Nada de "parecido com X" que confunda o cliente sobre quem faz o produto.

**Código e licenças**
- [ ] Código 100% próprio, ou código aberto com licença **permissiva** (MIT, Apache 2.0, BSD).
- [ ] Cuidado com **GPL/AGPL** (podem obrigar a abrir o seu código) e licenças "não comercial" ou "source available".
- [ ] Arquivo com as licenças e avisos das dependências (`THIRD_PARTY_NOTICES`).

**Dados e integrações**
- [ ] Só APIs **oficiais**, com chave própria, respeitando limites e termos (sem revender dados).
- [ ] Nenhuma chave dentro do app ou do repositório.

**Direitos de terceiros**
- [ ] Funções muito específicas podem ter **patente**. Pesquise antes de monetizar.
- [ ] Nenhum conteúdo de terceiros sem permissão (imagens, textos, modelos).

**Pessoas e dinheiro (LGPD e pagamentos)**
- [ ] Política de privacidade e termos de uso.
- [ ] Dados pessoais protegidos, coletando só o necessário.
- [ ] Pagamento por provedor (Stripe, Mercado Pago, etc.). **Nunca** guardar número de cartão.
- [ ] Revisão jurídica rápida antes da primeira cobrança.

---

## 3. Segurança dos apps (sempre)

- Chaves e senhas só em `.env` (fora do Git) e em secrets (EAS, GitHub, Cloudflare). **Nunca** em arquivo do repositório, README, CHANGELOG ou commit. O repositório é público.
- Chave realmente privada fica no **backend** (ex.: Worker). Variáveis `EXPO_PUBLIC_*` e código web ficam visíveis para quem abrir o app.
- Validar e escapar todo dado vindo de fora (formulários, APIs, arquivos).
- Rodar `npm audit` e manter dependências atualizadas.
- Ativar **verificação em duas etapas** em GitHub, Expo, Cloudflare e na conta do Claude.
- Não registrar dados pessoais em logs.

---

## 4. Regras para não perder a conta do Claude

- Usar **só o Claude Code oficial**, na sua própria conta, sem compartilhar login. Para automações, usar **chave de API**.
- **Nunca** pedir ao Claude para burlar assinatura, trial, licença, DRM ou proteção de outro app.
- Se o Claude **recusar** ou aparecer um bloqueio: **parar**. Não reformular várias vezes para driblar. Mude a abordagem (por exemplo, descrever o comportamento em vez de analisar um programa).
- Explicar o contexto **real** uma única vez (app seu, autorizado, para aprender). Nunca inventar um contexto.
- Criar a conta e usar o serviço a partir de um local **suportado** pela Anthropic.
- Se receber um aviso: parar, não insistir e usar o formulário de apelação em claude.ai.

---

## 5. Documentação pública do projeto

- README, CHANGELOG, commits e comentários descrevem **só a funcionalidade do seu produto**.
- Não citar produtos de referência nem nomes de arquivos, pastas ou símbolos de programas analisados.
- A origem de cada ideia fica em uma **nota privada**, fora do repositório, em `C:\Users\matth\Documents\notas-rea\`.

Modelo da nota privada (um arquivo por app):

```
App do projeto:
Data:
Ideia ou função inspiradora (descrita com as minhas palavras):
Como estudei (uso normal do app, documentação pública, outro):
Programa foi analisado com o REA? (sim/não) Se sim: tinha permissão? Qual?
Base do meu código (do zero / código aberto: qual licença / API oficial):
Modo (A: uso próprio / B: comercial):
Itens da seção 2 que faltam:
Observações:
```

Usar um produto de referência como **integração** (funcionalidade, skill, conector) é permitido e pode ser documentado normalmente.
