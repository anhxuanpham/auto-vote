/**
 * Service Tests
 *
 * Basic service instantiation and interface tests
 */

import { BrowserService } from '../src/services/BrowserService.js';
import { DiscordAuthService } from '../src/services/DiscordAuthService.js';
import { VoteService } from '../src/services/VoteService.js';
import { SchedulerService } from '../src/services/SchedulerService.js';
import { StateManager } from '../src/services/StateManager.js';

describe('Services', () => {
  describe('BrowserService', () => {
    test('should instantiate', () => {
      const service = new BrowserService();
      expect(service).toBeInstanceOf(BrowserService);
    });
  });

  describe('DiscordAuthService', () => {
    test('should instantiate', () => {
      const service = new DiscordAuthService();
      expect(service).toBeInstanceOf(DiscordAuthService);
    });
  });

  describe('VoteService', () => {
    test('should instantiate with dependencies', () => {
      const browser = new BrowserService();
      const auth = new DiscordAuthService();
      const service = new VoteService(browser, auth);
      expect(service).toBeInstanceOf(VoteService);
    });
  });

  describe('SchedulerService', () => {
    test('should instantiate', () => {
      const service = new SchedulerService();
      expect(service).toBeInstanceOf(SchedulerService);
    });
  });

  describe('StateManager', () => {
    test('should instantiate', () => {
      const manager = new StateManager();
      expect(manager).toBeInstanceOf(StateManager);
    });

    test('should initialize with empty state', async () => {
      const manager = new StateManager();
      const state = await manager.load();
      expect(state).toBeDefined();
      expect(state.nextVoteTime).toBeInstanceOf(Date);
    });
  });
});
