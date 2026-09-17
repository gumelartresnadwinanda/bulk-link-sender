/**
 * Storage management for Bulk Link Sender Chrome Extension.
 * Works across Service Worker, Popup, and Manager page contexts.
 *
 * PROFILES: Each profile has its own botToken, chatId, topicId, and per-send settings.
 * On first load after upgrade, existing flat settings are migrated into a "Default" profile.
 */

(function (root) {
  const STORAGE_KEYS = {
    LINKS: 'bls_links',
    SETTINGS: 'bls_settings',       // Legacy key (migrated on first use)
    PROFILES: 'bls_profiles',
    ACTIVE_PROFILE_ID: 'bls_active_profile_id'
  };

  const DEFAULT_PROFILE_SETTINGS = {
    delayMs: 500,
    messageFormat: 'url_only',
    disablePreview: false,
    silentNotification: false
  };

  function genId() {
    return (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'profile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  function makeDefaultProfile(overrides = {}) {
    return {
      id: genId(),
      name: 'Default',
      botToken: '',
      chatId: '',
      topicId: '',
      ...DEFAULT_PROFILE_SETTINGS,
      ...overrides
    };
  }

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
    // ─── Profiles ───────────────────────────────────────────────────────────────

    /** Returns all profiles. Migrates legacy flat settings if no profiles exist yet. */
    async getProfiles() {
      const result = await chrome.storage.local.get([STORAGE_KEYS.PROFILES, STORAGE_KEYS.SETTINGS]);
      let profiles = result[STORAGE_KEYS.PROFILES];

      if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
        // Migrate legacy flat settings into a "Default" profile
        const legacy = result[STORAGE_KEYS.SETTINGS];
        const defaultProfile = makeDefaultProfile(legacy ? {
          name: 'Default',
          botToken: legacy.botToken || '',
          chatId: legacy.chatId || '',
          topicId: legacy.topicId || '',
          delayMs: legacy.delayMs || 500,
          messageFormat: legacy.messageFormat || 'url_only',
          disablePreview: Boolean(legacy.disablePreview),
          silentNotification: Boolean(legacy.silentNotification)
        } : {});

        profiles = [defaultProfile];
        await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
        // Set active profile to this default
        await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_PROFILE_ID]: defaultProfile.id });
      }

      return profiles;
    },

    async saveProfiles(profiles) {
      await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: profiles });
    },

    async getActiveProfileId() {
      const profiles = await this.getProfiles(); // ensures migration
      const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_PROFILE_ID);
      const storedId = result[STORAGE_KEYS.ACTIVE_PROFILE_ID];

      // Validate stored ID still exists
      if (storedId && profiles.some(p => p.id === storedId)) {
        return storedId;
      }

      // Fall back to first profile
      const fallbackId = profiles[0] ? profiles[0].id : null;
      if (fallbackId) {
        await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_PROFILE_ID]: fallbackId });
      }
      return fallbackId;
    },

    async setActiveProfileId(id) {
      await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_PROFILE_ID]: id });
    },

    async getActiveProfile() {
      const [profiles, activeId] = await Promise.all([this.getProfiles(), this.getActiveProfileId()]);
      return profiles.find(p => p.id === activeId) || profiles[0] || null;
    },

    async addProfile(data) {
      const profiles = await this.getProfiles();
      const newProfile = makeDefaultProfile({
        name: data.name || 'New Profile',
        botToken: data.botToken || '',
        chatId: data.chatId || '',
        topicId: data.topicId || '',
        delayMs: data.delayMs || 500,
        messageFormat: data.messageFormat || 'url_only',
        disablePreview: Boolean(data.disablePreview),
        silentNotification: Boolean(data.silentNotification)
      });
      profiles.push(newProfile);
      await this.saveProfiles(profiles);
      return newProfile;
    },

    async updateProfile(id, updates) {
      const profiles = await this.getProfiles();
      const index = profiles.findIndex(p => p.id === id);
      if (index === -1) return null;
      profiles[index] = { ...profiles[index], ...updates, id }; // id cannot change
      await this.saveProfiles(profiles);
      return profiles[index];
    },

    async deleteProfile(id) {
      const profiles = await this.getProfiles();
      if (profiles.length <= 1) {
        throw new Error('Cannot delete the last profile.');
      }
      const filtered = profiles.filter(p => p.id !== id);
      await this.saveProfiles(filtered);

      // If we deleted the active profile, switch to first
      const activeId = await this.getActiveProfileId();
      if (activeId === id) {
        await this.setActiveProfileId(filtered[0].id);
      }

      return filtered;
    },

    // ─── Legacy settings shim (for backward compat) ─────────────────────────────

    /** @deprecated Use getActiveProfile() instead */
    async getSettings() {
      return await this.getActiveProfile() || makeDefaultProfile();
    },

    /** @deprecated Use updateProfile() instead */
    async saveSettings(settings) {
      const activeId = await this.getActiveProfileId();
      if (activeId) {
        return await this.updateProfile(activeId, settings);
      }
      return settings;
    },

    // ─── Links ──────────────────────────────────────────────────────────────────

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
        return { item: links[existingIndex], isDuplicate: true };
      }

      const domain = extractDomain(cleanUrl);
      const newLink = {
        id: genId(),
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
          id: genId(),
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
