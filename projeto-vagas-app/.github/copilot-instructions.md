# Instruções para IA (GitHub Copilot)

**Leia e siga o arquivo `AGENTS.md` na raiz do projeto antes de qualquer alteração.**

Ele contém a visão do produto, o estado atual (o que já foi feito), a arquitetura, o mapa de
arquivos, as regras de **o que fazer** e **o que NÃO fazer**, e o roadmap. É o documento-mãe e
deve ser mantido atualizado a cada mudança relevante.

**REGRA DE OURO (seção 0.2 do AGENTS.md):** não apague, sobrescreva ou reescreva código que já
funciona — mudança = adição/extensão. Só alterar/remover existente se for bug comprovado ou pedido
do dono. E **sempre registre no `CHANGELOG.md`** o que foi feito, onde, o que mudou e por quê.

Resumo mínimo:
- App Expo/React Native (SDK 57) — Android primeiro. CRM pessoal de vagas/carreira.
- Vagas remotas de qualquer lugar; presenciais/híbridas **só em Florianópolis/SC**.
- Candidatura **assistida** (o usuário confirma). Nunca fazer scraping de LinkedIn/Gupy/Solides.
- Nunca guardar senhas de terceiros; login só via Google/OAuth. Nunca commitar chaves de API.
- Toda persistência passa por `src/services/storage.ts`. Rodar `npx tsc --noEmit` antes de concluir.
