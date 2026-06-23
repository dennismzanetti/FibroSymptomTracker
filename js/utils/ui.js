// ============================================================
// UI UTILITIES — tabs, toasts, status, mobile wiring,
//                sleep calc, build footer, about commits
// No ES module exports — loaded as a plain <script> before app.js
// ============================================================

// ---- Tab switching ----
function setupTabs() {
  const tabBtns  = document.querySelectorAll('.tab-button');
  const tabs     = document.querySelectorAll('.tab');
  const floatBtn = document.getElementById('saveDayFloat');
  const header   = document.querySelector('.app-header');
  const tabSelect = document.getElementById('tabSelect');

  function activate(id) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    tabs.forEach(t => t.classList.toggle('active', t.id === id));
    if (floatBtn) floatBtn.style.display = (id === 'entry-tab') ? '' : 'none';
    if (header) header.classList.toggle('entry-tab-active', id === 'entry-tab');
    // Keep the mobile dropdown in sync
    if (tabSelect && tabSelect.value !== id) tabSelect.value = id;
  }

  // Desktop tab button clicks
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  // Mobile dropdown change — drive the same activate() path
  if (tabSelect) {
    tabSelect.addEventListener('change', function () {
      activate(tabSelect.value);
    });
  }

  activate('entry-tab');
}

// ---- Status bar ----
function showStatus(msg, isError = false) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--color-error)' : 'var(--color-success)';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// ---- Toast notifications ----
function showToast(msg, isError = false) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  // Reset to hidden state synchronously so opacity:0 is painted before we show
  toast.classList.remove('show');
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.textContent = msg;

  // Clear any pending dismiss timer
  clearTimeout(toast._timer);

  // Double rAF ensures the browser has painted opacity:0 before adding .show,
  // which makes the CSS transition actually fire.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
      toast._timer = setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    });
  });
}

// ---- Mobile sign-out sync ----
// Runs immediately (sign-out buttons are in the static header partial,
// loaded before this script executes).
(function () {
  var signOutBtnMobile  = document.getElementById('signOutBtnMobile');
  var signOutBtnDesktop = document.getElementById('signOutBtn');

  if (signOutBtnMobile && signOutBtnDesktop) {
    signOutBtnMobile.addEventListener('click', function () {
      signOutBtnDesktop.click();
    });

    var obs = new MutationObserver(function () {
      signOutBtnMobile.style.display = signOutBtnDesktop.style.display;
    });
    obs.observe(signOutBtnDesktop, { attributes: true, attributeFilter: ['style'] });
  }
}());

// ---- Sleep calculator ----
(function () {
  ['bedtimeInput', 'wakeTimeInput'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', recalcSleep);
  });

  function recalcSleep() {
    var bed  = document.getElementById('bedtimeInput')?.value;
    var wake = document.getElementById('wakeTimeInput')?.value;
    var disp = document.getElementById('hoursSleptDisplay');
    var hid  = document.getElementById('hoursSleptInput');
    if (!bed || !wake) { if (disp) disp.textContent = '\u2014'; return; }
    var bParts = bed.split(':').map(Number);
    var wParts = wake.split(':').map(Number);
    var bMins  = bParts[0] * 60 + bParts[1];
    var wMins  = wParts[0] * 60 + wParts[1];
    if (wMins <= bMins) wMins += 1440;
    var total  = (wMins - bMins) / 60;
    if (disp) disp.textContent = total.toFixed(1) + ' hrs';
    if (hid)  hid.value = total.toFixed(2);
  }
}());

// ---- Build footer SHA — read from static build-info.js (no API call) ----
(function () {
  var info = window.BUILD_INFO;
  if (!info) return;
  var shaEl  = document.getElementById('buildSha');
  var msgEl  = document.getElementById('buildMsg');
  var dateEl = document.getElementById('buildDate');
  if (shaEl)  shaEl.textContent = info.sha;
  if (msgEl)  msgEl.textContent = (info.message || '').split('\n')[0];
  if (dateEl) {
    var d = new Date(info.date);
    dateEl.textContent = d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
    dateEl.setAttribute('datetime', info.date);
  }
}());

// ---- About — commit history table ----
// Fetches commit-log.json, filters bot commits, renders top 10.
// Bot commits are identified by [skip ci] in the message.
// The row matching BUILD_INFO.shaFull is highlighted as the latest build.
function renderAboutCommits() {
  const container = document.getElementById('settingsAboutCommits');
  if (!container) return;

  const buildShaFull = (window.BUILD_INFO && window.BUILD_INFO.shaFull) || '';

  fetch('commit-log.json')
    .then(r => {
      if (!r.ok) throw new Error('commit-log.json not found (' + r.status + ')');
      return r.json();
    })
    .then(commits => {
      // Filter out bot / automated commits (contain [skip ci])
      const human = commits.filter(c => !(c.message || '').includes('[skip ci]'));
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
        '  <th style="text-align:left;padding:var(--space-2) var(--space-3);color:var(--color-text-muted);font-weight:600;white-space:nowrap;">SHA</th>',
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

        const dateStr = c.date
          ? new Date(c.date).toLocaleString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })
          : '\u2014';

        const msg = (c.message || '').split('\n')[0].replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const shaLink = c.url
          ? `<a href="${c.url}" target="_blank" rel="noopener noreferrer" style="font-family:monospace;color:var(--color-primary);text-decoration:none;word-break:break-all;">${c.sha.replace(/</g, '&lt;')}</a>`
          : `<span style="font-family:monospace;word-break:break-all;">${c.sha.replace(/</g, '&lt;')}</span>`;

        const buildBadge = isLatestBuild
          ? ' <span style="display:inline-block;margin-left:var(--space-2);padding:1px 6px;border-radius:var(--radius-full);background:var(--color-primary);color:white;font-size:0.7rem;font-weight:700;vertical-align:middle;">latest build</span>'
          : '';

        html += [
          `<tr style="border-bottom:1px solid var(--color-divider);${rowBg}">`,
          `  <td style="padding:var(--space-2) var(--space-3);vertical-align:top;">${shaLink}</td>`,
          `  <td style="padding:var(--space-2) var(--space-3);vertical-align:top;white-space:nowrap;color:var(--color-text-muted);">${dateStr}</td>`,
          `  <td style="padding:var(--space-2) var(--space-3);vertical-align:top;">${msg}${buildBadge}</td>`,
          '</tr>'
        ].join('\n');
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;
    })
    .catch(err => {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm);">Could not load commit history: ' + err.message + '</p>';
      if (window.FibroDiag) FibroDiag.warn('UI', 'renderAboutCommits failed: ' + err.message);
    });
}

// Wire up on partialsLoaded
document.addEventListener('partialsLoaded', function () {
  renderAboutCommits();
});
