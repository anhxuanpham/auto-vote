import { BrowserConfig } from '../types/config.js';

/**
 * Get Puppeteer launch configuration based on browser config
 */
export function getLaunchConfig(config: BrowserConfig) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-features=TranslateUI',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    // Anti-detection flags
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1920,1080',
    '--disable-features=site-per-process',
    `--user-agent=${config.userAgent}`,
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-field-trial-config',
    '--disable-back-forward-cache',
  ];

  return {
    args,
    defaultViewport: config.viewport,
  };
}

/**
 * Get Docker-specific Chrome args for containerized environments
 */
export function getDockerArgs(): string[] {
  return [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
  ];
}
