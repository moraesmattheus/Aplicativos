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
