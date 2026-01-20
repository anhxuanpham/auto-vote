import { VoteStatus } from './index.js';

export interface VoteResult {
  success: boolean;
  status: VoteStatus;
  timestamp: Date;
  error?: string;
  botId: string;
  tokenUsed: string;
}

export interface VoteState {
  lastVoteTime: string;
  nextVoteTime: string;
  consecutiveFailures: number;
  totalVotes: number;
}

export interface VoteAttempt {
  attemptNumber: number;
  startTime: Date;
  endTime?: Date;
  result?: VoteResult;
}
