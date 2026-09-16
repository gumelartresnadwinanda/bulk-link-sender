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
      title: 'Add current page to Telegram queue',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.LINK,
      title: 'Add link to Telegram queue',
      contexts: ['link']
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.SELECTION,
      title: 'Add selected URL to Telegram queue',
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
      } else {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Keep message channel open for async response
});
