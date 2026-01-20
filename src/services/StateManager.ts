import fs from 'fs/promises';
import path from 'path';
import { VoteState, VoteResult } from '../types/vote.js';
import { getLogger } from '../utils/logger.js';

const STATE_FILE = './data/vote-state.json';

const DEFAULT_STATE: VoteState = {
  lastVoteTime: new Date(0).toISOString(),
  nextVoteTime: new Date(0).toISOString(),
  consecutiveFailures: 0,
  totalVotes: 0,
};

export class StateManager {
  private state: VoteState;
  private statePath: string;
  private logger = getLogger();
  private lock = false;

  constructor(statePath: string = STATE_FILE) {
    this.statePath = statePath;
    this.state = { ...DEFAULT_STATE };
  }

  async load(): Promise<void> {
    // Simple lock to prevent concurrent writes
    while (this.lock) {
      await this.sleep(100);
    }
    this.lock = true;

    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      const loaded = JSON.parse(data);

      // Merge with defaults to handle new fields
      this.state = { ...DEFAULT_STATE, ...loaded };

      this.logger.info('State loaded', {
        lastVote: this.state.lastVoteTime,
        nextVote: this.state.nextVoteTime,
        totalVotes: this.state.totalVotes,
      });
    } catch (error) {
      this.logger.warn('State file not found or corrupted, using defaults');
      await this.save();
    } finally {
      this.lock = false;
    }
  }

  async save(): Promise<void> {
    while (this.lock) {
      await this.sleep(100);
    }
    this.lock = true;

    try {
      const dir = path.dirname(this.statePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
      this.logger.debug('State saved');
    } catch (error) {
      this.logger.error('Failed to save state', { error: (error as Error).message });
    } finally {
      this.lock = false;
    }
  }

  getLastVoteTime(): Date {
    return new Date(this.state.lastVoteTime);
  }

  async recordVote(result: VoteResult, cooldownHours: number = 12): Promise<void> {
    this.state.lastVoteTime = result.timestamp.toISOString();

    // Calculate next vote time
    const nextVote = new Date(result.timestamp);
    nextVote.setHours(nextVote.getHours() + cooldownHours);
    this.state.nextVoteTime = nextVote.toISOString();

    if (result.success) {
      this.state.consecutiveFailures = 0;
      this.state.totalVotes += 1;
    } else {
      this.state.consecutiveFailures += 1;
    }

    await this.save();

    this.logger.info('Vote recorded', {
      success: result.success,
      nextVote: this.state.nextVoteTime,
      consecutiveFailures: this.state.consecutiveFailures,
    });
  }

  setNextVoteTime(time: Date): void {
    this.state.nextVoteTime = time.toISOString();
  }

  getNextVoteTime(): Date {
    return new Date(this.state.nextVoteTime);
  }

  getConsecutiveFailures(): number {
    return this.state.consecutiveFailures;
  }

  getTotalVotes(): number {
    return this.state.totalVotes;
  }

  /**
   * Check if vote is due (cooldown has passed)
   */
  isVoteDue(cooldownHours: number = 12): boolean {
    const lastVote = this.getLastVoteTime();
    const now = new Date();
    const cooldownEnd = new Date(lastVote);
    cooldownEnd.setHours(cooldownEnd.getHours() + cooldownHours);

    return now >= cooldownEnd;
  }

  /**
   * Get time until next vote in milliseconds
   */
  getTimeUntilNextVote(cooldownHours: number = 12): number {
    const lastVote = this.getLastVoteTime();
    const now = new Date();
    const cooldownEnd = new Date(lastVote);
    cooldownEnd.setHours(cooldownEnd.getHours() + cooldownHours);

    const diff = cooldownEnd.getTime() - now.getTime();
    return Math.max(0, diff);
  }

  /**
   * Get full state (for debugging/monitoring)
   */
  getState(): VoteState {
    return { ...this.state };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
