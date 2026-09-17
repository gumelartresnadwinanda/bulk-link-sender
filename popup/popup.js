/**
 * Bulk Link Sender - Popup Controller
 * Handles active tab capture, link table rendering, per-bubble Telegram sending,
 * and multi-profile Telegram destination management.
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

  // Profile editing state
  let editingProfileId = null; // null = adding new, string = editing existing

  // DOM Elements
  const unsentBadgeText = document.getElementById('unsentBadgeText');
  const activeTabTitle = document.getElementById('activeTabTitle');
  const activeTabUrl = document.getElementById('activeTabUrl');
  const btnGrabCurrentTab = document.getElementById('btnGrabCurrentTab');
  const grabBtnLabel = document.getElementById('grabBtnLabel');
  const alertBanner = document.getElementById('alertBanner');

  // Drawers
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

  // Profile List Section
  const profileListSection = document.getElementById('profileListSection');
  const profileListContainer = document.getElementById('profileListContainer');
  const btnAddProfile = document.getElementById('btnAddProfile');

  // Profile Edit Form
  const profileEditForm = document.getElementById('profileEditForm');
  const profileEditTitle = document.getElementById('profileEditTitle');
  const btnCancelProfileEdit = document.getElementById('btnCancelProfileEdit');
  const editProfileName = document.getElementById('editProfileName');
  const editBotToken = document.getElementById('editBotToken');
  const btnToggleEditTokenVisibility = document.getElementById('btnToggleEditTokenVisibility');
  const editChatId = document.getElementById('editChatId');
  const editTopicId = document.getElementById('editTopicId');
  const editDelay = document.getElementById('editDelay');
  const editFormat = document.getElementById('editFormat');
  const editDisablePreview = document.getElementById('editDisablePreview');
  const btnTestProfileConnection = document.getElementById('btnTestProfileConnection');
  const testProfileSpinner = document.getElementById('testProfileSpinner');
  const profileTestResult = document.getElementById('profileTestResult');
  const btnSaveProfileEdit = document.getElementById('btnSaveProfileEdit');

  // Profile Selector Dropdown (in toolbar)
  const activeProfileSelect = document.getElementById('activeProfileSelect');

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

  // --- Initial Data Load ---
  async function init() {
    await loadProfiles();
    await fetchActiveTab();
    await loadLinks();
  }

  // ─── Profile Management ─────────────────────────────────────────────────────

  async function loadProfiles() {
    const [profiles, activeId] = await Promise.all([
      LinkStorage.getProfiles(),
      LinkStorage.getActiveProfileId()
    ]);

    // Render the profile selector dropdown
    activeProfileSelect.textContent = '';
    profiles.forEach(profile => {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.name + (profile.chatId ? ` (${profile.chatId})` : '');
      if (profile.id === activeId) opt.selected = true;
      activeProfileSelect.appendChild(opt);
    });

    // Render profile list in the settings drawer
    renderProfileList(profiles, activeId);
  }

  function renderProfileList(profiles, activeId) {
    profileListContainer.textContent = '';

    profiles.forEach(profile => {
      const item = document.createElement('div');
      item.className = 'profile-list-item' + (profile.id === activeId ? ' active' : '');
      item.dataset.id = profile.id;

      const info = document.createElement('div');
      info.className = 'profile-item-info';

      const nameLine = document.createElement('div');
      nameLine.className = 'profile-item-name';
      nameLine.textContent = profile.name;

      const detailLine = document.createElement('div');
      detailLine.className = 'profile-item-detail';
      if (profile.chatId) {
        detailLine.textContent = profile.chatId + (profile.topicId ? ` · Topic ${profile.topicId}` : '');
      } else {
        detailLine.textContent = 'Not configured';
      }

      info.appendChild(nameLine);
      info.appendChild(detailLine);

      const actions = document.createElement('div');
      actions.className = 'profile-item-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'profile-action-btn';
      editBtn.title = 'Edit profile';
      editBtn.dataset.action = 'edit';
      editBtn.dataset.id = profile.id;
      editBtn.textContent = '✏️';

      actions.appendChild(editBtn);

      if (profiles.length > 1) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'profile-action-btn profile-delete-btn';
        deleteBtn.title = 'Delete profile';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.dataset.id = profile.id;
        deleteBtn.textContent = '🗑';
        actions.appendChild(deleteBtn);
      }

      item.appendChild(info);
      item.appendChild(actions);
      profileListContainer.appendChild(item);
    });
  }

  // Profile list click events (edit / delete)
  profileListContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'edit') {
      await openProfileEditForm(id);
    } else if (action === 'delete') {
      const profiles = await LinkStorage.getProfiles();
      const profile = profiles.find(p => p.id === id);
      if (!profile) return;
      if (!confirm(`Delete profile "${profile.name}"?`)) return;
      try {
        await LinkStorage.deleteProfile(id);
        await loadProfiles();
        showBanner(`Profile "${profile.name}" deleted.`, 'info');
      } catch (err) {
        showBanner(err.message, 'error');
      }
    }
  });

  // Active profile dropdown change
  activeProfileSelect.addEventListener('change', async () => {
    const selectedId = activeProfileSelect.value;
    await LinkStorage.setActiveProfileId(selectedId);
    await loadProfiles();
  });

  // Add New Profile button
  btnAddProfile.addEventListener('click', () => {
    openNewProfileForm();
  });

  function openNewProfileForm() {
    editingProfileId = null;
    profileEditTitle.textContent = 'New Profile';
    editProfileName.value = '';
    editBotToken.value = '';
    editBotToken.type = 'password';
    btnToggleEditTokenVisibility.textContent = '👁️';
    editChatId.value = '';
    editTopicId.value = '';
    editDelay.value = 500;
    editFormat.value = 'url_only';
    editDisablePreview.checked = false;
    profileTestResult.className = 'test-result hidden';
    profileTestResult.textContent = '';

    profileListSection.classList.add('hidden');
    profileEditForm.classList.remove('hidden');
  }

  async function openProfileEditForm(id) {
    const profiles = await LinkStorage.getProfiles();
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    editingProfileId = id;
    profileEditTitle.textContent = 'Edit Profile';
    editProfileName.value = profile.name || '';
    editBotToken.value = profile.botToken || '';
    editBotToken.type = 'password';
    btnToggleEditTokenVisibility.textContent = '👁️';
    editChatId.value = profile.chatId || '';
    editTopicId.value = profile.topicId || '';
    editDelay.value = profile.delayMs || 500;
    editFormat.value = profile.messageFormat || 'url_only';
    editDisablePreview.checked = Boolean(profile.disablePreview);
    profileTestResult.className = 'test-result hidden';
    profileTestResult.textContent = '';

    profileListSection.classList.add('hidden');
    profileEditForm.classList.remove('hidden');
  }

  btnCancelProfileEdit.addEventListener('click', () => {
    profileEditForm.classList.add('hidden');
    profileListSection.classList.remove('hidden');
  });

  btnToggleEditTokenVisibility.addEventListener('click', () => {
    if (editBotToken.type === 'password') {
      editBotToken.type = 'text';
      btnToggleEditTokenVisibility.textContent = '🔒';
    } else {
      editBotToken.type = 'password';
      btnToggleEditTokenVisibility.textContent = '👁️';
    }
  });

  btnTestProfileConnection.addEventListener('click', async () => {
    const token = editBotToken.value.trim();
    const chatId = editChatId.value.trim();
    const topicId = editTopicId.value.trim();

    profileTestResult.className = 'test-result';
    profileTestResult.classList.remove('hidden');
    profileTestResult.textContent = 'Testing connection...';
    testProfileSpinner.classList.remove('hidden');
    btnTestProfileConnection.disabled = true;

    try {
      const result = await TelegramService.testConnection(token, chatId, topicId);
      if (result.success) {
        profileTestResult.className = 'test-result success';
        profileTestResult.textContent = `✓ Connected! Bot @${result.botUsername} sent ping${topicId ? ' (Topic ' + topicId + ')' : ''}.`;
      } else {
        profileTestResult.className = 'test-result error';
        profileTestResult.textContent = `✕ Failed: ${result.error}`;
      }
    } catch (err) {
      profileTestResult.className = 'test-result error';
      profileTestResult.textContent = `✕ Error: ${err.message || err}`;
    } finally {
      testProfileSpinner.classList.add('hidden');
      btnTestProfileConnection.disabled = false;
    }
  });

  btnSaveProfileEdit.addEventListener('click', async () => {
    const name = editProfileName.value.trim();
    if (!name) {
      showBanner('Profile name is required.', 'error');
      return;
    }

    const data = {
      name,
      botToken: editBotToken.value.trim(),
      chatId: editChatId.value.trim(),
      topicId: editTopicId.value.trim(),
      delayMs: parseInt(editDelay.value, 10) || 500,
      messageFormat: editFormat.value,
      disablePreview: editDisablePreview.checked
    };

    try {
      if (editingProfileId) {
        await LinkStorage.updateProfile(editingProfileId, data);
        showBanner(`Profile "${name}" saved!`, 'success');
      } else {
        const newProfile = await LinkStorage.addProfile(data);
        // Make the newly created profile active
        await LinkStorage.setActiveProfileId(newProfile.id);
        showBanner(`Profile "${name}" created and set as active!`, 'success');
      }

      await loadProfiles();
      profileEditForm.classList.add('hidden');
      profileListSection.classList.remove('hidden');
    } catch (err) {
      showBanner(`Failed to save: ${err.message}`, 'error');
    }
  });

  // ─── Active Tab Grabber ─────────────────────────────────────────────────────

  async function fetchActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        currentActiveTab = tab;
        activeTabTitle.textContent = tab.title || tab.url;
        activeTabUrl.textContent = tab.url;
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

  // ─── Load and Render Links ───────────────────────────────────────────────────

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
      if (currentFilter === 'pending' && item.status === 'sent') return false;
      if (currentFilter === 'sent' && item.status !== 'sent') return false;

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

  // --- Table Event Delegation ---
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
        const result = await LinkStorage.addLink({ url: lines[0], title: titleText || lines[0] });
        if (result.isDuplicate) {
          showBanner(`"${result.item.domain || result.item.url}" is already saved.`, 'info');
        } else {
          showBanner('Link added to queue!', 'success');
        }
      } else {
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

  // --- Settings Drawer Toggle ---
  btnToggleSettings.addEventListener('click', () => {
    settingsDrawer.classList.toggle('hidden');
    if (!settingsDrawer.classList.contains('hidden')) {
      manualAddDrawer.classList.add('hidden');
      // Always show profile list when opening
      profileEditForm.classList.add('hidden');
      profileListSection.classList.remove('hidden');
      hideBanner();
    }
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsDrawer.classList.add('hidden');
  });

  // ─── Telegram Sending Logic ──────────────────────────────────────────────────

  /** Get the currently selected profile for sending */
  async function getActiveProfile() {
    const profile = await LinkStorage.getActiveProfile();
    if (!profile || !profile.botToken || !profile.chatId) {
      settingsDrawer.classList.remove('hidden');
      profileEditForm.classList.add('hidden');
      profileListSection.classList.remove('hidden');
      showBanner('Please configure a Telegram profile with Bot Token and Chat ID first.', 'error', 5000);
      return null;
    }
    return profile;
  }

  // Single Link Send
  async function sendSingleLink(id, buttonEl) {
    const profile = await getActiveProfile();
    if (!profile) return;

    const linkItem = allLinks.find(l => l.id === id);
    if (!linkItem) return;

    const origText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = '⏳';

    try {
      const result = await TelegramService.sendSingleBubble(profile.botToken, profile.chatId, linkItem, profile);

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
    const profile = await getActiveProfile();
    if (!profile) return;

    if (targetItems.length === 0) {
      showBanner('No unsent links to send.', 'info');
      return;
    }

    isSendingActive = true;
    abortSendController = false;

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

      progressStep.textContent = `${stepIndex} / ${total}`;
      const percent = Math.round((i / total) * 100);
      progressBarFill.style.width = `${percent}%`;
      progressCurrentUrl.textContent = `Sending ${item.domain || item.url}...`;

      const result = await TelegramService.sendSingleBubble(profile.botToken, profile.chatId, item, profile);

      if (result.success) {
        await LinkStorage.markStatus(item.id, 'sent');
        successCount++;
      } else {
        await LinkStorage.markStatus(item.id, 'failed', result.error);
        failCount++;
      }

      await loadLinks();

      if (stepIndex < total && !abortSendController) {
        const delay = profile.delayMs || 500;
        await TelegramService.sleep(delay);
      }
    }

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
