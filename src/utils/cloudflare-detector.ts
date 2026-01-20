import { Page } from 'puppeteer';
import { getLogger } from './logger.js';

/**
 * Cloudflare challenge selectors for detection
 */
const CLOUDFLARE_SELECTORS = [
  '#challenge-form',
  '.cf-browser-verification',
  '[data-ray]',
  'iframe[src*="challenges.cloudflare.com"]',
] as const;

/**
 * Detect and handle Cloudflare challenges
 * Returns true if a challenge was detected
 */
export async function detectCloudflareChallenge(page: Page): Promise<boolean> {
  const logger = getLogger();

  // Wait a bit for any JS challenges to load
  await sleep(2000);

  // Check for common Cloudflare challenge indicators
  for (const selector of CLOUDFLARE_SELECTORS) {
    const element = await page.$(selector);
    if (element) {
      logger.warn('Cloudflare challenge detected', { selector });
      // Wait for challenge to complete
      await sleep(5000);
      return true;
    }
  }

  return false;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
