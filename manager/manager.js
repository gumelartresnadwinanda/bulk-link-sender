/**
 * Bulk Link Sender - Dashboard & Manager Controller
 * Includes multi-profile Telegram destination management.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let allLinks = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let selectedIds = new Set();
  let isSendingActive = false;
  let abortSend = false;

  // Profile editing state
  let mgrEditingProfileId = null; // null = new, string = existing

  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const sidebarPendingBadge = document.getElementById('sidebarPendingBadge');
  const sidebarBotStatus = document.getElementById('sidebarBotStatus');
  const botStatusText = document.getElementById('botStatusText');
  const managerAlert = document.getElementById('managerAlert');

  // Stats
  const statTotal = document.getElementById('statTotal');
  const statPending = document.getElementById('statPending');
  const statSent = document.getElementById('statSent');

  // Table & Controls
  const managerTableBody = document.getElementById('managerTableBody');
  const managerSelectAll = document.getElementById('managerSelectAll');
  const managerEmptyState = document.getElementById('managerEmptyState');
  const managerSearch = document.getElementById('managerSearch');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const btnManagerSendAll = document.getElementById('btnManagerSendAll');
  const btnManagerSendAllText = document.getElementById('btnManagerSendAllText');
  const btnExportMenu = document.getElementById('btnExportMenu');

  // Profile selector (in links action bar)
  const mgrActiveProfileSelect = document.getElementById('mgrActiveProfileSelect');

  // Multi-selection bar
  const managerSelectionBar = document.getElementById('managerSelectionBar');
  const managerSelectedText = document.getElementById('managerSelectedText');
  const btnSendSelectedBatch = document.getElementById('btnSendSelectedBatch');
  const btnMarkSentBatch = document.getElementById('btnMarkSentBatch');
  const btnMarkUnsentBatch = document.getElementById('btnMarkUnsentBatch');
  const btnDeleteSelectedBatch = document.getElementById('btnDeleteSelectedBatch');

  // Import View
  const importTextarea = document.getElementById('importTextarea');
  const btnRunImport = document.getElementById('btnRunImport');
  const importFeedback = document.getElementById('importFeedback');

  // Profiles View
  const btnMgrAddProfile = document.getElementById('btnMgrAddProfile');
  const mgrProfileList = document.getElementById('mgrProfileList');
  const mgrProfileEditCard = document.getElementById('mgrProfileEditCard');
  const mgrProfileEditTitle = document.getElementById('mgrProfileEditTitle');
  const btnMgrCancelProfileEdit = document.getElementById('btnMgrCancelProfileEdit');
  const mgrEditProfileName = document.getElementById('mgrEditProfileName');
  const mgrEditBotToken = document.getElementById('mgrEditBotToken');
  const mgrEditChatId = document.getElementById('mgrEditChatId');
  const mgrEditTopicId = document.getElementById('mgrEditTopicId');
  const mgrEditDelay = document.getElementById('mgrEditDelay');
  const mgrEditFormat = document.getElementById('mgrEditFormat');
  const mgrEditDisablePreview = document.getElementById('mgrEditDisablePreview');
  const mgrEditSilent = document.getElementById('mgrEditSilent');
  const btnMgrTestProfilePing = document.getElementById('btnMgrTestProfilePing');
  const mgrProfileTestSpinner = document.getElementById('mgrProfileTestSpinner');
  const mgrProfileTestResult = document.getElementById('mgrProfileTestResult');
  const btnMgrSaveProfile = document.getElementById('btnMgrSaveProfile');

  // Progress Overlay
  const mgrProgressOverlay = document.getElementById('mgrProgressOverlay');
  const mgrProgressTitle = document.getElementById('mgrProgressTitle');
  const mgrProgressStep = document.getElementById('mgrProgressStep');
  const mgrProgressBarFill = document.getElementById('mgrProgressBarFill');
  const mgrProgressCurrentUrl = document.getElementById('mgrProgressCurrentUrl');
  const btnMgrStopSend = document.getElementById('btnMgrStopSend');

  // ─── Banner Helper ───────────────────────────────────────────────────────────
  let alertTimer = null;
  function showAlert(msg, type = 'info', duration = 4000) {
    if (alertTimer) clearTimeout(alertTimer);
    managerAlert.textContent = msg;
    managerAlert.className = `alert-banner ${type}`;
    managerAlert.classList.remove('hidden');

    if (duration > 0) {
      alertTimer = setTimeout(() => {
        managerAlert.classList.add('hidden');
      }, duration);
    }
  }

  function formatDate(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ─── View Switching ──────────────────────────────────────────────────────────
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      navItems.forEach(n => n.classList.remove('active'));
      viewPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(viewId);
      if (targetPanel) targetPanel.classList.add('active');

      // When switching to profiles view, refresh it
      if (viewId === 'profiles-view') {
        loadProfiles();
      }
    });
  });

  // ─── Initial Load ────────────────────────────────────────────────────────────
  async function init() {
    await loadProfiles();
    await loadLinks();
    await checkBotHealth();
  }

  async function checkBotHealth() {
    const profile = await LinkStorage.getActiveProfile();
    if (profile && profile.botToken && profile.chatId) {
      sidebarBotStatus.className = 'bot-status-card connected';
      botStatusText.textContent = `Profile: ${profile.name}`;
    } else {
      sidebarBotStatus.className = 'bot-status-card';
      botStatusText.textContent = 'No profile configured';
    }
  }

  // ─── Profile Management ──────────────────────────────────────────────────────

  async function loadProfiles() {
    const [profiles, activeId] = await Promise.all([
      LinkStorage.getProfiles(),
      LinkStorage.getActiveProfileId()
    ]);

    // Update profile selector dropdown (in links action bar)
    mgrActiveProfileSelect.textContent = '';
    profiles.forEach(profile => {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.name + (profile.chatId ? ` (${profile.chatId})` : '');
      if (profile.id === activeId) opt.selected = true;
      mgrActiveProfileSelect.appendChild(opt);
    });

    // Update profile cards list
    renderProfileCards(profiles, activeId);
  }

  function renderProfileCards(profiles, activeId) {
    mgrProfileList.textContent = '';

    if (profiles.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-desc';
      empty.textContent = 'No profiles yet. Add one to start sending links.';
      mgrProfileList.appendChild(empty);
      return;
    }

    profiles.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'mgr-profile-card' + (profile.id === activeId ? ' active' : '');
      card.dataset.id = profile.id;

      const cardInfo = document.createElement('div');
      cardInfo.className = 'mgr-profile-card-info';

      const nameBadgeRow = document.createElement('div');
      nameBadgeRow.className = 'mgr-profile-name-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'mgr-profile-card-name';
      nameEl.textContent = profile.name;

      if (profile.id === activeId) {
        const activeBadge = document.createElement('span');
        activeBadge.className = 'mgr-active-badge';
        activeBadge.textContent = 'Active';
        nameBadgeRow.appendChild(nameEl);
        nameBadgeRow.appendChild(activeBadge);
      } else {
        nameBadgeRow.appendChild(nameEl);
      }

      const detailEl = document.createElement('div');
      detailEl.className = 'mgr-profile-card-detail';

      if (profile.botToken && profile.chatId) {
        detailEl.textContent = `Chat: ${profile.chatId}${profile.topicId ? ' · Topic ' + profile.topicId : ''}`;
      } else {
        detailEl.textContent = 'Not configured — click Edit to add credentials';
      }

      cardInfo.appendChild(nameBadgeRow);
      cardInfo.appendChild(detailEl);

      const cardActions = document.createElement('div');
      cardActions.className = 'mgr-profile-card-actions';

      if (profile.id !== activeId) {
        const setActiveBtn = document.createElement('button');
        setActiveBtn.className = 'btn btn-secondary btn-sm';
        setActiveBtn.dataset.action = 'setactive';
        setActiveBtn.dataset.id = profile.id;
        setActiveBtn.textContent = 'Set Active';
        cardActions.appendChild(setActiveBtn);
      }

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.dataset.action = 'edit';
      editBtn.dataset.id = profile.id;
      editBtn.textContent = 'Edit';
      cardActions.appendChild(editBtn);

      if (profiles.length > 1) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-sm';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.dataset.id = profile.id;
        deleteBtn.textContent = 'Delete';
        cardActions.appendChild(deleteBtn);
      }

      card.appendChild(cardInfo);
      card.appendChild(cardActions);
      mgrProfileList.appendChild(card);
    });
  }

  // Profile card action delegation
  mgrProfileList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'edit') {
      await openMgrProfileEditForm(id);
    } else if (action === 'delete') {
      const profiles = await LinkStorage.getProfiles();
      const profile = profiles.find(p => p.id === id);
      if (!profile) return;
      if (!confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) return;
      try {
        await LinkStorage.deleteProfile(id);
        await loadProfiles();
        await checkBotHealth();
        showAlert(`Profile "${profile.name}" deleted.`, 'info');
      } catch (err) {
        showAlert(err.message, 'error');
      }
    } else if (action === 'setactive') {
      await LinkStorage.setActiveProfileId(id);
      await loadProfiles();
      await checkBotHealth();
    }
  });

  // Active profile dropdown change (links view)
  mgrActiveProfileSelect.addEventListener('change', async () => {
    const selectedId = mgrActiveProfileSelect.value;
    await LinkStorage.setActiveProfileId(selectedId);
    await loadProfiles();
    await checkBotHealth();
  });

  // Add New Profile button
  btnMgrAddProfile.addEventListener('click', () => {
    openMgrNewProfileForm();
  });

  function openMgrNewProfileForm() {
    mgrEditingProfileId = null;
    mgrProfileEditTitle.textContent = 'New Profile';
    mgrEditProfileName.value = '';
    mgrEditBotToken.value = '';
    mgrEditChatId.value = '';
    mgrEditTopicId.value = '';
    mgrEditDelay.value = 500;
    mgrEditFormat.value = 'url_only';
    mgrEditDisablePreview.checked = false;
    mgrEditSilent.checked = false;
    mgrProfileTestResult.className = 'test-result hidden';
    mgrProfileTestResult.textContent = '';

    mgrProfileEditCard.classList.remove('hidden');
    mgrProfileEditCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function openMgrProfileEditForm(id) {
    const profiles = await LinkStorage.getProfiles();
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    mgrEditingProfileId = id;
    mgrProfileEditTitle.textContent = `Edit: ${profile.name}`;
    mgrEditProfileName.value = profile.name || '';
    mgrEditBotToken.value = profile.botToken || '';
    mgrEditChatId.value = profile.chatId || '';
    mgrEditTopicId.value = profile.topicId || '';
    mgrEditDelay.value = profile.delayMs || 500;
    mgrEditFormat.value = profile.messageFormat || 'url_only';
    mgrEditDisablePreview.checked = Boolean(profile.disablePreview);
    mgrEditSilent.checked = Boolean(profile.silentNotification);
    mgrProfileTestResult.className = 'test-result hidden';
    mgrProfileTestResult.textContent = '';

    mgrProfileEditCard.classList.remove('hidden');
    mgrProfileEditCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  btnMgrCancelProfileEdit.addEventListener('click', () => {
    mgrProfileEditCard.classList.add('hidden');
  });

  btnMgrTestProfilePing.addEventListener('click', async () => {
    const token = mgrEditBotToken.value.trim();
    const chatId = mgrEditChatId.value.trim();
    const topicId = mgrEditTopicId.value.trim();

    mgrProfileTestResult.classList.remove('hidden', 'success', 'error');
    mgrProfileTestResult.className = 'test-result';
    mgrProfileTestResult.textContent = 'Testing connection with Telegram...';
    mgrProfileTestSpinner.classList.remove('hidden');
    btnMgrTestProfilePing.disabled = true;

    try {
      const result = await TelegramService.testConnection(token, chatId, topicId);
      if (result.success) {
        mgrProfileTestResult.className = 'test-result success';
        mgrProfileTestResult.textContent = `✓ Connection verified! Bot @${result.botUsername} sent ping to chat ${chatId}${topicId ? ' (Topic ' + topicId + ')' : ''}.`;
      } else {
        mgrProfileTestResult.className = 'test-result error';
        mgrProfileTestResult.textContent = `✕ Connection test failed: ${result.error}`;
      }
    } catch (err) {
      mgrProfileTestResult.className = 'test-result error';
      mgrProfileTestResult.textContent = `✕ Error: ${err.message || err}`;
    } finally {
      mgrProfileTestSpinner.classList.add('hidden');
      btnMgrTestProfilePing.disabled = false;
    }
  });

  btnMgrSaveProfile.addEventListener('click', async () => {
    const name = mgrEditProfileName.value.trim();
    if (!name) {
      showAlert('Profile name is required.', 'error');
      return;
    }

    const data = {
      name,
      botToken: mgrEditBotToken.value.trim(),
      chatId: mgrEditChatId.value.trim(),
      topicId: mgrEditTopicId.value.trim(),
      delayMs: parseInt(mgrEditDelay.value, 10) || 500,
      messageFormat: mgrEditFormat.value,
      disablePreview: mgrEditDisablePreview.checked,
      silentNotification: mgrEditSilent.checked
    };

    try {
      if (mgrEditingProfileId) {
        await LinkStorage.updateProfile(mgrEditingProfileId, data);
        showAlert(`Profile "${name}" updated successfully!`, 'success');
      } else {
        const newProfile = await LinkStorage.addProfile(data);
        await LinkStorage.setActiveProfileId(newProfile.id);
        showAlert(`Profile "${name}" created and set as active!`, 'success');
      }

      mgrProfileEditCard.classList.add('hidden');
      await loadProfiles();
      await checkBotHealth();
    } catch (err) {
      showAlert(`Failed to save: ${err.message}`, 'error');
    }
  });

  // ─── Links ───────────────────────────────────────────────────────────────────

  async function loadLinks() {
    allLinks = await LinkStorage.getLinks();
    updateStats();
    renderTable();
  }

  function updateStats() {
    const total = allLinks.length;
    const pending = allLinks.filter(l => l.status === 'pending' || l.status === 'failed').length;
    const sent = allLinks.filter(l => l.status === 'sent').length;

    statTotal.textContent = total;
    statPending.textContent = pending;
    statSent.textContent = sent;
    sidebarPendingBadge.textContent = pending;

    btnManagerSendAllText.textContent = `Send All Unsent (${pending})`;
    btnManagerSendAll.disabled = pending === 0;
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
    managerTableBody.textContent = '';

    if (filtered.length === 0) {
      managerEmptyState.classList.remove('hidden');
      managerSelectAll.disabled = true;
      managerSelectAll.checked = false;
      updateSelectionBar();
      return;
    }

    managerEmptyState.classList.add('hidden');
    managerSelectAll.disabled = false;

    const allFilteredSelected = filtered.every(item => selectedIds.has(item.id));
    managerSelectAll.checked = filtered.length > 0 && allFilteredSelected;

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      tr.dataset.id = item.id;

      const isChecked = selectedIds.has(item.id);
      const statusClass = item.status === 'sent' ? 'sent' : (item.status === 'failed' ? 'failed' : 'pending');
      const statusLabel = item.status === 'sent' ? 'Sent' : (item.status === 'failed' ? 'Failed' : 'Pending');

      // Checkbox
      const tdCb = document.createElement('td');
      tdCb.className = 'th-cb';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'mgr-checkbox';
      cb.dataset.id = item.id;
      cb.checked = isChecked;
      tdCb.appendChild(cb);

      // Domain
      const tdDomain = document.createElement('td');
      tdDomain.className = 'th-domain';
      const domainTag = document.createElement('span');
      domainTag.className = 'cell-domain-tag';
      domainTag.textContent = item.domain || 'web';
      tdDomain.appendChild(domainTag);

      // Title & URL
      const tdTitle = document.createElement('td');
      tdTitle.className = 'th-title';
      const titleDiv = document.createElement('div');
      titleDiv.className = 'cell-title-text';
      titleDiv.title = item.title || item.url;
      titleDiv.textContent = item.title || item.url;
      const urlAnchor = document.createElement('a');
      urlAnchor.href = item.url;
      urlAnchor.target = '_blank';
      urlAnchor.className = 'cell-url-anchor';
      urlAnchor.title = item.url;
      urlAnchor.textContent = item.url;
      tdTitle.appendChild(titleDiv);
      tdTitle.appendChild(urlAnchor);

      // Status
      const tdStatus = document.createElement('td');
      tdStatus.className = 'th-status';
      const statusPill = document.createElement('span');
      statusPill.className = `status-pill ${statusClass}`;
      if (item.errorMessage) statusPill.title = item.errorMessage;
      statusPill.textContent = statusLabel;
      tdStatus.appendChild(statusPill);

      // Date
      const tdDate = document.createElement('td');
      tdDate.className = 'th-date';
      const dateSpan = document.createElement('span');
      dateSpan.className = 'cell-date-text';
      dateSpan.textContent = formatDate(item.addedAt);
      tdDate.appendChild(dateSpan);

      // Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'th-actions';
      const actionsCell = document.createElement('div');
      actionsCell.className = 'table-actions-cell';

      const sendBtn = document.createElement('button');
      sendBtn.className = 'icon-btn-action send-action';
      sendBtn.dataset.action = 'send';
      sendBtn.dataset.id = item.id;
      sendBtn.title = 'Send bubble to Telegram';
      sendBtn.textContent = '✈';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn-action delete-action';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.id = item.id;
      deleteBtn.title = 'Delete link';
      deleteBtn.textContent = '🗑';

      actionsCell.appendChild(sendBtn);
      actionsCell.appendChild(deleteBtn);
      tdActions.appendChild(actionsCell);

      tr.appendChild(tdCb);
      tr.appendChild(tdDomain);
      tr.appendChild(tdTitle);
      tr.appendChild(tdStatus);
      tr.appendChild(tdDate);
      tr.appendChild(tdActions);

      managerTableBody.appendChild(tr);
    });

    updateSelectionBar();
  }

  // Checkbox interactions
  managerTableBody.addEventListener('click', async (e) => {
    const target = e.target.closest('button, input');
    if (!target) return;

    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('mgr-checkbox')) {
      if (target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateSelectionBar();

      const filtered = getFilteredLinks();
      managerSelectAll.checked = filtered.length > 0 && filtered.every(item => selectedIds.has(item.id));
      return;
    }

    const action = target.dataset.action;
    if (action === 'send') {
      await sendSingleLink(id, target);
    } else if (action === 'delete') {
      await deleteSingleLink(id);
    }
  });

  managerSelectAll.addEventListener('change', () => {
    const filtered = getFilteredLinks();
    if (managerSelectAll.checked) {
      filtered.forEach(item => selectedIds.add(item.id));
    } else {
      filtered.forEach(item => selectedIds.delete(item.id));
    }
    renderTable();
  });

  function updateSelectionBar() {
    const count = selectedIds.size;
    if (count > 0) {
      managerSelectionBar.classList.remove('hidden');
      managerSelectedText.textContent = `${count} link(s) selected`;
    } else {
      managerSelectionBar.classList.add('hidden');
    }
  }

  // Filter tabs & Search
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  managerSearch.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTable();
  });

  // ─── Sending ─────────────────────────────────────────────────────────────────

  async function getActiveProfile() {
    const profile = await LinkStorage.getActiveProfile();
    if (!profile || !profile.botToken || !profile.chatId) {
      showAlert('Please configure a Telegram profile with Bot Token and Chat ID first. Go to Telegram Profiles.', 'error', 6000);
      return null;
    }
    return profile;
  }

  async function deleteSingleLink(id) {
    selectedIds.delete(id);
    await LinkStorage.deleteLink(id);
    await loadLinks();
  }

  async function sendSingleLink(id, buttonEl) {
    const profile = await getActiveProfile();
    if (!profile) return;

    const item = allLinks.find(l => l.id === id);
    if (!item) return;

    buttonEl.disabled = true;
    const origText = buttonEl.textContent;
    buttonEl.textContent = '⏳';

    try {
      const result = await TelegramService.sendSingleBubble(profile.botToken, profile.chatId, item, profile);
      if (result.success) {
        await LinkStorage.markStatus(id, 'sent');
        showAlert(`Sent bubble: ${item.domain || item.url}`, 'success');
      } else {
        await LinkStorage.markStatus(id, 'failed', result.error);
        showAlert(`Telegram error: ${result.error}`, 'error');
      }
      await loadLinks();
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'error');
    } finally {
      buttonEl.textContent = origText;
      buttonEl.disabled = false;
    }
  }

  // Batch actions
  btnDeleteSelectedBatch.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} link(s)?`)) return;

    await LinkStorage.deleteLinks(Array.from(selectedIds));
    selectedIds.clear();
    await loadLinks();
    showAlert('Selected links deleted.', 'info');
  });

  btnMarkSentBatch.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await LinkStorage.markStatus(id, 'sent');
    }
    selectedIds.clear();
    await loadLinks();
    showAlert('Marked selected links as sent.', 'success');
  });

  btnMarkUnsentBatch.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await LinkStorage.markStatus(id, 'pending');
    }
    selectedIds.clear();
    await loadLinks();
    showAlert('Marked selected links as pending.', 'info');
  });

  // Bulk Sending Engine
  async function runBulkSend(items, title) {
    const profile = await getActiveProfile();
    if (!profile) return;

    if (items.length === 0) {
      showAlert('No links to send.', 'info');
      return;
    }

    const targetIds = items.map(item => item.id);
    chrome.runtime.sendMessage({ type: 'START_BULK_SEND', targetIds, title }, (response) => {
      if (response && response.success) {
        isSendingActive = true;
      } else {
        showAlert(`Failed to start: ${response?.error || 'Unknown'}`, 'error');
      }
    });
  }
  
  // Handle Background Progress Messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'BULK_SEND_PROGRESS' && msg.status) {
      const s = msg.status;
      isSendingActive = true;
      mgrProgressOverlay.classList.remove('hidden');
      mgrProgressTitle.textContent = s.title || 'Sending to Telegram...';
      mgrProgressStep.textContent = `${s.currentIdx} / ${s.total}`;
      const pct = Math.round((s.currentIdx / s.total) * 100);
      mgrProgressBarFill.style.width = `${pct}%`;
      mgrProgressCurrentUrl.textContent = `Sending ${s.currentUrl}...`;
      btnMgrStopSend.disabled = false;
      loadLinks(); // Refresh table
    } else if (msg.type === 'BULK_SEND_FINISHED') {
      isSendingActive = false;
      mgrProgressOverlay.classList.add('hidden');
      const s = msg.status;
      if (!msg.aborted) {
        showAlert(`Bulk send complete: ${s.successCount} sent, ${s.failCount} failed.`, s.successCount > 0 ? 'success' : 'error');
      } else {
        showAlert(`Queue paused (${s.successCount} sent, ${s.failCount} failed).`, 'info');
      }
      selectedIds.clear();
      loadLinks();
    }
  });

  // Check on load if background sending is active
  async function checkBackgroundStatus() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_SEND_STATUS' }, (response) => {
        if (response && response.status && response.status.active) {
          const s = response.status;
          isSendingActive = true;
          mgrProgressOverlay.classList.remove('hidden');
          mgrProgressTitle.textContent = s.title || 'Sending to Telegram...';
          mgrProgressStep.textContent = `${s.currentIdx} / ${s.total}`;
          const pct = s.total > 0 ? Math.round((s.currentIdx / s.total) * 100) : 0;
          mgrProgressBarFill.style.width = `${pct}%`;
          mgrProgressCurrentUrl.textContent = `Sending ${s.currentUrl}...`;
        }
        resolve();
      });
    });
  }

  btnManagerSendAll.addEventListener('click', async () => {
    if (isSendingActive) return;
    const unsent = allLinks.filter(l => l.status === 'pending' || l.status === 'failed');
    await runBulkSend(unsent, 'Sending All Unsent Links to Telegram...');
  });

  btnSendSelectedBatch.addEventListener('click', async () => {
    if (isSendingActive) return;
    const selected = allLinks.filter(l => selectedIds.has(l.id));
    await runBulkSend(selected, `Sending ${selected.length} Selected Links...`);
  });

  btnMgrStopSend.addEventListener('click', () => {
    btnMgrStopSend.disabled = true;
    mgrProgressCurrentUrl.textContent = 'Stopping queue...';
    chrome.runtime.sendMessage({ type: 'STOP_BULK_SEND' });
  });

  // ─── Export to CSV ───────────────────────────────────────────────────────────
  btnExportMenu.addEventListener('click', () => {
    if (allLinks.length === 0) {
      showAlert('No links to export.', 'info');
      return;
    }

    const headers = ['Title', 'URL', 'Domain', 'Status', 'AddedDate', 'SentDate'];
    const rows = allLinks.map(l => [
      `"${(l.title || '').replace(/"/g, '""')}"`,
      `"${(l.url || '').replace(/"/g, '""')}"`,
      `"${(l.domain || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${l.addedAt ? new Date(l.addedAt).toISOString() : ''}"`,
      `"${l.sentAt ? new Date(l.sentAt).toISOString() : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `telegram-links-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('Links exported to CSV file!', 'success');
  });

  // ─── Bulk Import ─────────────────────────────────────────────────────────────
  btnRunImport.addEventListener('click', async () => {
    const text = importTextarea.value.trim();
    if (!text) {
      showAlert('Please enter or paste at least one URL.', 'error');
      return;
    }

    btnRunImport.disabled = true;
    try {
      const result = await LinkStorage.addBulkUrls(text);
      importFeedback.classList.remove('hidden');
      importFeedback.textContent = `✓ Successfully imported ${result.added} new link(s). Skipped ${result.duplicates} duplicate(s).`;
      importTextarea.value = '';
      await loadLinks();
    } catch (err) {
      showAlert(`Import error: ${err.message}`, 'error');
    } finally {
      btnRunImport.disabled = false;
    }
  });

  // Run initialization
  const originalInit = init;
  init = async () => {
    await originalInit();
    await checkBackgroundStatus();
  };
  await init();
});
