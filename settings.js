// ============================================================
// SETTINGS TAB
// ============================================================

(function () {
  'use strict';

  // ---- Constants ----
  const SETTINGS_KEY = 'fibroSettings';

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function saveSettings(obj) {
    try {
      const current = loadSettings();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(Object.assign(current, obj)));
    } catch { /* silently ignore */ }
  }

  // ---- Theme ----
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      // system
      root.removeAttribute('data-theme');
    }
  }

  function initTheme() {
    const settings = loadSettings();
    if (settings.theme) applyTheme(settings.theme);
  }

  // ---- Default tab on open ----
  function applyDefaultTab() {
    const settings = loadSettings();
    const tabId = settings.defaultTab;
    if (!tabId) return;
    // Only switch if no tab is already active beyond entry-tab (i.e. on initial page load)
    const activeBtn = document.querySelector('.tab-button.active');
    if (activeBtn && activeBtn.getAttribute('data-tab') === 'entry-tab' && tabId !== 'entry-tab') {
      const targetBtn = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
      if (targetBtn) targetBtn.click();
    }
  }

  // ---- Populate account info ----
  function populateAccountInfo() {
    const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
    if (!auth) return;
    const user = auth.currentUser;
    if (!user) return;

    const nameEl = document.getElementById('settingsUserName');
    const emailEl = document.getElementById('settingsUserEmail');
    const photoEl = document.getElementById('settingsUserPhoto');

    if (nameEl) nameEl.textContent = user.displayName || 'No name set';
    if (emailEl) emailEl.textContent = user.email || '';
    if (photoEl && user.photoURL) {
      photoEl.src = user.photoURL;
      photoEl.style.display = 'block';
    }
  }

  // ---- Load app version from VERSION file ----
  function loadAppVersion() {
    const el = document.getElementById('settingsAppVersion');
    if (!el) return;
    fetch('VERSION')
      .then(r => r.text())
      .then(v => { el.textContent = 'Version ' + v.trim(); })
      .catch(() => { el.textContent = ''; });
  }

  // ---- Wire display settings form ----
  function wireDisplaySettings() {
    const themeSelect = document.getElementById('settingsThemeSelect');
    const defaultTabSelect = document.getElementById('settingsDefaultTabSelect');
    const saveBtn = document.getElementById('settingsSaveDisplayBtn');
    const status = document.getElementById('settingsDisplayStatus');

    if (!themeSelect || !defaultTabSelect || !saveBtn) return;

    // Pre-populate from saved settings
    const settings = loadSettings();
    if (settings.theme) themeSelect.value = settings.theme;
    if (settings.defaultTab) defaultTabSelect.value = settings.defaultTab;

    saveBtn.addEventListener('click', () => {
      const theme = themeSelect.value;
      const defaultTab = defaultTabSelect.value;
      saveSettings({ theme, defaultTab });
      applyTheme(theme);
      if (status) {
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 2000);
      }
    });
  }

  // ---- Wire sign-out button in settings ----
  function wireSettingsSignOut() {
    const btn = document.getElementById('settingsSignOutBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (typeof firebase !== 'undefined') firebase.auth().signOut();
    });
  }

  // ---- Wire export / import (delegates to app.js functions) ----
  function wireExportImport() {
    document.getElementById('exportDataBtn')
      ?.addEventListener('click', () => {
        if (typeof exportAllData === 'function') exportAllData();
      });
    document.getElementById('importFileInput')
      ?.addEventListener('change', (e) => {
        if (typeof handleImportFile === 'function') handleImportFile(e);
      });
    document.getElementById('importConfirmBtn')
      ?.addEventListener('click', () => {
        if (typeof confirmImport === 'function') confirmImport();
      });
    document.getElementById('importCancelBtn')
      ?.addEventListener('click', () => {
        if (typeof cancelImport === 'function') cancelImport();
      });
  }

  // ---- Refresh settings tab when it becomes active ----
  function watchSettingsTab() {
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.getAttribute('data-tab') === 'settings-tab') {
          populateAccountInfo();
        }
      });
    });
    // Also handle mobile dropdown
    const tabSelect = document.getElementById('tabSelect');
    if (tabSelect) {
      tabSelect.addEventListener('change', () => {
        if (tabSelect.value === 'settings-tab') populateAccountInfo();
      });
    }
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    wireDisplaySettings();
    wireSettingsSignOut();
    wireExportImport();
    watchSettingsTab();
    loadAppVersion();
  });

  // Apply default tab after auth resolves (auth.onAuthStateChanged fires after DOMContentLoaded)
  // We expose a hook that app.js can call after sign-in setup
  window.applySettingsDefaultTab = applyDefaultTab;

})();
