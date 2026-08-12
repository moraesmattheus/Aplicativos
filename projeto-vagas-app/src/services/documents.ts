// Extração de texto de arquivos de currículo, 100% no aparelho.
//
// - PDF: varre os content streams, descomprime FlateDecode (pako) e extrai os
//   operadores de texto (Tj / TJ / strings literais e hex). Funciona bem em PDFs
//   "de texto" (exportados de Word/Google Docs/Canva com texto). PDFs escaneados
//   (imagem) ou com fontes CID embutidas viram ilegíveis — nesse caso avisamos.
// - DOCX: é um ZIP; achamos `word/document.xml`, descomprimimos (deflate cru) e
//   tiramos as tags XML.
// - TXT: decodifica direto.
//
// A leitura de bytes (I/O) usa fetch/Blob/FileReader — portável entre web e
// nativo, sem depender da versão do expo-file-system. As funções de extração
// (bytes → texto) são puras, para facilitar teste e um futuro uso no backend.

import * as pako from 'pako';

export interface LeituraArquivo {
  ok: boolean;
  texto: string;
  motivo?: string;
}

// ------------------------------------------------------------------
// Orquestrador
// ------------------------------------------------------------------

export async function extrairTextoDeArquivo(
  uri: string,
  nome?: string,
  mime?: string,
): Promise<LeituraArquivo> {
  const lower = (nome ?? '').toLowerCase();
  const bytes = await lerBytesDeUri(uri);

  if (!bytes || bytes.length === 0) {
    // último recurso: tentar ler como texto puro
    try {
      const t = await (await fetch(uri)).text();
      if (pareceTexto(t)) return { ok: true, texto: t };
    } catch {
      /* ignora */
    }
    return { ok: false, texto: '', motivo: 'Não consegui abrir o arquivo. Cole o texto do currículo abaixo.' };
  }

  const head = latin1(bytes.subarray(0, 5));
  const ehPdf = lower.endsWith('.pdf') || mime === 'application/pdf' || head.startsWith('%PDF');
  const ehDocx =
    lower.endsWith('.docx') ||
    (mime ?? '').includes('wordprocessingml') ||
    (head.startsWith('PK') && lower.endsWith('.docx'));

  try {
    if (ehPdf) {
      const t = extrairTextoPdf(bytes);
      return pareceTexto(t)
        ? { ok: true, texto: t }
        : { ok: false, texto: '', motivo: 'Esse PDF parece escaneado (imagem) ou usa fontes que o app não lê. Copie e cole o texto do currículo abaixo.' };
    }
    if (ehDocx) {
      const t = extrairTextoDocx(bytes);
      return pareceTexto(t)
        ? { ok: true, texto: t }
        : { ok: false, texto: '', motivo: 'Não consegui extrair o texto desse DOCX. Copie e cole o texto abaixo.' };
    }
  } catch {
    return { ok: false, texto: '', motivo: 'Falha ao ler o arquivo. Copie e cole o texto do currículo abaixo.' };
  }

  // texto puro (.txt e afins)
  const comoTexto = decodeUtf8(bytes);
  if (pareceTexto(comoTexto)) return { ok: true, texto: comoTexto };
  return { ok: false, texto: '', motivo: 'Formato não reconhecido. Copie e cole o texto do currículo abaixo.' };
}

// ------------------------------------------------------------------
// PDF → texto
// ------------------------------------------------------------------

export function extrairTextoPdf(bytes: Uint8Array): string {
  const s = latin1(bytes); // posições em `s` == posições em bytes (1 byte/char)
  let saida = '';
  let cursor = 0;

  while (true) {
    const ini = s.indexOf('stream', cursor);
    if (ini < 0) break;
    // início dos dados: logo após "stream" + EOL
    let dataStart = ini + 'stream'.length;
    if (s[dataStart] === '\r' && s[dataStart + 1] === '\n') dataStart += 2;
    else if (s[dataStart] === '\n' || s[dataStart] === '\r') dataStart += 1;

    const fim = s.indexOf('endstream', dataStart);
    if (fim < 0) break;
    cursor = fim + 'endstream'.length;

    // o dicionário do stream fica logo antes de "stream"
    const dict = s.slice(Math.max(0, ini - 400), ini);
    const flate = dict.includes('FlateDecode') || /\/Fl\b/.test(dict);
    // pula imagens conhecidas (não são texto)
    if (dict.includes('/Image') || dict.includes('DCTDecode') || dict.includes('JPXDecode')) continue;

    let conteudo: string | null = null;
    const raw = bytes.subarray(dataStart, trimEol(bytes, fim));
    if (flate) {
      try {
        conteudo = latin1(pako.inflate(raw));
      } catch {
        conteudo = null;
      }
    } else {
      conteudo = latin1(raw);
    }
    if (conteudo) saida += extrairTextoDeConteudo(conteudo) + '\n';
  }

  return limpar(saida);
}

