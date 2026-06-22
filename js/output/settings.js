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

  // ---- About section ----
  loadAboutSection();

  // ---- Developer Diagnostics toggle ----
  injectDiagnosticsToggle();
});

// Shared card style used by every build card in the About section
function buildCardStyle(highlight) {
  const base = [
    'padding:var(--space-3)',
    'background:var(--color-surface-offset)',
    'border-radius:var(--radius-md)',
    'margin-bottom:var(--space-2)',
  ];
  if (highlight) {
    base.push(
      'border:2px solid var(--color-primary)',
      'box-shadow:0 0 0 3px var(--color-primary-highlight)'
    );
  } else {
    base.push('border:1px solid var(--color-border)');
  }
  return base.join(';');
}

function loadAboutSection() {
  const container = document.getElementById('settingsAboutCommits');
  if (!container) return;

  function renderAbout(sha, shaFull, message, date, url) {
    const currentDate = date ? new Date(date).toLocaleString() : '';

    const html = `
      <p style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:var(--space-2);">Current Build</p>
      <div style="${buildCardStyle(true)}">
        <span style="display:inline-block;font-size:var(--text-xs);font-weight:700;background:var(--color-primary-highlight);color:var(--color-primary);border-radius:var(--radius-full);padding:0.1em 0.6em;margin-bottom:var(--space-1);">latest</span>
        <p style="font-size:var(--text-sm);font-weight:600;color:var(--color-text);margin:0 0 var(--space-1);word-break:break-word;">${escHtml(message)}</p>
        <a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
           style="font-size:var(--text-xs);color:var(--color-primary);font-family:monospace;word-break:break-all;text-decoration:none;display:block;margin-bottom:var(--space-1);"
           title="Open commit on GitHub">${escHtml(shaFull || sha)}</a>
        <p style="font-size:var(--text-xs);color:var(--color-text-faint);margin:0;">${escHtml(currentDate)}</p>
      </div>
      <p style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-top:var(--space-4);margin-bottom:var(--space-2);">Recent Changes</p>
      <div id="aboutCommitList" style="font-size:var(--text-xs);color:var(--color-text-faint);">Loading&hellip;</div>
      <p style="margin-top:var(--space-4);font-size:var(--text-xs);color:var(--color-text-faint);">
        Full history on <a href="https://github.com/dennismzanetti/FibroSymptomTracker/commits/main" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary);">GitHub</a>.
      </p>
    `;

    container.innerHTML = html;

    fetch('./commit-log.json')
      .then(r => r.json())
      .then(commits => {
        const listEl = document.getElementById('aboutCommitList');
        if (!listEl) return;

        const real = commits.filter(c =>
          !c.message.includes('[skip ci]') &&
          !c.message.startsWith('chore: update commit-log')
        );

        if (!real.length) {
          listEl.textContent = 'No recent commits found.';
          return;
        }

        listEl.innerHTML = real.map((c) => {
          const d = c.date ? new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          const fullSha = c.sha || c.short || '';
          return `
            <div style="${buildCardStyle(false)}">
              <span style="display:block;font-size:var(--text-xs);color:var(--color-text);word-break:break-word;margin-bottom:2px;font-weight:600;">${escHtml(c.message)}</span>
              <a href="${escHtml(c.url)}" target="_blank" rel="noopener noreferrer"
                 style="display:block;font-size:var(--text-xs);color:var(--color-primary);font-family:monospace;word-break:break-all;text-decoration:none;margin-bottom:2px;"
                 title="Open commit on GitHub">${escHtml(fullSha)}</a>
              <span style="font-size:var(--text-xs);color:var(--color-text-faint);">${escHtml(d)}</span>
            </div>
          `;
        }).join('');
      })
      .catch(() => {
        const listEl = document.getElementById('aboutCommitList');
        if (listEl) listEl.textContent = 'Could not load commit history.';
      });
  }

  fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits/main', {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  })
    .then(r => {
      if (!r.ok) throw new Error(`GitHub API ${r.status}`);
      return r.json();
    })
    .then(data => {
      const shaFull = data.sha;
      const sha     = shaFull.slice(0, 7);
      const message = (data.commit.message || '').split('\n')[0];
      const date    = data.commit.author.date;
      const url     = `https://github.com/dennismzanetti/FibroSymptomTracker/commit/${shaFull}`;
      renderAbout(sha, shaFull, message, date, url);
    })
    .catch(() => {
      const info = window.BUILD_INFO;
      if (info) {
        renderAbout(
          info.sha,
          info.shaFull || info.sha,
          info.message || '',
          info.date    || '',
          info.url     || '#'
        );
      } else {
        container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-faint);">Build info unavailable.</p>';
      }
    });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Developer Diagnostics toggle ----
