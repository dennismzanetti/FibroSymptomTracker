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

  // ---- Load About section: version + last 10 commits from GitHub API ----
  function loadAboutSection() {
    // Version line
    const versionEl = document.getElementById('settingsAppVersion');
    if (versionEl) {
      fetch('VERSION')
        .then(r => r.text())
        .then(v => { versionEl.textContent = 'Version ' + v.trim(); })
        .catch(() => { versionEl.textContent = ''; });
    }

    // Commit history table — fetched live from GitHub API
    const container = document.getElementById('settingsAboutCommits');
    if (!container) return;

    container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-muted);">Loading commit history…</p>';

    fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits?per_page=10')
      .then(r => {
        if (!r.ok) throw new Error('GitHub API error (' + r.status + ')');
        return r.json();
      })
      .then(commits => {
        if (!Array.isArray(commits) || commits.length === 0) {
          container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-muted);">No commit data available.</p>';
          return;
        }

        const rows = commits.map(c => {
          const date    = new Date(c.commit.author.date);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const sha     = c.sha.slice(0, 7);
          const msg     = (c.commit.message || '').split('\n')[0];
          const url     = c.html_url;

          return `<tr>
            <td style="font-family:monospace;font-size:var(--text-xs);white-space:nowrap;padding:var(--space-2) var(--space-3);vertical-align:top;border-bottom:1px solid var(--color-divider);">
              <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary);text-decoration:none;">${sha}</a>
            </td>
            <td style="font-size:var(--text-xs);white-space:nowrap;padding:var(--space-2) var(--space-3);vertical-align:top;border-bottom:1px solid var(--color-divider);color:var(--color-text-muted);">
              ${dateStr}<br><span style="color:var(--color-text-faint);">${timeStr}</span>
            </td>
            <td style="font-size:var(--text-xs);padding:var(--space-2) var(--space-3);vertical-align:top;border-bottom:1px solid var(--color-divider);">
              ${msg}
            </td>
          </tr>`;
        }).join('');

        container.innerHTML = `
          <div style="overflow-x:auto;margin-top:var(--space-3);">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:var(--color-surface-offset);">
                  <th style="font-size:var(--text-xs);text-align:left;padding:var(--space-2) var(--space-3);color:var(--color-text-muted);font-weight:600;border-bottom:2px solid var(--color-border);white-space:nowrap;">SHA</th>
                  <th style="font-size:var(--text-xs);text-align:left;padding:var(--space-2) var(--space-3);color:var(--color-text-muted);font-weight:600;border-bottom:2px solid var(--color-border);white-space:nowrap;">Date</th>
                  <th style="font-size:var(--text-xs);text-align:left;padding:var(--space-2) var(--space-3);color:var(--color-text-muted);font-weight:600;border-bottom:2px solid var(--color-border);">Commit Message</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      })
      .catch(err => {
        container.innerHTML = `<p style="font-size:var(--text-sm);color:var(--color-text-muted);">Could not load commit history (${err.message}).</p>`;
      });
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
          loadAboutSection();
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
        if (tabSelect.value === 'settings-tab') {
          populateAccountInfo();
          loadAboutSection();
        }
      });
    }
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    wireDisplaySettings();
    wireSettingsSignOut();
    wireExportImport();
    watchSettingsTab();
    loadAboutSection();
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
