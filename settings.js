// settings.js

// ---- Theme / display name settings (called from app.js after auth) ----
window.applySettingsOnAuth = function applySettingsOnAuth() {
  const saved = {};
  try {
    const raw = sessionStorage.getItem('fibroSettings');
    if (raw) Object.assign(saved, JSON.parse(raw));
  } catch {}

  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect && saved.theme) {
    themeSelect.value = saved.theme;
    applyTheme(saved.theme);
  }
};

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'light');
}

function saveSettings() {
  const themeSelect = document.getElementById('themeSelect');
  const settings = {
    theme: themeSelect ? themeSelect.value : 'light'
  };
  try { sessionStorage.setItem('fibroSettings', JSON.stringify(settings)); } catch {}
  if (settings.theme) applyTheme(settings.theme);
  showToast('\u2713 Settings saved');
}

document.addEventListener('partialsLoaded', () => {

  // ---- Theme selector ----
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', saveSettings);
  }

  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);

  // ---- About section: pull latest commit info from GitHub API ----
  loadAboutSection();
});

function loadAboutSection() {
  const shaEl  = document.getElementById('aboutSha');
  const msgEl  = document.getElementById('aboutMsg');
  const dateEl = document.getElementById('aboutDate');

  if (!shaEl && !msgEl && !dateEl) return; // about section not present

  fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits/main')
    .then(r => {
      if (!r.ok) throw new Error('GitHub API ' + r.status);
      return r.json();
    })
    .then(data => {
      if (shaEl)  shaEl.textContent  = (data.sha  || '').slice(0, 7);
      if (msgEl)  msgEl.textContent  = (data.commit?.message || '').split('\n')[0];
      if (dateEl) dateEl.textContent = data.commit?.author?.date
        ? new Date(data.commit.author.date).toLocaleString()
        : '';
    })
    .catch(err => {
      console.warn('Could not load build info:', err.message);
      if (msgEl) msgEl.textContent = 'build info unavailable';
    });
}
