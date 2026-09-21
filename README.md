# Bulk Link Sender to Telegram

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Firefox & Chrome Compatible](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Edge%20%7C%20Brave-blue.svg)](#how-to-install)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A powerful cross-browser extension (Chrome & Firefox Manifest V3) that captures URLs from your browsing sessions, organizes them in a searchable local queue, and sends them to Telegram as **individual message bubbles** — with multi-profile destination routing, Forum Topic ID support, and background execution.

---

## 🎯 Best & Broadest Use Cases

Whether you are browsing casually, curating content, managing community forums, or automating bot workflows, **Bulk Link Sender** is built for versatile link dispatching:

### 1. 📱 Personal Cross-Device Sync & "Read / Watch Later"
* **The Goal:** Send interesting tabs from your desktop to your mobile device without cluttering browser bookmarks.
* **How it works:** Set up a profile pointing to your **Telegram Saved Messages** (`chat_id` from [@userinfobot](https://t.me/userinfobot)). Hit `Alt + Shift + S` or right-click any article, YouTube video, Instagram reel, or paper. Click **Send All Unsent** before walking away from your computer — every link arrives in your Telegram app as its own bubble with rich previews.

### 2. 🗂️ Categorized Forum Topic Dispatching (Telegram Supergroups)
* **The Goal:** Route different types of links into distinct Forum Topics in your Telegram Supergroups.
* **How it works:** Create multiple profiles corresponding to your topics:
  * *Profile 1:* `#tech-news` (Topic ID: `12`)
  * *Profile 2:* `#design-inspiration` (Topic ID: `34`)
  * *Profile 3:* `#competitor-watch` (Topic ID: `56`)
* Select the destination profile directly from the extension popup dropdown and dispatch links directly into the appropriate thread.

### 3. 🤖 Downloader & Automation Bot Ingestion
* **The Goal:** Feed link lists into automated Telegram bots (e.g. video/media downloaders, archive bots, scraping pipelines, or LLM summarizers).
* **How it works:** These bots typically require links sent **one per message bubble** to trigger downstream tasks. Paste a batch into **Bulk Import**, adjust the per-bubble delay (e.g., 500ms–1000ms), and let the background worker deliver them smoothly without triggering rate limits.

### 4. 📰 Content Curation & Channel Broadcasting
* **The Goal:** Curate daily news roundups, resource digests, or affiliate drops for public or private Telegram channels.
* **How it works:** Grab links throughout your research workflow. Open the **Full-Screen Manager Dashboard**, review and prune candidates, toggle between **"Title + URL"** or **"URL Only"** formats, and broadcast the batch to your channel in one click.

### 5. 💼 QA Testing, Recruiting & Team Research
* **The Goal:** Collect and share batches of URLs with your team without losing context.
  * **QA Bug Reports:** Grab staging URLs where issues were found and send them in batch to the engineering channel.
  * **Talent Sourcing:** Gather candidate profiles (LinkedIn, GitHub) and send them directly to the hiring team.
  * **Audit Trail:** Export all collected links to **CSV** anytime with timestamps and statuses.

### 6. 🛍️ E-Commerce & Deal / Property Hunting
* **The Goal:** Compare candidate products (Amazon, eBay, AliExpress, Shopee) or real estate listings across dozens of open tabs.
* **How it works:** Grab tabs while browsing, then send them to a shared family or group chat so everyone can review individual preview cards directly on their phones.

---

## ✨ Features

- ⚡ **1-Click Active Tab Grab**: Instantly grabs the active tab's URL and title.
- 💬 **Per-Bubble Telegram Delivery**: Sends each link as its own individual Telegram chat bubble for clean media previews and bot compatibility.
- 🔄 **True Background Execution**: Start a bulk send and switch tabs, close the popup, or browse freely — the background service worker handles the delivery queue seamlessly.
- 👥 **Multi-Profile Support**: Save multiple Telegram configurations (Personal, Work, Community, Channels) and switch destinations instantly with a dropdown.
- 🏷️ **Optional Forum Topic IDs**: Full support for Telegram Supergroup Forum Topics (`message_thread_id`).
- ⏱️ **Rate-Limit Safe Queue**: Configurable delay between message bubbles (default 500ms) to ensure delivery without hitting Telegram API rate limits.
- 📋 **Saved Links Table**: Filter by **All**, **Unsent (Pending)**, or **Sent**. Real-time search across domain, URL, and page title.
- 🎯 **Single & Batch Controls**: Send individual links via table row buttons, or send all unsent / selected links at once.
- 🖱️ **Context Menus & Keyboard Shortcut**: Right-click any link or webpage to grab it (`Grab link to Telegram queue`), or press `Alt + Shift + S`.
- 📊 **Full-Screen Dashboard**: Full-tab manager with statistics, bulk URL import (paste raw URLs), multi-selection tools, and CSV export.
- 🔒 **Privacy First**: All links and bot credentials are stored 100% locally in your browser (`chrome.storage.local`). No external servers.

---

## 🚀 How to Install

### Google Chrome / Brave / Edge / Opera
1. Clone or download this repository.
2. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `bulk-link-sender` project directory.
6. Pin **Bulk Link Sender** to your extension toolbar.

### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` inside the `bulk-link-sender` directory (or use the built `.zip` from `web-ext-artifacts/`).
4. The extension is immediately active and ready to use!

---

## ⚙️ Telegram Bot Setup (2 Minutes)

To send links into Telegram, you need a **Bot Token** and your **Chat ID**:

### Step 1: Create a Bot
1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a bot name and username (e.g. `MyLinkQueueBot`).
3. Copy the HTTP API token provided by BotFather (looks like `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

### Step 2: Get Your Chat ID (and optional Topic ID)
1. Search for your new bot in Telegram and click **START** (or send `/start`).  
   *(Important: A bot cannot message you until you start a chat with it).*
2. To find your Chat ID:
   - **Personal / Saved Messages:** Message [@userinfobot](https://t.me/userinfobot) in Telegram. It will reply with your `Id` (e.g. `987654321`).
   - **Group / Supergroup:** Add your bot to the group and use the group ID (e.g. `-100123456789`).
   - **Public Channel:** Use `@yourchannelname` (ensure the bot is added as an administrator).
3. **Optional Topic ID (Thread ID):**
   - If sending into a Telegram Forum Supergroup topic, copy the topic link or thread ID (e.g. `12`) and enter it in the **Topic ID** field.
   - For regular chats and channels, leave **Topic ID** blank.

### Step 3: Add Profiles in the Extension
1. Click the **Bulk Link Sender** extension icon.
2. Click the ⚙️ (Settings) button in the header.
3. Click **+ Add New Profile** (or edit the Default profile).
4. Enter a profile name (e.g. `Personal`, `Dev Forum`, `Deals Channel`), paste the **Bot Token**, **Chat ID**, and optional **Topic ID**.
5. Click **Test Connection** to send a live ping verification.
6. Click **Save Profile**.

---

## 📖 Quick Usage Guide

| Action | How to do it |
| :--- | :--- |
| **Grab Active Tab** | Open popup → click **Grab Tab**, or press `Alt + Shift + S` |
| **Grab Link on Page** | Right-click any link → select **"Grab link to Telegram queue"** |
| **Switch Destination** | Use the **"Send via:"** dropdown above the Send button |
| **Send Single Link** | Click the ✈ button on any row in the table |
| **Send All Unsent** | Click **Send All Unsent to Telegram** (runs in background) |
| **Bulk Import URLs** | Open Manager (↗) → **Bulk Import** → paste links → click **Import** |
| **Export to CSV** | Open Manager (↗) → click **Export CSV** in the action bar |

---

## 📂 Project Structure

```
bulk-link-sender/
├── manifest.json              # Dual Chrome / Firefox Manifest V3 manifest
├── icons/                     # Extension icons (16x16, 48x48, 128x128)
├── background/
│   └── service-worker.js      # Background worker: context menus, badges, background bulk send loop
├── popup/
│   ├── popup.html             # Compact popup UI
│   ├── popup.css              # Popup styling & responsive drawer layout
│   └── popup.js               # Tab grabber, table renderer, profile picker, queue controller
├── manager/
│   ├── manager.html           # Full-page dashboard UI (Saved Links, Bulk Import, Profiles)
│   ├── manager.css            # Full dashboard styling
│   └── manager.js             # Dashboard controller, CSV export, multi-select batch tools
├── scripts/
│   ├── storage.js             # Local storage manager (Profiles CRUD, links CRUD, badge updater)
│   └── telegram.js            # Telegram Bot API wrapper, rate-limiting timer, formatting
└── README.md                  # Documentation & usage guide
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
