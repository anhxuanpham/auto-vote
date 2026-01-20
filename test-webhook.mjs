const webhookUrl = 'https://discord.com/api/webhooks/1463010301082341410/mkmPBtpmtzqp8CsVmtqm3nh6vTU-dEWAdYxxiOTVRxJyXAov1GhqGAIpEk6dXbq9nuqT';

console.log('Testing Discord webhook notifications...\n');

async function sendWebhook(embeds) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'TopGG Auto Vote',
      embeds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }
  console.log('✓ Sent');
}

async function test() {
  // Test 1: Service start
  console.log('1. Sending service start notification...');
  await sendWebhook([{
    title: '🚀 Service Started',
    color: 0x0099ff,
    fields: [
      { name: 'Bot ID', value: '408785106942164992', inline: true },
      { name: 'Accounts', value: '3', inline: true },
      { name: 'Mode', value: '12-hour interval', inline: true },
    ],
    timestamp: new Date().toISOString(),
  }]);
  console.log();

  await new Promise(r => setTimeout(r, 2000));

  // Test 2: Vote success
  console.log('2. Sending vote success notification...');
  await sendWebhook([{
    title: '✅ Vote Successful',
    color: 0x00ff00,
    fields: [
      { name: 'Account', value: '#1', inline: true },
      { name: 'Bot ID', value: '408785106942164992', inline: true },
      { name: 'Timestamp', value: new Date().toISOString(), inline: false },
    ],
    timestamp: new Date().toISOString(),
  }]);
  console.log();

  await new Promise(r => setTimeout(r, 2000));

  // Test 3: All votes complete
  console.log('3. Sending all votes complete notification...');
  await sendWebhook([{
    title: '✅ All Votes Successful',
    color: 0x00ff00,
    fields: [
      { name: 'Total', value: '3', inline: true },
      { name: 'Success', value: '3', inline: true },
      { name: 'Failed', value: '0', inline: true },
      { name: 'Details', value: '#1: ✅\n#2: ✅\n#3: ✅', inline: false },
    ],
    timestamp: new Date().toISOString(),
  }]);

  console.log('\n✅ All webhook tests completed! Check your Discord channel.');
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
