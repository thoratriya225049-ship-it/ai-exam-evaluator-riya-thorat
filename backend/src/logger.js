// logger.js — Structured JSON logger. Never logs secrets or API keys.

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info

const REDACT_KEYS = /key|secret|token|password|auth|api/i

const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj, (k, v) => {
      if (typeof k === 'string' && REDACT_KEYS.test(k)) return '[REDACTED]'
      return v
    })
  } catch {
    return String(obj)
  }
}

const log = (level, requestId, event, data = {}) => {
  if (LEVELS[level] < currentLevel) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    requestId: requestId || 'system',
    event,
    ...data,
  }
  const line = safeStringify(entry)
  if (level === 'error') process.stderr.write(line + '\n')
  else process.stdout.write(line + '\n')
}

export const logger = {
  debug: (rid, event, data) => log('debug', rid, event, data),
  info:  (rid, event, data) => log('info',  rid, event, data),
  warn:  (rid, event, data) => log('warn',  rid, event, data),
  error: (rid, event, data) => log('error', rid, event, data),
}