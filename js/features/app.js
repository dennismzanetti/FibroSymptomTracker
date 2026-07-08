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
        // NOTE: refreshTrends is NOT called here on auth.
        // The Trends tab is hidden (display:none via CSS) at this point, so
        // Chart.js would render into a 0x0 canvas and bake zero dimensions
        // into canvas.style. The tab-click handler calls refreshTrends() fresh
        // on a visible canvas — that is the correct and only render path.
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
  setupMeditationToggle();
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
  // NOTE: refreshTrends is intentionally NOT called here — the Trends tab is
  // hidden at page load. Chart.js must only render into a visible canvas.

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

    function isBotCommit(data) {
      const committer = (data.commit?.committer?.name || '').toLowerCase();
      const author    = (data.commit?.author?.name || '').toLowerCase();
      const message   = (data.commit?.message || '');
      return committer.includes('github-actions') ||
             author.includes('github-actions') ||
             /\[skip ci\]/i.test(message);
    }

    fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits/main', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
      .then(r => {
        if (!r.ok) throw new Error(`GitHub API ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (isBotCommit(data)) {
          FibroDiag.debug('App', 'Live commit is bot-generated — falling back to BUILD_INFO');
          applyFallback();
          return;
        }
        const sha     = data.sha.slice(0, 7);
        const shaFull = data.sha;
        const message = (data.commit.message || '').split('\n')[0];
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
  const [year, month, day] = val.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return;
  const fullDow = date.toLocaleDateString(undefined, { weekday: 'long' });
  if (dowEl) dowEl.textContent = fullDow;
  if (dateEl) dateEl.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (entryDayLabel) entryDayLabel.textContent = fullDow;
}

function updateDayOfWeek() { updateDateDisplay(); }

function getJournalDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

function getJournalDateLine(dateStr) {
  if (!dateStr) return 'No date recorded';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function setupDatePicker() {
  const btn = document.getElementById('datePickerBtn');
  const input = document.getElementById('dateInput');
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    try { input.showPicker(); } catch (e) { input.focus(); input.click(); }
  });
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const tabs = document.querySelectorAll('.tab');
  const tabSelect = document.getElementById('tabSelect');

  function activate(target) {
    FibroDiag.debug('App', `Tab activated: ${target}`);
    buttons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === target));
    tabs.forEach(t => t.classList.toggle('active', t.id === target));
    if (tabSelect && tabSelect.value !== target) tabSelect.value = target;
    if (target === 'history-tab') refreshHistory();
    if (target === 'journal-tab') renderJournal();
    if (target === 'trends-tab') window.refreshTrends();
    if (target === 'mood-tab') refreshMoodTab();
    if (target === 'careteam-tab') {
      const defaultCTBtn = document.querySelector('.ct-sub-tab-btn[data-ct-view="ctProvidersView"]');
      if (defaultCTBtn) defaultCTBtn.click();
      else refreshProviderList();
    }
    if (target === 'conditions-tab') refreshConditionsList();
    if (target === 'medications-tab') {
      // Reset to Medications list view on every tab visit
      if (typeof activeMedView !== 'undefined') activeMedView = 'medListView';
      const medListBtn = document.querySelector('#medications-tab .ct-sub-tab-btn[data-med-view="medListView"]');
      if (medListBtn) medListBtn.click();
      else refreshMedView('medListView');
    }
    if (target === 'entry-tab') syncDateInput();
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => activate(btn.getAttribute('data-tab')));
  });

  if (tabSelect) {
    tabSelect.addEventListener('change', () => activate(tabSelect.value));
  }
}

function setupExerciseToggle() {
  const didExerciseInput = document.getElementById('didExerciseInput');
  const exerciseDetails  = document.getElementById('exerciseDetails');
  if (!didExerciseInput || !exerciseDetails) return;
  function updateVisibility() {
    exerciseDetails.style.display = didExerciseInput.value === 'yes' ? 'block' : 'none';
  }
  didExerciseInput.addEventListener('change', updateVisibility);
  updateVisibility();
}

function setupMeditationToggle() {
  const didMeditateInput  = document.getElementById('didMeditateInput');
  const meditationDetails = document.getElementById('meditationDetails');
  if (!didMeditateInput || !meditationDetails) return;
  function updateVisibility() {
    meditationDetails.style.display = didMeditateInput.value === 'yes' ? 'block' : 'none';
  }
  didMeditateInput.addEventListener('change', updateVisibility);
  updateVisibility();
}

function loadTodayDate() {
  currentDateStr = todayStr();
  FibroDiag.debug('App', `loadTodayDate: set to ${currentDateStr}`);
  syncDateInput();
}

function setupSaveDay() {
  const floatBtn = document.getElementById('saveDayFloat');
  const status   = document.getElementById('saveStatus');
  const handleSaveClick = async () => {
    const dayData = collectFormData();
    if (!dayData.date) { if (status) status.textContent = 'Please select a date.'; return; }
    if (status) status.textContent = '';
    FibroDiag.info('App', `Saving day: ${dayData.date}`);
    FibroDiag.time('save-day');
    const days = loadAllDays();
    const existingIndex = days.findIndex(d => d.date === dayData.date);
    if (existingIndex >= 0) days[existingIndex] = dayData;
    else days.push(dayData);
    saveAllDays(days);
    try {
      await db.collection('days').doc(dayData.date).set(dayData, { merge: false });
      FibroDiag.timeEnd('save-day');
      FibroDiag.info('App', `Day saved to Firestore: ${dayData.date}`);
      showToast('\u2713 Day saved');
    } catch (err) {
      FibroDiag.error('App', `Firestore save failed for ${dayData.date}`, err);
      showToast('\u26A0 Cloud save failed — check connection', true);
    }
    refreshHistory();
    renderJournal();
    window.refreshTrends();
  };
  floatBtn?.addEventListener('click', handleSaveClick);
}

function setupNumberSteppers() {
  document.querySelectorAll('.number-stepper').forEach((stepper) => {
    const input = stepper.querySelector('input[type="number"]');
    const buttons = stepper.querySelectorAll('.stepper-btn');
    if (!input) return;
    const min = input.min !== '' ? Number(input.min) : null;
    const max = input.max !== '' ? Number(input.max) : null;
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.step || 0);
        let current = input.value === '' ? min ?? 0 : Number(input.value);
        let next = current + step;
        if (min !== null && next < min) next = min;
        if (max !== null && next > max) next = max;
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
}

function setupSleepCalculation() {
  const bedtimeInput  = document.getElementById('bedtimeInput');
  const wakeTimeInput = document.getElementById('wakeTimeInput');
  if (!bedtimeInput || !wakeTimeInput) return;
  bedtimeInput.addEventListener('input', updateSleepDuration);
  wakeTimeInput.addEventListener('input', updateSleepDuration);
  bedtimeInput.addEventListener('change', updateSleepDuration);
  wakeTimeInput.addEventListener('change', updateSleepDuration);
  updateSleepDuration();
}

function updateSleepDuration() {
  const bedtimeInput    = document.getElementById('bedtimeInput');
  const wakeTimeInput   = document.getElementById('wakeTimeInput');
  const hoursSleptInput = document.getElementById('hoursSleptInput');
  const hoursSleptDisplay = document.getElementById('hoursSleptDisplay');
  if (!bedtimeInput || !wakeTimeInput || !hoursSleptInput) return;
  const bedtime  = bedtimeInput.value;
  const wakeTime = wakeTimeInput.value;
  if (!bedtime || !wakeTime) {
    hoursSleptInput.value = '';
    if (hoursSleptDisplay) hoursSleptDisplay.textContent = '\u2014';
    return;
  }
  const [bedHour, bedMinute]   = bedtime.split(':').map(Number);
  const [wakeHour, wakeMinute] = wakeTime.split(':').map(Number);
  let bedtimeMinutes  = bedHour  * 60 + bedMinute;
  let wakeTimeMinutes = wakeHour * 60 + wakeMinute;
  if (wakeTimeMinutes <= bedtimeMinutes) wakeTimeMinutes += 24 * 60;
  const totalHours = Math.round(((wakeTimeMinutes - bedtimeMinutes) / 60) * 10) / 10;
  hoursSleptInput.value = totalHours;
  if (hoursSleptDisplay) hoursSleptDisplay.textContent = `${totalHours.toFixed(1)} hours`;
}

function clearFormFieldsExceptDate() {
  document.getElementById('dayTitleInput').value = '';
  document.getElementById('overallNotesInput').value = '';
  const clearBlock = (prefix) => {
    document.getElementById(prefix + 'Score').value = '';
    document.getElementById(prefix + 'Activity').value = '';
    document.getElementById(prefix + 'Symptoms').value = '';
  };
  ['earlyMorning','lateMorning','earlyAfternoon','lateAfternoon','earlyEvening','lateEvening'].forEach(clearBlock);
  document.getElementById('bedtimeInput').value = '';
  document.getElementById('wakeTimeInput').value = '';
  document.getElementById('hoursSleptInput').value = '';
  document.getElementById('sleepQualityInput').value = '';
  document.getElementById('awakeningsInput').value = '';
  document.getElementById('sleepNotesInput').value = '';
  updateSleepDuration();
  document.getElementById('didExerciseInput').value = 'no';
  document.getElementById('didExerciseInput').dispatchEvent(new Event('change'));
  document.getElementById('exerciseTypeInput').value = '';
  document.getElementById('exerciseMinutesInput').value = '';
  document.getElementById('exerciseIntensityInput').value = '';
  document.getElementById('exerciseTimingInput').value = '';
  document.getElementById('exerciseNotesInput').value = '';
  document.getElementById('didMeditateInput').value = 'no';
  document.getElementById('didMeditateInput').dispatchEvent(new Event('change'));
  document.getElementById('meditationMinutesInput').value = '';
  document.getElementById('meditationNotesInput').value = '';
  document.getElementById('moodScoreInput').value = '';
  document.getElementById('moodNotesInput').value = '';
  const painScoreEl   = document.getElementById('painScoreInput');   if (painScoreEl)   painScoreEl.value = '';
  const painNotesEl   = document.getElementById('painNotesInput');   if (painNotesEl)   painNotesEl.value = '';
  const fatScoreEl    = document.getElementById('fatigueScoreInput'); if (fatScoreEl)    fatScoreEl.value = '';
  const fatNotesEl    = document.getElementById('fatigueNotesInput'); if (fatNotesEl)    fatNotesEl.value = '';
  document.querySelectorAll('#tagsContainer input[type=checkbox]').forEach(cb => cb.checked = false);
}

function loadDayFromCloud(date) {
  if (!date) return;
  FibroDiag.debug('App', `loadDayFromCloud: fetching ${date}`);
  FibroDiag.time(`cloud-load-${date}`);
  db.collection('days').doc(date).get().then((doc) => {
    FibroDiag.timeEnd(`cloud-load-${date}`);
    if (doc.exists) {
      FibroDiag.info('App', `Cloud load success: ${date}`);
      fillFormFromData(Object.assign({ date: doc.id }, doc.data()));
      showToast('\u2601 Updated from cloud');
    } else {
      FibroDiag.debug('App', `No cloud entry for ${date} — clearing form`);
      clearFormFieldsExceptDate();
      showToast('No entry for that date — form cleared');
    }
  }).catch((error) => {
    FibroDiag.error('App', `Cloud load failed for ${date}`, error);
    clearFormFieldsExceptDate();
    showToast('\u26A0 Cloud load failed', true);
  });
}

function collectFormData() {
  const date = currentDateStr || document.getElementById('dateInput').value;
  const dayTitle = document.getElementById('dayTitleInput').value;
  const overallNotes = document.getElementById('overallNotesInput').value;
  const getBlock = (prefix) => ({
    score:    numberOrNull(document.getElementById(prefix + 'Score').value),
    activity: document.getElementById(prefix + 'Activity').value,
    symptoms: document.getElementById(prefix + 'Symptoms').value
  });
  const functionality = {
    earlyMorning:    getBlock('earlyMorning'),
    lateMorning:     getBlock('lateMorning'),
    earlyAfternoon:  getBlock('earlyAfternoon'),
    lateAfternoon:   getBlock('lateAfternoon'),
    earlyEvening:    getBlock('earlyEvening'),
    lateEvening:     getBlock('lateEvening')
  };
  const sleep = {
    bedtime:    document.getElementById('bedtimeInput').value,
    wakeTime:   document.getElementById('wakeTimeInput').value,
    hours:      numberOrNull(document.getElementById('hoursSleptInput').value),
    quality:    numberOrNull(document.getElementById('sleepQualityInput').value),
    awakenings: numberOrNull(document.getElementById('awakeningsInput').value),
    notes:      document.getElementById('sleepNotesInput').value
  };
  const didExercise = document.getElementById('didExerciseInput').value === 'yes';
  const exercise = didExercise ? {
    type:      document.getElementById('exerciseTypeInput').value,
    minutes:   numberOrNull(document.getElementById('exerciseMinutesInput').value),
    intensity: document.getElementById('exerciseIntensityInput').value,
    timing:    document.getElementById('exerciseTimingInput').value,
    notes:     document.getElementById('exerciseNotesInput').value
  } : null;
  const didMeditate = document.getElementById('didMeditateInput').value === 'yes';
  const meditation = didMeditate ? {
    minutes: numberOrNull(document.getElementById('meditationMinutesInput').value),
    notes:   document.getElementById('meditationNotesInput').value
  } : null;
  const tags = [];
  document.querySelectorAll('#tagsContainer input[type=checkbox]').forEach(cb => { if (cb.checked) tags.push(cb.value); });
  const scores = Object.values(functionality).map(b => b.score).filter(v => typeof v === 'number');
  const avgFunctionality = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const moodScore = numberOrNull(document.getElementById('moodScoreInput').value);
  const moodNotes = document.getElementById('moodNotesInput').value;
  const painScoreEl  = document.getElementById('painScoreInput');
  const painNotesEl  = document.getElementById('painNotesInput');
  const fatScoreEl   = document.getElementById('fatigueScoreInput');
  const fatNotesEl   = document.getElementById('fatigueNotesInput');
  return {
    date, dayTitle, overallNotes, functionality, sleep,
    didExercise, exercise,
    didMeditate, meditation,
    tags, avgFunctionality,
    mood: { score: moodScore, notes: moodNotes },
    painScore:    painScoreEl  ? numberOrNull(painScoreEl.value)  : null,
    painNotes:    painNotesEl  ? painNotesEl.value  : '',
    fatigueScore: fatScoreEl   ? numberOrNull(fatScoreEl.value)   : null,
    fatigueNotes: fatNotesEl   ? fatNotesEl.value   : ''
  };
}

function scoreChipClass(score) {
  if (score == null) return '';
  if (score <= 3) return 'score-low';
  if (score <= 6) return 'score-mid';
  return 'score-high';
}

function setupHistoryControls() {
  const fromEl = document.getElementById('historyFrom');
  const toEl   = document.getElementById('historyTo');
  if (fromEl && !fromEl.value) fromEl.value = nDaysAgo(13);
  if (toEl   && !toEl.value)   toEl.value   = todayStr();
  document.getElementById('loadHistoryBtn')?.addEventListener('click', () => {
    // Always force a fresh API call when user explicitly clicks Analyze
    if (typeof window.resetInsights === 'function') window.resetInsights();
    refreshHistory();
  });
}

function refreshHistory() {
  const fromEl = document.getElementById('historyFrom');
  const toEl   = document.getElementById('historyTo');
  const from   = fromEl?.value || nDaysAgo(13);
  const to     = toEl?.value   || todayStr();
  FibroDiag.debug('App', `refreshHistory: ${from} \u2192 ${to}`);
  if (typeof window.loadAndRenderHistory === 'function') {
    window.loadAndRenderHistory(from, to, 'historyList');
  } else {
    const list = document.getElementById('historyList');
    if (list) list.innerHTML = "<p class='history-empty'>History renderer not loaded.</p>";
  }
}

function fillFormFromData(d) {
  if (d.date) currentDateStr = d.date;
  syncDateInput();
  document.getElementById('dayTitleInput').value    = d.dayTitle || '';
  document.getElementById('overallNotesInput').value = d.overallNotes || '';
  const setBlock = (prefix, obj = {}) => {
    document.getElementById(prefix + 'Score').value    = obj.score ?? '';
    document.getElementById(prefix + 'Activity').value = obj.activity || '';
    document.getElementById(prefix + 'Symptoms').value = obj.symptoms || '';
  };
  setBlock('earlyMorning',   d.functionality?.earlyMorning);
  setBlock('lateMorning',    d.functionality?.lateMorning);
  setBlock('earlyAfternoon', d.functionality?.earlyAfternoon);
  setBlock('lateAfternoon',  d.functionality?.lateAfternoon);
  setBlock('earlyEvening',   d.functionality?.earlyEvening);
  setBlock('lateEvening',    d.functionality?.lateEvening);
  if (d.sleep) {
    document.getElementById('bedtimeInput').value    = d.sleep.bedtime || '';
    document.getElementById('wakeTimeInput').value   = d.sleep.wakeTime || '';
    document.getElementById('hoursSleptInput').value = d.sleep.hours ?? '';
    document.getElementById('sleepQualityInput').value = d.sleep.quality ?? '';
    document.getElementById('awakeningsInput').value = d.sleep.awakenings ?? '';
    document.getElementById('sleepNotesInput').value = d.sleep.notes || '';
  }
  if (d.didExercise && d.exercise) {
    document.getElementById('didExerciseInput').value    = 'yes';
    document.getElementById('exerciseTypeInput').value   = d.exercise.type || '';
    document.getElementById('exerciseMinutesInput').value = d.exercise.minutes ?? '';
    document.getElementById('exerciseIntensityInput').value = d.exercise.intensity || '';
    document.getElementById('exerciseTimingInput').value = d.exercise.timing || '';
    document.getElementById('exerciseNotesInput').value  = d.exercise.notes || '';
  } else {
    document.getElementById('didExerciseInput').value = 'no';
  }
  document.getElementById('didExerciseInput').dispatchEvent(new Event('change'));
  if (d.didMeditate && d.meditation) {
    document.getElementById('didMeditateInput').value       = 'yes';
    document.getElementById('meditationMinutesInput').value = d.meditation.minutes ?? '';
    document.getElementById('meditationNotesInput').value   = d.meditation.notes || '';
  } else {
    document.getElementById('didMeditateInput').value = 'no';
  }
  document.getElementById('didMeditateInput').dispatchEvent(new Event('change'));
  // Fall back to legacy top-level moodScore for entries saved before the mood object was introduced
  document.getElementById('moodScoreInput').value = d.mood?.score ?? d.moodScore ?? '';
  document.getElementById('moodNotesInput').value = d.mood?.notes || d.moodNotes || '';
  const painScoreEl  = document.getElementById('painScoreInput');   if (painScoreEl)  painScoreEl.value  = d.painScore    ?? '';
  const painNotesEl  = document.getElementById('painNotesInput');   if (painNotesEl)  painNotesEl.value  = d.painNotes    || '';
  const fatScoreEl   = document.getElementById('fatigueScoreInput'); if (fatScoreEl)   fatScoreEl.value   = d.fatigueScore ?? '';
  const fatNotesEl   = document.getElementById('fatigueNotesInput'); if (fatNotesEl)   fatNotesEl.value   = d.fatigueNotes || '';
  updateSleepDuration();
  renderJournal();
  const tagsSet = new Set(d.tags || []);
  document.querySelectorAll('#tagsContainer input[type=checkbox]').forEach(cb => cb.checked = tagsSet.has(cb.value));
}

function changeDateBy(days) {
  if (!currentDateStr) currentDateStr = todayStr();
  const [y, mo, dy] = currentDateStr.split('-').map(Number);
  const current = new Date(y, mo - 1, dy);
  if (isNaN(current.getTime())) return;
  current.setDate(current.getDate() + days);
  currentDateStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
  FibroDiag.debug('App', `changeDateBy(${days}): now ${currentDateStr}`);
  syncDateInput();
  loadDayFromCloud(currentDateStr);
}

function setupDateNavigation() {
  document.getElementById('prevDayBtn')?.addEventListener('click', () => changeDateBy(-1));
  document.getElementById('nextDayBtn')?.addEventListener('click', () => changeDateBy(1));
}

function switchToTab(tabId) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId));
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.id === tabId));
  const tabSelect = document.getElementById('tabSelect');
  if (tabSelect && tabSelect.value !== tabId) tabSelect.value = tabId;
  if (tabId === 'entry-tab') syncDateInput();
}

function formatScore(value) { return typeof value === 'number' ? value : 'not recorded'; }
function formatText(value, fallback = 'Not recorded.') { return value && String(value).trim() ? value : fallback; }

// ================================================================
//  EXPORT / IMPORT DATA
// ================================================================

async function exportAllData() {
  const statusEl = document.getElementById('exportImportStatus');
  const btn = document.getElementById('exportDataBtn');
  statusEl.style.display = 'block';
  statusEl.className = 'settings-status settings-status-info';
  statusEl.textContent = 'Exporting\u2026 please wait.';
  btn.disabled = true;
  FibroDiag.info('App', 'Export started');
  FibroDiag.time('export-all');
  try {
    const collections = ['days','medications','supplements','medicationHistory','careTeam','appointments','automaticThoughtRecords','conditions'];
    const backup = { exportedAt: new Date().toISOString(), appVersion: 'FibroSymptomTracker', collections: {} };
    for (const col of collections) {
      const snap = await db.collection(col).get();
      backup.collections[col] = {};
      snap.forEach(doc => { backup.collections[col][doc.id] = doc.data(); });
      FibroDiag.debug('App', `Exported ${col}: ${snap.size} records`);
      statusEl.textContent = `Exporting ${col}\u2026 (${snap.size} records)`;
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fibro-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    let total = 0;
    for (const col of collections) total += Object.keys(backup.collections[col]).length;
    FibroDiag.timeEnd('export-all');
    FibroDiag.info('App', `Export complete: ${total} total records`);
    statusEl.className = 'settings-status settings-status-success';
    statusEl.textContent = `\u2713 Export complete \u2014 ${total} total records downloaded.`;
  } catch (err) {
    FibroDiag.error('App', 'Export failed', err);
    statusEl.className = 'settings-status settings-status-error';
    statusEl.textContent = 'Export failed: ' + err.message;
  } finally { btn.disabled = false; }
}

let pendingImportData = null;

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  FibroDiag.info('App', `Import file selected: ${file.name}`);
  const statusEl    = document.getElementById('exportImportStatus');
  const confirmBox  = document.getElementById('importConfirmBox');
  const confirmMsg  = document.getElementById('importConfirmMsg');
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.collections) throw new Error('Invalid backup file format.');
      let total = 0;
      const cols = Object.keys(data.collections);
      cols.forEach(c => total += Object.keys(data.collections[c]).length);
      FibroDiag.debug('App', `Import file parsed: ${total} records across ${cols.length} collections`);
      pendingImportData = data;
      confirmMsg.textContent = `Import ${total} records across ${cols.length} collections from backup dated ${data.exportedAt ? data.exportedAt.slice(0,10) : 'unknown'}? This will overwrite existing matching records.`;
      confirmBox.style.display = 'block';
      statusEl.style.display = 'none';
    } catch (err) {
      FibroDiag.error('App', 'Import file parse error', err);
      statusEl.style.display = 'block';
      statusEl.className = 'settings-status settings-status-error';
      statusEl.textContent = 'Could not read file: ' + err.message;
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function confirmImport() {
  const statusEl   = document.getElementById('exportImportStatus');
  const confirmBox = document.getElementById('importConfirmBox');
  const confirmBtn = document.getElementById('importConfirmBtn');
  if (!pendingImportData) return;
  confirmBox.style.display = 'none';
  statusEl.style.display = 'block';
  statusEl.className = 'settings-status settings-status-info';
  statusEl.textContent = 'Importing\u2026 please wait.';
  confirmBtn.disabled = true;
  FibroDiag.info('App', 'Import confirmed — writing to Firestore');
  FibroDiag.time('import-all');
  try {
    const collections = pendingImportData.collections;
    let total = 0;
    for (const col of Object.keys(collections)) {
      const docs = collections[col];
      for (const [id, data] of Object.entries(docs)) {
        await db.collection(col).doc(id).set(data, { merge: true });
        total++;
      }
      FibroDiag.debug('App', `Imported collection: ${col}`);
      statusEl.textContent = `Importing ${col}\u2026`;
    }
    FibroDiag.timeEnd('import-all');
    FibroDiag.info('App', `Import complete: ${total} records`);
    statusEl.className = 'settings-status settings-status-success';
    statusEl.textContent = `\u2713 Import complete \u2014 ${total} records restored.`;
    pendingImportData = null;
  } catch (err) {
    FibroDiag.error('App', 'Import failed', err);
    statusEl.className = 'settings-status settings-status-error';
    statusEl.textContent = 'Import failed: ' + err.message;
  } finally { confirmBtn.disabled = false; }
}

function cancelImport() {
  pendingImportData = null;
  document.getElementById('importConfirmBox').style.display = 'none';
  document.getElementById('importFileInput').value = '';
  FibroDiag.debug('App', 'Import cancelled');
}