function injectDiagnosticsToggle() {
  // Render into the existing #diagToggleContent placeholder inside the
  // Developer Diagnostics card — do NOT create a separate appended section.
  const container = document.getElementById('diagToggleContent');
  if (!container) return;

  const isOn = !!(typeof FibroDiag !== 'undefined'
    ? FibroDiag.isDebugEnabled()
    : sessionStorage.getItem('FIBRO_DEBUG'));

  container.innerHTML = `
    <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-4);">Enable verbose console logging to help diagnose errors. The setting persists for this browser tab until you turn it off.</p>
    <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;">
      <button id="diagToggleBtn" style="
        display:inline-flex;align-items:center;gap:var(--space-2);
        padding:var(--space-2) var(--space-4);
        border-radius:var(--radius-full);
        font-size:var(--text-sm);font-weight:600;
        border:2px solid ${isOn ? 'var(--color-success)' : 'var(--color-border)'};
        background:${isOn ? 'var(--color-success-highlight)' : 'var(--color-surface)'};
        color:${isOn ? 'var(--color-success)' : 'var(--color-text-muted)'};
        cursor:pointer;transition:all 0.18s ease;
      ">
        <span id="diagToggleDot" style="
          width:10px;height:10px;border-radius:50%;
          background:${isOn ? 'var(--color-success)' : 'var(--color-text-faint)'};
          display:inline-block;
        "></span>
        <span id="diagToggleLabel">Debug logging: ${isOn ? 'ON' : 'OFF'}</span>
      </button>
      <span id="diagToggleHint" style="font-size:var(--text-xs);color:var(--color-text-faint);">
        ${isOn ? '&#x1F41E; Open DevTools console to see debug output.' : 'Page will reload when enabled.'}
      </span>
    </div>
  `;

  document.getElementById('diagToggleBtn').addEventListener('click', () => {
    const currentlyOn = !!(typeof FibroDiag !== 'undefined'
      ? FibroDiag.isDebugEnabled()
      : sessionStorage.getItem('FIBRO_DEBUG'));
    if (currentlyOn) {
      sessionStorage.removeItem('FIBRO_DEBUG');
      showToast('\uD83D\uDD15 Debug logging disabled');
      const btn  = document.getElementById('diagToggleBtn');
      const dot  = document.getElementById('diagToggleDot');
      const lbl  = document.getElementById('diagToggleLabel');
      const hint = document.getElementById('diagToggleHint');
      if (btn)  { btn.style.borderColor = 'var(--color-border)'; btn.style.background = 'var(--color-surface)'; btn.style.color = 'var(--color-text-muted)'; }
      if (dot)  dot.style.background = 'var(--color-text-faint)';
      if (lbl)  lbl.textContent = 'Debug logging: OFF';
      if (hint) hint.textContent = 'Page will reload when enabled.';
    } else {
      sessionStorage.setItem('FIBRO_DEBUG', '1');
      showToast('\uD83D\uDC1E Debug logging enabled \u2014 reloading...');
      setTimeout(() => location.reload(), 900);
    }
  });
}
