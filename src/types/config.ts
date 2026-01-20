export interface AppConfig {
  discord: DiscordConfig;
  topgg: TopGGConfig;
  captchaly: CaptchalyConfig;
  scheduling: SchedulingConfig;
  logging: LoggingConfig;
  browser: BrowserConfig;
  webhook: WebhookConfig;
}

export interface DiscordConfig {
  tokens: string[];
  currentTokenIndex: number;
}

export interface TopGGConfig {
  botId: string;
  voteUrl: string;
}

export interface CaptchalyConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

export interface SchedulingConfig {
  voteIntervalHours: number;
  cronExpression: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  dir: string;
  maxFiles: string;
  maxSize: string;
}

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  userAgent: string;
  viewport: ViewportConfig;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export interface ViewportConfig {
  width: number;
  height: number;
}

export interface WebhookConfig {
  url: string;
  enabled: boolean;
}
