/**
 * Manual Vote Test Script
 *
 * This script performs a single vote operation for testing purposes.
 * Useful for verifying authentication, browser automation, and voting flow.
 *
 * Usage:
 *   npm run build
 *   node dist/test-manual-vote.js
 *
 * Environment:
 *   Requires config/.env with valid Discord token
 */

import dotenv from 'dotenv';
import { loadConfig } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { VoteService } from './services/VoteService.js';
import { DiscordAuthService } from './services/DiscordAuthService.js';
import { BrowserService } from './services/BrowserService.js';

// Load environment
dotenv.config({ path: './config/.env' });

async function testManualVote(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logging);

  logger.info('=== Manual Vote Test Started ===');

  // Validate configuration
  const tokens = config.discord.tokens;
  if (tokens.length === 0) {
    logger.error('No Discord tokens configured in config/.env!');
    logger.error('Please add DISCORD_TOKENS to your environment file.');
    process.exit(1);
  }

  logger.info('Configuration loaded:', {
    botId: config.topgg.botId,
    voteUrl: config.topgg.voteUrl,
    tokenCount: tokens.length,
    headless: config.browser.headless,
  });

  // Initialize services
  const browserService = new BrowserService();
  const discordAuth = new DiscordAuthService();
  const voteService = new VoteService(browserService, discordAuth);

  logger.info('Services initialized');

  // Test with first token
  const testToken = tokens[0];
  logger.info(`Testing with token: ${testToken.substring(0, 10)}...`);

  try {
    // Launch browser
    logger.info('Launching browser...');
    await browserService.launch({ headless: config.browser.headless });
    logger.info('Browser launched successfully');

    // Perform vote
    logger.info(`Attempting vote for bot ${config.topgg.botId}...`);
    const result = await voteService.vote(config.topgg.botId, testToken);

    // Log result
    logger.info('=== Vote Result ===', {
      success: result.success,
      status: result.status,
      timestamp: result.timestamp.toISOString(),
      error: result.error || 'none',
    });

    if (result.success) {
      logger.info('✓ Vote test PASSED');
      logger.info(`Status: ${result.status}`);
    } else {
      logger.error('✗ Vote test FAILED');
      logger.error(`Status: ${result.status}`);
      if (result.error) {
        logger.error(`Error: ${result.error}`);
      }
    }

    // Cleanup
    logger.info('Closing browser...');
    await browserService.close();
    logger.info('Browser closed');

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('Test failed with exception:', error);
    process.exit(1);
  }
}

// Run test
testManualVote().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
