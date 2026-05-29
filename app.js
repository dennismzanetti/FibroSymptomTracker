// ============================================================
// FIBRO SYMPTOM TRACKER — app.js
// ============================================================

// Firebase references (set in firebase-init.js)
let db, auth, currentUser;

// ---- Date state ----
let currentDateStr = '';

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

function syncDateInput() {
  const input  = document.getElementById('dateInput');
  const inputM = document.getElementById('dateInputMobile');
  if (input)  input.value  = currentDateStr;
  if (inputM) inputM.value = currentDateStr;
  renderDateDisplay(currentDateStr);
}

function renderDateDisplay(dateStr) {
  const [y, mo, dy] = dateStr.split('-').map(Number);
  const d = new Date(y, mo - 1, dy);
  const label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const els = document.querySelectorAll('.date-display');
  els.forEach(el => el.textContent = label);
}

function offsetDate(n) {
  const [y, mo, dy] = currentDateStr.split('-').map(Number);
  const d = new Date(y, mo - 1, dy);
  d.setDate(d.getDate() + n);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  const nd = String(d.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function setupDateNavigation() {
  document.getElementById('prevDayBtn')?.addEventListener('click', () => {
    currentDateStr = offsetDate(-1);
    syncDateInput();
    loadEntry(currentDateStr);
  });
  document.getElementById('nextDayBtn')?.addEventListener('click', () => {
    currentDateStr = offsetDate(1);
    syncDateInput();
    loadEntry(currentDateStr);
  });
  document.getElementById('prevDayBtnMobile')?.addEventListener('click', () => {
    currentDateStr = offsetDate(-1);
    syncDateInput();
    loadEntry(currentDateStr);
  });
  document.getElementById('nextDayBtnMobile')?.addEventListener('click', () => {
    currentDateStr = offsetDate(1);
    syncDateInput();
    loadEntry(currentDateStr);
  });

  const dateInput  = document.getElementById('dateInput');
  const dateInputM = document.getElementById('dateInputMobile');
  const dateDisplay  = document.querySelector('#dateDisplayDesktop');
  const dateDisplayM = document.querySelector('#dateDisplayMobile');

  if (dateDisplay) {
    dateDisplay.addEventListener('click', () => dateInput?.showPicker?.());
  }
  if (dateDisplayM) {
    dateDisplayM.addEventListener('click', () => dateInputM?.showPicker?.());
  }

  dateInput?.addEventListener('change', () => {
    currentDateStr = dateInput.value;
    syncDateInput();
    loadEntry(currentDateStr);
  });
  dateInputM?.addEventListener('change', () => {
    currentDateStr = dateInputM.value;
    syncDateInput();
    loadEntry(currentDateStr);
  });
}

// ---- Toast ----
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.toggle('toast-error', isError);
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---- HTML escape ----
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const tabs = document.querySelectorAll(".tab");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      buttons.forEach(b => b.classList.remove("active"));
      tabs.forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(target).classList.add("active");
      if (target === "history-tab") refreshHistory();
      if (target === "journal-tab") renderJournal();
      if (target === "trends-tab") refreshTrends();
      if (target === "mood-tab") refreshMoodTab();
      if (target === "medications-tab") {
        const activeView = document.querySelector(".med-view:not([style*='display:none']):not([style*='display: none'])");
        if (activeView) refreshMedView(activeView.id);
      }
      if (target === "careteam-tab") setupCareTeamTab();
      if (target === "entry-tab") syncDateInput();
    });
  });
}

function setupExerciseToggle() {
  const didExerciseInput = document.getElementById("didExerciseInput");
  const exerciseDetails = document.getElementById("exerciseDetails");
  function updateVisibility() {
    exerciseDetails.style.display = didExerciseInput.value === "yes" ? "block" : "none";
  }
  didExerciseInput.addEventListener("change", updateVisibility);
  updateVisibility();
}

function loadTodayDate() {
  currentDateStr = todayStr();
  syncDateInput();
}

function setupSaveDay() {
  const floatBtn  = document.getElementById("saveDayFloat");
  const status    = document.getElementById("saveStatus");

  const handleSaveClick = async () => {
    if (!currentUser) { showToast('Please sign in to save', true); return; }
    const entry = collectEntry();
    try {
      await db.collection('entries').doc(currentDateStr).set(entry, { merge: true });
      if (status) {
        status.textContent = 'Saved ✓';
        setTimeout(() => { if (status) status.textContent = ''; }, 2500);
      }
      showToast('✓ Day saved');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('⚠ Save failed — check connection', true);
    }
  };

  floatBtn?.addEventListener('click', handleSaveClick);
}

