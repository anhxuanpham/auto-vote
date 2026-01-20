import dotenv from 'dotenv';
import { loadConfig } from './dist/utils/config.js';
import { createLogger } from './dist/utils/logger.js';
import { VoteService } from './dist/services/VoteService.js';
import { DiscordAuthService } from './dist/services/DiscordAuthService.js';
import { BrowserService } from './dist/services/BrowserService.js';

// Load environment
dotenv.config({ path: './config/.env' });

async function testWithUI() {
  const config = loadConfig();
  const logger = createLogger(config.logging);

  logger.info('=== Testing with VISIBLE UI (Non-Headless) ===');

  const tokens = config.discord.tokens;
  if (tokens.length === 0) {
    logger.error('No Discord tokens configured!');
    process.exit(1);
  }

  // Override headless to false for visible UI
  config.browser.headless = false;

  logger.info('Browser will OPEN with visible UI - watch the voting process!');

  const browserService = new BrowserService();
  const discordAuth = new DiscordAuthService();
  const voteService = new VoteService(browserService, discordAuth);

  const botId = config.topgg.botId;
  const token = tokens[0];

  try {
    logger.info(`Attempting vote for bot ${botId}...`);
    const result = await voteService.vote(botId, token);

    logger.info('=== Vote Result ===');
    logger.info(`Success: ${result.success}`);
    logger.info(`Status: ${result.status}`);
    if (result.error) logger.info(`Error: ${result.error}`);

    if (result.success) {
      logger.info('✓ Vote test PASSED');
      logger.info('You can verify in your browser!');
    } else {
      logger.error('✗ Vote test FAILED');
    }
  } catch (error) {
    logger.error('Test error:', error);
  } finally {
    process.exit(0);
  }
}

testWithUI();
