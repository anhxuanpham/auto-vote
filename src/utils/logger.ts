import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LoggingConfig } from '../types/config.js';

// Sensitive data patterns to mask
const SENSITIVE_PATTERNS = [
  { regex: /"token":\s*"[^"]+"/gi, replacement: '"token": "***"' },
  { regex: /"password":\s*"[^"]+"/gi, replacement: '"password": "***"' },
  { regex: /"authorization":\s*"[^"]+"/gi, replacement: '"authorization": "***"' },
  { regex: /"apiKey":\s*"[^"]+"/gi, replacement: '"apiKey": "***"' },
];

function maskSensitiveData(message: string): string {
  let masked = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern.regex, pattern.replacement);
  }
  return masked;
}

// Custom format for console (colored, readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const serviceTag = service ? `[${service}] ` : '';
    let log = `${timestamp} ${level}: ${serviceTag}${message}`;
    if (Object.keys(meta).length > 0) {
      // Filter out service from metadata if present
      const { service: _, ...restMeta } = meta as any;
      if (Object.keys(restMeta).length > 0) {
        log += ` ${JSON.stringify(restMeta)}`;
      }
    }
    return maskSensitiveData(log);
  })
);

// Custom format for files (JSON, structured)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create daily rotating file transport
function createFileTransport(config: LoggingConfig, filename: string, level: string = 'info') {
  return new DailyRotateFile({
    dirname: config.dir,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: config.maxSize,
    maxFiles: config.maxFiles,
    format: fileFormat,
    level,
  });
}

let mainLogger: winston.Logger | null = null;
const serviceLoggers = new Map<string, winston.Logger>();

/**
 * Create or get main logger
 */
export function createLogger(config: LoggingConfig): winston.Logger {
  if (mainLogger) {
    return mainLogger;
  }

  const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: config.level,
    }),

    // Main log file
    createFileTransport(config, 'topgg-vote', config.level),

    // Error-only file
    createFileTransport(config, 'error', 'error'),
  ];

  mainLogger = winston.createLogger({
    level: config.level,
    transports,
    exitOnError: false,
  });

  return mainLogger;
}

/**
 * Get main logger instance
 */
export function getLogger(): winston.Logger {
  if (!mainLogger) {
    mainLogger = winston.createLogger({
      level: 'info',
      transports: [new winston.transports.Console({ format: consoleFormat })],
      exitOnError: false,
    });
  }
  return mainLogger;
}

/**
 * Create a service-specific logger with dedicated file
 */
export function createServiceLogger(serviceName: string, config: LoggingConfig): winston.Logger {
  if (serviceLoggers.has(serviceName)) {
    return serviceLoggers.get(serviceName)!;
  }

  const logger = winston.createLogger({
    level: config.level,
    defaultMeta: { service: serviceName },
    transports: [
      // Service-specific file
      createFileTransport(config, `${serviceName.toLowerCase()}`, config.level),
      // Console for errors
      new winston.transports.Console({
        format: consoleFormat,
        level: 'error',
      }),
    ],
    exitOnError: false,
  });

  serviceLoggers.set(serviceName, logger);
  return logger;
}

/**
 * Vote-specific logging helper
 */
export interface VoteLogData {
  botId: string;
  token: string;
  attempt?: number;
  duration?: number;
  success?: boolean;
  error?: string;
}

export function logVote(logger: winston.Logger, event: string, data: VoteLogData): void {
  const maskedData = {
    ...data,
    token: data.token.slice(0, 5) + '...' + data.token.slice(-5),
  };

  logger.info(`Vote: ${event}`, maskedData);
}

/**
 * Error logging helper with stack trace
 */
export function logError(logger: winston.Logger, error: Error, context?: Record<string, any>): void {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

/**
 * Performance logging
 */
export class PerformanceLogger {
  private logger: winston.Logger;
  private operation: string;
  private startTime: number;
  private metadata: Record<string, any>;

  constructor(logger: winston.Logger, operation: string, metadata: Record<string, any> = {}) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = Date.now();
    this.metadata = metadata;
  }

  /**
   * End performance tracking and log duration
   */
  end(additionalMetadata: Record<string, any> = {}): void {
    const duration = Date.now() - this.startTime;
    this.logger.debug(`Performance: ${this.operation}`, {
      duration: `${duration}ms`,
      ...this.metadata,
      ...additionalMetadata,
    });
  }

  /**
   * End and log as error if duration exceeds threshold
   */
  endWithThreshold(thresholdMs: number, additionalMetadata: Record<string, any> = {}): void {
    const duration = Date.now() - this.startTime;
    const level = duration > thresholdMs ? 'warn' : 'debug';
    this.logger.log(level, `Performance: ${this.operation}`, {
      duration: `${duration}ms`,
      threshold: `${thresholdMs}ms`,
      exceeded: duration > thresholdMs,
      ...this.metadata,
      ...additionalMetadata,
    });
  }
}

/**
 * Create performance logger
 */
export function startPerformanceLog(
  logger: winston.Logger,
  operation: string,
  metadata?: Record<string, any>
): PerformanceLogger {
  return new PerformanceLogger(logger, operation, metadata);
}

/**
 * Flush all log streams
 */
export async function flushLogs(): Promise<void> {
  const flushes: Promise<void>[] = [];

  if (mainLogger) {
    flushes.push(
      new Promise((resolve) => {
        mainLogger!.on('finish', resolve);
        mainLogger!.end();
      })
    );
  }

  for (const logger of serviceLoggers.values()) {
    flushes.push(
      new Promise((resolve) => {
        logger.on('finish', resolve);
        logger.end();
      })
    );
  }

  await Promise.all(flushes);
}

/**
 * Reopen log streams (for log rotation)
 */
export function reopenLogStreams(): void {
  // DailyRotateFile handles this automatically
}
