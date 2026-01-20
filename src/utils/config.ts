import dotenv from 'dotenv';
import { AppConfig } from '../types/config.js';

dotenv.config({ path: './config/.env' });

export function loadConfig(): AppConfig {
  // Support both formats: DISCORD_TOKENS (comma-separated) or DISCORD_TOKEN_1, DISCORD_TOKEN_2, etc.
  const tokens: string[] = [];

  // Try numbered format first (DISCORD_TOKEN_1, DISCORD_TOKEN_2, etc.)
  for (let i = 1; i <= 10; i++) {
    const envVar = `DISCORD_TOKEN_${i}`;
    const token = process.env[envVar];
    if (token) {
      tokens.push(token);
    }
  }

  // Fallback to comma-separated format
  if (tokens.length === 0) {
    const commaTokens = process.env.DISCORD_TOKENS?.split(',') || [process.env.DISCORD_TOKEN || ''];
    tokens.push(...commaTokens.filter(Boolean));
  }

  return {
    discord: {
      tokens: tokens.filter(Boolean),
      currentTokenIndex: 0,
    },
    topgg: {
      botId: process.env.TOPGG_BOT_ID || '408785106942164992',
      voteUrl: `https://top.gg/bot/${process.env.TOPGG_BOT_ID || '408785106942164992'}/vote`,
    },
    captchaly: {
      apiKey: process.env.CAPTCHALY_API_KEY || '',
      baseUrl: process.env.CAPTCHALY_BASE_URL || 'https://v1.captchaly.com',
      timeout: parseInt(process.env.CAPTCHALY_TIMEOUT || '120000', 10),
    },
    scheduling: {
      voteIntervalHours: parseInt(process.env.VOTE_INTERVAL_HOURS || '12', 10),
      cronExpression: process.env.CRON_EXPRESSION || '0 */12 * * *',
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      dir: process.env.LOG_DIR || './logs',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
    },
    browser: {
      headless: process.env.HEADLESS !== 'false',
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
      userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      viewport: {
        width: parseInt(process.env.VIEWPORT_WIDTH || '1920', 10),
        height: parseInt(process.env.VIEWPORT_HEIGHT || '1080', 10),
      },
    },
    webhook: {
      url: process.env.DISCORD_WEBHOOK_URL || '',
      enabled: !!process.env.DISCORD_WEBHOOK_URL,
    },
  };
}
