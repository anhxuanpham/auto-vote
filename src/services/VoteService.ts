import { Page } from 'puppeteer';
import { IVoteService } from './interfaces/IVoteService.js';
import { IBrowserService } from './interfaces/IBrowserService.js';
import { IDiscordAuthService } from './interfaces/IDiscordAuthService.js';
import { VoteResult } from '../types/vote.js';
import { VoteStatus } from '../types/index.js';
import { BrowserService } from './BrowserService.js';
import { DiscordAuthService } from './DiscordAuthService.js';
import { CaptchalySolver } from './CaptchalySolver.js';
import { TOPGG_SELECTORS } from '../utils/topgg-selectors.js';
import { getLogger } from '../utils/logger.js';
import { humanDelay } from '../utils/stealth.js';
import { loadConfig } from '../utils/config.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * VoteService - Handles TopGG voting automation
 * Integrates Discord auth, Turnstile solving, and vote submission
 */
export class VoteService implements IVoteService {
  private browserService: IBrowserService;
  private discordAuthService: IDiscordAuthService;
  private captchalySolver: CaptchalySolver | null = null;
  private logger = getLogger();
  private config = loadConfig();

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [5000, 10000, 15000]; // 5s, 10s, 15s

  // Additional selectors for vote detection
  private readonly VOTE_SUCCESS_PATTERNS = [
    /successfully voted/i,
    /thanks for voting/i,
    /vote recorded/i,
  ];

  private readonly VOTE_ERROR_PATTERNS = [
    /already voted/i,
    /rate limit/i,
    /try again later/i,
    /12 hours/i,
  ];

  constructor(
    browserService?: IBrowserService,
    discordAuthService?: IDiscordAuthService
  ) {
    this.browserService = browserService ?? new BrowserService();
    this.discordAuthService = discordAuthService ?? new DiscordAuthService();

    // Initialize CaptchalySolver if API key is available
    if (this.config.captchaly.apiKey) {
      this.captchalySolver = new CaptchalySolver(
        this.config.captchaly.apiKey,
        this.config.captchaly.baseUrl,
        this.config.captchaly.timeout
      );
      this.logger.info('CaptchalySolver initialized');
    } else {
      this.logger.warn('Captchaly API key not configured, Turnstile will not be auto-solved');
    }
  }

  async vote(botId: string, token: string): Promise<VoteResult> {
    const startTime = new Date();
    this.logger.info(`Starting vote for bot ${botId}`);

    // Validate inputs
    if (!botId || !token) {
      return this.createResult(
        botId,
        token,
        startTime,
        VoteStatus.FAILED,
        'Invalid botId or token'
      );
    }

    // Validate token format
    const isValidToken = await this.discordAuthService.validateToken(token);
    if (!isValidToken) {
      return this.createResult(
        botId,
        token,
        startTime,
        VoteStatus.FAILED,
        'Invalid Discord token format'
      );
    }

    try {
      // Launch browser
      await this.browserService.launch({
        headless: this.config.browser.headless,
        timeout: this.config.browser.timeout,
      });
      const page = this.browserService.getPage();
      if (!page) {
        throw new Error('Failed to get page after browser launch');
      }

      // Inject Discord token BEFORE navigation
      await this.discordAuthService.injectToken(page, token);

      // Navigate to vote page
      const voteUrl = `https://top.gg/bot/${botId}/vote`;
      await this.browserService.navigate(voteUrl);

      // Wait for page to stabilize
      await this.sleep(2000);

      // Check authentication status
      const isLoggedIn = await this.checkLoginStatus(page);
      if (!isLoggedIn) {
        this.logger.warn('User not logged in, attempting OAuth flow');
        await this.performLogin(page, botId);
      }

      // Wait for page to fully load after auth
      await this.sleep(3000);

      // Check for ads that block the vote button
      const hasAd = await page.evaluate(() => {
        return document.body.innerText.toLowerCase().includes('you will be able to vote after this ad');
      });

      if (hasAd) {
        this.logger.info('Ad detected, waiting for it to finish (up to 30s)...');

        // Wait for ad to finish - check every 2s
        for (let i = 0; i < 15; i++) {
          await this.sleep(2000);

          const adGone = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return !text.includes('you will be able to vote after this ad');
          });

          if (adGone) {
            this.logger.info(`Ad finished after ${i * 2}s`);
            break;
          }

          this.logger.debug(`Still waiting for ad... (${i + 1}/15)`);
        }

        await this.sleep(2000);
      }

