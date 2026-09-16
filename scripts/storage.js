/**
 * Storage management for Bulk Link Sender Chrome Extension.
 * Works across Service Worker, Popup, and Manager page contexts.
 */

(function (root) {
  const STORAGE_KEYS = {
    LINKS: 'bls_links',
    SETTINGS: 'bls_settings'
  };

  const DEFAULT_SETTINGS = {
    botToken: '',
    chatId: '',
    topicId: '', // Optional: Telegram Forum Supergroup message_thread_id
    delayMs: 500, // Safe default delay between Telegram bubbles
    messageFormat: 'url_only', // 'url_only' | 'title_and_url'
    disablePreview: false,
    silentNotification: false
  };

  function extractDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function normalizeUrl(url) {
    if (!url) return '';
    let trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    return trimmed;
  }

  const LinkStorage = {
    async getSettings() {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
    },

    async saveSettings(settings) {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
      return updated;
    },

    async getLinks() {
      const result = await chrome.storage.local.get(STORAGE_KEYS.LINKS);
      const links = result[STORAGE_KEYS.LINKS] || [];
      // Return sorted with newest first
      return links.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    },

    async saveLinks(links) {
      await chrome.storage.local.set({ [STORAGE_KEYS.LINKS]: links });
      await this.updateBadge(links);
      return links;
    },

    async addLink({ url, title }) {
      if (!url) throw new Error('URL cannot be empty');
      const cleanUrl = normalizeUrl(url);
      const links = await this.getLinks();

      // Check if URL already exists
      const existingIndex = links.findIndex(l => l.url.toLowerCase() === cleanUrl.toLowerCase());
      if (existingIndex !== -1) {
        // Return existing item with a flag indicating it exists
        return { item: links[existingIndex], isDuplicate: true };
      }

      const domain = extractDomain(cleanUrl);
      const newLink = {
        id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'link_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        url: cleanUrl,
        title: (title || cleanUrl).trim(),
        domain: domain || cleanUrl,
        addedAt: Date.now(),
        status: 'pending', // 'pending' | 'sent' | 'failed'
        sentAt: null,
        errorMessage: null
      };

      links.unshift(newLink);
      await this.saveLinks(links);
      return { item: newLink, isDuplicate: false };
    },

    async addBulkUrls(rawText) {
      if (!rawText) return { added: 0, duplicates: 0, items: [] };
      const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      const links = await this.getLinks();
      const existingMap = new Set(links.map(l => l.url.toLowerCase()));

      let addedCount = 0;
      let duplicateCount = 0;
      const newItems = [];

      for (const line of lines) {
        const clean = normalizeUrl(line);
        if (!clean) continue;
        if (existingMap.has(clean.toLowerCase())) {
          duplicateCount++;
          continue;
        }

        const domain = extractDomain(clean);
        const item = {
          id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'link_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
          url: clean,
          title: clean,
          domain: domain || clean,
          addedAt: Date.now(),
          status: 'pending',
          sentAt: null,
          errorMessage: null
        };
        links.unshift(item);
        existingMap.add(clean.toLowerCase());
        newItems.push(item);
        addedCount++;
      }

      if (addedCount > 0) {
        await this.saveLinks(links);
      }

      return { added: addedCount, duplicates: duplicateCount, items: newItems };
    },

    async updateLink(id, updates) {
      const links = await this.getLinks();
      const index = links.findIndex(l => l.id === id);
      if (index === -1) return null;

      links[index] = { ...links[index], ...updates };
      await this.saveLinks(links);
      return links[index];
    },

    async markStatus(id, status, errorMessage = null) {
      return await this.updateLink(id, {
        status,
        sentAt: status === 'sent' ? Date.now() : null,
        errorMessage: errorMessage || null
      });
    },

    async deleteLink(id) {
      const links = await this.getLinks();
      const filtered = links.filter(l => l.id !== id);
      await this.saveLinks(filtered);
    },

    async deleteLinks(ids) {
      const idSet = new Set(ids);
      const links = await this.getLinks();
      const filtered = links.filter(l => !idSet.has(l.id));
      await this.saveLinks(filtered);
    },

    async clearSentLinks() {
      const links = await this.getLinks();
      const remaining = links.filter(l => l.status !== 'sent');
      await this.saveLinks(remaining);
      return remaining;
    },

    async clearAllLinks() {
      await this.saveLinks([]);
    },

    async updateBadge(providedLinks) {
      try {
        if (!chrome.action) return;
        const links = providedLinks || await this.getLinks();
        const unsentCount = links.filter(l => l.status === 'pending' || l.status === 'failed').length;

        if (unsentCount > 0) {
          await chrome.action.setBadgeText({ text: String(unsentCount) });
          await chrome.action.setBadgeBackgroundColor({ color: '#2AABEE' }); // Telegram Blue
        } else {
          await chrome.action.setBadgeText({ text: '' });
        }
      } catch (err) {
        console.warn('Could not update badge:', err);
      }
    }
  };

  root.LinkStorage = LinkStorage;
})(typeof globalThis !== 'undefined' ? globalThis : this);