/** Extrai o texto dos operadores de um content stream já descomprimido. */
function extrairTextoDeConteudo(content: string): string {
  let out = '';
  let i = 0;
  const n = content.length;

  while (i < n) {
    const ch = content[i];

    if (ch === '(') {
      const [str, ni] = lerStringLiteral(content, i);
      out += str;
      i = ni;
      continue;
    }
    if (ch === '<' && content[i + 1] !== '<') {
      const end = content.indexOf('>', i);
      if (end > i) {
        out += hexParaTexto(content.slice(i + 1, end));
        i = end + 1;
        continue;
      }
    }
    // fim de bloco de texto → nova linha
    if (ch === 'E' && content[i + 1] === 'T') { out += '\n'; i += 2; continue; }
    // "próxima linha" → nova linha
    if (ch === 'T' && content[i + 1] === '*') { out += '\n'; i += 2; continue; }
    // reposição de texto (Td/TD/Tm) → espaço (preserva skills de 2 palavras)
    if (ch === 'T' && (content[i + 1] === 'd' || content[i + 1] === 'D' || content[i + 1] === 'm')) {
      out += ' ';
      i += 2;
      continue;
    }
    i++;
  }
  return out;
}

// ------------------------------------------------------------------
// DOCX → texto (ZIP → word/document.xml)
// ------------------------------------------------------------------

export function extrairTextoDocx(bytes: Uint8Array): string {
  const xml = lerEntradaZip(bytes, 'word/document.xml');
  if (!xml) return '';
  const texto = xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return limpar(texto);
}

