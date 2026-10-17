// Chamada única ao Google Gemini, usada pelo resumo (texto) e pela identificação de falantes (áudio).
// "partes" é a lista de pedaços da mensagem: { text } para texto ou { inline_data: { mime_type, data } } para arquivos.

export const chamarGemini = async (partes, config) => {
  if (!config.geminiKey) throw new Error('falta a chave do Gemini nas Configurações');
  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModelo}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: partes }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    }
  );
  if (!resposta.ok) throw new Error(`Gemini respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  const dados = await resposta.json();
  return dados.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
};

export const lerJson = (texto) => {
  const semCercas = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(semCercas);
};

// Pede ao Google a lista de modelos que ESTA chave pode usar (a lista muda com o tempo, por isso não é fixa).
// Fica só com os que geram texto e aceitam o que precisamos; tira voz, imagem, vídeo e "embedding".
const NAO_SERVE = /tts|image|imagen|veo|embedding|aqa|live|native-audio|robotics|computer-use|learnlm|gemma/i;

export const listarModelosGemini = async (chave) => {
  if (!chave) throw new Error('cole a chave do Gemini primeiro');
  const modelos = [];
  let pagina = '';
  do {
    const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pagina}`, {
      headers: { 'x-goog-api-key': chave }
    });
    if (!resposta.ok) throw new Error(`Google respondeu ${resposta.status}: confira a chave`);
    const dados = await resposta.json();
    for (const m of dados.models ?? []) {
      const id = String(m.name ?? '').replace(/^models\//, '');
      if (!id.startsWith('gemini') || NAO_SERVE.test(id)) continue;
      if (!(m.supportedGenerationMethods ?? []).includes('generateContent')) continue;
      modelos.push({ id, nome: m.displayName || id, previa: /preview|exp/i.test(id) });
    }
    pagina = dados.nextPageToken ? `&pageToken=${encodeURIComponent(dados.nextPageToken)}` : '';
  } while (pagina);
  // Estáveis antes das prévias; dentro de cada grupo, o nome mais "alto" (versão mais nova) primeiro.
  return modelos.sort((a, b) => a.previa - b.previa || b.id.localeCompare(a.id, 'en', { numeric: true }));
};
