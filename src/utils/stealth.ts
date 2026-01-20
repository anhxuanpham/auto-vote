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
        get: () => undefined,
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
