/**
 * Discord token validation utilities
 * Handles format validation and token type detection
 */

/**
 * Discord token format patterns
 */
const DISCORD_TOKEN_REGEX = /^[\w-]{24,}\.[\w-]{6,}\.[\w-]{27,}$/;
const MFA_TOKEN_REGEX = /^mfa\.[\w-]{84,}$/;
const BOT_TOKEN_REGEX = /^[A-Za-z0-9._-]{59,}$/;

/**
 * Validate Discord token format
 * @param token - Discord token string
 * @returns true if token matches valid format
 */
export function validateTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const trimmed = token.trim();

  // Check MFA token format
  if (MFA_TOKEN_REGEX.test(trimmed)) {
    return true;
  }

  // Check regular token format
  if (DISCORD_TOKEN_REGEX.test(trimmed)) {
    return true;
  }

  // Check bot token format
  if (BOT_TOKEN_REGEX.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Get token type
 * @param token - Discord token string
 * @returns Token type: 'user', 'bot', 'mfa', or 'unknown'
 */
export function getTokenType(token: string): 'user' | 'bot' | 'mfa' | 'unknown' {
  if (MFA_TOKEN_REGEX.test(token)) return 'mfa';
  if (DISCORD_TOKEN_REGEX.test(token)) return 'user';
  if (BOT_TOKEN_REGEX.test(token)) return 'bot';
  return 'unknown';
}

/**
 * Mask token for logging (show only first 5 and last 5 chars)
 * @param token - Discord token string
 * @returns Masked token string
 */
export function maskToken(token: string): string {
  if (!token || token.length <= 10) return '***';
  return `${token.slice(0, 5)}...${token.slice(-5)}`;
}

/**
 * Validate token via Discord API (optional, can be skipped)
 * @param token - Discord token string
 * @returns Promise<boolean> - true if token is valid
 */
export async function validateTokenViaAPI(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      // Token is valid if response is OK
      return true;
    }

    if (response.status === 401) {
      return false;
    }

    // Don't fail on network error - token might still work
    return true;
  } catch (error) {
    // Network error or other issue - don't fail validation
    return true;
  }
}
