/**
 * Configuration Tests
 *
 * Test configuration loading and validation
 */

import { loadConfig } from '../src/utils/config.js';

describe('Configuration', () => {
  test('should load default configuration', () => {
    const config = loadConfig();

    expect(config).toBeDefined();
    expect(config.topgg.botId).toBe('408785106942164992');
    expect(config.topgg.voteUrl).toContain('top.gg');
    expect(config.discord.tokens).toHaveLength(1);
    expect(config.discord.tokens[0]).toBe('test_token_abc123');
  });

  test('should have valid logging configuration', () => {
    const config = loadConfig();

    expect(config.logging).toBeDefined();
    expect(config.logging.level).toBe('error');
  });

  test('should have valid browser configuration', () => {
    const config = loadConfig();

    expect(config.browser).toBeDefined();
    expect(config.browser.headless).toBe(true);
  });

  test('should have valid scheduling configuration', () => {
    const config = loadConfig();

    expect(config.schedule).toBeDefined();
    expect(config.schedule.intervalHours).toBe(12);
  });
});
