/**
 * Minimal logger interface. Every module logs through this, so the
 * implementation (console today, Winston/pino tomorrow) can change
 * without touching a single call site.
 */
const LEVELS = ['error', 'warn', 'info', 'debug'];

const consoleSink = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.log(...args),
  debug: (...args) => console.log(...args),
};

function createLogger(sink = consoleSink) {
  const logger = {};
  for (const level of LEVELS) {
    logger[level] = (message, meta) => {
      sink[level](`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, meta ?? '');
    };
  }
  return logger;
}

module.exports = createLogger();
module.exports.createLogger = createLogger;
