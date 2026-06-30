// settings.js

// ---- Theme / display name settings (called from app.js after auth) ----
window.applySettingsOnAuth = function applySettingsOnAuth(user) {
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

  // Populate the Account card with the signed-in user's info
  if (user) loadAccountSection(user);
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

function loadAccountSection(user) {
  const nameEl     = document.getElementById('settingsUserName');
  const emailEl    = document.getElementById('settingsUserEmail');
  const photoEl    = document.getElementById('settingsUserPhoto');
  const initialsEl = document.getElementById('settingsUserInitials');
  const signOutBtn = document.getElementById('settingsSignOutBtn');

  if (nameEl)  nameEl.textContent  = user.displayName  || '';
  if (emailEl) emailEl.textContent = user.email        || '';

  if (photoEl && user.photoURL) {
    photoEl.src = user.photoURL;
    photoEl.style.display = 'block';
    if (initialsEl) initialsEl.style.display = 'none';
  } else if (initialsEl) {
    const name = user.displayName || user.email || '?';
    const initials = name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    initialsEl.textContent = initials;
    initialsEl.style.display = 'flex';
    if (photoEl) photoEl.style.display = 'none';
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      firebase.auth().signOut().catch(err => console.error('Sign-out error:', err));
    });
  }
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

// ---- About — single commit table (top 10, no bots, latest build highlighted) ----
function loadAboutSection() {
  const container = document.getElementById('settingsAboutCommits');
  if (!container) return;

  const buildShaFull = (window.BUILD_INFO && window.BUILD_INFO.shaFull) || '';

  fetch('./commit-log.json')
    .then(r => {
      if (!r.ok) throw new Error('commit-log.json not found (' + r.status + ')');
      return r.json();
    })
    .then(commits => {
      // Filter out bot / automated commits
      const human = commits.filter(c =>
        !c.message.includes('[skip ci]') &&
        !c.message.startsWith('chore: update commit-log')
      );
      const top10 = human.slice(0, 10);

      if (!top10.length) {
        container.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm);">No commits found.</p>';
        return;
      }

      let html = [
        '<div style="overflow-x:auto;">',
        '<table style="width:100%;border-collapse:collapse;font-size:var(--text-sm);font-variant-numeric:tabular-nums;">',
        '<thead>',
        '<tr style="border-bottom:2px solid var(--color-border);">',
        '  <th style="text-align:left;padding:var(--space-2) var(--space-3);color:var(--color-text-muted);font-weight:600;white-space:nowrap;min-width:360px;">SHA</th>',
        '  <th style="text-align:left;padding:var(--space-2) var(--space-3);color:var(--color-text-muted);font-weight:600;white-space:nowrap;">Date / Time</th>',
        '  <th style="text-align:left;padding:var(--space-2) var(--space-3);color:var(--color-text-muted);font-weight:600;">Commit Message</th>',
        '</tr>',
        '</thead>',
        '<tbody>'
      ].join('\n');

      top10.forEach((c, i) => {
        const isLatestBuild = buildShaFull && c.sha === buildShaFull;
        const rowBg = isLatestBuild
          ? 'background:var(--color-primary-highlight);'
          : (i % 2 === 0 ? '' : 'background:var(--color-surface-offset);');

        // Full datetime with seconds, 24-hour clock, unambiguous numeric format
        const dateStr = c.date
          ? new Date(c.date).toLocaleString(undefined, {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false
            })
          : '\u2014';

        const msg = escHtml((c.message || '').split('\n')[0]);
        // Always display the full 40-char SHA (c.sha), fall back to short only if absent
        const shaFull = escHtml(c.sha || c.short || '');
        const shaLink = c.url
          ? `<a href="${escHtml(c.url)}" target="_blank" rel="noopener noreferrer" style="font-family:monospace;font-size:0.8em;color:var(--color-primary);text-decoration:none;word-break:break-all;letter-spacing:0.01em;">${shaFull}</a>`
          : `<span style="font-family:monospace;font-size:0.8em;word-break:break-all;letter-spacing:0.01em;">${shaFull}</span>`;

        const buildBadge = isLatestBuild
          ? ' <span style="display:inline-block;margin-left:var(--space-2);padding:1px 6px;border-radius:var(--radius-full);background:var(--color-primary);color:white;font-size:0.7rem;font-weight:700;vertical-align:middle;">latest build</span>'
          : '';

        html += [
          `<tr style="border-bottom:1px solid var(--color-divider);${rowBg}">`,
          `  <td style="padding:var(--space-2) var(--space-3);vertical-align:top;min-width:360px;">${shaLink}</td>`,
          `  <td style="padding:var(--space-2) var(--space-3);vertical-align:top;white-space:nowrap;color:var(--color-text-muted);">${dateStr}</td>`,
          `  <td style="padding:var(--space-2) var(--space-3);vertical-align:top;">${msg}${buildBadge}</td>`,
          '</tr>'
        ].join('\n');
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;
    })
    .catch(err => {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm);">Could not load commit history: ' + escHtml(err.message) + '</p>';
      if (window.FibroDiag) FibroDiag.warn('Settings', 'loadAboutSection failed: ' + err.message);
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
