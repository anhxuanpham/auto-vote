import { getLogger } from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  attempt: number;
  error?: Error;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 60000,
  exponentialBase: 2,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = getLogger();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const data = await fn();
      if (attempt > 1) {
        logger.info(`Retry succeeded on attempt ${attempt}`);
      }
      return { success: true, data, attempt };
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.baseDelay * Math.pow(opts.exponentialBase, attempt - 1),
          opts.maxDelay
        );
        logger.debug(`Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    attempt: opts.maxRetries,
    error: lastError,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
