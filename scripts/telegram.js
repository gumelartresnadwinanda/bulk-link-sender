/**
 * Telegram Bot API Service for Bulk Link Sender
 * Handles single message bubble dispatches, test pings, and sequential queue sending.
 */

(function (root) {
  const TelegramService = {
    validateToken(token) {
      if (!token || typeof token !== 'string') return false;
      // Basic Telegram Bot Token format: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
      return /^\d{8,12}:[A-Za-z0-9_-]{30,50}$/.test(token.trim());
    },

    validateChatId(chatId) {
      if (!chatId) return false;
      const str = String(chatId).trim();
      // User ID (positive number), Group ID (negative number), or Channel username (@channelname)
      return /^(-?\d+|@[a-zA-Z0-9_]{5,})$/.test(str);
    },

    formatMessage(linkItem, settings = {}) {
      const format = settings.messageFormat || 'url_only';
      const cleanUrl = linkItem.url || '';
      const cleanTitle = (linkItem.title || '').trim();

      if (format === 'title_and_url') {
        if (cleanTitle && cleanTitle.toLowerCase() !== cleanUrl.toLowerCase()) {
          return `${cleanTitle}\n${cleanUrl}`;
        }
      }
      return cleanUrl;
    },

    async getMe(botToken) {
      const cleanToken = (botToken || '').trim();
      if (!cleanToken) {
        return { success: false, error: 'Bot Token is required' };
      }

      try {
        const response = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
          method: 'GET'
        });
        const data = await response.json();

        if (data.ok) {
          return { success: true, bot: data.result };
        } else {
          return { success: false, error: data.description || 'Invalid Bot Token' };
        }
      } catch (err) {
        return { success: false, error: `Network error: ${err.message || err}` };
      }
    },

    async testConnection(botToken, chatId, topicId = null) {
      const cleanToken = (botToken || '').trim();
      const cleanChatId = (chatId || '').trim();

      if (!cleanToken) {
        return { success: false, error: 'Bot token cannot be empty.' };
      }
      if (!cleanChatId) {
        return { success: false, error: 'Chat ID cannot be empty.' };
      }

      // Step 1: Verify token with getMe
      const meResult = await this.getMe(cleanToken);
      if (!meResult.success) {
        return { success: false, error: `Bot Token check failed: ${meResult.error}` };
      }

      // Step 2: Send test ping message
      const botName = meResult.bot.first_name || meResult.bot.username || 'Bot';
      const topicNote = topicId ? ` (Topic ID: ${topicId})` : '';
      const testText = `🤖 *Bulk Link Sender connected!* \n\nYour bot (@${meResult.bot.username || botName}) is successfully linked${topicNote}. Links will be sent here as separate bubbles.`;

      const payload = {
        chat_id: cleanChatId,
        text: testText,
        parse_mode: 'Markdown'
      };

      const threadId = topicId ? parseInt(String(topicId).trim(), 10) : null;
      if (threadId && !isNaN(threadId)) {
        payload.message_thread_id = threadId;
      }

      try {
        const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.ok) {
          return {
            success: true,
            botUsername: meResult.bot.username,
            botName: botName,
            messageId: data.result.message_id
          };
        } else {
          let hint = '';
          if (data.description && data.description.includes('chat not found')) {
            hint = ' Hint: Have you started a chat with this bot first in Telegram? Press /start with your bot.';
          } else if (data.description && (data.description.includes('message thread not found') || data.description.includes('TOPIC_ID_INVALID'))) {
            hint = ' Hint: The specified Topic ID does not exist in this supergroup or the group does not have topics enabled.';
          } else if (data.description && data.description.includes('Forbidden: bot was blocked')) {
            hint = ' Hint: You may have blocked the bot in Telegram. Unblock the bot and try again.';
          }
          return { success: false, error: `${data.description || 'Failed to send message.'}${hint}` };
        }
      } catch (err) {
        return { success: false, error: `Network error sending message: ${err.message || err}` };
      }
    },

    async sendSingleBubble(botToken, chatId, linkItem, settings = {}) {
      const cleanToken = (botToken || '').trim();
      const cleanChatId = (chatId || '').trim();

      if (!cleanToken || !cleanChatId) {
        return { success: false, error: 'Missing Bot Token or Chat ID in settings.' };
      }

      const text = this.formatMessage(linkItem, settings);
      if (!text) {
        return { success: false, error: 'Empty message text.' };
      }

      const payload = {
        chat_id: cleanChatId,
        text: text,
        disable_web_page_preview: Boolean(settings.disablePreview),
        disable_notification: Boolean(settings.silentNotification)
      };

      const threadId = settings.topicId ? parseInt(String(settings.topicId).trim(), 10) : null;
      if (threadId && !isNaN(threadId)) {
        payload.message_thread_id = threadId;
      }

      try {
        const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.ok) {
          return {
            success: true,
            messageId: data.result.message_id
          };
        } else {
          let errDesc = data.description || 'Telegram API rejected message';
          // Rate limit indicator
          if (data.parameters && data.parameters.retry_after) {
            errDesc += ` (Rate limited. Retry after ${data.parameters.retry_after}s)`;
          }
          return {
            success: false,
            error: errDesc,
            retryAfter: data.parameters?.retry_after
          };
        }
      } catch (err) {
        return {
          success: false,
          error: `Network error: ${err.message || err}`
        };
      }
    },

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };

  root.TelegramService = TelegramService;
})(typeof globalThis !== 'undefined' ? globalThis : this);
