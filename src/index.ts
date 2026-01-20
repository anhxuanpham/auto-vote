import dotenv from 'dotenv';
import { loadConfig } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { VoteService } from './services/VoteService.js';
import { StateManager } from './services/StateManager.js';
import { SchedulerService } from './services/SchedulerService.js';

// Load configuration
dotenv.config({ path: './config/.env' });
const config = loadConfig();

// Create logger
const logger = createLogger(config.logging);

logger.info('='.repeat(50));
logger.info('TopGG Auto Vote Service Starting');
logger.info('='.repeat(50));

// Initialize services
const voteService = new VoteService();
const stateManager = new StateManager();
const schedulerService = new SchedulerService(voteService, stateManager, config);

// Start scheduler
schedulerService.initialize().catch((error) => {
  logger.error('Failed to initialize scheduler', { error: error.message });
  process.exit(1);
});

// Log startup info
logger.info('Service started', {
  botId: config.topgg.botId,
  voteUrl: config.topgg.voteUrl,
  interval: `${config.scheduling.voteIntervalHours} hours`,
  cron: config.scheduling.cronExpression,
  headless: config.browser.headless,
});

// Health check endpoint (optional, could use Express)
logger.info('Scheduler running. Press Ctrl+C to stop.');
