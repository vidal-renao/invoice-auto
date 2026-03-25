/**
 * Structured logger for Invoice Auto.
 *
 * In production (Vercel) emits newline-delimited JSON — Vercel Log Drains
 * and Datadog/Logtail parse these natively.
 * In development emits human-readable output with colour.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('STORAGE', 'Upload complete', { path, size })
 *   logger.error('AI', 'Analysis failed', { invoiceId, cause: err.message })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogTag =
  | 'AI'
  | 'STORAGE'
  | 'AUTH'
  | 'DB'
  | 'VALIDATION'
  | 'MIDDLEWARE'
  | 'SYSTEM'

interface LogPayload {
  tag: LogTag
  message: string
  level: LogLevel
  timestamp: string
  [key: string]: unknown
}

const IS_PROD = process.env.NODE_ENV === 'production'

const DEV_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}
const RESET = '\x1b[0m'

function emit(level: LogLevel, tag: LogTag, message: string, meta?: Record<string, unknown>): void {
  const payload: LogPayload = {
    level,
    tag,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }

  if (IS_PROD) {
    // Vercel parses JSON lines natively
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(JSON.stringify(payload))
  } else {
    const color = DEV_COLORS[level]
    const prefix = `${color}[${level.toUpperCase()}]${RESET} [${tag}]`
    const details = meta && Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(`${prefix} ${message}${details}`)
  }
}

export const logger = {
  debug: (tag: LogTag, message: string, meta?: Record<string, unknown>) =>
    emit('debug', tag, message, meta),
  info: (tag: LogTag, message: string, meta?: Record<string, unknown>) =>
    emit('info', tag, message, meta),
  warn: (tag: LogTag, message: string, meta?: Record<string, unknown>) =>
    emit('warn', tag, message, meta),
  error: (tag: LogTag, message: string, meta?: Record<string, unknown>) =>
    emit('error', tag, message, meta),
}
