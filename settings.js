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

  // ---- About section: pull latest commits from GitHub API ----
  loadAboutSection();
});

function loadAboutSection() {
  const container = document.getElementById('settingsAboutCommits');
  const versionEl = document.getElementById('settingsAppVersion');
  if (!container) return;

  container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-faint);">Loading build history…</p>';

  fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits?sha=main&per_page=10')
    .then(r => {
      if (!r.ok) throw new Error('GitHub API ' + r.status);
      return r.json();
    })
    .then(commits => {
      if (!Array.isArray(commits) || commits.length === 0) {
        container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-faint);">No build history available.</p>';
        return;
      }

      // Show latest commit SHA as the app version
      if (versionEl) {
        versionEl.textContent = 'Build: ' + commits[0].sha;
      }

      // Render commit list
      const rows = commits.map((c, i) => {
        const sha     = c.sha || '';
        const message = (c.commit?.message || '').split('\n')[0];
        const date    = c.commit?.author?.date
          ? new Date(c.commit.author.date).toLocaleString()
          : '';
        const url     = c.html_url || '#';
        const isLatest = i === 0;

        return `
          <div style="
            display:grid;
            grid-template-columns: 1fr auto;
            gap:var(--space-1) var(--space-3);
            padding:var(--space-2) 0;
            border-bottom:1px solid var(--color-divider);
            ${isLatest ? 'padding-top:0;' : ''}
          ">
            <div style="min-width:0;">
              ${isLatest ? '<span style="display:inline-block;font-size:var(--text-xs);font-weight:700;background:var(--color-primary-light);color:var(--color-primary);border:1px solid var(--color-primary-border);border-radius:var(--radius-full);padding:0 0.5rem;margin-bottom:var(--space-1);">latest</span><br>' : ''}
              <span style="font-size:var(--text-sm);font-weight:600;color:var(--color-text);word-break:break-word;">${escHtml(message)}</span>
            </div>
            <a href="${url}" target="_blank" rel="noopener noreferrer"
               style="font-size:var(--text-xs);color:var(--color-primary);font-family:monospace;white-space:nowrap;align-self:start;text-decoration:none;"
               title="Open commit on GitHub">${escHtml(sha)}</a>
            <span style="font-size:var(--text-xs);color:var(--color-text-faint);">${escHtml(date)}</span>
          </div>`;
      }).join('');

      container.innerHTML = `
        <p style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:var(--space-2);">Last 10 Commits</p>
        ${rows}
      `;
    })
    .catch(err => {
      console.warn('Could not load build info:', err.message);
      container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-faint);">Build history unavailable.</p>';
    });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
