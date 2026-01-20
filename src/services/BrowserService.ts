import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { IBrowserService, BrowserLaunchOptions } from './interfaces/IBrowserService.js';
import { getLaunchConfig } from '../utils/browser-config.js';
import { injectStealthScripts, humanDelay } from '../utils/stealth.js';
import { detectCloudflareChallenge } from '../utils/cloudflare-detector.js';
import { getLogger } from '../utils/logger.js';
import { Browser, Page, HTTPResponse } from 'puppeteer';

// Add stealth plugin
puppeteer.use(StealthPlugin());

/**
 * BrowserService - Manages Puppeteer browser lifecycle and interactions
 * Implements anti-detection measures and Cloudflare challenge handling
 */
export class BrowserService implements IBrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger = getLogger();

  async launch(options?: BrowserLaunchOptions): Promise<void> {
    const userAgent = options?.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const viewport = options?.viewport || { width: 1920, height: 1080 };

    const config = getLaunchConfig({
      headless: options?.headless ?? true,
      timeout: options?.timeout ?? 30000,
      userAgent,
      viewport,
    });

    this.logger.info('Launching browser...', { headless: options?.headless ?? true });

    try {
      this.browser = await puppeteer.launch({
        ...config,
        headless: options?.headless ?? true,
      } as any);
      this.page = await this.browser.newPage();

      // Inject stealth scripts
      await injectStealthScripts(this.page);

      // Set viewport
      if (options?.viewport) {
        await this.page.setViewport(options.viewport);
      }

      // Set default timeout
      if (options?.timeout) {
        this.page.setDefaultTimeout(options.timeout);
      }

      // Listen for responses for debugging
      this.page.on('response', (response: HTTPResponse) => {
        const status = response.status();
        if (status >= 400) {
          this.logger.warn(`HTTP ${status}: ${response.url()}`);
        }
      });

      // Set up request interception for potential cf-clearance
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        // Allow all requests but could modify headers here
        req.continue();
      });

      this.logger.info('Browser launched successfully');
    } catch (error) {
      this.logger.error('Failed to launch browser', { error: (error as Error).message });
      throw error;
    }
  }

  async close(): Promise<void> {
    this.logger.info('Closing browser...');
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
      if (this.browser && this.browser.isConnected()) {
        await this.browser.close();
      }
      this.page = null;
      this.browser = null;
      this.logger.info('Browser closed');
    } catch (error) {
      this.logger.error('Error closing browser', { error: (error as Error).message });
    }
  }

  getPage(): Page | null {
    return this.page;
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    this.logger.info(`Navigating to: ${url}`);

    try {
      const response = await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      if (!response) {
        throw new Error('No response received');
      }

      const status = response.status();
      this.logger.debug(`Navigation response: ${status}`);

      if (status >= 400) {
        throw new Error(`HTTP ${status}: ${response.statusText()}`);
      }

      // Check for Cloudflare challenge
      await detectCloudflareChallenge(this.page);

    } catch (error) {
      this.logger.error('Navigation failed', {
        url,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async waitForSelector(selector: string, timeout: number = 10000): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    this.logger.debug(`Waiting for selector: ${selector}`);
    await this.page.waitForSelector(selector, { timeout, visible: true });
  }

  async click(selector: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    this.logger.debug(`Clicking: ${selector}`);

    // Human-like delay before click
    await humanDelay(100, 300);

    await this.page.click(selector);
  }

  async evaluate<T>(fn: () => T): Promise<T> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    return await this.page.evaluate(fn);
  }

  async screenshot(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    this.logger.debug(`Taking screenshot: ${path}`);
    await this.page.screenshot({ path, fullPage: true });
  }
}
