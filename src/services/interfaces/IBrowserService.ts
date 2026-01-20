import { Page } from 'puppeteer';

export interface BrowserLaunchOptions {
  headless: boolean;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export interface IBrowserService {
  launch(options?: BrowserLaunchOptions): Promise<void>;
  close(): Promise<void>;
  getPage(): Page | null;
  navigate(url: string): Promise<void>;
  waitForSelector(selector: string, timeout?: number): Promise<void>;
  click(selector: string): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  screenshot(path: string): Promise<void>;
}
