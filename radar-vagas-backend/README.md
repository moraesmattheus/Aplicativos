# Radar de Vagas — Backend de IA (Fase 2)

Backend **grátis** que dá "cérebro" ao app: lê o currículo (inclusive **PDF/DOCX e PDF escaneado**),
faz a análise ATS profunda por IA e extrai o perfil pronto pra preencher o app.

- **Hospedagem:** Cloudflare Workers (plano grátis, **sem cartão**).
- **IA:** Google Gemini (free tier do Google AI Studio) — lê PDF de forma nativa (multimodal).
- **Segurança:** a chave da IA fica como *secret* no Worker, **nunca** no app (regra do projeto).

O app funciona **sem** este backend (análise ATS local). Com ele, a análise fica muito melhor.

---

## Passo a passo (uma vez, ~10 min, tudo grátis)

### 1. Pegar a chave do Gemini (grátis)
1. Acesse **https://aistudio.google.com/apikey** (login Google).
2. Clique **Create API key** → copie a chave (começa com `AIza...`).
   - Free tier: modelo `gemini-2.0-flash`, ~15 req/min e ~1.500 req/dia. Sobra pra uso pessoal.

### 2. Criar conta na Cloudflare (grátis, sem cartão)
1. **https://dash.cloudflare.com/sign-up** → confirme o e-mail.

### 3. Publicar o Worker
Na sua máquina, dentro desta pasta `radar-vagas-backend`:

```bash
npm install
npx wrangler login                       # abre o navegador p/ autorizar (grátis)
npx wrangler secret put GEMINI_API_KEY   # cole a chave AIza... quando pedir
npm run deploy
```

No fim, o Wrangler mostra a URL pública, algo como:
`https://radar-vagas-backend.SEU-SUBDOMINIO.workers.dev`

### 4. Ligar no app
No app: **Perfil → ⚙️ Configurações → "Backend de IA (URL)"** e cole a URL do Worker. Salve.
Pronto — a aba **Currículo** ganha o botão **"Analisar com IA"**.

---

## Endpoints

- `GET /` → healthcheck (`{ ok: true }`).
- `POST /cv` → analisa o currículo. Body JSON:
  ```json
  {
    "texto": "texto do CV (opcional se mandar pdfBase64)",
    "pdfBase64": "conteúdo do PDF em base64 (opcional)",
    "mimeType": "application/pdf",
    "alvo": { "titulo": "Analista de Performance", "competencias": ["meta ads"] }
  }
  ```
  Resposta: `{ score, nivel, breakdown, issues[], pontosFortes[], extracted, resumoIA }`
  (mesmo formato do ATS local + `resumoIA`).

## Custo
Zero dentro dos free tiers de Cloudflare Workers e Gemini. Se um dia estourar, dá pra trocar a chave
por outra conta ou ligar limites — sem surpresa de cobrança (Cloudflare grátis não pede cartão).
