import { Page } from 'puppeteer';
import { getLogger } from './logger.js';

/**
 * Inject stealth scripts to avoid bot detection
 */
export async function injectStealthScripts(page: Page): Promise<void> {
  const logger = getLogger();

  try {
    // Hide webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty((globalThis as any).navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Mock Chrome object
    await page.evaluateOnNewDocument(() => {
      (globalThis as any).window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };
    });

    // Mock permissions
    await page.evaluateOnNewDocument(() => {
      const originalQuery = (globalThis as any).window.navigator.permissions.query;
      (globalThis as any).window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: 'prompt' })
          : originalQuery(parameters);
    });

    // Hide automation indicator
    await page.evaluateOnNewDocument(() => {
      const originalCall = Function.prototype.call;
      (Function.prototype as any).call = function () {
        return originalCall.apply(this, arguments as any);
      };
      const originalApply = Function.prototype.apply;
      (Function.prototype as any).apply = function () {
        return originalApply.apply(this, arguments as any);
      };
    });

    // Mock plugins
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty((globalThis as any).navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // Mock languages
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty((globalThis as any).navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    logger.debug('Stealth scripts injected');
  } catch (error) {
    logger.warn('Failed to inject stealth scripts', { error: (error as Error).message });
  }
}

/**
 * Add realistic delays to mimic human behavior
 */
export function humanDelay(min: number = 100, max: number = 300): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
