import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config({ path: './config/.env' });

const token = process.env.DISCORD_TOKEN;
const botId = process.env.TOPGG_BOT_ID || '408785106942164992';

console.log('=== Test với Visible UI ===');
console.log('Bot ID:', botId);
console.log('Token:', token?.slice(0, 10) + '...' + token?.slice(-5));
console.log('Browser sẽ mở - watch the process!\n');

const browser = await puppeteer.launch({
  headless: false,
  args: ['--start-maximized'],
  defaultViewport: null,
});

const page = (await browser.pages())[0];

// Inject token
await page.evaluateOnNewDocument((t) => {
  localStorage.setItem('token', `"${t}"`);
  localStorage.setItem('requestToken', t);
}, token);

// Navigate
const voteUrl = `https://top.gg/bot/${botId}/vote`;
console.log('Navigating to:', voteUrl);
await page.goto(voteUrl, { waitUntil: 'networkidle2', timeout: 30000 });

await new Promise(r => setTimeout(r, 3000));

// Check login
const loginStatus = await page.evaluate(() => {
  const text = document.body.innerText.toLowerCase();
  const loginBtns = Array.from(document.querySelectorAll('a, button'))
    .filter(e => e.textContent?.toLowerCase().includes('login'));
  return {
    mustLogin: text.includes('you must be logged in'),
    loginBtnCount: loginBtns.length,
    voteBtnExists: document.body.innerText.toLowerCase().includes('vote')
  };
});

console.log('Login Status:', JSON.stringify(loginStatus, null, 2));

if (loginStatus.loginBtnCount > 0) {
  console.log('Clicking login button...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('a, button'))
      .find(e => e.textContent?.toLowerCase().includes('login'));
    btn?.click();
  });

  // Wait for Discord OAuth
  console.log('Waiting for Discord OAuth...');
  await page.waitForNavigation({ timeout: 15000 }).catch(() => {});

  const url = page.url();
  console.log('Current URL:', url);

  if (url.includes('discord.com/oauth2')) {
    console.log('On Discord OAuth page - clicking Authorize...');
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.toLowerCase().includes('authorize'));
      btn?.click();
    });

    console.log('Waiting for redirect back...');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  }
}

await new Promise(r => setTimeout(r, 3000));

// Click vote
console.log('Looking for vote button...');
const voted = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent?.trim().toLowerCase() === 'vote');
  if (btn) {
    btn.click();
    return true;
  }
  return false;
});

if (voted) {
  console.log('✓ Vote button clicked!');
  await new Promise(r => setTimeout(r, 10000));

  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
  if (bodyText.includes('successfully voted') || bodyText.includes('thanks for voting')) {
    console.log('✅ SUCCESS - Vote confirmed!');
  } else if (bodyText.includes('already voted') || bodyText.includes('rate limit')) {
    console.log('⚠️  Already voted / Rate limited');
  } else if (!finalUrl.includes('/vote')) {
    console.log('✅ Likely successful - page navigated');
  } else {
    console.log('⚠️  Unclear result');
  }
} else {
  console.log('❌ Vote button not found');
}

console.log('\nKeeping browser open for 30s - check it now!');
await new Promise(r => setTimeout(r, 30000));

await browser.close();
console.log('\n=== Test Complete ===');
process.exit(0);
