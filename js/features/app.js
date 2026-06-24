// ---- app.js ----
// Main application orchestrator.
// Depends on: js/core/firebase-init.js (provides `db`, `auth`)

let _windowLoaded = false;
let _pendingSetup = false;
let _appInitialised = false;

function runPostLoadSetup() {
  if (!_windowLoaded || !_pendingSetup) return;
  _pendingSetup = false;
  FibroDiag.debug('App', 'runPostLoadSetup: loading today date and cloud data');
  loadTodayDate();
  loadDayFromCloud(currentDateStr);
}

// ---- All DOM wiring deferred until partials are injected ----
document.addEventListener('partialsLoaded', () => {
  FibroDiag.info('App', 'partialsLoaded event received — wiring up UI');

  const signOutBtn       = document.getElementById('signOutBtn');
  const signOutBtnMobile = document.getElementById('signOutBtnMobile');
  const appMain          = document.querySelector('main');

  if (appMain) appMain.style.display = 'none';

  // ---- Auth state ----
  auth.onAuthStateChanged((user) => {
    if (user) {
      FibroDiag.info('App', `Auth: signed in as ${user.email} (uid: ${user.uid})`);
      const authOverlay = document.getElementById('authOverlay');
      if (authOverlay) authOverlay.style.display = 'none';
      if (appMain) appMain.style.display = '';
      if (signOutBtn) signOutBtn.style.display = 'inline-block';
      if (signOutBtnMobile) signOutBtnMobile.style.display = 'inline-flex';

      if (!_appInitialised) {
        _appInitialised = true;
        _pendingSetup = true;
        FibroDiag.debug('App', 'First auth — running first-time setup');
        setupMedicationsTab();
        setupCareTeamTab();
        if (typeof setupConditionsTab === 'function') setupConditionsTab();
        runPostLoadSetup();
        // refreshTrends must run after auth so Firestore security rules are satisfied
        if (typeof window.refreshTrends === 'function') window.refreshTrends();
        if (typeof window.applySettingsOnAuth === 'function') window.applySettingsOnAuth(user);
        // Refresh medications views after auth so Firestore reads succeed
        if (typeof refreshMedView === 'function') {
          refreshMedView('medListView');
          refreshMedView('suppListView');
        }
      }
    } else {
      FibroDiag.info('App', 'Auth: signed out');
      const authOverlay = document.getElementById('authOverlay');
      if (authOverlay) authOverlay.style.display = 'flex';
      if (appMain) appMain.style.display = 'none';
      if (signOutBtn) signOutBtn.style.display = 'none';
      if (signOutBtnMobile) signOutBtnMobile.style.display = 'none';
      _appInitialised = false;
      _pendingSetup = false;
    }
  });

  // ---- Google Sign-In ----
  const signInBtn = document.getElementById('googleSignInBtn');
  const authError = document.getElementById('authError');
  if (signInBtn) {
    const provider = new firebase.auth.GoogleAuthProvider();

    auth.getRedirectResult().then(result => {
      if (result && result.user) {
        FibroDiag.info('App', `Redirect sign-in complete: ${result.user.displayName}`);
      }
    }).catch(err => {
      FibroDiag.error('App', 'Redirect sign-in error', err);
      if (authError) authError.textContent = 'Sign-in failed. Please try again.';
    });

    signInBtn.addEventListener('click', () => {
      if (authError) authError.textContent = '';
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      FibroDiag.debug('App', `Sign-in clicked — method: ${isMobile ? 'redirect' : 'popup'}`);
      if (isMobile) {
        auth.signInWithRedirect(provider).catch(err => {
          FibroDiag.error('App', 'Redirect sign-in error', err);
          if (authError) authError.textContent = 'Sign-in failed. Please try again.';
        });
      } else {
        auth.signInWithPopup(provider).catch(err => {
          FibroDiag.error('App', 'Popup sign-in error', err);
          if (authError) authError.textContent = 'Sign-in failed. Please try again.';
        });
      }
    });
  }

  signOutBtn?.addEventListener('click', () => { FibroDiag.info('App', 'User clicked sign out'); auth.signOut(); });
  signOutBtnMobile?.addEventListener('click', () => { FibroDiag.info('App', 'User clicked sign out (mobile)'); auth.signOut(); });

  // ---- UI setup ----
  FibroDiag.debug('App', 'Setting up UI components...');
  setupTabs();
  setupExerciseToggle();
  setupSaveDay();
  setupDateNavigation();
  setupDatePicker();
  setupSleepCalculation();
  setupNumberSteppers();
  setupAtrForm();
  setupHistoryControls();

  if (typeof setupTrends === 'function') {
    setupTrends(() => auth.currentUser ? auth.currentUser.uid : null);
  }

  const dateInput = document.getElementById('dateInput');
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      const v = dateInput.value;
      if (v && v !== currentDateStr) {
        FibroDiag.debug('App', `Date picker changed to ${v}`);
        currentDateStr = v;
        updateDateDisplay();
        loadDayFromCloud(currentDateStr);
      }
    });
  }

  refreshHistory();
  // NOTE: refreshTrends is intentionally NOT called here — it is called inside
  // auth.onAuthStateChanged after sign-in so Firestore security rules are satisfied.

  _windowLoaded = true;
  runPostLoadSetup();

  // ---- Export / Import listeners ----
  document.getElementById('exportDataBtn')?.addEventListener('click', exportAllData);
  document.getElementById('importFileInput')?.addEventListener('change', handleImportFile);
  document.getElementById('importConfirmBtn')?.addEventListener('click', confirmImport);
  document.getElementById('importCancelBtn')?.addEventListener('click', cancelImport);

  // ---- Build footer — live GitHub API, falls back to static build-info.js ----
  (function loadBuildInfo() {
    const shaEl = document.getElementById('buildSha');
    const msgEl = document.getElementById('buildMsg');

    function applyBuildInfo(sha, message, url) {
      if (shaEl) {
        if (url) {
          shaEl.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">${sha}</a>`;
        } else {
          shaEl.textContent = sha;
        }
      }
      if (msgEl) msgEl.textContent = message;
      FibroDiag.debug('App', `Build info: ${sha} — ${message}`);
    }

    function applyFallback() {
      if (window.BUILD_INFO) {
        applyBuildInfo(
          window.BUILD_INFO.sha,
          window.BUILD_INFO.message,
          window.BUILD_INFO.url
        );
        FibroDiag.debug('App', 'Build info: loaded from static BUILD_INFO fallback');
      } else {
        if (msgEl) msgEl.textContent = 'build info unavailable';
        FibroDiag.warn('App', 'BUILD_INFO not found and GitHub API failed');
      }
    }

    function isBotCommit(c) {
      const msg = (c.commit?.message || '').toLowerCase();
      return msg.includes('[skip ci]') || msg.startsWith('chore: update commit-log');
    }

    fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits?sha=main&per_page=10', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
      .then(r => {
        if (!r.ok) throw new Error(`GitHub API ${r.status}`);
        return r.json();
      })
      .then(commits => {
        const real = commits.find(c => !isBotCommit(c));
        if (!real) throw new Error('No non-bot commits found');
        const sha     = real.sha.slice(0, 7);
        const shaFull = real.sha;
        const message = (real.commit.message || '').split('\n')[0];
        const url     = `https://github.com/dennismzanetti/FibroSymptomTracker/commit/${shaFull}`;
        applyBuildInfo(sha, message, url);
        FibroDiag.debug('App', 'Build info: loaded live from GitHub API');
      })
      .catch(err => {
        FibroDiag.warn('App', `GitHub API failed (${err.message}) — falling back to BUILD_INFO`);
        applyFallback();
      });
  })();

  FibroDiag.info('App', 'UI setup complete');

}); // end partialsLoaded