// ---- Entry form ----
function collectEntry() {
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function num(id) {
    const v = val(id);
    return v !== '' ? Number(v) : null;
  }

  const painRegions = [];
  document.querySelectorAll('.body-region.active').forEach(r => {
    painRegions.push(r.getAttribute('data-region'));
  });

  return {
    date:            currentDateStr,
    painLevel:       num('painLevel'),
    fatigue:         num('fatigueLevel'),
    sleep:           num('sleepLevel'),
    sleepHours:      num('sleepHours'),
    brainfog:        num('brainfogLevel'),
    mood:            num('moodLevel'),
    stress:          num('stressLevel'),
    exercise:        val('didExerciseInput'),
    exerciseType:    val('exerciseTypeInput'),
    exerciseDuration:num('exerciseDurationInput'),
    exerciseNotes:   val('exerciseNotesInput'),
    painRegions:     painRegions,
    notes:           val('generalNotes'),
    updatedAt:       new Date().toISOString()
  };
}

function populateEntry(data) {
  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el && v != null) el.value = v;
  }
  function setSlider(id, displayId, v) {
    if (v == null) return;
    const el = document.getElementById(id);
    const disp = document.getElementById(displayId);
    if (el) el.value = v;
    if (disp) disp.textContent = v;
  }

  setSlider('painLevel',    'painLevelDisplay',    data.painLevel);
  setSlider('fatigueLevel', 'fatigueLevelDisplay', data.fatigue);
  setSlider('sleepLevel',   'sleepLevelDisplay',   data.sleep);
  setSlider('brainfogLevel','brainfogLevelDisplay', data.brainfog);
  setSlider('moodLevel',    'moodLevelDisplay',    data.mood);
  setSlider('stressLevel',  'stressLevelDisplay',  data.stress);
  setVal('sleepHours', data.sleepHours);
  setVal('didExerciseInput', data.exercise);
  setVal('exerciseTypeInput', data.exerciseType);
  setVal('exerciseDurationInput', data.exerciseDuration);
  setVal('exerciseNotesInput', data.exerciseNotes);
  setVal('generalNotes', data.notes);

  // Update exercise visibility
  const didExerciseInput = document.getElementById('didExerciseInput');
  const exerciseDetails  = document.getElementById('exerciseDetails');
  if (didExerciseInput && exerciseDetails) {
    exerciseDetails.style.display = didExerciseInput.value === 'yes' ? 'block' : 'none';
  }

  // Pain body regions
  document.querySelectorAll('.body-region').forEach(r => r.classList.remove('active'));
  if (data.painRegions && Array.isArray(data.painRegions)) {
    data.painRegions.forEach(region => {
      document.querySelectorAll(`.body-region[data-region="${region}"]`)
        .forEach(el => el.classList.add('active'));
    });
  }
}

function clearEntry() {
  ['painLevel','fatigueLevel','sleepLevel','brainfogLevel','moodLevel','stressLevel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = 5; }
    const disp = document.getElementById(id + 'Display');
    if (disp) disp.textContent = 5;
  });
  ['sleepHours','didExerciseInput','exerciseTypeInput','exerciseDurationInput',
   'exerciseNotesInput','generalNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.body-region').forEach(r => r.classList.remove('active'));
  const exerciseDetails = document.getElementById('exerciseDetails');
  if (exerciseDetails) exerciseDetails.style.display = 'none';
}

async function loadEntry(dateStr) {
  clearEntry();
  try {
    const doc = await db.collection('entries').doc(dateStr).get();
    if (doc.exists) populateEntry(doc.data());
  } catch (err) {
    console.error('Error loading entry:', err);
  }
}

// ---- Slider live display ----
function setupSliders() {
  [
    ['painLevel',     'painLevelDisplay'],
    ['fatigueLevel',  'fatigueLevelDisplay'],
    ['sleepLevel',    'sleepLevelDisplay'],
    ['brainfogLevel', 'brainfogLevelDisplay'],
    ['moodLevel',     'moodLevelDisplay'],
    ['stressLevel',   'stressLevelDisplay'],
  ].forEach(([sliderId, displayId]) => {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (slider && display) {
      slider.addEventListener('input', () => { display.textContent = slider.value; });
    }
  });
}

// ---- Pain body SVG interaction ----
function setupPainBody() {
  document.querySelectorAll('.body-region').forEach(region => {
    region.addEventListener('click', () => {
      region.classList.toggle('active');
    });
  });
}

