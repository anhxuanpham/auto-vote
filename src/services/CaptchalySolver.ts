import axios, { AxiosInstance } from 'axios';
import { getLogger } from '../utils/logger.js';
import type {
  CaptchalyTurnstileResponse,
  CaptchalyErrorResponse,
  TurnstileSolution
} from '../types/captcha.js';

const CAPTCHALY_CONFIG = {
  MAX_RETRIES: 3,
} as const;

export class CaptchalySolver {
  private axiosInstance: AxiosInstance;
  private apiKey: string;
  private logger = getLogger();

  constructor(apiKey: string, baseUrl: string, timeout: number) {
    if (!apiKey) {
      throw new Error('Captchaly API key is required');
    }
    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${apiKey}`,
      },
      validateStatus: () => true,
      timeout: timeout,
    });
  }

  /**
   * Solve Cloudflare Turnstile using Captchaly API
   * @param sitekey - Turnstile sitekey from data-sitekey attribute
   * @param siteurl - URL of the page with Turnstile
   * @returns Turnstile solution with token
   */
  async solveTurnstile(sitekey: string, siteurl: string): Promise<TurnstileSolution> {
    this.logger.info(`[Captchaly] Solving Turnstile for ${siteurl}`);
    const startTime = Date.now();

    for (let attempt = 1; attempt <= CAPTCHALY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.get<
          CaptchalyTurnstileResponse | CaptchalyErrorResponse
        >('/turnstile', {
          params: {
            sitekey: sitekey,
            url: siteurl,
          },
        });

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

        // Check HTTP errors
        if (response.status !== 200) {
          const errorData = response.data as CaptchalyErrorResponse;
          const errorMessage = errorData.error || errorData.message || errorData.detail || response.statusText;
          throw new Error(`HTTP ${response.status}: ${errorMessage}`);
        }

        const data = response.data as CaptchalyTurnstileResponse;

        // Validate token
        if (!data.token) {
          throw new Error('Invalid response: missing token');
        }

        this.logger.info(
          `[Captchaly] Turnstile solved in ${elapsedTime}s ` +
          `(API: ${data.duration.toFixed(1)}s, cost: ${data.deducted})`
        );

        return {
          success: true,
          token: data.token,
          duration: data.duration,
        };

      } catch (error) {
        const isLastAttempt = attempt === CAPTCHALY_CONFIG.MAX_RETRIES;

        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            this.logger.error(`[Captchaly] Request timed out (attempt ${attempt}/${CAPTCHALY_CONFIG.MAX_RETRIES})`);
          } else {
            this.logger.error(`[Captchaly] Network error: ${error.message} (attempt ${attempt}/${CAPTCHALY_CONFIG.MAX_RETRIES})`);
          }
        } else {
          this.logger.error(`[Captchaly] Error: ${(error as Error).message} (attempt ${attempt}/${CAPTCHALY_CONFIG.MAX_RETRIES})`);
        }

        if (isLastAttempt) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }

        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.debug(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded',
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
