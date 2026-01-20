/**
 * Test Setup Configuration
 *
 * Global setup for Jest test suite
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// Mock environment variables for testing
process.env.DISCORD_TOKENS = 'test_token_abc123';
process.env.TOPGG_BOT_ID = '408785106942164992';
process.env.VOTE_INTERVAL_HOURS = '12';
process.env.LOG_LEVEL = 'error';
process.env.HEADLESS = 'true';
