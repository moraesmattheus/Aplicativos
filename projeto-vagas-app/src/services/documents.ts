// Motor de Documentos v4 - Blindado contra Crashes (S24 Ultra Ready)
// Foco: Scaneamento binário direto e conversão Base64 ultra-segura.

import * as pako from 'pako';

export interface LeituraArquivo {
  ok: boolean;
  texto: string;
  motivo?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function extrairTextoDeArquivo(
  uri: string,
  nome?: string,
  mime?: string,
  bytesJaCarregados?: Uint8Array,
): Promise<LeituraArquivo & { bytes?: Uint8Array }> {
  try {
    const bytes = bytesJaCarregados || await lerBytesDeUri(uri);
    if (!bytes || bytes.length === 0) {
      console.warn('[Documents] Arquivo vazio:', uri);
      return { ok: false, texto: '', motivo: 'Arquivo vazio.' };
    }
    if (bytes.length > MAX_FILE_SIZE) {
      console.warn('[Documents] Arquivo excede 10MB:', bytes.length);
      return { ok: false, texto: '', motivo: 'Arquivo muito grande (máx 10MB).' };
    }

    const lower = (nome ?? '').toLowerCase();
    const ehPdf = lower.endsWith('.pdf') || mime === 'application/pdf' || (bytes[0] === 0x25 && bytes[1] === 0x50);

    // Se for PDF, vamos apenas extrair o texto básico.
    // Se falhar ou for complexo, o app usará o botão "Analisar com IA" que envia os bytes crus.
    if (ehPdf) {
      try {
        const t = extrairTextoPdfBinario(bytes);
        return { ok: t.length > 20, texto: t, bytes };
      } catch (pdfError) {
        console.error('[Documents] Erro ao extrair PDF:', pdfError);
        // Retorna bytes mesmo que a extração tenha falhado (IA pode processar)
        return { ok: false, texto: '', motivo: 'PDF complexo. Use "Analisar com IA".', bytes };
      }
    }

    // Para outros arquivos, tenta ler como UTF-8 simples
    try {
      const texto = new TextDecoder('utf-8').decode(bytes.subarray(0, 100000));
      return { ok: texto.length > 10, texto, bytes };
    } catch (decodeError) {
      console.error('[Documents] Erro ao decodificar UTF-8:', decodeError);
      return { ok: false, texto: '', motivo: 'Formato não suportado.', bytes };
    }
  } catch (e) {
    console.error('[Documents] Erro geral ao processar arquivo:', e);
    return { ok: false, texto: '', motivo: 'Erro ao processar arquivo.' };
  }
}

// ------------------------------------------------------------------
// PDF Binário: Procura marcadores sem converter o arquivo em String
// ------------------------------------------------------------------
function extrairTextoPdfBinario(bytes: Uint8Array): string {
  let saida = '';
  // Hermes não suporta 'latin1' — usar 'utf-8' com fallback manual para bytes ASCII
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let streamsProcessados = 0;
  const MAX_STREAMS = 100; // Previne loops infinitos em PDFs malformados

  // Marcadores: 'stream' = [115, 116, 114, 101, 97, 109]
  for (let i = 0; i < bytes.length - 10 && streamsProcessados < MAX_STREAMS; i++) {
    if (bytes[i] === 115 && bytes[i+1] === 116 && bytes[i+2] === 114 && bytes[i+3] === 101 && bytes[i+4] === 97 && bytes[i+5] === 109) {
      streamsProcessados++;
      let start = i + 6;
      if (bytes[start] === 0x0D) start++;
      if (bytes[start] === 0x0A) start++;

      // Acha 'endstream' = [101, 110, 100, 115, 116, 114, 101, 97, 109]
      let end = -1;
      for (let j = start; j < Math.min(start + 50000, bytes.length - 9); j++) {
        if (bytes[j] === 101 && bytes[j+1] === 110 && bytes[j+2] === 100 && bytes[j+3] === 115) {
          end = j;
          break;
        }
      }

      if (end > start) {
        try {
          const chunk = bytes.subarray(start, end);
          // Só tenta inflar se parecer comprimido e não for muito grande
          if (chunk.length < 1024 * 1024) { // Máx 1MB por stream
            const inflated = pako.inflate(chunk);
            const content = decoder.decode(inflated);
            // Extrai o que estiver entre parênteses (...)
            const matches = content.match(/\((.*?)\)/g);
            if (matches) saida += matches.map(m => m.slice(1, -1)).join('') + ' ';
          }
        } catch (inflateError) {
          // Se não for FlateDecode ou falhar, ignora esse stream
          // Não loga para não poluir console em PDFs complexos
        }
      }
      i = end > 0 ? end : i + 6;
    }
  }

  if (streamsProcessados >= MAX_STREAMS) {
    console.warn('[Documents] PDF muito complexo, processamento limitado');
  }

  return saida.replace(/\\/g, '').trim();
}

// ------------------------------------------------------------------
// Base64 Ultra-Segura (sem btoa, sem crashes)
// Otimizada para Android de alta densidade (S24/S26 Ultra)
// Processamento por blocos para evitar OutOfMemoryError
// ------------------------------------------------------------------
export function bytesParaBase64(bytes: Uint8Array): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const len = bytes.length;

  // Limite de segurança: 8MB em base64 = ~6MB binário
  if (len > 6 * 1024 * 1024) {
    throw new Error('Arquivo muito grande para conversão (máx 6MB)');
  }

  // Processamento por blocos de 64KB para evitar stack overflow
  const CHUNK_SIZE = 65536; // 64KB por iteração
  const chunks: string[] = [];

  for (let chunkStart = 0; chunkStart < len; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, len);
    const chunkLen = chunkEnd - chunkStart;
    let chunkResult = "";

    let i = chunkStart + 2;
    const limit = chunkStart + chunkLen;

    for (; i < limit; i += 3) {
      chunkResult += abc[bytes[i - 2] >> 2];
      chunkResult += abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
      chunkResult += abc[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
      chunkResult += abc[bytes[i] & 0x3f];
    }

    // Padding apenas no último chunk
    if (chunkEnd === len) {
      if (i === len + 1) {
        chunkResult += abc[bytes[i - 2] >> 2];
        chunkResult += abc[(bytes[i - 2] & 0x03) << 4];
        chunkResult += "==";
      } else if (i === len) {
        chunkResult += abc[bytes[i - 2] >> 2];
        chunkResult += abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        chunkResult += abc[(bytes[i - 1] & 0x0f) << 2];
        chunkResult += "=";
      }
    }

    chunks.push(chunkResult);
  }

  return chunks.join('');
}

async function lerBytesDeUri(uri: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch { return null; }
}

export function pareceTexto(s: string) {
  return !!s && s.length > 20;
}
