/**
 * Bulk Link Sender - Popup Controller
 * Handles active tab capture, link table rendering, per-bubble Telegram sending, and settings.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Application State
  let allLinks = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let selectedIds = new Set();
  let currentActiveTab = null;
  let isSendingActive = false;
  let abortSendController = false;

  // DOM Elements
  const unsentBadgeText = document.getElementById('unsentBadgeText');
  const activeTabTitle = document.getElementById('activeTabTitle');
  const activeTabUrl = document.getElementById('activeTabUrl');
  const btnGrabCurrentTab = document.getElementById('btnGrabCurrentTab');
  const grabBtnLabel = document.getElementById('grabBtnLabel');
  const alertBanner = document.getElementById('alertBanner');

  // Drawers & Modals
  const btnToggleSettings = document.getElementById('btnToggleSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const settingsDrawer = document.getElementById('settingsDrawer');
  const btnToggleManualAdd = document.getElementById('btnToggleManualAdd');
  const btnCloseManualAdd = document.getElementById('btnCloseManualAdd');
  const manualAddDrawer = document.getElementById('manualAddDrawer');
  const btnOpenManager = document.getElementById('btnOpenManager');

  // Manual Add Form
  const manualInputTitle = document.getElementById('manualInputTitle');
  const manualInputUrls = document.getElementById('manualInputUrls');
  const btnAddManualLink = document.getElementById('btnAddManualLink');

  // Settings Form
  const settingBotToken = document.getElementById('settingBotToken');
  const btnToggleTokenVisibility = document.getElementById('btnToggleTokenVisibility');
  const settingChatId = document.getElementById('settingChatId');
  const settingTopicId = document.getElementById('settingTopicId');
  const settingDelay = document.getElementById('settingDelay');
  const settingFormat = document.getElementById('settingFormat');
  const settingDisablePreview = document.getElementById('settingDisablePreview');
  const btnTestConnection = document.getElementById('btnTestConnection');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const testConnectionResult = document.getElementById('testConnectionResult');
  const testBtnSpinner = document.getElementById('testBtnSpinner');

  // Toolbar & Filters
  const btnSendAllUnsent = document.getElementById('btnSendAllUnsent');
  const sendAllBtnText = document.getElementById('sendAllBtnText');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const searchInput = document.getElementById('searchInput');
  const countAll = document.getElementById('countAll');
  const countPending = document.getElementById('countPending');
  const countSent = document.getElementById('countSent');

  // Selection Bar
  const selectionBar = document.getElementById('selectionBar');
  const selectedCountText = document.getElementById('selectedCountText');
  const btnSendSelected = document.getElementById('btnSendSelected');
  const btnDeleteSelected = document.getElementById('btnDeleteSelected');

  // Table
  const linksTableBody = document.getElementById('linksTableBody');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const emptyState = document.getElementById('emptyState');
  const noMatchState = document.getElementById('noMatchState');

  // Progress Overlay
  const progressOverlay = document.getElementById('progressOverlay');
  const progressTitle = document.getElementById('progressTitle');
  const progressStep = document.getElementById('progressStep');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressCurrentUrl = document.getElementById('progressCurrentUrl');
  const btnCancelSend = document.getElementById('btnCancelSend');

  // Footer
  const totalCounter = document.getElementById('totalCounter');
  const btnClearSent = document.getElementById('btnClearSent');
  const btnClearAll = document.getElementById('btnClearAll');

  // --- Banner & Notification Helper ---
  let bannerTimer = null;
  function showBanner(message, type = 'info', durationMs = 3500) {
    if (bannerTimer) clearTimeout(bannerTimer);
    alertBanner.textContent = message;
    alertBanner.className = `alert-banner ${type}`;
    alertBanner.classList.remove('hidden');

    if (durationMs > 0) {
      bannerTimer = setTimeout(() => {
        alertBanner.classList.add('hidden');
      }, durationMs);
    }
  }

  function hideBanner() {
    if (bannerTimer) clearTimeout(bannerTimer);
    alertBanner.classList.add('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Initial Data Load ---
  async function init() {
    await loadSettings();
    await fetchActiveTab();
    await loadLinks();
  }

  // --- Active Tab Grabber ---
  async function fetchActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        currentActiveTab = tab;
        activeTabTitle.textContent = tab.title || tab.url;
        activeTabUrl.textContent = tab.url;

        // Check if already in queue
        updateGrabButtonState();
      } else {
        activeTabTitle.textContent = 'No active webpage detected';
        activeTabUrl.textContent = '';
        btnGrabCurrentTab.disabled = true;
      }
    } catch (err) {
      console.warn('Could not query active tab:', err);
      activeTabTitle.textContent = 'Unable to read active tab';
      btnGrabCurrentTab.disabled = true;
    }
  }

  function updateGrabButtonState() {
    if (!currentActiveTab || !currentActiveTab.url) return;
    const exists = allLinks.some(l => l.url.toLowerCase() === currentActiveTab.url.toLowerCase());
    if (exists) {
      grabBtnLabel.textContent = 'Already Saved';
      btnGrabCurrentTab.classList.remove('btn-primary');
      btnGrabCurrentTab.classList.add('btn-secondary');
    } else {
      grabBtnLabel.textContent = 'Grab Tab';
      btnGrabCurrentTab.classList.remove('btn-secondary');
      btnGrabCurrentTab.classList.add('btn-primary');
      btnGrabCurrentTab.disabled = false;
    }
  }

  btnGrabCurrentTab.addEventListener('click', async () => {
    if (!currentActiveTab || !currentActiveTab.url) return;

    try {
      btnGrabCurrentTab.disabled = true;
      const result = await LinkStorage.addLink({
        url: currentActiveTab.url,
        title: currentActiveTab.title || currentActiveTab.url
      });

      if (result.isDuplicate) {
        showBanner(`"${result.item.domain || result.item.url}" is already in your queue.`, 'info');
      } else {
        showBanner(`Saved "${result.item.title || result.item.url}" to queue!`, 'success');
      }

      await loadLinks();
      updateGrabButtonState();
    } catch (err) {
      showBanner(`Error: ${err.message}`, 'error');
    } finally {
      btnGrabCurrentTab.disabled = false;
    }
  });

  // --- Load and Render Links ---
  async function loadLinks() {
    allLinks = await LinkStorage.getLinks();
    updateCounters();
    renderTable();
    updateGrabButtonState();
  }

  function updateCounters() {
    const total = allLinks.length;
    const pending = allLinks.filter(l => l.status === 'pending' || l.status === 'failed').length;
    const sent = allLinks.filter(l => l.status === 'sent').length;

    countAll.textContent = total;
    countPending.textContent = pending;
    countSent.textContent = sent;

    unsentBadgeText.textContent = `${pending} unsent link${pending === 1 ? '' : 's'}`;
    sendAllBtnText.textContent = `Send All Unsent to Telegram (${pending})`;
    totalCounter.textContent = `${total} link${total === 1 ? '' : 's'} total`;

    btnSendAllUnsent.disabled = pending === 0;
  }

  function getFilteredLinks() {
    return allLinks.filter(item => {
      // Filter tab
      if (currentFilter === 'pending' && item.status === 'sent') return false;
      if (currentFilter === 'sent' && item.status !== 'sent') return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesUrl = item.url && item.url.toLowerCase().includes(q);
        const matchesTitle = item.title && item.title.toLowerCase().includes(q);
        const matchesDomain = item.domain && item.domain.toLowerCase().includes(q);
        if (!matchesUrl && !matchesTitle && !matchesDomain) return false;
      }

      return true;
    });
  }

  function renderTable() {
    const filtered = getFilteredLinks();
    linksTableBody.textContent = '';

    // Handle Empty States
    if (allLinks.length === 0) {
      emptyState.classList.remove('hidden');
      noMatchState.classList.add('hidden');
      selectAllCheckbox.disabled = true;
      selectAllCheckbox.checked = false;
      updateSelectionBar();
      return;
    }

    emptyState.classList.add('hidden');

    if (filtered.length === 0) {
      noMatchState.classList.remove('hidden');
      selectAllCheckbox.disabled = true;
      selectAllCheckbox.checked = false;
      updateSelectionBar();
      return;
    }

    noMatchState.classList.add('hidden');
    selectAllCheckbox.disabled = false;

    // Check if all filtered are selected
    const allFilteredSelected = filtered.every(item => selectedIds.has(item.id));
    selectAllCheckbox.checked = filtered.length > 0 && allFilteredSelected;

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      tr.dataset.id = item.id;

      const isChecked = selectedIds.has(item.id);
      const domain = item.domain || 'link';
      const statusClass = item.status === 'sent' ? 'sent' : (item.status === 'failed' ? 'failed' : 'pending');
      const statusLabel = item.status === 'sent' ? 'Sent' : (item.status === 'failed' ? 'Failed' : 'Pending');

      // Checkbox column
      const tdCb = document.createElement('td');
      tdCb.className = 'col-checkbox';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'row-checkbox';
      cb.dataset.id = item.id;
      cb.checked = isChecked;
      tdCb.appendChild(cb);

      // Details column
      const tdDetails = document.createElement('td');
      tdDetails.className = 'col-details';
      const titleDiv = document.createElement('div');
      titleDiv.className = 'link-title-text';
      titleDiv.title = item.title || item.url;
      titleDiv.textContent = item.title || item.url;

      const subRow = document.createElement('div');
      subRow.className = 'link-sub-row';
      const domainBadge = document.createElement('span');
      domainBadge.className = 'link-domain-badge';
      domainBadge.textContent = domain;
      const urlAnchor = document.createElement('a');
      urlAnchor.href = item.url;
      urlAnchor.target = '_blank';
      urlAnchor.className = 'link-url-anchor';
      urlAnchor.title = item.url;
      urlAnchor.textContent = item.url;
      subRow.appendChild(domainBadge);
      subRow.appendChild(urlAnchor);

      tdDetails.appendChild(titleDiv);
      tdDetails.appendChild(subRow);

      // Status column
      const tdStatus = document.createElement('td');
      tdStatus.className = 'col-status';
      const statusSpan = document.createElement('span');
      statusSpan.className = `status-badge ${statusClass}`;
      if (item.errorMessage) statusSpan.title = item.errorMessage;
      statusSpan.textContent = statusLabel;
      tdStatus.appendChild(statusSpan);

      // Actions column
      const tdActions = document.createElement('td');
      tdActions.className = 'col-actions';
      const rowActions = document.createElement('div');
      rowActions.className = 'row-actions';

      const sendBtn = document.createElement('button');
      sendBtn.className = 'action-btn send-btn';
      sendBtn.dataset.action = 'send';
      sendBtn.dataset.id = item.id;
      sendBtn.title = 'Send this link to Telegram bubble';
      sendBtn.textContent = '✈';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete-btn';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.id = item.id;
      deleteBtn.title = 'Delete link';
      deleteBtn.textContent = '🗑';

      rowActions.appendChild(sendBtn);
      rowActions.appendChild(deleteBtn);
      tdActions.appendChild(rowActions);

      tr.appendChild(tdCb);
      tr.appendChild(tdDetails);
      tr.appendChild(tdStatus);
      tr.appendChild(tdActions);

      linksTableBody.appendChild(tr);
    });

    updateSelectionBar();
  }

  // --- Table Event Delegation (Checkbox, Send single, Delete single) ---
  linksTableBody.addEventListener('click', async (e) => {
    const target = e.target.closest('button, input');
    if (!target) return;

    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('row-checkbox')) {
      if (target.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      updateSelectionBar();
      // Update header select-all state
      const filtered = getFilteredLinks();
      selectAllCheckbox.checked = filtered.length > 0 && filtered.every(item => selectedIds.has(item.id));
      return;
    }

    const action = target.dataset.action;
    if (action === 'send') {
      await sendSingleLink(id, target);
    } else if (action === 'delete') {
      await deleteSingleLink(id);
    }
  });

  // Select All Checkbox
  selectAllCheckbox.addEventListener('change', () => {
    const filtered = getFilteredLinks();
    if (selectAllCheckbox.checked) {
      filtered.forEach(item => selectedIds.add(item.id));
    } else {
      filtered.forEach(item => selectedIds.delete(item.id));
    }
    renderTable();
  });

  function updateSelectionBar() {
    const count = selectedIds.size;
    if (count > 0) {
      selectionBar.classList.remove('hidden');
      selectedCountText.textContent = `${count} selected`;
    } else {
      selectionBar.classList.add('hidden');
    }
  }

  // --- Filter Tabs and Search ---
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTable();
    });
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTable();
  });

  // --- Delete Operations ---
  async function deleteSingleLink(id) {
    selectedIds.delete(id);
    await LinkStorage.deleteLink(id);
    await loadLinks();
  }

  btnDeleteSelected.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const confirmDelete = confirm(`Delete ${selectedIds.size} selected link(s)?`);
    if (!confirmDelete) return;

    await LinkStorage.deleteLinks(Array.from(selectedIds));
    selectedIds.clear();
    await loadLinks();
    showBanner('Selected links deleted.', 'info');
  });

  btnClearSent.addEventListener('click', async () => {
    const sentCount = allLinks.filter(l => l.status === 'sent').length;
    if (sentCount === 0) {
      showBanner('No sent links to clear.', 'info');
      return;
    }
    await LinkStorage.clearSentLinks();
    // Clean up selectedIds if any were sent
    selectedIds.clear();
    await loadLinks();
    showBanner(`Cleared ${sentCount} sent link(s).`, 'success');
  });

  btnClearAll.addEventListener('click', async () => {
    if (allLinks.length === 0) return;
    const ok = confirm('Are you sure you want to clear ALL links?');
    if (!ok) return;

    await LinkStorage.clearAllLinks();
    selectedIds.clear();
    await loadLinks();
    showBanner('All links cleared.', 'info');
  });

  // --- Manual Add Link Drawer ---
  btnToggleManualAdd.addEventListener('click', () => {
    manualAddDrawer.classList.toggle('hidden');
    if (!manualAddDrawer.classList.contains('hidden')) {
      settingsDrawer.classList.add('hidden');
      manualInputUrls.focus();
    }
  });

  btnCloseManualAdd.addEventListener('click', () => {
    manualAddDrawer.classList.add('hidden');
  });

  btnAddManualLink.addEventListener('click', async () => {
    const urlsText = manualInputUrls.value.trim();
    const titleText = manualInputTitle.value.trim();

    if (!urlsText) {
      showBanner('Please enter at least one URL.', 'error');
      return;
    }

    try {
      const lines = urlsText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 1) {
        // Single link
        const result = await LinkStorage.addLink({ url: lines[0], title: titleText || lines[0] });
        if (result.isDuplicate) {
          showBanner(`"${result.item.domain || result.item.url}" is already saved.`, 'info');
        } else {
          showBanner('Link added to queue!', 'success');
        }
      } else {
        // Bulk links
        const result = await LinkStorage.addBulkUrls(urlsText);
        showBanner(`Added ${result.added} links (${result.duplicates} duplicates skipped).`, 'success');
      }

      manualInputUrls.value = '';
      manualInputTitle.value = '';
      manualAddDrawer.classList.add('hidden');
      await loadLinks();
    } catch (err) {
      showBanner(`Failed to add: ${err.message}`, 'error');
    }
  });

  // --- Open Full Manager Tab ---
  btnOpenManager.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('manager/manager.html') });
  });

  // --- Settings & Telegram Bot Configuration ---
  async function loadSettings() {
    const settings = await LinkStorage.getSettings();
    settingBotToken.value = settings.botToken || '';
    settingChatId.value = settings.chatId || '';
    settingTopicId.value = settings.topicId || '';
    settingDelay.value = settings.delayMs || 500;
    settingFormat.value = settings.messageFormat || 'url_only';
    settingDisablePreview.checked = Boolean(settings.disablePreview);
  }

  btnToggleSettings.addEventListener('click', () => {
    settingsDrawer.classList.toggle('hidden');
    if (!settingsDrawer.classList.contains('hidden')) {
      manualAddDrawer.classList.add('hidden');
      hideBanner();
    }
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsDrawer.classList.add('hidden');
  });

  btnToggleTokenVisibility.addEventListener('click', () => {
    if (settingBotToken.type === 'password') {
      settingBotToken.type = 'text';
      btnToggleTokenVisibility.textContent = '🔒';
    } else {
      settingBotToken.type = 'password';
      btnToggleTokenVisibility.textContent = '👁️';
    }
  });

  btnSaveSettings.addEventListener('click', async () => {
    const updated = {
      botToken: settingBotToken.value.trim(),
      chatId: settingChatId.value.trim(),
      topicId: settingTopicId.value.trim(),
      delayMs: parseInt(settingDelay.value, 10) || 500,
      messageFormat: settingFormat.value,
      disablePreview: settingDisablePreview.checked
    };

    await LinkStorage.saveSettings(updated);
    showBanner('Telegram settings saved successfully!', 'success');
    settingsDrawer.classList.add('hidden');
  });

  btnTestConnection.addEventListener('click', async () => {
    const token = settingBotToken.value.trim();
    const chatId = settingChatId.value.trim();
    const topicId = settingTopicId.value.trim();

    testConnectionResult.classList.remove('hidden', 'success', 'error');
    testConnectionResult.textContent = 'Testing connection with Telegram...';
    testBtnSpinner.classList.remove('hidden');
    btnTestConnection.disabled = true;

    try {
      const result = await TelegramService.testConnection(token, chatId, topicId);
      if (result.success) {
        testConnectionResult.className = 'test-result success';
        testConnectionResult.textContent = `✓ Connected! Verified bot @${result.botUsername} and sent ping to chat${topicId ? ' (Topic ' + topicId + ')' : ''}.`;
      } else {
        testConnectionResult.className = 'test-result error';
        testConnectionResult.textContent = `✕ Failed: ${result.error}`;
      }
    } catch (err) {
      testConnectionResult.className = 'test-result error';
      testConnectionResult.textContent = `✕ Error: ${err.message || err}`;
    } finally {
      testBtnSpinner.classList.add('hidden');
      btnTestConnection.disabled = false;
    }
  });

  // --- Telegram Sending Logic (Per Bubble) ---
  async function checkCredentials() {
    const settings = await LinkStorage.getSettings();
    if (!settings.botToken || !settings.chatId) {
      settingsDrawer.classList.remove('hidden');
      showBanner('Please enter your Telegram Bot Token and Chat ID first.', 'error', 5000);
      return null;
    }
    return settings;
  }

  // Single Link Send
  async function sendSingleLink(id, buttonEl) {
    const settings = await checkCredentials();
    if (!settings) return;

    const linkItem = allLinks.find(l => l.id === id);
    if (!linkItem) return;

    const origText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = '⏳';

    try {
      const result = await TelegramService.sendSingleBubble(settings.botToken, settings.chatId, linkItem, settings);

      if (result.success) {
        await LinkStorage.markStatus(id, 'sent');
        showBanner(`Sent to Telegram: ${linkItem.domain || linkItem.url}`, 'success');
      } else {
        await LinkStorage.markStatus(id, 'failed', result.error);
        showBanner(`Telegram error: ${result.error}`, 'error', 5000);
      }
      await loadLinks();
    } catch (err) {
      showBanner(`Failed to send: ${err.message}`, 'error');
    } finally {
      buttonEl.textContent = origText;
      buttonEl.disabled = false;
    }
  }

  // Bulk Send (All Unsent or Selected)
  async function startBulkSend(targetItems, label) {
    const settings = await checkCredentials();
    if (!settings) return;

    if (targetItems.length === 0) {
      showBanner('No unsent links to send.', 'info');
      return;
    }

    isSendingActive = true;
    abortSendController = false;

    // Show Progress Overlay
    progressOverlay.classList.remove('hidden');
    progressTitle.textContent = label;
    progressBarFill.style.width = '0%';
    btnCancelSend.disabled = false;

    let successCount = 0;
    let failCount = 0;
    const total = targetItems.length;

    for (let i = 0; i < total; i++) {
      if (abortSendController) {
        showBanner(`Sending stopped by user (${successCount} sent, ${failCount} failed).`, 'info');
        break;
      }

      const item = targetItems[i];
      const stepIndex = i + 1;

      // Update progress UI
      progressStep.textContent = `${stepIndex} / ${total}`;
      const percent = Math.round((i / total) * 100);
      progressBarFill.style.width = `${percent}%`;
      progressCurrentUrl.textContent = `Sending ${item.domain || item.url}...`;

      // Dispatch single message bubble
      const result = await TelegramService.sendSingleBubble(settings.botToken, settings.chatId, item, settings);

      if (result.success) {
        await LinkStorage.markStatus(item.id, 'sent');
        successCount++;
      } else {
        await LinkStorage.markStatus(item.id, 'failed', result.error);
        failCount++;
      }

      // Live update table row state
      await loadLinks();

      // Delay between bubbles to avoid rate-limiting (unless it's the last item or cancelled)
      if (stepIndex < total && !abortSendController) {
        const delay = settings.delayMs || 500;
        await TelegramService.sleep(delay);
      }
    }

    // Finished
    progressBarFill.style.width = '100%';
    progressOverlay.classList.add('hidden');
    isSendingActive = false;

    if (!abortSendController) {
      if (failCount === 0) {
        showBanner(`🎉 All ${successCount} links sent to Telegram!`, 'success', 4500);
      } else {
        showBanner(`Sent ${successCount} links (${failCount} failed. Check red badges for details).`, 'info', 5000);
      }
    }

    selectedIds.clear();
    await loadLinks();
  }

  // Send All Unsent Button
  btnSendAllUnsent.addEventListener('click', async () => {
    if (isSendingActive) return;
    const unsent = allLinks.filter(l => l.status === 'pending' || l.status === 'failed');
    await startBulkSend(unsent, 'Sending All Unsent Links...');
  });

  // Send Selected Button
  btnSendSelected.addEventListener('click', async () => {
    if (isSendingActive) return;
    const selected = allLinks.filter(l => selectedIds.has(l.id));
    await startBulkSend(selected, `Sending ${selected.length} Selected Links...`);
  });

  // Cancel Bulk Send
  btnCancelSend.addEventListener('click', () => {
    abortSendController = true;
    btnCancelSend.disabled = true;
    progressCurrentUrl.textContent = 'Stopping queue...';
  });

  // Initialize
  await init();
});
