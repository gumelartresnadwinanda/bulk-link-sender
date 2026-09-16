/**
 * Bulk Link Sender - Dashboard & Manager Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let allLinks = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let selectedIds = new Set();
  let isSendingActive = false;
  let abortSend = false;

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

  // Settings View
  const mgrBotToken = document.getElementById('mgrBotToken');
  const mgrChatId = document.getElementById('mgrChatId');
  const mgrTopicId = document.getElementById('mgrTopicId');
  const mgrDelay = document.getElementById('mgrDelay');
  const mgrFormat = document.getElementById('mgrFormat');
  const mgrDisablePreview = document.getElementById('mgrDisablePreview');
  const mgrSilent = document.getElementById('mgrSilent');
  const btnMgrTestPing = document.getElementById('btnMgrTestPing');
  const btnMgrSaveSettings = document.getElementById('btnMgrSaveSettings');
  const mgrTestSpinner = document.getElementById('mgrTestSpinner');
  const mgrTestResult = document.getElementById('mgrTestResult');

  // Progress Overlay
  const mgrProgressOverlay = document.getElementById('mgrProgressOverlay');
  const mgrProgressTitle = document.getElementById('mgrProgressTitle');
  const mgrProgressStep = document.getElementById('mgrProgressStep');
  const mgrProgressBarFill = document.getElementById('mgrProgressBarFill');
  const mgrProgressCurrentUrl = document.getElementById('mgrProgressCurrentUrl');
  const btnMgrStopSend = document.getElementById('btnMgrStopSend');

  // Banner Helper
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // --- View Switching ---
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      navItems.forEach(n => n.classList.remove('active'));
      viewPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(viewId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // --- Initial Load ---
  async function init() {
    await loadSettings();
    await loadLinks();
    await checkBotHealth();
  }

  async function checkBotHealth() {
    const settings = await LinkStorage.getSettings();
    if (settings.botToken && settings.chatId) {
      sidebarBotStatus.className = 'bot-status-card connected';
      botStatusText.textContent = 'Telegram Configured';
    } else {
      sidebarBotStatus.className = 'bot-status-card';
      botStatusText.textContent = 'Telegram Not Configured';
    }
  }

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
    managerTableBody.innerHTML = '';

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

      tr.innerHTML = `
        <td class="th-cb">
          <input type="checkbox" class="mgr-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="th-domain">
          <span class="cell-domain-tag">${escapeHtml(item.domain || 'web')}</span>
        </td>
        <td class="th-title">
          <div class="cell-title-text" title="${escapeHtml(item.title)}">${escapeHtml(item.title || item.url)}</div>
          <a href="${escapeHtml(item.url)}" target="_blank" class="cell-url-anchor" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a>
        </td>
        <td class="th-status">
          <span class="status-pill ${statusClass}" title="${escapeHtml(item.errorMessage || '')}">${statusLabel}</span>
        </td>
        <td class="th-date">
          <span class="cell-date-text">${formatDate(item.addedAt)}</span>
        </td>
        <td class="th-actions">
          <div class="table-actions-cell">
            <button class="icon-btn-action send-action" data-action="send" data-id="${item.id}" title="Send bubble to Telegram">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.6 3.4a1.8 1.8 0 0 0-1.9-.3L2.8 10.4c-.9.4-1 1.6-.2 2.1l4.8 2.5 1.9 5.8c.2.6.9 1 1.5.8.5-.1.8-.4 1-.8l2.6-3.2 4.9 3.6c.7.5 1.7.2 2-.6l3.5-15.6c.2-.8-.2-1.4-.7-1.6z"/>
              </svg>
            </button>
            <button class="icon-btn-action delete-action" data-action="delete" data-id="${item.id}" title="Delete link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      `;

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

  // Actions on single link
  async function deleteSingleLink(id) {
    selectedIds.delete(id);
    await LinkStorage.deleteLink(id);
    await loadLinks();
  }

  async function sendSingleLink(id, buttonEl) {
    const settings = await LinkStorage.getSettings();
    if (!settings.botToken || !settings.chatId) {
      showAlert('Please configure Bot Token and Chat ID in Settings first.', 'error');
      return;
    }

    const item = allLinks.find(l => l.id === id);
    if (!item) return;

    buttonEl.disabled = true;
    const origHtml = buttonEl.innerHTML;
    buttonEl.innerHTML = '<span class="spinner"></span>';

    try {
      const result = await TelegramService.sendSingleBubble(settings.botToken, settings.chatId, item, settings);
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
      buttonEl.innerHTML = origHtml;
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
    const settings = await LinkStorage.getSettings();
    if (!settings.botToken || !settings.chatId) {
      showAlert('Please configure Telegram Bot Token and Chat ID in Settings first.', 'error');
      return;
    }

    if (items.length === 0) {
      showAlert('No links to send.', 'info');
      return;
    }

    isSendingActive = true;
    abortSend = false;

    mgrProgressOverlay.classList.remove('hidden');
    mgrProgressTitle.textContent = title;
    mgrProgressBarFill.style.width = '0%';
    btnMgrStopSend.disabled = false;

    let successCount = 0;
    let failCount = 0;
    const total = items.length;

    for (let i = 0; i < total; i++) {
      if (abortSend) {
        showAlert(`Queue paused (${successCount} sent, ${failCount} failed).`, 'info');
        break;
      }

      const item = items[i];
      const step = i + 1;

      mgrProgressStep.textContent = `${step} / ${total}`;
      const pct = Math.round((i / total) * 100);
      mgrProgressBarFill.style.width = `${pct}%`;
      mgrProgressCurrentUrl.textContent = `Sending ${item.domain || item.url}...`;

      const result = await TelegramService.sendSingleBubble(settings.botToken, settings.chatId, item, settings);
      if (result.success) {
        await LinkStorage.markStatus(item.id, 'sent');
        successCount++;
      } else {
        await LinkStorage.markStatus(item.id, 'failed', result.error);
        failCount++;
      }

      await loadLinks();

      if (step < total && !abortSend) {
        const delay = settings.delayMs || 500;
        await TelegramService.sleep(delay);
      }
    }

    mgrProgressBarFill.style.width = '100%';
    mgrProgressOverlay.classList.add('hidden');
    isSendingActive = false;

    if (!abortSend) {
      showAlert(`Bulk send complete: ${successCount} sent, ${failCount} failed.`, successCount > 0 ? 'success' : 'error');
    }

    selectedIds.clear();
    await loadLinks();
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
    abortSend = true;
    btnMgrStopSend.disabled = true;
    mgrProgressCurrentUrl.textContent = 'Stopping queue...';
  });

  // Export to CSV
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

  // Bulk Import
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

  // Settings
  async function loadSettings() {
    const s = await LinkStorage.getSettings();
    mgrBotToken.value = s.botToken || '';
    mgrChatId.value = s.chatId || '';
    mgrTopicId.value = s.topicId || '';
    mgrDelay.value = s.delayMs || 500;
    mgrFormat.value = s.messageFormat || 'url_only';
    mgrDisablePreview.checked = Boolean(s.disablePreview);
    mgrSilent.checked = Boolean(s.silentNotification);
  }

  btnMgrSaveSettings.addEventListener('click', async () => {
    const updated = {
      botToken: mgrBotToken.value.trim(),
      chatId: mgrChatId.value.trim(),
      topicId: mgrTopicId.value.trim(),
      delayMs: parseInt(mgrDelay.value, 10) || 500,
      messageFormat: mgrFormat.value,
      disablePreview: mgrDisablePreview.checked,
      silentNotification: mgrSilent.checked
    };

    await LinkStorage.saveSettings(updated);
    showAlert('Telegram settings saved successfully!', 'success');
    await checkBotHealth();
  });

  btnMgrTestPing.addEventListener('click', async () => {
    const token = mgrBotToken.value.trim();
    const chatId = mgrChatId.value.trim();
    const topicId = mgrTopicId.value.trim();

    mgrTestResult.classList.remove('hidden', 'success', 'error');
    mgrTestResult.textContent = 'Testing connection with Telegram...';
    mgrTestSpinner.classList.remove('hidden');
    btnMgrTestPing.disabled = true;

    try {
      const result = await TelegramService.testConnection(token, chatId, topicId);
      if (result.success) {
        mgrTestResult.className = 'test-result success';
        mgrTestResult.textContent = `✓ Connection verified! Bot @${result.botUsername} sent a test message to chat ${chatId}${topicId ? ' (Topic ' + topicId + ')' : ''}.`;
        await checkBotHealth();
      } else {
        mgrTestResult.className = 'test-result error';
        mgrTestResult.textContent = `✕ Connection test failed: ${result.error}`;
      }
    } catch (err) {
      mgrTestResult.className = 'test-result error';
      mgrTestResult.textContent = `✕ Error: ${err.message || err}`;
    } finally {
      mgrTestSpinner.classList.add('hidden');
      btnMgrTestPing.disabled = false;
    }
  });

  // Run initialization
  await init();
});
