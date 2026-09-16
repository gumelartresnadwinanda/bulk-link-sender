# Chrome Web Store Listing: Bulk Link Sender to Telegram

**Last Updated:** 2026-09-16  
**Extension Name:** Bulk Link Sender to Telegram  
**Current Version:** 1.0.0  

---

## 1. Store Listing Metadata

### Short Description (max 132 chars)
Grab active tab URLs, organize links in a table, and send them to Telegram individually or in bulk per message bubble.

### Detailed Description
Save and organize web links as you browse, then send them directly to your Telegram chat, group, or channel—each link delivered as its own individual chat bubble.

Whether you are collecting research articles, Instagram profiles, Google Docs, or shopping links, Bulk Link Sender makes link management effortless.

**Key Features:**
• **1-Click Tab Capture:** Instantly grab and save the URL and title of your active tab.
• **Per-Bubble Delivery:** Every link is dispatched as an individual Telegram chat bubble for clean reading and easy forwarding.
• **Interactive Link Table:** Search, filter (All / Unsent / Sent), sort, and manage all your saved URLs with live status badges.
• **Single & Bulk Sending:** Send links one-by-one or blast all unsent links sequentially with a rate-limit safe queue.
• **Right-Click Context Menu:** Right-click any link or page to immediately add it to your Telegram queue without leaving your workflow.
• **Full-Screen Dashboard:** Manage large lists of URLs, paste bulk batches, and export links to CSV.
• **Privacy-First:** Your links, bot tokens, and chat IDs stay in your browser's local storage. No tracking, no third-party servers.

---

## 2. Permissions Justification

| Permission | Justification |
| :--- | :--- |
| `storage` | Required to store saved URLs, queue status (pending/sent), and user preferences (Telegram Bot Token and Chat ID) locally on your device. |
| `tabs` | Required to read the URL and title of the active tab when the user clicks "Grab Tab" or triggers the grab shortcut. |
| `activeTab` | Grants temporary access to the current page to retrieve its web address and page title upon user interaction. |
| `contextMenus` | Allows users to right-click links, selections, or pages to quickly add URLs directly into the Telegram queue. |
| `notifications` | Displays brief desktop confirmations when links are saved via context menus or keyboard shortcuts. |
| `host_permissions` (`https://api.telegram.org/*`) | Required to communicate directly with the official Telegram Bot API to deliver link messages to the user's configured chat. |

---

## 3. Privacy & Data Handling Disclosure

- **Does this extension collect personal data?** No.
- **Does this extension sell or transfer user data?** No.
- **Where is data stored?** All URLs, titles, and Telegram configuration tokens are stored strictly within the browser's isolated `chrome.storage.local`.
- **External Network Requests:** The extension only connects to `https://api.telegram.org` to transmit the messages explicitly triggered by the user to their own Telegram bot.

---

## 4. Version History

### Version 1.0.0 (2026-09-16)
- Initial release.
- 1-click active tab capture with duplicate detection.
- Per-bubble Telegram Bot sending with customizable rate-limit pacing.
- Interactive table with search, filter tabs, single-send buttons, and bulk operations.
- Full-screen dashboard and CSV export.
- Context menu support and keyboard shortcut (`Alt+Shift+S`).
