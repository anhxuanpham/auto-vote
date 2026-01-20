/**
 * Captchaly API response for successful Turnstile solve
 */
export interface CaptchalyTurnstileResponse {
  time: number;
  duration: number;
  deducted: string;
  token: string;
}

/**
 * Captchaly API error response
 */
export interface CaptchalyErrorResponse {
  error?: string;
  message?: string;
  detail?: string;
}

/**
 * Turnstile solution result
 */
export interface TurnstileSolution {
  success: boolean;
  token?: string;
  error?: string;
  duration?: number;
}
