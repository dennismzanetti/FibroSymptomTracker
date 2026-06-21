// ============================================================
// UI UTILITIES — tabs, toasts, status, mobile wiring,
//                sleep calc, build footer
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

// ---- Build footer SHA ----
(function () {
  var REPO = 'dennismzanetti/FibroSymptomTracker';
  var API  = 'https://api.github.com/repos/' + REPO + '/commits/main';
  fetch(API, { headers: { Accept: 'application/vnd.github.v3+json' } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      var sha     = data.sha.slice(0, 7);
      var msg     = data.commit.message.split('\n')[0];
      var isoDate = data.commit.author.date;
      var d = new Date(isoDate);
      var formatted = d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
      var shaEl  = document.getElementById('buildSha');
      var msgEl  = document.getElementById('buildMsg');
      var dateEl = document.getElementById('buildDate');
      if (shaEl)  { shaEl.textContent = sha; shaEl.href = 'https://github.com/' + REPO + '/commit/' + data.sha; }
      if (msgEl)  msgEl.textContent  = msg;
      if (dateEl) { dateEl.textContent = formatted; dateEl.setAttribute('datetime', isoDate); }
    })
    .catch(function () {
      var footer = document.getElementById('buildFooter');
      if (footer) footer.style.display = 'none';
    });
}());
