// Discord token format
export type DiscordToken = string;

// Bot ID format
export type BotId = string;

// Vote status
export enum VoteStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited',
}

// Service health status
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}
