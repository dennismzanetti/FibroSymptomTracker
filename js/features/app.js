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
