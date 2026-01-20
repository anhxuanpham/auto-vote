import { CaptchalySolver } from '../src/services/CaptchalySolver.js';
import type { TurnstileSolution } from '../src/types/captcha.js';

// Mock axios for testing
jest.mock('axios');

describe('CaptchalySolver', () => {
  let solver: CaptchalySolver;

  beforeEach(() => {
    solver = new CaptchalySolver(
      'test-api-key',
      'https://v1.captchaly.com',
      120000
    );
  });

  test('should initialize with API key', () => {
    expect(solver).toBeInstanceOf(CaptchalySolver);
  });

  test('should throw error without API key', () => {
    expect(() => {
      new CaptchalySolver('', 'https://v1.captchaly.com', 120000);
    }).toThrow('Captchaly API key is required');
  });

  // Note: Full integration tests would require mocking axios.get()
  // and testing success/error scenarios
});
