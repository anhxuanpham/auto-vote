/**
 * DiscordWebhookService - Send notifications to Discord webhook
 */

export interface WebhookMessage {
  content?: string;
  embeds?: WebhookEmbed[];
  username?: string;
  avatar_url?: string;
}

export interface WebhookEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: WebhookField[];
  footer?: WebhookFooter;
  timestamp?: string;
}

export interface WebhookField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface WebhookFooter {
  text: string;
  icon_url?: string;
}

export class DiscordWebhookService {
  private webhookUrl: string;
  private enabled: boolean;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
    this.enabled = !!webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/');
  }

  async sendMessage(message: WebhookMessage): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...message,
          username: message.username || 'TopGG Auto Vote',
        }),
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Webhook error:', error);
      return false;
    }
  }

  async sendVoteSuccess(tokenIndex: number, botId: string, username?: string): Promise<boolean> {
    const embed: WebhookEmbed = {
      title: '✅ Vote Successful',
      color: 0x00ff00,
      fields: [
        { name: 'Account', value: `#${tokenIndex + 1}`, inline: true },
        { name: 'Bot ID', value: botId, inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    if (username) {
      embed.fields?.push({ name: 'User', value: username, inline: true });
    }

    return this.sendMessage({
      content: '',
      embeds: [embed],
    });
  }

  async sendVoteFailure(tokenIndex: number, botId: string, error: string): Promise<boolean> {
    const embed: WebhookEmbed = {
      title: '❌ Vote Failed',
      color: 0xff0000,
      fields: [
        { name: 'Account', value: `#${tokenIndex + 1}`, inline: true },
        { name: 'Bot ID', value: botId, inline: true },
        { name: 'Error', value: error.slice(0, 1000), inline: false },
        { name: 'Timestamp', value: new Date().toISOString(), inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content: '',
      embeds: [embed],
    });
  }

  async sendVoteStart(tokenIndex: number, botId: string): Promise<boolean> {
    const embed: WebhookEmbed = {
      title: '🔄 Vote Started',
      color: 0xffff00,
      fields: [
        { name: 'Account', value: `#${tokenIndex + 1}`, inline: true },
        { name: 'Bot ID', value: botId, inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content: '',
      embeds: [embed],
    });
  }

  async sendServiceStart(botId: string, tokenCount: number): Promise<boolean> {
    const embed: WebhookEmbed = {
      title: '🚀 Service Started',
      color: 0x0099ff,
      fields: [
        { name: 'Bot ID', value: botId, inline: true },
        { name: 'Accounts', value: tokenCount.toString(), inline: true },
        { name: 'Mode', value: '12-hour interval', inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content: '**TopGG Auto Vote Service Started**',
      embeds: [embed],
    });
  }

  async sendAllVotesComplete(results: Array<{ index: number; success: boolean; error?: string }>): Promise<boolean> {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    const embed: WebhookEmbed = {
      title: successCount === results.length ? '✅ All Votes Successful' : '⚠️ Vote Cycle Complete',
      color: successCount === results.length ? 0x00ff00 : failCount === results.length ? 0xff0000 : 0xffff00,
      fields: [
        { name: 'Total', value: results.length.toString(), inline: true },
        { name: 'Success', value: successCount.toString(), inline: true },
        { name: 'Failed', value: failCount.toString(), inline: true },
        {
          name: 'Details',
          value: results.map(r => `#${r.index + 1}: ${r.success ? '✅' : `❌ ${r.error || 'Unknown'}`}`).join('\n'),
          inline: false,
        },
        { name: 'Timestamp', value: new Date().toISOString(), inline: false },
      ],
      timestamp: new Date().toISOString(),
    };

    return this.sendMessage({
      content: '',
      embeds: [embed],
    });
  }
}
