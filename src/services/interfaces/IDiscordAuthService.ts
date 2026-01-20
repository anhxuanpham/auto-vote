import { Page } from 'puppeteer';

export interface IDiscordAuthService {
  injectToken(page: Page, token: string): Promise<void>;
  validateToken(token: string): Promise<boolean>;
}
