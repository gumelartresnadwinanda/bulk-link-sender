# Bulk Link Sender to Telegram

A cross-browser extension (Chrome & Firefox Manifest V3) that captures URLs from your browsing sessions, organizes them in a searchable local queue, and sends them to Telegram as individual message bubbles. Features multi-profile destination routing, Supergroup Forum Topic support, and background execution.

---

## Use Cases

### Personal Cross-Device Sync & Read-Later Queue
Send articles, videos, and references from your desktop browser directly to your Telegram Saved Messages chat (`chat_id` obtained via [@userinfobot](https://t.me/userinfobot)). When you finish browsing on your desktop, dispatch the queue in bulk. Every link arrives on your mobile Telegram app as an individual message bubble with native link previews.

### Supergroup Forum Topic Dispatching
If you manage or participate in Telegram Supergroups with Topics enabled, configure distinct profiles for each topic (e.g., `#tech-news`, `#design-inspiration`, `#competitor-watch`) using their respective `message_thread_id`. Switch destination profiles directly from the extension toolbar and dispatch links to the appropriate thread.

### Ingestion for Downloader & Automation Bots
Many Telegram-based utility bots (video downloaders, archivers, scrapers, or LLM-based summarization webhooks) require URLs to be sent one per message bubble. The extension's configurable inter-message delay (default 500ms) delivers links sequentially in the background without triggering Telegram API rate limits.

### Content Curation & Channel Broadcasting
Collect links throughout your research workflow. Open the full-page manager dashboard to prune candidates, verify status, select either "Title + URL" or "URL Only" formatting, and broadcast the curated batch directly to a public or private channel.

### QA Testing, Sourcing & Team Research
- **QA Reporting:** Capture URLs of pages with bugs or staging environments and batch-send them directly to an engineering group.
- **Candidate Sourcing:** Gather candidate profiles (LinkedIn, GitHub) and route them to hiring channels.
- **Audit Trails:** Export collected links to CSV at any time with timestamps and delivery status.

### E-Commerce & Product Comparison
Capture multiple product listings across different stores during comparison shopping and send them to a shared chat for collaborative review on mobile devices.

---

## Features

- **Active Tab Capture:** Grab the current tab URL and title with a single click or keyboard shortcut (`Alt + Shift + S`).
- **Per-Bubble Delivery:** Delivers each link as an individual chat bubble for clean media previews and compatibility with external automation bots.
- **Background Execution:** Bulk send jobs run within the background service worker, allowing you to close the popup, switch tabs, or browse freely while sending proceeds.
- **Multi-Profile Support:** Manage multiple Telegram bot tokens, chat IDs, and topic IDs across separate named profiles with quick dropdown switching.
- **Forum Topic Support:** Full support for Telegram Supergroup Forum Topics via optional `message_thread_id`.
- **Rate-Limit Safe:** Configurable delay between message dispatches to prevent Telegram API rate limiting (`429 Too Many Requests`).
- **Local Link Management:** Filter by All, Pending, or Sent status; search across domain, URL, and page title.
- **Context Menus:** Right-click any link or page to immediately queue it.
- **Manager Dashboard:** Full-page interface with bulk URL import, multi-select operations, and CSV export.
- **Local Storage:** All links and credentials are stored strictly in `chrome.storage.local`. No external servers or third-party tracking.

---

## Installation

### Google Chrome, Brave, Edge, Opera
1. Clone or download this repository.
2. Navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `bulk-link-sender` root folder.
6. Pin the extension to your toolbar.

### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` inside the `bulk-link-sender` directory (or the `.zip` archive in `web-ext-artifacts/`).

---

## Telegram Setup

To send links into Telegram, you need a Bot Token and a target Chat ID:

### 1. Create a Bot
1. In Telegram, open a chat with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a display name and username (e.g., `MyLinkQueueBot`).
3. Copy the HTTP API token provided by BotFather (format: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

### 2. Obtain Your Chat ID & Topic ID
1. Open a chat with your new bot and click **START** or send `/start` (required before a bot can message you).
2. Find your Chat ID:
   - **Personal / Saved Messages:** Message [@userinfobot](https://t.me/userinfobot) to get your numeric ID (e.g., `987654321`).
   - **Group / Supergroup:** Add your bot to the group and use the group ID (e.g., `-100123456789`).
   - **Public Channel:** Add your bot as an admin and use `@yourchannelname`.
3. **Optional Topic ID (Thread ID):**
   - If sending to a specific topic inside a Forum Supergroup, obtain the topic link or thread ID (e.g., `12`) and fill in the **Topic ID** field.
   - For regular chats and channels, leave the Topic ID field blank.

### 3. Add Profiles in the Extension
1. Click the extension icon in your browser toolbar.
2. Click the gear icon to open the **Telegram Profiles** drawer.
3. Click **+ Add New Profile** (or edit the Default profile).
4. Enter a profile name (e.g., `Personal`, `Dev Forum`, `Deals Channel`), paste the Bot Token, Chat ID, and optional Topic ID.
5. Click **Test Connection** to verify delivery.
6. Click **Save Profile**.

---

## Quick Reference

| Action | Method |
| :--- | :--- |
| Grab Active Tab | Click **Grab Tab** in popup, or press `Alt + Shift + S` |
| Grab Link on Webpage | Right-click link -> select **Grab link to Telegram queue** |
| Switch Destination Profile | Select from the **Send via:** dropdown in the popup toolbar |
| Send Single Link | Click the airplane icon on any table row |
| Send All Unsent | Click **Send All Unsent to Telegram** (runs in background) |
| Bulk Import URLs | Open Manager -> **Bulk Import** -> paste URLs -> **Import** |
| Export Data | Open Manager -> click **Export CSV** |

---

## Project Structure

```
bulk-link-sender/
├── manifest.json              # Dual Chrome / Firefox Manifest V3 definition
├── icons/                     # Extension icons (16x16, 48x48, 128x128)
├── background/
│   └── service-worker.js      # Background worker: context menus, badges, background send loop
├── popup/
│   ├── popup.html             # Main popup interface
│   ├── popup.css              # Popup styling
│   └── popup.js               # Popup controller, tab capture, queue interface
├── manager/
│   ├── manager.html           # Full-page manager dashboard
│   ├── manager.css            # Dashboard styling
│   └── manager.js             # Dashboard controller, CSV export, bulk import
├── scripts/
│   ├── storage.js             # Storage manager (Profiles CRUD, links CRUD, badge updater)
│   └── telegram.js            # Telegram Bot API client, rate limiting, message formatting
└── README.md                  # Documentation
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
