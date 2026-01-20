import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config({ path: './config/.env' });

const token = process.env.DISCORD_TOKEN;
const botId = process.env.TOPGG_BOT_ID || '408785106942164992';

console.log('=== Test với Visible UI (Long wait) ===');
console.log('Bot ID:', botId);
console.log('Token:', token?.slice(0, 10) + '...' + token?.slice(-5));
console.log('Browser sẽ mở - MANUAL CHECK!\\n');

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
    url: window.location.href,
    pageText: document.body.innerText.slice(0, 300)
  };
});

console.log('Step 1 - Initial Status:', JSON.stringify(loginStatus, null, 2));

if (loginStatus.loginBtnCount > 0) {
  console.log('\\nStep 2 - Clicking login button...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('a, button'))
      .find(e => e.textContent?.toLowerCase().includes('login'));
    btn?.click();
  });

  // Wait for Discord OAuth
  console.log('Waiting for Discord OAuth redirect...');
  await page.waitForNavigation({ timeout: 15000 }).catch(() => {});

  const url2 = page.url();
  console.log('Step 3 - After login click:', url2);

  if (url2.includes('discord.com/oauth2')) {
    console.log('\\nStep 4 - On Discord OAuth page');
    await new Promise(r => setTimeout(r, 3000));

    console.log('Clicking Authorize button...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.toLowerCase().includes('authorize'));
      btn?.click();
    });

    console.log('Waiting for redirect back to top.gg...');
    await page.waitForNavigation({ timeout: 20000 }).catch((e) => {
      console.log('Navigation timeout/error:', e.message);
    });

    const url3 = page.url();
    console.log('Step 5 - After authorize:', url3);

    // If not back on vote page, wait more
    if (!url3.includes('/vote')) {
      console.log('Not on vote page, waiting 5s more...');
      await new Promise(r => setTimeout(r, 5000));
      const url4 = page.url();
      console.log('Step 6 - After extra wait:', url4);

      // Try navigating manually
      if (!url4.includes('/vote')) {
        console.log('Manually navigating to vote page...');
        await page.goto(voteUrl, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}

// Final check
console.log('\\nStep 7 - Final check:');
const finalStatus = await page.evaluate(() => {
  const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
    .map(b => ({
      tag: b.tagName,
      text: b.textContent?.trim(),
      class: b.className
    }))
    .filter(b => b.text && b.text.length < 50);

  return {
    url: window.location.href,
    title: document.title,
    buttonTexts: allButtons.slice(0, 10),
    bodyText: document.body.innerText.slice(0, 500)
  };
});

console.log(JSON.stringify(finalStatus, null, 2));

// Try to find and click vote
console.log('\\nStep 8 - Attempting vote click...');
const voteResult = await page.evaluate(() => {
  const allElements = document.querySelectorAll('button, a, [role="button"]');
  for (const elem of allElements) {
    const text = elem.textContent?.trim().toLowerCase() || '';
    if (text === 'vote') {
      elem.click();
      return { success: true, element: elem.tagName, text: elem.textContent };
    }
  }
  return { success: false, error: 'No vote button' };
});

console.log('Vote click result:', JSON.stringify(voteResult, null, 2));

if (voteResult.success) {
  console.log('✅ Vote clicked! Waiting 10s for result...');
  await new Promise(r => setTimeout(r, 10000));

  const afterVote = await page.evaluate(() => ({
    url: window.location.href,
    text: document.body.innerText.slice(0, 500)
  }));
  console.log('After vote:', JSON.stringify(afterVote, null, 2));
}

console.log('\\n=============================');
console.log('BROWSER SẼ MỞ TRONG 90 GIÂY');
console.log('CHECK MANUAL ĐỂ XEM THỰC TẾ!');
console.log('=============================');

await new Promise(r => setTimeout(r, 90000));

await browser.close();
console.log('\\n=== Test Complete ===');
process.exit(0);
