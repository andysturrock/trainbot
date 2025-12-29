import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'trainbot' },
  transports: [
    new winston.transports.Console()
  ],
});

// Suppress logs during tests unless explicitly enabled
if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_LOGGING) {
  logger.silent = true;
}

export default logger;
