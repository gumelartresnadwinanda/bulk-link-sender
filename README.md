# Bulk Link Sender to Telegram (Chrome Extension)

A Chrome Extension (Manifest V3) that captures active tab URLs, organizes them into a searchable table with status tracking, and sends them to Telegram either one-by-one or in bulk as **individual message bubbles**.

---

## Features

- ⚡ **1-Click Active Tab Grab**: Instantly grabs the active tab's URL and title.
- 💬 **Per-Bubble Telegram Delivery**: Each link is delivered as its own individual Telegram chat bubble (e.g. `https://instagram.com/me`, `https://docs.google.com/s`).
- ⏱️ **Rate-Limit Safe Queue**: Sequential bulk-sending with configurable delays (default 500ms) to ensure smooth delivery without hitting Telegram API rate limits.
- 📋 **Saved Links Table**: Filter by **All**, **Unsent (Pending)**, or **Sent**. Real-time search by domain, URL, or page title.
- 🎯 **Single & Batch Controls**: Send individual links via table row buttons, or click **Send All Unsent** / **Send Selected**.
- 🖱️ **Context Menus & Shortcut**: Right-click any webpage or link to add it to the queue. Press `Alt + Shift + S` to quickly grab the active tab.
- 📊 **Full-Screen Dashboard**: Open a dedicated management tab with stats, multi-selection tools, CSV export, and bulk URL pasting.
- 🔒 **Privacy First**: Your links and Telegram Bot credentials are stored locally in your browser (`chrome.storage.local`).

---

## How to Install in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the address bar.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left.
5. Select this folder: `e:\Code\2026\bulk-link-sender`
6. Pin **Bulk Link Sender** to your Chrome toolbar for quick access.

---

## Setting Up Your Telegram Bot (2 Minutes)

To send links into Telegram, you need a **Bot Token** and your **Chat ID**:

### Step 1: Get a Bot Token
1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a name and username (e.g. `MyLinkQueueBot`).
3. BotFather will provide an API token that looks like:  
   `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`
4. Copy this token.

### Step 2: Get Your Chat ID (and optional Topic ID)
1. Search for your new bot in Telegram and click **START** (or send `/start`).  
   *(Crucial: A bot cannot message you until you start a chat with it).*
2. To find your numeric Chat ID:
   - Message [@userinfobot](https://t.me/userinfobot) in Telegram. It will instantly reply with your `Id` (e.g. `987654321`).
   - For a Telegram Group/Supergroup: Add your bot to the group and use the group ID (e.g. `-100123456789`).
   - For a public Channel: Use `@yourchannelname` (ensure bot is an admin).
3. **Optional Topic ID (Thread ID):**
   - If you are sending into a Telegram Forum Supergroup with Topics enabled, copy the topic link or thread ID (e.g. `12`) and enter it in the **Topic ID** field.
   - If sending to a regular chat or group, simply leave **Topic ID** blank.

### Step 3: Configure the Extension
1. Click the **Bulk Link Sender** icon in Chrome.
2. Click the ⚙️ (Settings) button in the top-right.
3. Paste your **Bot Token**, **Chat ID**, and optional **Topic ID**.
4. Click **Test Connection Ping** to verify everything works!
5. Click **Save Settings**.

---

## How to Use

### 1. Adding Links
- **From Popup:** Click **Grab Tab** to save the webpage you are currently viewing.
- **Manually:** Click the `+` button in the popup to paste one or multiple URLs.
- **From Webpage:** Right-click anywhere on a webpage or link -> **Add to Telegram queue**.
- **Keyboard Shortcut:** Press `Alt + Shift + S` on any page.

### 2. Sending Links
- **Send Single Link:** Click the Telegram paper-airplane button on any row in the table.
- **Send All Unsent:** Click the large blue **Send All Unsent to Telegram** button. The extension will deliver each link as a separate chat bubble with live progress.
- **Send Selected:** Check the boxes for specific links and click **Send Selected**.

### 3. Managing Links
- Click the ↗ button in the header to open the **Full-Screen Manager Dashboard**.
- Filter by status (**All**, **Unsent**, **Sent**) or use the search bar.
- Export your links to a **CSV** file anytime.
- Clear sent links or individual items with a single click.

---

## Project Structure

```
bulk-link-sender/
├── manifest.json              # Chrome Manifest V3 configuration
├── icons/                     # Extension icons (16x16, 48x48, 128x128)
├── background/
│   └── service-worker.js      # Context menus, badge counter, shortcuts
├── popup/
│   ├── popup.html             # Main popup UI
│   ├── popup.css              # Styling
│   └── popup.js               # Tab grabbing, table logic, single & bulk sends
├── manager/
│   ├── manager.html           # Full-tab management dashboard
│   ├── manager.css            # Dashboard styling
│   └── manager.js             # Dashboard controller, CSV export, bulk import
├── scripts/
│   ├── storage.js             # Chrome storage local operations & badge updater
│   └── telegram.js            # Telegram Bot API client & rate-limiting queue
├── generate-icons.js          # Icon generation utility
├── CHROMEWEBSTORE.md          # Store listing metadata & permissions justifications
└── README.md                  # Instructions & documentation
```
