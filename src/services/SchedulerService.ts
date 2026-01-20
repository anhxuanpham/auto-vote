import cron from 'node-cron';
import { VoteService } from './VoteService.js';
import { StateManager } from './StateManager.js';
import { DiscordWebhookService } from './DiscordWebhookService.js';
import { AppConfig } from '../types/config.js';
import { getLogger } from '../utils/logger.js';
import { VoteResult } from '../types/vote.js';
import { VoteStatus } from '../types/index.js';

/**
 * SchedulerService - Manages automated voting schedule
 * Handles 12-hour cooldown, state persistence, and graceful shutdown
 */
export class SchedulerService {
  private voteService: VoteService;
  private stateManager: StateManager;
  private webhookService: DiscordWebhookService;
  private config: AppConfig;
  private logger = getLogger();
  private scheduledTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  private shutdownRequested = false;

  constructor(
    voteService: VoteService,
    stateManager: StateManager,
    config: AppConfig
  ) {
    this.voteService = voteService;
    this.stateManager = stateManager;
    this.config = config;
    this.webhookService = new DiscordWebhookService(config.webhook.url);
  }

  /**
   * Initialize scheduler - load state and schedule tasks
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing scheduler...');

    // Send webhook notification
    if (this.config.webhook.enabled) {
      await this.webhookService.sendServiceStart(
        this.config.topgg.botId,
        this.config.discord.tokens.length
      );
    }

    // Load persisted state
    await this.stateManager.load();

    // Check if we need to vote immediately (first run or missed vote)
    const cooldownHours = this.config.scheduling.voteIntervalHours;
    if (this.stateManager.isVoteDue(cooldownHours)) {
      this.logger.info('Vote is due, executing immediately...');
      await this.executeVote();
    } else {
      const timeUntil = this.stateManager.getTimeUntilNextVote(cooldownHours);
      const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
      const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
      this.logger.info(`Next vote in ${hoursUntil}h ${minutesUntil}m`);
    }

    // Schedule recurring votes
    this.scheduleVotes();

    // Set up shutdown handlers
    this.setupShutdownHandlers();
  }

  /**
   * Schedule votes using cron expression
   */
  private scheduleVotes(): void {
    const cronExpression = this.config.scheduling.cronExpression;

    this.logger.info(`Scheduling votes with cron: ${cronExpression}`);

    this.scheduledTask = cron.schedule(cronExpression, async () => {
      await this.executeVote();
    });

    this.logger.info('Votes scheduled successfully');
  }

  /**
   * Execute vote for ALL tokens in parallel
   */
  private async executeVote(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Vote already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // Check cooldown
      const cooldownHours = this.config.scheduling.voteIntervalHours;
      if (!this.stateManager.isVoteDue(cooldownHours)) {
        const timeUntil = this.stateManager.getTimeUntilNextVote(cooldownHours);
        this.logger.info(
          `Cooldown active, skipping. Next vote in ${Math.round(timeUntil / 60000)} minutes`
        );
        return;
      }

      // Get all tokens
      const tokens = this.config.discord.tokens;
      if (tokens.length === 0) {
        throw new Error('No Discord tokens configured');
      }

      this.logger.info(`Executing parallel vote for ${tokens.length} accounts...`);

      // Run all votes in parallel
      const votePromises = tokens.map(async (token, index) => {
        try {
          this.logger.info(`Account #${index + 1} - Starting vote...`);

          // Send start notification
          if (this.config.webhook.enabled) {
            await this.webhookService.sendVoteStart(index, this.config.topgg.botId);
          }

          // Create fresh vote service instance for each parallel execution
          const voteService = new VoteService();
          const result = await voteService.vote(this.config.topgg.botId, token);

          // Send success/failure notification
          if (this.config.webhook.enabled) {
            if (result.success) {
              await this.webhookService.sendVoteSuccess(index, this.config.topgg.botId);
            } else {
              await this.webhookService.sendVoteFailure(
                index,
                this.config.topgg.botId,
                result.error || 'Unknown error'
              );
            }
          }

          // Log result
          if (result.success) {
            this.logger.info(`Account #${index + 1} - Vote successful!`);
          } else {
            this.logger.error(`Account #${index + 1} - Vote failed: ${result.error}`);
          }

          return { index, success: result.success, error: result.error };
        } catch (error) {
          const errorMsg = (error as Error).message;
          this.logger.error(`Account #${index + 1} - Exception: ${errorMsg}`);

          // Send failure notification
          if (this.config.webhook.enabled) {
            await this.webhookService.sendVoteFailure(index, this.config.topgg.botId, errorMsg);
          }

          return { index, success: false, error: errorMsg };
        }
      });

      // Wait for all votes to complete
      const results = await Promise.all(votePromises);

      // Send summary notification
      if (this.config.webhook.enabled) {
        await this.webhookService.sendAllVotesComplete(results);
      }

      // Record first successful result (for cooldown tracking)
      const firstSuccessful = results.find(r => r.success);
      if (firstSuccessful) {
        await this.stateManager.recordVote(
          {
            success: true,
            status: VoteStatus.SUCCESS,
            timestamp: new Date(),
            botId: this.config.topgg.botId,
            tokenUsed: `Account #${firstSuccessful.index + 1}`,
          },
          cooldownHours
        );
      } else {
        // All failed - still record to track attempts
        await this.stateManager.recordVote(
          {
            success: false,
            status: VoteStatus.FAILED,
            timestamp: new Date(),
            error: 'All accounts failed to vote',
            botId: this.config.topgg.botId,
            tokenUsed: '***',
          },
          cooldownHours
        );
      }

      // Log summary
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      this.logger.info(`Vote cycle complete: ${successCount} success, ${failCount} failed`);

      // Check for too many failures
      if (failCount === results.length) {
        const failures = this.stateManager.getConsecutiveFailures();
        if (failures >= 3) {
          this.logger.error(
            `Too many consecutive failures (${failures}), manual intervention may be needed`
          );
        }
      }
    } catch (error) {
      this.logger.error('Vote execution error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger a vote (for testing or manual override)
   */
  async triggerManualVote(): Promise<VoteResult> {
    this.logger.info('Manual vote triggered');

    const tokens = this.config.discord.tokens;
    if (tokens.length === 0) {
      throw new Error('No Discord tokens configured');
    }

    const token = tokens[0];
    const result = await this.voteService.vote(this.config.topgg.botId, token);

    await this.stateManager.recordVote(result, this.config.scheduling.voteIntervalHours);

    return result;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    isScheduled: boolean;
    lastVoteTime: Date;
    nextVoteTime: Date;
    consecutiveFailures: number;
    totalVotes: number;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.scheduledTask !== null,
      lastVoteTime: this.stateManager.getLastVoteTime(),
      nextVoteTime: this.stateManager.getNextVoteTime(),
      consecutiveFailures: this.stateManager.getConsecutiveFailures(),
      totalVotes: this.stateManager.getTotalVotes(),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down scheduler...');
    this.shutdownRequested = true;

    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }

    // Wait for current vote to complete
    while (this.isRunning) {
      this.logger.info('Waiting for current vote to complete...');
      await this.sleep(1000);
    }

    this.logger.info('Scheduler shut down');
  }

  private setupShutdownHandlers(): void {
    const shutdownHandler = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
