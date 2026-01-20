import { Page } from 'puppeteer';
import { IDiscordAuthService } from './interfaces/IDiscordAuthService.js';
import { validateTokenFormat, getTokenType, maskToken } from '../utils/token-validator.js';
import { getLogger } from '../utils/logger.js';

/**
 * DiscordAuthService - Handles Discord token injection and authentication
 * Injects tokens into localStorage to authenticate with TopGG via OAuth
 */
export class DiscordAuthService implements IDiscordAuthService {
  private logger = getLogger();

  /**
   * Inject Discord token into localStorage
   * MUST be called before page navigates to any Discord/TopGG URL
   * @param page - Puppeteer Page instance
   * @param token - Discord token string
   * @throws Error if token format is invalid
   */
  async injectToken(page: Page, token: string): Promise<void> {
    this.logger.info('Injecting Discord token', { token: maskToken(token) });

    // Validate format first
    if (!validateTokenFormat(token)) {
      const error = `Invalid token format: ${maskToken(token)}`;
      this.logger.error(error);
      throw new Error(error);
    }

    const tokenType = getTokenType(token);
    this.logger.debug('Token type detected', { type: tokenType });

    try {
      // IMPORTANT: Set localStorage BEFORE navigation for better reliability
      // We'll inject it both before (for new documents) and after (for current page)

      // Method 1: Inject before page loads (for new documents)
      await page.evaluateOnNewDocument((tokenValue) => {
        // Set the main token (Discord expects it with quotes)
        localStorage.setItem('token', `"${tokenValue}"`);

        // Set additional localStorage keys Discord uses
        try {
          // Try to decode user ID from token
          const base64Part = tokenValue.split('.')[0];
          const decoded = JSON.parse(atob(base64Part));

          if (decoded?.id) {
            localStorage.setItem('user_id', decoded.id);
          }

          if (typeof decoded === 'string') {
            localStorage.setItem('userId', JSON.stringify({ id: decoded }));
          }
        } catch (e) {
          // If decoding fails, that's okay - token will still work
          console.warn('Could not decode token for user ID:', e);
        }

        // Set request token for OAuth flow
        localStorage.setItem('requestToken', tokenValue);

      }, token);

      // Method 2: Also set cookies for Discord domain (helps with auth)
      await page.setCookie({
        name: '__dcfduid',
        value: crypto.randomUUID(),
        domain: '.discord.com',
        path: '/',
      });

      await page.setCookie({
        name: 'locale',
        value: 'en-US',
        domain: '.discord.com',
        path: '/',
      });

      // Method 3: Also inject token directly into current page context (backup method)
      // This runs immediately to set localStorage for any existing pages
      try {
        await page.evaluate((tokenValue) => {
          localStorage.setItem('token', `"${tokenValue}"`);
          localStorage.setItem('requestToken', tokenValue);

          // Try to decode and set user ID
          try {
            const base64Part = tokenValue.split('.')[0];
            const decoded = JSON.parse(atob(base64Part));
            if (decoded?.id) {
              localStorage.setItem('user_id', decoded.id);
            }
          } catch (e) {
            // Ignore
          }
        }, token);
        this.logger.debug('Token injected into current page context');
      } catch (e) {
        // Page might not be ready yet, which is fine
        this.logger.debug('Could not inject into current page (will apply on navigation)');
      }

      // Method 2: Set cookies for Discord domain (helps with auth)
      await page.setCookie({
        name: '__dcfduid',
        value: crypto.randomUUID(),
        domain: '.discord.com',
        path: '/',
      });

      await page.setCookie({
        name: 'locale',
        value: 'en-US',
        domain: '.discord.com',
        path: '/',
      });

      this.logger.info('Token injected successfully (multiple methods)');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to inject token', {
        error: errorMessage,
        token: maskToken(token),
      });
      throw new Error(`Token injection failed: ${errorMessage}`);
    }
  }

  /**
   * Validate token format (basic check)
   * @param token - Discord token string
   * @returns true if token format is valid
   */
  async validateToken(token: string): Promise<boolean> {
    const isValid = validateTokenFormat(token);

    if (!isValid) {
      this.logger.warn('Token failed format validation', {
        token: maskToken(token)
      });
    }

    return isValid;
  }

  /**
   * Check if user is authenticated on current page
   * @param page - Puppeteer Page instance
   * @returns true if authentication token is present
   */
  async isAuthenticated(page: Page): Promise<boolean> {
    try {
      // Check localStorage for token
      const hasToken = await page.evaluate(() => {
        return !!localStorage.getItem('token');
      });

      if (hasToken) {
        this.logger.debug('Authentication check: Token found in localStorage');
        return true;
      }

      // Check for logged-in indicators in DOM
      const isLoggedIn = await page.evaluate(() => {
        // Check for user avatar or username elements
        const userElements = document.querySelectorAll('[class*="user"], [class*="avatar"]');
        return userElements.length > 0;
      });

      this.logger.debug('Authentication check result', { isLoggedIn });
      return isLoggedIn;

    } catch (error) {
      this.logger.warn('Failed to check authentication status', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get current user info from Discord token
   * @param page - Puppeteer Page instance
   * @returns Object with username and id (or null if not found)
   */
  async getCurrentUserInfo(page: Page): Promise<{ username: string | null; id: string | null }> {
    try {
      const userInfo = await page.evaluate(() => {
        const token = localStorage.getItem('token');
        if (!token) return { username: null, id: null };

        // Parse token to get user ID
        try {
          // Remove quotes if present
          const cleanToken = token.replace(/^"|"$/g, '');
          const decoded = JSON.parse(atob(cleanToken.split('.')[0]));
          return {
            username: decoded.username || null,
            id: decoded.id || null,
          };
        } catch {
          return { username: null, id: null };
        }
      });

      return userInfo;
    } catch {
      return { username: null, id: null };
    }
  }

  /**
   * Clear token from browser localStorage
   * @param page - Puppeteer Page instance
   */
  async clearToken(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('userId');
        localStorage.removeItem('requestToken');
      });
      this.logger.debug('Token cleared from localStorage');
    } catch (error) {
      this.logger.warn('Failed to clear token', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Rotate to next token (for multi-token setups)
   * @param page - Puppeteer Page instance
   * @param newToken - New Discord token to inject
   * @returns true if rotation succeeded
   */
  async rotateToken(page: Page, newToken: string): Promise<boolean> {
    this.logger.info('Rotating to new token', { newToken: maskToken(newToken) });

    // Clear old token first
    await this.clearToken(page);

    // Inject new token
    try {
      await this.injectToken(page, newToken);
      return true;
    } catch {
      return false;
    }
  }
}
