/**
 * CSS Selectors for TopGG vote page elements
 */
export const TOPGG_SELECTORS = {
  // Login button
  loginButton: 'a[href*="/api/oauth2/authorize"], a[href*="oauth2"], button[class*="login"]',

  // Vote button (after auth) - TopGG uses Chakra UI
  voteButton: 'button[type="submit"], button.chakra-button, .chakra-button',
  voteButtonClass: '.vote-button, [class*="voteBtn"], [class*="vote-btn"], button[class*="Vote"]',

  // Turnstile iframe
  turnstileIframe: 'iframe[src*="turnstile"], iframe[src*="challenges.cloudflare"]',
  turnstileChallenge: '[data-sitekey]',
  turnstileSuccess: '[data-callback]',
  turnstileResponse: 'input[name="cf-turnstile-response"]',

  // Success message
  successMessage: '.toast-success, [class*="success"], .alert-success',
  successToast: '[role="alert"].success, [role="alert"][class*="success"]',
  votedIndicator: '.voted, [class*="already-voted"], [class*="already voted"]',

  // Error messages
  errorMessage: '.toast-error, [class*="error"], .alert-error',
  rateLimitMessage: '[class*="rate-limit"], .rate-limit, [class*="rate limit"]',

  // User info (to verify auth)
  userInfo: '.user-info, [class*="user-avatar"], [class*="username"], [class*="user-"]',
  loggedInIndicator: '[class*="logged-in"], .authenticated',

  // Loading states
  loadingSpinner: '.spinner, [class*="loading"], [role="progressbar"]',
} as const;

/**
 * URL patterns for TopGG
 */
export const TOPGG_URLS = {
  vote: (botId: string) => `https://top.gg/bot/${botId}/vote`,
  bot: (botId: string) => `https://top.gg/bot/${botId}`,
} as const;

/**
 * Regex patterns for detecting vote success/failure
 */
export const VOTE_SUCCESS_PATTERNS = [
  /successfully voted/i,
  /thanks for voting/i,
  /vote recorded/i,
] as const;

export const VOTE_ERROR_PATTERNS = [
  /already voted/i,
  /rate limit/i,
  /try again later/i,
  /12 hours/i,
] as const;
