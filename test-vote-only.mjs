import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config({ path: './config/.env' });

const token = process.env.DISCORD_TOKEN;
const botId = process.env.TOPGG_BOT_ID || '408785106942164992';

console.log('=== TEST: FOCUS ON VOTE STEP ===\n');

const browser = await puppeteer.launch({
  headless: false,
  args: ['--start-maximized'],
  defaultViewport: null,
});

const page = (await browser.pages())[0];

// Inject token BEFORE navigation
await page.evaluateOnNewDocument((t) => {
  localStorage.setItem('token', `"${t}"`);
}, token);

// Navigate to vote page
const voteUrl = `https://top.gg/bot/${botId}/vote`;
console.log(`1. Navigating to: ${voteUrl}`);
await page.goto(voteUrl, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Check if logged in
const status1 = await page.evaluate(() => ({
  url: window.location.href,
  hasLoginBtn: !!Array.from(document.querySelectorAll('a, button'))
    .find(e => e.textContent?.toLowerCase().includes('login')),
  hasVoteBtn: !!Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent?.trim().toLowerCase() === 'vote'),
  pageText: document.body.innerText.slice(0, 200)
}));

console.log('\n2. Status after navigation:');
console.log(JSON.stringify(status1, null, 2));

// If has login button, do OAuth
if (status1.hasLoginBtn) {
  console.log('\n3. Login button found - clicking...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('a, button'))
      .find(e => e.textContent?.toLowerCase().includes('login'));
    btn?.click();
  });

  console.log('   Waiting for Discord OAuth...');
  await page.waitForNavigation({ timeout: 15000 }).catch(() => {});

  const oauthUrl = page.url();
  console.log(`   Current URL: ${oauthUrl}`);

  if (oauthUrl.includes('discord.com/oauth2')) {
    console.log('\n4. On Discord OAuth - clicking Authorize...');
    await new Promise(r => setTimeout(r, 3000));

    const authorizeClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim().toLowerCase() === 'authorize');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!authorizeClicked) {
      console.log('   ❌ Could not find/click Authorize button');
      console.log('   === MANUAL INTERVENTION NEEDED ===');
      console.log('   Browser sẽ mở 120s - BẠN CLICK AUTHORIZE!');
      await new Promise(r => setTimeout(r, 120000));
    } else {
      console.log('   ✓ Authorize clicked, waiting for redirect...');

      // Wait longer for redirect with multiple checks
      let redirected = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const currentUrl = page.url();
        console.log(`   Checking... (${i + 1}/10) URL: ${currentUrl.slice(0, 50)}...`);

        if (currentUrl.includes('top.gg')) {
          console.log('   ✓ Redirected to top.gg!');
          redirected = true;
          break;
        }
      }

      if (!redirected) {
        console.log('   ⚠️  Redirect timeout - checking current state...');
        const finalUrl = page.url();
        console.log(`   Current URL: ${finalUrl}`);

        if (finalUrl.includes('discord.com')) {
          console.log('   Still on Discord - needs manual Authorize click');
          console.log('   === WAITING 60s FOR MANUAL CLICK ===');
          await new Promise(r => setTimeout(r, 60000));
        }
      }
    }
  }

  await new Promise(r => setTimeout(r, 5000));
}

// Check login status again
console.log('\n5. Checking login status after OAuth...');
const status2 = await page.evaluate(() => {
  const allBtns = Array.from(document.querySelectorAll('button, a, [role="button"]'))
    .map(b => ({ tag: b.tagName, text: b.textContent?.trim().slice(0, 30) }))
    .filter(b => b.text && b.text.length > 0 && b.text.length < 50);

  return {
    url: window.location.href,
    title: document.title,
    buttons: allBtns.slice(0, 15),
    hasLoginBtn: allBtns.some(b => b.text.toLowerCase().includes('login')),
    pageText: document.body.innerText.slice(0, 300)
  };
});

console.log(JSON.stringify(status2, null, 2));

// Look for vote button
console.log('\n6. Looking for VOTE button...');

// Check if ad is blocking
const hasAd = await page.evaluate(() => {
  return document.body.innerText.toLowerCase().includes('you will be able to vote after this ad');
});

if (hasAd) {
  console.log('⚠️  AD detected! Waiting for ad to finish...');
  console.log('   (This might take 5-30 seconds)');

  // Wait for ad to finish - check every 2s
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const adGone = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return !text.includes('you will be able to vote after this ad');
    });

    if (adGone) {
      console.log(`   ✓ Ad finished after ${i * 2}s`);
      break;
    }

    console.log(`   Still waiting... (${i + 1}/15)`);
  }

  await new Promise(r => setTimeout(r, 2000));
}

const voteSearch = await page.evaluate(() => {
  // Method 1: Exact text match
  const exactMatch = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent?.trim().toLowerCase() === 'vote');

  if (exactMatch) {
    return {
      found: true,
      method: 'exact match',
      text: exactMatch.textContent?.trim(),
      class: exactMatch.className,
      tag: exactMatch.tagName
    };
  }

  // Method 2: Contains 'vote'
  const containsMatch = Array.from(document.querySelectorAll('button, a, [role="button"]'))
    .find(b => b.textContent?.trim().toLowerCase().includes('vote'));

  if (containsMatch) {
    return {
      found: true,
      method: 'contains',
      text: containsMatch.textContent?.trim(),
      class: containsMatch.className,
      tag: containsMatch.tagName
    };
  }

  return { found: false };
});

console.log(JSON.stringify(voteSearch, null, 2));

if (voteSearch.found) {
  console.log(`\n7. ✓ VOTE BUTTON FOUND!`);
  console.log(`   Method: ${voteSearch.method}`);
  console.log(`   Text: "${voteSearch.text}"`);

  console.log('\n8. ⚠ WAITING 5s BEFORE CLICK - WATCH THE BROWSER!');
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n9. CLICKING VOTE BUTTON NOW!!!');
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .find(b => b.textContent?.trim().toLowerCase().includes('vote'));
    if (btn) {
      btn.click();
      return { clicked: true, text: btn.textContent?.trim() };
    }
    return { clicked: false };
  });

  console.log(`   Click result: ${JSON.stringify(clicked)}`);

  console.log('\n10. Waiting 10s for result...');
  await new Promise(r => setTimeout(r, 10000));

  const final = await page.evaluate(() => ({
    url: window.location.href,
    text: document.body.innerText.slice(0, 500)
  }));

  console.log('\n11. FINAL STATUS:');
  console.log(JSON.stringify(final, null, 2));

  if (final.text.toLowerCase().includes('successfully voted') ||
      final.text.toLowerCase().includes('thanks for voting')) {
    console.log('\n✅✅✅ VOTE SUCCESSFUL!!! ✅✅✅');
  } else if (final.text.toLowerCase().includes('already voted')) {
    console.log('\n⚠️  Already voted recently');
  } else if (!final.url.includes('/vote')) {
    console.log('\n✅ Page navigated away - likely successful');
  } else {
    console.log('\n❓ Unclear result');
  }
} else {
  console.log('\n❌ VOTE BUTTON NOT FOUND!');
  console.log('   This means login may have failed or page structure changed');
}

console.log('\n=================================');
console.log('Browser sẽ mở 60s để bạn CHECK MANUAL');
console.log('=================================');

await new Promise(r => setTimeout(r, 60000));

await browser.close();
console.log('\n=== TEST COMPLETE ===');
process.exit(0);
