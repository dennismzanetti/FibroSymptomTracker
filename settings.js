// ============================================================
// SETTINGS TAB
// ============================================================

(function () {
  'use strict';

  let _cachedSettings = {};

  // ---- Firestore helpers ----
  function getSettingsRef() {
    const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
    const db   = typeof firebase !== 'undefined' ? firebase.firestore() : null;
    if (!auth || !db || !auth.currentUser) return null;
    return db.collection('users').doc(auth.currentUser.uid).collection('meta').doc('settings');
  }

  function loadSettingsFromFirestore(callback) {
    const ref = getSettingsRef();
    if (!ref) { callback({}); return; }
    ref.get().then(snap => {
      const data = snap.exists ? snap.data() : {};
      _cachedSettings = data;
      callback(data);
    }).catch(() => callback({}));
  }

  function saveSettingsToFirestore(obj, onDone) {
    _cachedSettings = Object.assign({}, _cachedSettings, obj);
    const ref = getSettingsRef();
    if (!ref) { if (onDone) onDone(); return; }
    ref.set(_cachedSettings, { merge: true })
      .then(() => { if (onDone) onDone(); })
      .catch(() => { if (onDone) onDone(); });
  }

  // ---- Theme ----
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  // ---- Default tab on open ----
  function applyDefaultTab(settings) {
    const tabId = settings && settings.defaultTab;
    if (!tabId) return;
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

    const nameEl  = document.getElementById('settingsUserName');
    const emailEl = document.getElementById('settingsUserEmail');
    const photoEl = document.getElementById('settingsUserPhoto');

    if (nameEl)  nameEl.textContent  = user.displayName || 'No name set';
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
    const themeSelect      = document.getElementById('settingsThemeSelect');
    const defaultTabSelect = document.getElementById('settingsDefaultTabSelect');
    const saveBtn          = document.getElementById('settingsSaveDisplayBtn');
    const status           = document.getElementById('settingsDisplayStatus');

    if (!themeSelect || !defaultTabSelect || !saveBtn) return;

    saveBtn.addEventListener('click', () => {
      const theme      = themeSelect.value;
      const defaultTab = defaultTabSelect.value;
      saveSettingsToFirestore({ theme, defaultTab }, () => {
        applyTheme(theme);
        if (status) {
          status.style.display = 'block';
          setTimeout(() => { status.style.display = 'none'; }, 2000);
        }
      });
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

  // ---- Refresh account info + display form when settings tab is activated ----
  function watchSettingsTab() {
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.getAttribute('data-tab') === 'settings-tab') {
          populateAccountInfo();
          loadSettingsFromFirestore(settings => {
            const themeSelect      = document.getElementById('settingsThemeSelect');
            const defaultTabSelect = document.getElementById('settingsDefaultTabSelect');
            if (themeSelect      && settings.theme)      themeSelect.value      = settings.theme;
            if (defaultTabSelect && settings.defaultTab) defaultTabSelect.value = settings.defaultTab;
          });
        }
      });
    });
    const tabSelect = document.getElementById('tabSelect');
    if (tabSelect) {
      tabSelect.addEventListener('change', () => {
        if (tabSelect.value === 'settings-tab') populateAccountInfo();
      });
    }
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    wireDisplaySettings();
    wireSettingsSignOut();
    wireExportImport();
    watchSettingsTab();
    loadAppVersion();
  });

  // Called by app.js after onAuthStateChanged fires so theme + default tab apply immediately on login
  window.applySettingsOnAuth = function () {
    loadSettingsFromFirestore(settings => {
      if (settings.theme) applyTheme(settings.theme);
      applyDefaultTab(settings);
    });
  };

  // Keep old hook name for backward compat
  window.applySettingsDefaultTab = function () {
    applyDefaultTab(_cachedSettings);
  };

})();
