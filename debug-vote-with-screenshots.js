import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// Load environment
dotenv.config({ path: './config/.env' });

const SCREENSHOT_DIR = './debug-screenshots';

// Simple logger
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data) : ''),
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data ? JSON.stringify(data) : ''),
};

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = join(SCREENSHOT_DIR, `${timestamp}-${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugVoteProcess() {
  await ensureDir(SCREENSHOT_DIR);

  logger.info('=== DEBUG: Vote Process with Screenshots ===');

  const botId = process.env.TOPGG_BOT_ID || '408785106942164992';
  const token = process.env.DISCORD_TOKEN;

  if (!token) {
    logger.error('No Discord token configured!');
    process.exit(1);
  }

  logger.info(`Bot ID: ${botId}`);
  logger.info(`Token: ${token.slice(0, 10)}...${token.slice(-5)}`);

  let browser;
  let page;

  try {
    logger.info('Step 1: Launching browser (VISIBLE)...');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--start-maximized'],
      defaultViewport: null,
    });
    page = (await browser.pages())[0];

    await takeScreenshot(page, '01-browser-started');
    logger.info('✓ Browser started');

    logger.info('Step 2: Injecting Discord token into localStorage...');
    await page.evaluateOnNewDocument((tokenValue) => {
      localStorage.setItem('token', `"${tokenValue}"`);
      console.log('Token injected into localStorage:', tokenValue);
    }, token);
    await takeScreenshot(page, '02-token-injected-script');
    logger.info('✓ Token injection script set up');

    logger.info(`Step 3: Navigating to vote page...`);
    const voteUrl = `https://top.gg/bot/${botId}/vote`;
    logger.info(`URL: ${voteUrl}`);

    await page.goto(voteUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000); // Wait for page to stabilize

    await takeScreenshot(page, '03-page-loaded');
    logger.info('✓ Page loaded');

    logger.info('Step 4: Checking login status...');
    const loginStatus = await page.evaluate(() => {
      // Check localStorage
      const localToken = localStorage.getItem('token');
      console.log('Token in localStorage:', localToken ? 'YES' : 'NO');

      // Check for login button
      const loginButtons = Array.from(document.querySelectorAll('a, button')).filter(el =>
        el.textContent?.toLowerCase().includes('login')
      );
      console.log('Login buttons found:', loginButtons.length);

      // Check for user avatar/username
      const userElements = document.querySelectorAll('[class*="user"], [class*="avatar"], [class*="profile"]');
      console.log('User elements found:', userElements.length);

      // Get page title
      const title = document.title;
      console.log('Page title:', title);

      // Get URL
      const url = window.location.href;
      console.log('Current URL:', url);

      return {
        hasToken: !!localToken,
        loginButtonCount: loginButtons.length,
        loginButtonTexts: loginButtons.map(b => b.textContent?.trim()),
        userElementCount: userElements.length,
        title,
        url,
        pageText: document.body.innerText.slice(0, 500),
      };
    });

    logger.info(`Login Status: ${JSON.stringify(loginStatus, null, 2)}`);
    await takeScreenshot(page, '04-login-status-check');
    logger.info('✓ Login status checked');

    // If login buttons found, user is NOT logged in
    if (loginStatus.loginButtonCount > 0) {
      logger.warn('⚠ LOGIN BUTTONS DETECTED - USER IS NOT LOGGED IN!');
      await takeScreenshot(page, '05-LOGIN-BUTTONS-FOUND');

      logger.info('Login buttons found:');
      loginStatus.loginButtonTexts.forEach(text => logger.info(`  - "${text}"`));
    } else {
      logger.info('✓ No login button - user appears to be logged in');
    }

    logger.info('Step 5: Looking for vote button...');
    await sleep(2000);

    const buttonStatus = await page.evaluate(() => {
      const results = [];

      // Find all buttons and links
      const allElements = document.querySelectorAll('button, a, [role="button"]');

      allElements.forEach((elem, idx) => {
        const text = elem.textContent?.trim() || '';
        if (text.toLowerCase().includes('vote')) {
          results.push({
            index: idx,
            tag: elem.tagName,
            text: text,
            class: elem.className,
            id: elem.id,
          });
        }
      });

      return results;
    });

    logger.info(`Vote-related elements found: ${JSON.stringify(buttonStatus, null, 2)}`);
    await takeScreenshot(page, '06-vote-elements-found');
    logger.info('✓ Vote elements checked');

    logger.info('Step 6: Clicking vote button...');
    const clickResult = await page.evaluate(() => {
      // Look for vote button
      const allElements = document.querySelectorAll('button, a, [role="button"]');
      for (const elem of allElements) {
        const text = elem.textContent?.trim() || '';
        if (text.toLowerCase() === 'vote') {
          elem.click();
          return { success: true, element: elem.tagName, text };
        }
      }
      return { success: false, error: 'No vote button found' };
    });

    logger.info(`Click result: ${JSON.stringify(clickResult)}`);
    await takeScreenshot(page, '07-after-vote-click');
    logger.info('✓ Vote button clicked');

    logger.info('Step 7: Waiting for result (10 seconds)...');
    await sleep(10000);

    const finalStatus = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.slice(0, 1000),
        hasSuccessMessage: document.body.innerText.toLowerCase().includes('successfully voted') ||
                           document.body.innerText.toLowerCase().includes('thanks for voting'),
        hasErrorMessage: document.body.innerText.toLowerCase().includes('already voted') ||
                          document.body.innerText.toLowerCase().includes('rate limit'),
      };
    });

    logger.info(`Final Status: ${JSON.stringify(finalStatus, null, 2)}`);
    await takeScreenshot(page, '08-final-state');

    // Determine actual result
    if (finalStatus.hasSuccessMessage) {
      logger.info('✅ SUCCESS: Vote successful message detected!');
    } else if (finalStatus.hasErrorMessage) {
      logger.warn('⚠️ ERROR: Vote error message detected');
    } else if (!finalStatus.url.includes('/vote')) {
      logger.info(`✅ LIKELY SUCCESS: Page navigated to ${finalStatus.url}`);
    } else {
      logger.warn('⚠️ UNCLEAR: Could not determine vote result');
    }

    logger.info('Step 8: Keeping browser open for 30 seconds for manual inspection...');
    logger.info('👀 Check the browser window to see what actually happened!');
    await sleep(30000);

    await takeScreenshot(page, '09-final-before-close');

  } catch (error) {
    logger.error(`Error during debug: ${error.message}`);
    logger.error(error.stack);
    if (page) {
      await takeScreenshot(page, 'ERROR');
    }
  } finally {
    if (browser) {
      logger.info('Closing browser...');
      await browser.close();
    }
    logger.info('=== DEBUG COMPLETE ===');
    logger.info(`Check ${SCREENSHOT_DIR} for all screenshots`);
    process.exit(0);
  }
}

debugVoteProcess().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
