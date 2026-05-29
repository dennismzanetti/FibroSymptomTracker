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

  function activate(id) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    tabs.forEach(t => t.classList.toggle('active', t.id === id));
    if (floatBtn) floatBtn.style.display = (id === 'entry-tab') ? '' : 'none';
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

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
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// ---- Mobile wiring ----
(function () {
  var signOutBtnMobile  = document.getElementById('signOutBtnMobile');
  var signOutBtnDesktop = document.getElementById('signOutBtn');

  if (signOutBtnMobile) {
    signOutBtnMobile.addEventListener('click', function () {
      if (signOutBtnDesktop) signOutBtnDesktop.click();
    });
  }

  if (signOutBtnDesktop && signOutBtnMobile) {
    var obs = new MutationObserver(function () {
      signOutBtnMobile.style.display = signOutBtnDesktop.style.display;
    });
    obs.observe(signOutBtnDesktop, { attributes: true, attributeFilter: ['style'] });
  }

  document.getElementById('prevDayBtnMobile')?.addEventListener('click', function () {
    document.getElementById('prevDayBtn')?.click();
  });
  document.getElementById('nextDayBtnMobile')?.addEventListener('click', function () {
    document.getElementById('nextDayBtn')?.click();
  });
  document.getElementById('datePickerBtnMobile')?.addEventListener('click', function () {
    document.getElementById('datePickerBtn')?.click();
  });

  function mirrorDateDisplay() {
    var dowSrc  = document.getElementById('dayOfWeekDisplay');
    var dateSrc = document.getElementById('dateDisplay');
    var dowDst  = document.getElementById('dayOfWeekDisplayMobile');
    var dateDst = document.getElementById('dateDisplayMobile');
    if (dowDst  && dowSrc)  dowDst.textContent  = dowSrc.textContent;
    if (dateDst && dateSrc) dateDst.textContent = dateSrc.textContent;
  }

  var dowSrc  = document.getElementById('dayOfWeekDisplay');
  var dateSrc = document.getElementById('dateDisplay');
  if (dowSrc)  new MutationObserver(mirrorDateDisplay).observe(dowSrc,  { childList: true, characterData: true, subtree: true });
  if (dateSrc) new MutationObserver(mirrorDateDisplay).observe(dateSrc, { childList: true, characterData: true, subtree: true });
  mirrorDateDisplay();

  var tabSelect = document.getElementById('tabSelect');
  document.querySelectorAll('#tabs .tab-button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (tabSelect) tabSelect.value = btn.getAttribute('data-tab');
    });
  });
  if (tabSelect) {
    tabSelect.addEventListener('change', function () {
      var btn = document.querySelector('#tabs .tab-button[data-tab="' + tabSelect.value + '"]');
      if (btn) btn.click();
    });
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
