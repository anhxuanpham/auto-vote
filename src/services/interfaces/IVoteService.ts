import { VoteResult } from '../../types/vote.js';

export interface IVoteService {
  vote(botId: string, token: string): Promise<VoteResult>;
  canVote(): boolean;
  getNextVoteTime(): Date;
}