      // Handle Turnstile if present
      const turnstileHandled = await this.handleTurnstile(page, voteUrl);
      if (!turnstileHandled) {
        this.logger.warn('Turnstile handling failed or timed out, attempting to proceed');
      }

      // Click vote button
      await this.clickVoteButton(page);

      // Wait for and verify result
      const result = await this.waitForVoteResult(page, botId, token, startTime);

      return result;
    } catch (error) {
      this.logger.error('Vote failed with error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      // Take screenshot on error
      await this.takeDebugScreenshot('error', botId);

      return this.createResult(
        botId,
        token,
        startTime,
        VoteStatus.FAILED,
        (error as Error).message
      );
    } finally {
      await this.browserService.close();
    }
  }

  canVote(): boolean {
    // This will be implemented with StateManager integration
    // For now, always return true
    return true;
  }

  getNextVoteTime(): Date {
    // This will be implemented with StateManager integration
    // For now, return current time
    return new Date();
  }

  /**
   * Check if user is logged in to Discord on TopGG
   */
  private async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      // Check page text for "You must be logged in to vote" message
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.toLowerCase().includes('you must be logged in to vote')) {
        this.logger.debug('Found "You must be logged in to vote" - NOT logged in');
        return false;
      }

      // Check for login buttons - definitive sign of NOT logged in
      const loginButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('a, button, [role="button"]'));
        return buttons
          .map(b => b.textContent?.trim().toLowerCase() || '')
          .filter(text => text.includes('login') && text.length < 50);
      });

      if (loginButtons.length > 0) {
        this.logger.debug('Login buttons found - NOT logged in', { buttons: loginButtons });
        return false;
      }

      // Check for vote button - means logged in
      const voteButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        return buttons
          .map(b => b.textContent?.trim().toLowerCase() || '')
          .filter(text => text === 'vote');
      });

      if (voteButtons.length > 0) {
        this.logger.debug('Vote button found - appears logged in');
        return true;
      }

      // Default to false if unclear
      this.logger.debug('Login status unclear, assuming not logged in');
      return false;
    } catch (error) {
      this.logger.warn('Error checking login status', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Perform Discord OAuth login flow
   */
  private async performLogin(page: Page, botId: string): Promise<void> {
    this.logger.info('Performing Discord OAuth login');

    try {
      // Look for ANY login button with text containing "login"
      const loginClicked = await page.evaluate(() => {
        // Find all links and buttons with "login" text
        const allElements = Array.from(document.querySelectorAll('a, button, [role="button"]'));

        for (const elem of allElements) {
          const text = elem.textContent?.trim().toLowerCase() || '';
          if (text.includes('login') && text.length < 50) {
            // Found login button - click it
            (elem as HTMLElement).click();
            return {
              success: true,
              text: elem.textContent?.trim(),
              tag: elem.tagName,
            };
          }
        }

        return { success: false, error: 'No login button found' };
      });

      if (!loginClicked.success) {
        this.logger.warn('Could not find login button');
        return;
      }

      this.logger.info(`Clicked login button: "${loginClicked.text}" (${loginClicked.tag})`);

      // Wait for URL change (OAuth redirect)
      this.logger.info('Waiting for OAuth redirect to Discord...');
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 10000,
      }).catch(() => {
        this.logger.warn('Navigation timeout, may need manual approval');
      });

      const currentUrl = page.url();
      this.logger.info(`Current URL: ${currentUrl}`);

      // Check if we're on Discord OAuth page
      if (currentUrl.includes('discord.com/oauth2')) {
        this.logger.info('On Discord OAuth page, checking for authorize button...');

        // Discord should auto-approve if token is valid
        // But we may need to click "Authorize" button
        await this.sleep(2000);

        const authorized = await page.evaluate(() => {
          // Look for "Authorize" button
          const buttons = Array.from(document.querySelectorAll('button, [type="submit"]'));
          for (const btn of buttons) {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('authorize')) {
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (authorized) {
          this.logger.info('Clicked Authorize button');
        }

        // Wait for redirect back to top.gg
        this.logger.info('Waiting for redirect back to top.gg...');

        // Check URL periodically for better redirect detection
        let redirected = false;
        for (let i = 0; i < 10; i++) {
          await this.sleep(2000);
          const currentUrl = page.url();

          if (currentUrl.includes('top.gg')) {
            this.logger.info(`Redirected to top.gg after ${i * 2}s`);
            redirected = true;
            break;
          }
        }

        if (!redirected) {
          this.logger.warn('Redirect timeout - may need manual intervention');
        }
      }

      // Final check - should be back on vote page or similar
      const finalUrl = page.url();
      this.logger.info(`Final URL after login: ${finalUrl}`);

      // If not on vote page, navigate there
      if (!finalUrl.includes('/vote')) {
        this.logger.warn('Not on vote page, navigating there');
        await this.browserService.navigate(
          `https://top.gg/bot/${botId}/vote`
        );
        await this.sleep(3000);
      }
    } catch (error) {
      this.logger.error('Error during login flow', {
        error: (error as Error).message,
      });
      // Don't throw - may still work
    }
  }

  /**
   * Handle Turnstile captcha if present
   */
  private async handleTurnstile(page: Page, pageUrl: string): Promise<boolean> {
    this.logger.debug('Checking for Turnstile captcha');

    try {
      // Check for Turnstile iframe
      const turnstileIframe = await page.$(TOPGG_SELECTORS.turnstileIframe);
      const turnstileChallenge = await page.$(TOPGG_SELECTORS.turnstileChallenge);

      if (!turnstileIframe && !turnstileChallenge) {
        this.logger.debug('No Turnstile detected, proceeding');
        return true;
      }

      this.logger.info('Turnstile detected, attempting to solve...');

      // If CaptchalySolver is available, try to use it
      if (this.captchalySolver) {
        return await this.solveTurnstileWithCaptchaly(page, pageUrl);
      } else {
        // Wait for auto-solve (cf-clearance-scraper or manual)
        return await this.waitForTurnstileAutoSolve(page);
      }
    } catch (error) {
      this.logger.error('Error handling Turnstile', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Solve Turnstile using Captchaly API
   */
  private async solveTurnstileWithCaptchaly(
    page: Page,
    pageUrl: string
  ): Promise<boolean> {
    this.logger.info('Using Captchaly to solve Turnstile');

    try {
      // Extract sitekey from page
      const sitekey = await page.evaluate(() => {
        const element = document.querySelector('[data-sitekey]');
        return element?.getAttribute('data-sitekey') || '';
      });

      if (!sitekey) {
        this.logger.warn('Could not find Turnstile sitekey');
        return await this.waitForTurnstileAutoSolve(page);
      }

      this.logger.debug(`Turnstile sitekey: ${sitekey}`);

      // Call Captchaly API
      const solution = await this.captchalySolver!.solveTurnstile(sitekey, pageUrl);

      if (!solution.success) {
        this.logger.error('Captchaly failed to solve Turnstile', {
          error: solution.error,
        });
        return await this.waitForTurnstileAutoSolve(page);
      }

      this.logger.info('Captchaly solved Turnstile, injecting token...');

      // Inject the token into the page
      const tokenInjected = await page.evaluate((token) => {
        // Find the response input and set the token
        const responseInput = document.querySelector(
          'input[name="cf-turnstile-response"]'
        ) as HTMLInputElement;

        if (responseInput) {
          responseInput.value = token;
          // Trigger change event
          responseInput.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // Try alternative method - call turnstile callback
        const callback = (window as any).turnstileCallback;
        if (typeof callback === 'function') {
          callback(token);
          return true;
        }

        return false;
      }, solution.token);

      if (tokenInjected) {
        this.logger.info('Turnstile token injected successfully');
        await this.sleep(1000);
        return true;
      } else {
        this.logger.warn('Could not inject Turnstile token');
        return false;
      }
    } catch (error) {
      this.logger.error('Error solving Turnstile with Captchaly', {
        error: (error as Error).message,
      });
      return await this.waitForTurnstileAutoSolve(page);
    }
  }

  /**
   * Wait for Turnstile to be auto-solved (by browser plugin or manual)
   */
  private async waitForTurnstileAutoSolve(page: Page): Promise<boolean> {
    this.logger.info('Waiting for Turnstile auto-solve (60s timeout)');

    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 1000; // 1 second
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check for success response token
        const response = await page.evaluate(() => {
          const input = document.querySelector(
            'input[name="cf-turnstile-response"]'
          ) as HTMLInputElement;
          return input?.value || '';
        });

        if (response && response.length > 20) {
          this.logger.info('Turnstile appears to be solved (token present)');
          return true;
        }

        // Check for success attribute
        const isSuccess = await page.evaluate(() => {
          const turnstileDiv = document.querySelector('[data-sitekey]');
          return (
            turnstileDiv?.getAttribute('data-callback') !== null ||
            turnstileDiv?.classList.contains('solved')
          );
        });

        if (isSuccess) {
          this.logger.info('Turnstile appears to be solved (callback detected)');
          return true;
        }

        await this.sleep(checkInterval);
      } catch (error) {
        this.logger.warn('Error checking Turnstile status', {
          error: (error as Error).message,
        });
        await this.sleep(checkInterval);
      }
    }

    this.logger.warn('Turnstile not solved within timeout');
    await this.takeDebugScreenshot('turnstile-timeout', 'unknown');
    return false;
  }

  /**
   * Click the vote button
   */
  private async clickVoteButton(page: Page): Promise<void> {
    this.logger.info('Looking for vote button');

    try {
      // Wait for button to be present
      await page
        .waitForSelector(TOPGG_SELECTORS.voteButton, { timeout: 10000 })
        .catch(() => {
          this.logger.warn('Vote button not found with primary selector');
        });

      // Try to find and click the button using multiple strategies
      const buttonClicked = await page.evaluate((selectors) => {
        // Try primary selector
        let button = document.querySelector(selectors.voteButton);
        if (button) {
          (button as HTMLButtonElement).click();
          return true;
        }

        // Fallback: Find ANY element with "vote" text (not just buttons)
        const allElements = document.querySelectorAll('*');
        for (const elem of allElements) {
          const text = elem.textContent?.trim() || '';
          if (text.toLowerCase() === 'vote' && text.length < 20) {
            // Found element with exactly "Vote" text
            (elem as HTMLElement).click();
            return true;
          }
        }

        return false;
      }, TOPGG_SELECTORS);

      if (!buttonClicked) {
        throw new Error('Could not find or click vote button');
      }

      this.logger.info('Vote button clicked');
      await humanDelay(500, 1000);
    } catch (error) {
      this.logger.error('Error clicking vote button', {
        error: (error as Error).message,
      });
      await this.takeDebugScreenshot('vote-button-error', 'unknown');
      throw error;
    }
  }

  /**
   * Wait for vote result and detect success/failure
   */
  private async waitForVoteResult(
    page: Page,
    botId: string,
    token: string,
    startTime: Date
  ): Promise<VoteResult> {
    this.logger.debug('Waiting for vote result...');

    const maxWaitTime = 15000; // 15 seconds
    const checkInterval = 500; // 500ms
    const elapsed = Date.now() - startTime.getTime();

    while (Date.now() - startTime.getTime() - elapsed < maxWaitTime) {
      try {
        // Check page content for success/error messages
        const pageText = await page.evaluate(() => document.body.innerText);

        // Check for success patterns
        for (const pattern of this.VOTE_SUCCESS_PATTERNS) {
          if (pattern.test(pageText)) {
            this.logger.info('Vote successful - detected success message');
            return this.createResult(botId, token, startTime, VoteStatus.SUCCESS);
          }
        }

        // Check for error patterns
        for (const pattern of this.VOTE_ERROR_PATTERNS) {
          if (pattern.test(pageText)) {
            this.logger.warn('Vote failed - detected error message', {
              pattern: pattern.source,
            });
            return this.createResult(
              botId,
              token,
              startTime,
              VoteStatus.RATE_LIMITED,
              'Already voted or rate limited'
            );
          }
        }

        // Check DOM for toast messages
        const toastMessage = await page.evaluate(() => {
          const toastSelectors = [
            '.toast-success',
            '.toast-error',
            '[class*="success"]',
            '[class*="error"]',
            '[role="alert"]',
          ];

          for (const selector of toastSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              return element.textContent?.trim() || '';
            }
          }
          return '';
        });

        if (toastMessage) {
          this.logger.debug('Toast message found', { message: toastMessage });

          // Check if toast contains success/error patterns
          for (const pattern of this.VOTE_SUCCESS_PATTERNS) {
            if (pattern.test(toastMessage)) {
              this.logger.info('Vote successful - detected in toast');
              return this.createResult(
                botId,
                token,
                startTime,
                VoteStatus.SUCCESS
              );
            }
          }

          for (const pattern of this.VOTE_ERROR_PATTERNS) {
            if (pattern.test(toastMessage)) {
              this.logger.warn('Vote failed - detected in toast');
              return this.createResult(
                botId,
                token,
                startTime,
                VoteStatus.RATE_LIMITED,
                toastMessage
              );
            }
          }
        }

        await this.sleep(checkInterval);
      } catch (error) {
        this.logger.warn('Error checking vote result', {
          error: (error as Error).message,
        });
        await this.sleep(checkInterval);
      }
    }

    // If no clear result, check URL for redirect
    const currentUrl = page.url();
    this.logger.debug(`Final URL: ${currentUrl}`);

    if (!currentUrl.includes('/vote')) {
      this.logger.info('Vote likely successful (page navigated away)');
      return this.createResult(botId, token, startTime, VoteStatus.SUCCESS);
    }

    // Ambiguous result
    this.logger.warn('Vote result unclear - returning PENDING status');
    await this.takeDebugScreenshot('unclear-result', botId);
    return this.createResult(
      botId,
      token,
      startTime,
      VoteStatus.PENDING,
      'Result unclear'
    );
  }

  /**
   * Create VoteResult object
   */
  private createResult(
    botId: string,
    token: string,
    startTime: Date,
    status: VoteStatus,
    error?: string
  ): VoteResult {
    return {
      success: status === VoteStatus.SUCCESS,
      status,
      timestamp: startTime,
      error,
      botId,
      tokenUsed: this.maskToken(token),
    };
  }

  /**
   * Mask token for logging (show only first and last 5 chars)
   */
  private maskToken(token: string): string {
    if (token.length <= 10) return '***';
    return `${token.slice(0, 5)}...${token.slice(-5)}`;
  }

  /**
   * Take debug screenshot
   */
  private async takeDebugScreenshot(name: string, botId: string = 'unknown'): Promise<void> {
    const screenshotsDir = './screenshots';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(screenshotsDir, `${name}-${botId}-${timestamp}.png`);

    try {
      // Ensure screenshots directory exists
      await fs.mkdir(screenshotsDir, { recursive: true });

      await this.browserService.screenshot(filename);
      this.logger.debug(`Screenshot saved: ${filename}`);
    } catch (error) {
      this.logger.warn('Failed to take screenshot', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Vote with retry logic (5s, 10s, 15s delays)
   * Retries on transient errors, skips on rate-limit/cooldown
   */
  async voteWithRetry(botId: string, token: string): Promise<VoteResult> {
    this.logger.info(`Starting vote with retry for bot ${botId}`);

    let lastError = '';

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delaySec = this.RETRY_DELAYS[attempt - 1] / 1000;
        this.logger.info(`Retry ${attempt}/${this.MAX_RETRIES - 1} after ${delaySec}s...`);
        await this.sleep(this.RETRY_DELAYS[attempt - 1]);
      }

      const result = await this.vote(botId, token);

      // Success - return immediately
      if (result.success) {
        if (attempt > 0) {
          this.logger.info(`✓ Vote successful after ${attempt} retries`);
        }
        return result;
      }

      // Failed - check if should retry
      lastError = result.error || 'Unknown error';
      this.logger.warn(`Attempt ${attempt + 1} failed: ${lastError}`);

      // Don't retry on rate limit or cooldown
      if (result.status === VoteStatus.RATE_LIMITED || result.status === VoteStatus.COOLDOWN) {
        this.logger.info('Non-retryable error, stopping retries');
        return result;
      }

      // For other errors, continue retrying
      this.logger.debug(`Will retry after ${this.RETRY_DELAYS[attempt] / 1000}s`);
    }

    // All retries failed
    this.logger.error(`❌ Vote failed after ${this.MAX_RETRIES} attempts`);
    return this.createResult(
      botId,
      token,
      new Date(),
      VoteStatus.FAILED,
      lastError
    );
  }
}