// ---- Toast notification ----
let _toastTimer = null;
function showToast(message, isError = false) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.classList.remove('toast-success', 'toast-error', 'show');
  toast.style.opacity = '';
  toast.style.transition = '';
  toast.textContent = message;
  toast.classList.add(isError ? 'toast-error' : 'toast-success');
  toast.style.display = 'block';
  toast.offsetHeight;
  toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.style.display = 'none'; }, 420);
  }, 3000);
}

// ---- Local storage helpers ----
const STORAGE_KEY = 'fibroDaysLocal';
function loadAllDays() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return []; return JSON.parse(raw); }
  catch { return []; }
}
function saveAllDays(days) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(days)); }
  catch { /* unavailable */ }
}
function numberOrNull(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ---- Module-level current date ----
let currentDateStr = '';

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function syncDateInput() {
  const dateInput = document.getElementById('dateInput');
  if (dateInput) dateInput.value = currentDateStr;
  updateDateDisplay();
}

function updateDateDisplay() {
  const val = currentDateStr;
  const dowEl = document.getElementById('dayOfWeekDisplay');
  const dateEl = document.getElementById('dateDisplay');
  const entryDayLabel = document.getElementById('entryDayLabel');
  if (!val) {
    if (dowEl) dowEl.textContent = '';
    if (dateEl) dateEl.textContent = '';
    if (entryDayLabel) entryDayLabel.textContent = '';
    return;
  }
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.toLocaleDateString(undefined, { weekday: 'long' });
  const md = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (dowEl) dowEl.textContent = dow;
  if (dateEl) dateEl.textContent = md;
  if (entryDayLabel) entryDayLabel.textContent = `${dow}, ${md}`;
}

function loadTodayDate() {
  currentDateStr = todayStr();
  syncDateInput();
}

function setupDateNavigation() {
  document.getElementById('prevDayBtn')?.addEventListener('click', () => {
    currentDateStr = nDaysAgo((new Date() - new Date(currentDateStr)) / 86400000 + 1);
    syncDateInput();
    loadDayFromCloud(currentDateStr);
  });
  document.getElementById('nextDayBtn')?.addEventListener('click', () => {
    const cur = new Date(currentDateStr);
    cur.setDate(cur.getDate() + 1);
    currentDateStr = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    syncDateInput();
    loadDayFromCloud(currentDateStr);
  });
}

function setupDatePicker() {
  const dateInput = document.getElementById('dateInput');
  dateInput?.addEventListener('change', () => {
    currentDateStr = dateInput.value;
    syncDateInput();
    loadDayFromCloud(currentDateStr);
  });
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });
}

