/**
 * Background Service Worker (Manifest V3)
 * Handles Context Menus, Keyboard Shortcuts, Extension Badge, and Notifications.
 */

if (typeof importScripts === 'function') {
  importScripts('../scripts/storage.js', '../scripts/telegram.js');
}

const CONTEXT_MENU_IDS = {
  PAGE: 'bls_add_page',
  LINK: 'bls_add_link',
  SELECTION: 'bls_add_selection'
};

// Set up Context Menus on Install/Update
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.PAGE,
      title: 'Grab current page to Telegram queue',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.LINK,
      title: 'Grab link to Telegram queue',
      contexts: ['link']
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.SELECTION,
      title: 'Grab selected URL to Telegram queue',
      contexts: ['selection']
    });
  });

  // Ensure initial badge state
  await LinkStorage.updateBadge();
});

// Handle Context Menu item clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let urlToAdd = '';
  let titleToAdd = '';

  if (info.menuItemId === CONTEXT_MENU_IDS.LINK && info.linkUrl) {
    urlToAdd = info.linkUrl;
    titleToAdd = info.selectionText || info.linkUrl;
  } else if (info.menuItemId === CONTEXT_MENU_IDS.PAGE && tab?.url) {
    urlToAdd = tab.url;
    titleToAdd = tab.title || tab.url;
  } else if (info.menuItemId === CONTEXT_MENU_IDS.SELECTION && info.selectionText) {
    urlToAdd = info.selectionText.trim();
    titleToAdd = info.selectionText.trim();
  }

  if (urlToAdd) {
    await handleAddLinkFromAction(urlToAdd, titleToAdd);
  }
});

// Handle keyboard shortcut (e.g. Alt+Shift+S)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'grab-current-tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      await handleAddLinkFromAction(tab.url, tab.title || tab.url);
    }
  }
});

async function handleAddLinkFromAction(url, title) {
  try {
    const result = await LinkStorage.addLink({ url, title });

    // Show feedback notification
    if (result.isDuplicate) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Already in Queue',
        message: `This link is already in your Telegram queue: ${result.item.domain || url}`
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Link Saved!',
        message: `Saved to Telegram queue: ${result.item.domain || url}`
      });
    }
  } catch (err) {
    console.error('Failed to save link from context action:', err);
  }
}

// Background Bulk Sending State
let isSending = false;
let abortSend = false;
let sendStatus = {
  active: false,
  title: '',
  currentIdx: 0,
  total: 0,
  successCount: 0,
  failCount: 0,
  currentUrl: ''
};

// Function to keep SW alive during long bulk sends
let keepAliveInterval = null;
function startKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(); // Dummy call to keep SW alive
  }, 20000);
}
function stopKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
}

// Background Bulk Sending Logic
async function runBackgroundSend(targetIds, title) {
  if (isSending) return;
  const profile = await LinkStorage.getActiveProfile();
  if (!profile) return;
  
  const links = await LinkStorage.getLinks();
  const targetItems = links.filter(l => targetIds.includes(l.id));
  
  isSending = true;
  abortSend = false;
  sendStatus = {
    active: true,
    title: title,
    currentIdx: 0,
    total: targetItems.length,
    successCount: 0,
    failCount: 0,
    currentUrl: ''
  };
  
  startKeepAlive();
  
  try {
    for (let i = 0; i < targetItems.length; i++) {
      if (abortSend) break;
      
      const item = targetItems[i];
      sendStatus.currentIdx = i + 1;
      sendStatus.currentUrl = item.domain || item.url;
      
      // Broadcast progress update to UI
      chrome.runtime.sendMessage({ type: 'BULK_SEND_PROGRESS', status: sendStatus }).catch(() => {});

      const result = await TelegramService.sendSingleBubble(profile.botToken, profile.chatId, item, profile);
      
      if (result.success) {
        await LinkStorage.markStatus(item.id, 'sent');
        sendStatus.successCount++;
      } else {
        await LinkStorage.markStatus(item.id, 'failed', result.error);
        sendStatus.failCount++;
      }
      
      // Delay before next message (only if not aborted and not the last item)
      if (sendStatus.currentIdx < targetItems.length && !abortSend) {
        const delay = profile.delayMs || 500;
        await TelegramService.sleep(delay);
      }
    }
  } catch (err) {
    console.error("Error during background bulk send:", err);
  } finally {
    isSending = false;
    sendStatus.active = false;
    stopKeepAlive();
    
    // Broadcast finish to UI
    chrome.runtime.sendMessage({ type: 'BULK_SEND_FINISHED', status: sendStatus, aborted: abortSend }).catch(() => {});
    
    // Show notification to user
    const msg = abortSend 
      ? `Queue paused (${sendStatus.successCount} sent, ${sendStatus.failCount} failed).`
      : `Bulk send complete: ${sendStatus.successCount} sent, ${sendStatus.failCount} failed.`;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Bulk Send Finished',
      message: msg
    });
  }
}

// Runtime message passing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'GET_ACTIVE_TAB') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ tab: tab || null });
      } else if (message.type === 'UPDATE_BADGE') {
        await LinkStorage.updateBadge();
        sendResponse({ success: true });
      } else if (message.type === 'START_BULK_SEND') {
        if (!isSending) {
          runBackgroundSend(message.targetIds, message.title);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Already sending' });
        }
      } else if (message.type === 'STOP_BULK_SEND') {
        abortSend = true;
        sendResponse({ success: true });
      } else if (message.type === 'GET_SEND_STATUS') {
        sendResponse({ status: sendStatus });
      } else {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Keep message channel open for async response
});