/** Lê uma entrada nomeada de um ZIP (via diretório central). */
function lerEntradaZip(bytes: Uint8Array, nomeAlvo: string): string | null {
  const s = latin1(bytes);
  // End Of Central Directory
  const eocd = s.lastIndexOf('PK\x05\x06');
  if (eocd < 0) return null;
  const cdOffset = leU32(bytes, eocd + 16);

  let p = cdOffset;
  while (p + 4 <= bytes.length && s.startsWith('PK\x01\x02', p)) {
    const metodo = leU16(bytes, p + 10);
    const compSize = leU32(bytes, p + 20);
    const nomeLen = leU16(bytes, p + 28);
    const extraLen = leU16(bytes, p + 30);
    const comentLen = leU16(bytes, p + 32);
    const localOffset = leU32(bytes, p + 42);
    const nome = latin1(bytes.subarray(p + 46, p + 46 + nomeLen));

    if (nome === nomeAlvo) {
      // cabeçalho local para achar o início real dos dados
      const lnLen = leU16(bytes, localOffset + 26);
      const leLen = leU16(bytes, localOffset + 28);
      const dataStart = localOffset + 30 + lnLen + leLen;
      const comprimido = bytes.subarray(dataStart, dataStart + compSize);
      try {
        if (metodo === 0) return latin1ToUtf8(comprimido); // stored
        return pako.inflateRaw(comprimido, { to: 'string' }); // deflate cru
      } catch {
        return null;
      }
    }
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return null;
}

// ------------------------------------------------------------------
// I/O — bytes de um uri (web e nativo)
// ------------------------------------------------------------------

/** Lê um arquivo e devolve seu conteúdo em base64 (para enviar ao backend de IA). */
export async function lerArquivoBase64(uri: string): Promise<string | null> {
  const bytes = await lerBytesDeUri(uri);
  return bytes ? bytesParaBase64(bytes) : null;
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = '';
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  }
  if (typeof btoa === 'function') return btoa(bin);
  // fallback manual
  let out = '';
  for (let i = 0; i < bin.length; i += 3) {
    const a = bin.charCodeAt(i);
    const b = i + 1 < bin.length ? bin.charCodeAt(i + 1) : 0;
    const cc = i + 2 < bin.length ? bin.charCodeAt(i + 2) : 0;
    out += B64_CHARS[a >> 2];
    out += B64_CHARS[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bin.length ? B64_CHARS[((b & 15) << 2) | (cc >> 6)] : '=';
    out += i + 2 < bin.length ? B64_CHARS[cc & 63] : '=';
  }
  return out;
}

async function lerBytesDeUri(uri: string): Promise<Uint8Array | null> {
  // 1) arrayBuffer direto (funciona na web e em RN novos)
  try {
    const res = await fetch(uri);
    if (typeof res.arrayBuffer === 'function') {
      const buf = await res.arrayBuffer();
      if (buf && buf.byteLength > 0) return new Uint8Array(buf);
    }
  } catch {
    /* tenta próximo */
  }
  // 2) blob → FileReader (dataURL) → base64 → bytes (RN e web)
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return base64ParaBytes(b64);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Helpers de baixo nível
// ------------------------------------------------------------------

/** Decodifica bytes como Latin1 (1 byte = 1 char), preservando o valor bruto. */
function latin1(bytes: Uint8Array): string {
  let out = '';
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  }
  return out;
}

/** Decodifica bytes como UTF-8, com fallback para Latin1. */
function decodeUtf8(bytes: Uint8Array): string {
  try {
    // @ts-ignore — TextDecoder pode não existir em todos os runtimes
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  } catch {
    /* fallback abaixo */
  }
  return latin1ToUtf8(bytes);
}

/** Converte uma string Latin1 (bytes UTF-8 crus) para texto UTF-8 legível. */
function latin1ToUtf8(bytes: Uint8Array): string {
  try {
    return decodeURIComponent(escape(latin1(bytes)));
  } catch {
    return latin1(bytes);
  }
}

function base64ParaBytes(b64: string): Uint8Array {
  const limpo = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  // atob existe na web e em RN (Hermes tem global atob nas versões recentes)
  if (typeof atob === 'function') {
    const bin = atob(limpo);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return base64Manual(limpo);
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64Manual(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let val = 0;
  let p = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = B64_CHARS.indexOf(clean[i]);
    if (idx < 0) continue;
    val = (val << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[p++] = (val >> bits) & 0xff;
    }
  }
  return out.subarray(0, p);
}

function leU16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
function leU32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

/** Remove o EOL que precede "endstream". */
function trimEol(bytes: Uint8Array, fim: number): number {
  let e = fim;
  if (bytes[e - 1] === 0x0a) e--;
  if (bytes[e - 1] === 0x0d) e--;
  return e;
}

/** Lê uma string literal PDF `(...)`, tratando escapes e parênteses aninhados. */
function lerStringLiteral(s: string, i: number): [string, number] {
  let out = '';
  let depth = 0;
  i++; // pula '('
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      const nx = s[i + 1];
      if (nx === 'n') out += '\n';
      else if (nx === 'r') out += '';
      else if (nx === 't') out += '\t';
      else if (nx === 'b' || nx === 'f') { /* ignora */ }
      else if (nx >= '0' && nx <= '7') {
        let oct = nx;
        let k = i + 2;
        while (k < s.length && s[k] >= '0' && s[k] <= '7' && oct.length < 3) {
          oct += s[k];
          k++;
        }
        out += String.fromCharCode(parseInt(oct, 8));
        i = k;
        continue;
      } else out += nx;
      i += 2;
      continue;
    }
    if (ch === '(') { depth++; out += ch; i++; continue; }
    if (ch === ')') {
      if (depth === 0) { i++; break; }
      depth--;
      out += ch;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return [out, i];
}

function hexParaTexto(hex: string): string {
  const h = hex.replace(/[^0-9a-fA-F]/g, '');
  let out = '';
  for (let i = 0; i + 1 < h.length; i += 2) {
    out += String.fromCharCode(parseInt(h.substr(i, 2), 16));
  }
  if (h.length % 2 === 1) out += String.fromCharCode(parseInt(h[h.length - 1] + '0', 16));
  return out;
}

function limpar(texto: string): string {
  return texto
    .replace(/\r/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Heurística: a string parece texto de verdade (e não bytes binários)? */
export function pareceTexto(s: string): boolean {
  if (!s || s.trim().length < 40) return false;
  const legiveis = s.replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ]/g, '');
  const razao = legiveis.length / s.length;
  const temLetras = /[a-zA-ZÀ-ÿ]{3,}/.test(s);
  return razao > 0.6 && temLetras;
}
