// Serviço de Logging para visualização interna no app.
// Captura logs do console e armazena em memória para debug no dispositivo.

type LogLevel = 'log' | 'warn' | 'error' | 'info';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  extra?: string;
}

const MAX_LOGS = 200;
let logs: LogEntry[] = [];
let listeners: ((logs: LogEntry[]) => void)[] = [];

// Guarda referências originais
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
};

function addLog(level: LogLevel, args: any[]) {
  const message = args
    .map((a) => {
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');

  const entry: LogEntry = {
    id: Math.random().toString(36).substring(7),
    level,
    message,
    timestamp: new Date().toLocaleTimeString('pt-BR'),
  };

  logs = [entry, ...logs].slice(0, MAX_LOGS);
  listeners.forEach((l) => l(logs));

  // Chama o console original para não perder o debug no PC
  originalConsole[level](...args);
}

// Intercepta o console global
export function initLogger() {
  console.log = (...args) => addLog('log', args);
  console.warn = (...args) => addLog('warn', args);
  console.error = (...args) => addLog('error', args);
  console.info = (...args) => addLog('info', args);
  console.log('[Logger] Inicializado. Capturando logs internos...');
}

export function getLogs() {
  return logs;
}

export function clearLogs() {
  logs = [];
  listeners.forEach((l) => l(logs));
}

export function subscribeLogs(fn: (logs: LogEntry[]) => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