// ---- Entry section collapse ----
function setupEntrySections() {
  document.querySelectorAll('.entry-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.entry-section');
      section?.classList.toggle('collapsed');
    });
  });
}

// ================================================================
// HISTORY
// ================================================================

async function refreshHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="12" class="history-empty">Loading…</td></tr>';

  const startInput = document.getElementById('historyStartDate');
  const endInput   = document.getElementById('historyEndDate');
  const startDate  = startInput?.value || '';
  const endDate    = endInput?.value   || '';

  try {
    let query = db.collection('entries').orderBy('date', 'desc');
    if (startDate) query = query.where('date', '>=', startDate);
    if (endDate)   query = query.where('date', '<=', endDate);
    query = query.limit(90);

    const snapshot = await query.get();

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="12" class="history-empty">No entries found for the selected range.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    snapshot.forEach(doc => {
      const d = doc.data();
      const [y, mo, dy] = (d.date || '').split('-').map(Number);
      const dateObj = (y && mo && dy) ? new Date(y, mo - 1, dy) : null;
      const dateLabel = dateObj
        ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        : (d.date || '');

      const frontSvg = buildCompactBodySvg(d.painRegions, 'front');
      const backSvg  = buildCompactBodySvg(d.painRegions, 'back');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="history-date-cell">${escHtml(dateLabel)}</td>
        <td>${d.painLevel  != null ? d.painLevel  : '—'}</td>
        <td>${d.fatigue    != null ? d.fatigue    : '—'}</td>
        <td>${d.sleep      != null ? d.sleep      : '—'}</td>
        <td>${d.sleepHours != null ? d.sleepHours : '—'}</td>
        <td>${d.brainfog   != null ? d.brainfog   : '—'}</td>
        <td>${d.mood       != null ? d.mood       : '—'}</td>
        <td>${d.stress     != null ? d.stress     : '—'}</td>
        <td>${escHtml(d.exercise || '')}</td>
        <td>
          <div class="pain-body-compact-container" title="${escHtml((d.painRegions||[]).join(', '))}">
            <div>${frontSvg}<span class="pain-body-compact-label">F</span></div>
            <div>${backSvg}<span class="pain-body-compact-label">B</span></div>
          </div>
        </td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(d.notes||'')}">${escHtml(d.notes||'')}</td>
        <td><button class="history-delete-btn" data-date="${escHtml(d.date)}">Del</button></td>
      `;
      tr.querySelector('.history-delete-btn').addEventListener('click', async (e) => {
        const dateKey = e.target.getAttribute('data-date');
        if (!window.confirm(`Delete the entry for ${dateKey}?`)) return;
        try {
          await db.collection('entries').doc(dateKey).delete();
          refreshHistory();
          showToast('Entry deleted');
        } catch (err) {
          console.error('Delete error:', err);
          showToast('⚠ Delete failed', true);
        }
      });
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('History load error:', err);
    tbody.innerHTML = '<tr><td colspan="12" class="history-empty">⚠ Failed to load history.</td></tr>';
  }
}

function buildCompactBodySvg(painRegions, view) {
  const regions = painRegions || [];
  const isActive = (r) => regions.includes(r);
  const fill = (r) => isActive(r) ? '#e57373' : '#ddd';

  if (view === 'front') {
    return `<svg class="pain-body-compact-svg" viewBox="0 0 60 120" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="30" cy="10" rx="10" ry="10" fill="${fill('head-front')}"/>
      <rect x="20" y="22" width="20" height="22" rx="4" fill="${fill('chest')}"/>
      <rect x="20" y="46" width="20" height="18" rx="3" fill="${fill('abdomen')}"/>
      <rect x="8" y="22" width="10" height="28" rx="4" fill="${fill('left-arm-front')}"/>
      <rect x="42" y="22" width="10" height="28" rx="4" fill="${fill('right-arm-front')}"/>
      <rect x="20" y="66" width="9" height="30" rx="4" fill="${fill('left-leg-front')}"/>
      <rect x="31" y="66" width="9" height="30" rx="4" fill="${fill('right-leg-front')}"/>
    </svg>`;
  } else {
    return `<svg class="pain-body-compact-svg" viewBox="0 0 60 120" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="30" cy="10" rx="10" ry="10" fill="${fill('head-back')}"/>
      <rect x="20" y="22" width="20" height="22" rx="4" fill="${fill('upper-back')}"/>
      <rect x="20" y="46" width="20" height="18" rx="3" fill="${fill('lower-back')}"/>
      <rect x="8" y="22" width="10" height="28" rx="4" fill="${fill('left-arm-back')}"/>
      <rect x="42" y="22" width="10" height="28" rx="4" fill="${fill('right-arm-back')}"/>
      <rect x="20" y="66" width="9" height="30" rx="4" fill="${fill('left-leg-back')}"/>
      <rect x="31" y="66" width="9" height="30" rx="4" fill="${fill('right-leg-back')}"/>
    </svg>`;
  }
}

// ================================================================
// TRENDS
// ================================================================

let trendsChartInstances = {};

async function refreshTrends() {
  const FIELDS = [
    { key: 'painLevel',  label: 'Pain',     color: '#e57373' },
    { key: 'fatigue',    label: 'Fatigue',   color: '#ffb74d' },
    { key: 'sleep',      label: 'Sleep',     color: '#4fc3f7' },
    { key: 'brainfog',   label: 'Brain Fog', color: '#9575cd' },
    { key: 'mood',       label: 'Mood',      color: '#81c784' },
    { key: 'stress',     label: 'Stress',    color: '#f06292' },
  ];

  try {
    const snapshot = await db.collection('entries').orderBy('date', 'asc').limit(30).get();
    const labels = [];
    const datasets = Object.fromEntries(FIELDS.map(f => [f.key, []]));

    snapshot.forEach(doc => {
      const d = doc.data();
      const [y, mo, dy] = (d.date || '').split('-').map(Number);
      const dateObj = (y && mo && dy) ? new Date(y, mo - 1, dy) : null;
      labels.push(dateObj
        ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : d.date);
      FIELDS.forEach(f => datasets[f.key].push(d[f.key] ?? null));
    });

    FIELDS.forEach(f => {
      const canvasId = `${f.key}Chart`;
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      if (trendsChartInstances[canvasId]) {
        trendsChartInstances[canvasId].destroy();
      }
      trendsChartInstances[canvasId] = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: f.label,
            data: datasets[f.key],
            borderColor: f.color,
            backgroundColor: f.color + '22',
            tension: 0.3,
            pointRadius: 3,
            spanGaps: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 10, ticks: { stepSize: 2 } },
            x: { ticks: { maxRotation: 45, font: { size: 10 } } }
          }
        }
      });
    });
  } catch (err) {
    console.error('Trends load error:', err);
  }
}

// ================================================================
// SHOW TAB (used by mobile select)
// ================================================================

function showTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  if (tabId === 'history-tab') refreshHistory();
  if (tabId === 'journal-tab') renderJournal();
  if (tabId === 'trends-tab') refreshTrends();
  if (tabId === 'mood-tab') refreshMoodTab();
  if (tabId === 'medications-tab') {
    const activeView = document.querySelector(".med-view:not([style*='display:none']):not([style*='display: none'])");
    if (activeView) refreshMedView(activeView.id);
  }
  if (tabId === 'careteam-tab') setupCareTeamTab();
  if (tabId === 'entry-tab') syncDateInput();
}

// ================================================================
// INIT
// ================================================================

function initApp(firebaseDb, firebaseAuth, user) {
  db = firebaseDb;
  auth = firebaseAuth;
  currentUser = user;

  loadTodayDate();
  loadEntry(currentDateStr);
  setupTabs();
  setupDateNavigation();
  setupSaveDay();
  setupSliders();
  setupPainBody();
  setupEntrySections();
  setupMedicationsTab();
  loadBuildInfo();

  // Mobile tab select
  const tabSelect = document.getElementById('tabSelect');
  if (tabSelect) {
    tabSelect.addEventListener('change', () => showTab(tabSelect.value));
  }
}

// ================================================================
// BUILD INFO FOOTER
// ================================================================

async function loadBuildInfo() {
  try {
    const res = await fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits/main');
    if (!res.ok) return;
    const data = await res.json();
    const sha     = data.sha?.slice(0, 7) || '';
    const msg     = data.commit?.message?.split('\n')[0] || '';
    const dateStr = data.commit?.author?.date || '';
    const date    = dateStr ? new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    const shaEl   = document.getElementById('buildSha');
    const msgEl   = document.getElementById('buildMsg');
    const dateEl  = document.getElementById('buildDate');

    if (shaEl)  { shaEl.textContent = sha;  shaEl.href = `https://github.com/dennismzanetti/FibroSymptomTracker/commit/${data.sha}`; }
    if (msgEl)  msgEl.textContent  = msg;
    if (dateEl) dateEl.textContent = date;
  } catch (err) {
    console.warn('Could not load build info:', err);
  }
}