function setupExerciseToggle() {
  const checkbox = document.getElementById('exerciseDid');
  const details = document.getElementById('exerciseDetails');
  if (!checkbox || !details) return;
  checkbox.addEventListener('change', () => {
    details.style.display = checkbox.checked ? 'block' : 'none';
  });
}

function setupSleepCalculation() {
  const start = document.getElementById('sleepStart');
  const end = document.getElementById('sleepEnd');
  const output = document.getElementById('sleepHours');
  function recalc() {
    if (!start?.value || !end?.value || !output) return;
    const [sh, sm] = start.value.split(':').map(Number);
    const [eh, em] = end.value.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    output.value = (mins / 60).toFixed(1);
  }
  start?.addEventListener('change', recalc);
  end?.addEventListener('change', recalc);
}

function setupNumberSteppers() {
  document.querySelectorAll('.num-stepper').forEach(wrap => {
    const input = wrap.querySelector('input');
    const dec = wrap.querySelector('.step-dec');
    const inc = wrap.querySelector('.step-inc');
    if (!input || !dec || !inc) return;
    const step = parseFloat(input.step || '1');
    const min = input.min === '' ? -Infinity : parseFloat(input.min);
    const max = input.max === '' ? Infinity : parseFloat(input.max);
    dec.addEventListener('click', () => {
      const cur = input.value === '' ? 0 : parseFloat(input.value);
      input.value = Math.max(min, cur - step);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    inc.addEventListener('click', () => {
      const cur = input.value === '' ? 0 : parseFloat(input.value);
      input.value = Math.min(max, cur + step);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function setupAtrForm() {}
function setupHistoryControls() {}
function setupSaveDay() {
  document.getElementById('saveDayBtn')?.addEventListener('click', saveDayToCloud);
}

async function saveDayToCloud() {
  if (!auth.currentUser) return showToast('Please sign in first', true);
  const uid = auth.currentUser.uid;
  const date = currentDateStr || todayStr();
  const payload = collectFormData();
  FibroDiag.debug('App', `Save: writing day ${date}`);
  try {
    await db.collection('users').doc(uid).collection('days').doc(date).set(payload, { merge: true });
    showToast('Day saved');
    refreshHistory();
    if (typeof window.refreshTrends === 'function') window.refreshTrends();
  } catch (err) {
    FibroDiag.error('App', 'Save failed', err);
    showToast('Save failed', true);
  }
}

function collectFormData() {
  const get = id => document.getElementById(id);
  return {
    date: currentDateStr,
    painLevel: numberOrNull(get('painLevel')?.value),
    fatigueLevel: numberOrNull(get('fatigueLevel')?.value),
    moodScore: numberOrNull(get('moodScore')?.value),
    sleepHours: numberOrNull(get('sleepHours')?.value),
    exerciseDid: !!get('exerciseDid')?.checked,
    exerciseDetails: get('exerciseDetails')?.value || '',
    notes: get('dailyNotes')?.value || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

async function loadDayFromCloud(date) {
  if (!auth.currentUser || !date) return;
  const uid = auth.currentUser.uid;
  FibroDiag.debug('App', `Load: reading day ${date}`);
  try {
    const snap = await db.collection('users').doc(uid).collection('days').doc(date).get();
    fillForm(snap.exists ? snap.data() : {});
  } catch (err) {
    FibroDiag.error('App', 'Load failed', err);
    showToast('Load failed', true);
  }
}

function fillForm(d) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  set('painLevel', d.painLevel);
  set('fatigueLevel', d.fatigueLevel);
  set('moodScore', d.moodScore);
  set('sleepHours', d.sleepHours);
  setCheck('exerciseDid', d.exerciseDid);
  set('exerciseDetails', d.exerciseDetails);
  set('dailyNotes', d.notes);
  const details = document.getElementById('exerciseDetails');
  if (details) details.style.display = d.exerciseDid ? 'block' : 'none';
}

async function refreshHistory() {
  const list = document.getElementById('historyList');
  if (!list || !auth.currentUser) return;
  list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm);">Loading…</p>';
  try {
    const uid = auth.currentUser.uid;
    const snap = await db.collection('users').doc(uid).collection('days').orderBy('date', 'desc').limit(30).get();
    if (snap.empty) {
      list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm);">No entries yet.</p>';
      return;
    }
    list.innerHTML = snap.docs.map(doc => {
      const d = doc.data() || {};
      return `<button class="history-row" data-date="${doc.id}">${doc.id} — Pain ${d.painLevel ?? '-'}, Fatigue ${d.fatigueLevel ?? '-'}, Mood ${d.moodScore ?? '-'}</button>`;
    }).join('');
    list.querySelectorAll('.history-row').forEach(btn => {
      btn.addEventListener('click', () => {
        currentDateStr = btn.dataset.date;
        syncDateInput();
        loadDayFromCloud(currentDateStr);
      });
    });
  } catch (err) {
    FibroDiag.error('App', 'History load failed', err);
    list.innerHTML = '<p style="color:var(--color-error);font-size:var(--text-sm);">Failed to load history.</p>';
  }
}
