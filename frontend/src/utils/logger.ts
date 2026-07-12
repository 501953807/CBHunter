/** Application logger — centralizes browser diagnostics in development. */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDev = import.meta.env.DEV

function log(level: LogLevel, message: string, ...args: unknown[]) {
  if (isDev) {
    const fn = console[level] || console.log
    fn(`[CBHunter] ${message}`, ...args)
  }
  // In production, could send to a remote logging service
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
  info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
}
