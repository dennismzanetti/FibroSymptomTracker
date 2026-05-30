// =============================================================
// app.js — FibroSymptomTracker
// Entry point: Firebase init, auth, daily entry load/save
// =============================================================

// ---- Firebase config ----
const firebaseConfig = {
  apiKey: "AIzaSyC0iFLf5DFhFIlRbOWBxUvHlkb4eZdJBt0",
  authDomain: "fibrosymptomtracker.firebaseapp.com",
  projectId: "fibrosymptomtracker",
  storageBucket: "fibrosymptomtracker.appspot.com",
  messagingSenderId: "882049131481",
  appId: "1:882049131481:web:0f5ea3db4e0fcf9cc8a84a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let currentDateStr = getTodayStr();

function getTodayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---- Auth ----
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById('authOverlay').style.display = 'none';
    const signOutBtn = document.getElementById('signOutBtn');
    const signOutBtnMobile = document.getElementById('signOutBtnMobile');
    if (signOutBtn) signOutBtn.style.display = '';
    if (signOutBtnMobile) signOutBtnMobile.style.display = '';
    init();
  } else {
    currentUser = null;
    document.getElementById('authOverlay').style.display = 'flex';
    const signOutBtn = document.getElementById('signOutBtn');
    const signOutBtnMobile = document.getElementById('signOutBtnMobile');
    if (signOutBtn) signOutBtn.style.display = 'none';
    if (signOutBtnMobile) signOutBtnMobile.style.display = 'none';
  }
});

document.getElementById('googleSignInBtn').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    document.getElementById('authError').textContent = err.message;
  });
});

const signOutBtn = document.getElementById('signOutBtn');
const signOutBtnMobile = document.getElementById('signOutBtnMobile');
if (signOutBtn) signOutBtn.addEventListener('click', () => auth.signOut());
if (signOutBtnMobile) signOutBtnMobile.addEventListener('click', () => auth.signOut());

// ---- Init (called after sign-in) ----
function init() {
  const dateInput = document.getElementById("dateInput");
  if (dateInput) {
    dateInput.value = currentDateStr;
    dateInput.addEventListener("change", () => {
      const v = dateInput.value;
      if (!v) return;
      currentDateStr = v;
      updateDateDisplay(v);
      loadEntry(v);
    });
  }
  updateDateDisplay(currentDateStr);
  loadEntry(currentDateStr);
  setupTabs();
  setupDatePicker();
  setupSleepCalculation();
  setupNumberSteppers();
  setupAtrForm();

  const prevBtn = document.getElementById("prevDayBtn");
  const nextBtn = document.getElementById("nextDayBtn");
  if (prevBtn) prevBtn.addEventListener("click", () => shiftDay(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => shiftDay(1));

  const saveDayFloat = document.getElementById("saveDayFloat");
  if (saveDayFloat) saveDayFloat.addEventListener("click", saveDay);

  loadBuildInfo();
  initMoodTab();
  initMedications();
  initCareTeam();
  initJournal();
}

// ---- Date picker button wiring ----
// The <input type="date"> is overlaid on the button via CSS (opacity:0, inset:0).
// Clicking anywhere on the button hits the native date input directly — no showPicker() needed.
function setupDatePicker() {
  // No additional click wiring needed; the overlay handles it natively.
  // Keep function present so call-sites don't error.
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
      const tab = document.getElementById(target);
      if (tab) tab.classList.add("active");
      if (target === "history-tab") loadHistoryRange();
      if (target === "trends-tab") loadTrends();
      if (target === "mood-tab") loadMoodSummary();
    });
  });

  const tabSelect = document.getElementById("tabSelect");
  if (tabSelect) {
    tabSelect.addEventListener("change", () => {
      const target = tabSelect.value;
      buttons.forEach(b => b.classList.remove("active"));
      tabs.forEach(t => t.classList.remove("active"));
      const matchingBtn = document.querySelector(`.tab-button[data-tab="${target}"]`);
      if (matchingBtn) matchingBtn.classList.add("active");
      const tab = document.getElementById(target);
      if (tab) tab.classList.add("active");
      if (target === "history-tab") loadHistoryRange();
      if (target === "trends-tab") loadTrends();
      if (target === "mood-tab") loadMoodSummary();
    });
  }
}

function shiftDay(delta) {
  const d = new Date(currentDateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  currentDateStr = `${yyyy}-${mm}-${dd}`;
  const dateInput = document.getElementById("dateInput");
  if (dateInput) dateInput.value = currentDateStr;
  updateDateDisplay(currentDateStr);
  loadEntry(currentDateStr);
}

function updateDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dow = days[d.getDay()];
  const dateText = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  const dowEl = document.getElementById('dayOfWeekDisplay');
  const dateEl = document.getElementById('dateDisplay');
  if (dowEl) dowEl.textContent = dow;
  if (dateEl) dateEl.textContent = dateText;

  const dayLabel = document.getElementById('entryDayLabel');
  if (dayLabel) {
    const today = getTodayStr();
    if (dateStr === today) {
      dayLabel.textContent = 'Today';
    } else {
      const diff = Math.round((new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
      if (diff === -1) dayLabel.textContent = 'Yesterday';
      else if (diff === 1) dayLabel.textContent = 'Tomorrow';
      else dayLabel.textContent = '';
    }
  }
}

// ---- Load / Save Entry ----
function loadEntry(dateStr) {
  if (!currentUser) return;
  const docRef = db.collection('users').doc(currentUser.uid)
                   .collection('entries').doc(dateStr);
  docRef.get().then(doc => {
    const data = doc.exists ? doc.data() : {};
    fillForm(data);
  }).catch(err => {
    console.error('Error loading entry:', err);
  });
}

function fillForm(data) {
  function set(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val !== undefined && val !== null ? val : '';
  }

  set('dayTitleInput', data.dayTitle);
  set('overallNotesInput', data.overallNotes);
  set('moodScoreInput', data.moodScore);
  set('moodNotesInput', data.moodNotes);

  const periods = ['earlyMorning','lateMorning','earlyAfternoon','lateAfternoon','earlyEvening','lateEvening'];
  periods.forEach(p => {
    const d = (data.timeBlocks || {})[p] || {};
    set(p + 'Score', d.score);
    set(p + 'Activity', d.activity);
    set(p + 'Symptoms', d.symptoms);
  });

  set('bedtimeInput', (data.sleep || {}).bedtime);
  set('wakeTimeInput', (data.sleep || {}).wakeTime);
  set('sleepQualityInput', (data.sleep || {}).quality);
  set('awakeningsInput', (data.sleep || {}).awakenings);
  set('sleepNotesInput', (data.sleep || {}).notes);
  if ((data.sleep || {}).hoursSlept !== undefined) {
    document.getElementById('hoursSleptDisplay').textContent = data.sleep.hoursSlept;
    document.getElementById('hoursSleptInput').value = data.sleep.hoursSlept;
  } else {
    document.getElementById('hoursSleptDisplay').textContent = '\u2014';
    document.getElementById('hoursSleptInput').value = '';
  }

  set('didExerciseInput', data.exercise ? (data.exercise.didExercise || 'no') : 'no');
  set('exerciseTypeInput', (data.exercise || {}).type);
  set('exerciseMinutesInput', (data.exercise || {}).minutes);
  set('exerciseIntensityInput', (data.exercise || {}).intensity);
  set('exerciseTimingInput', (data.exercise || {}).timing);
  set('exerciseNotesInput', (data.exercise || {}).notes);

  const tags = data.tags || [];
  document.querySelectorAll('#tagsContainer input[type="checkbox"]').forEach(cb => {
    cb.checked = tags.includes(cb.value);
  });
}

function collectForm() {
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function numVal(id) {
    const v = val(id);
    return v === '' ? null : Number(v);
  }

  const periods = ['earlyMorning','lateMorning','earlyAfternoon','lateAfternoon','earlyEvening','lateEvening'];
  const timeBlocks = {};
  periods.forEach(p => {
    timeBlocks[p] = {
      score: numVal(p + 'Score'),
      activity: val(p + 'Activity'),
      symptoms: val(p + 'Symptoms')
    };
  });

  const bedtime = val('bedtimeInput');
  const wakeTime = val('wakeTimeInput');
  let hoursSlept = null;
  if (bedtime && wakeTime) {
    const [bh, bm] = bedtime.split(':').map(Number);
    const [wh, wm] = wakeTime.split(':').map(Number);
    let diff = (wh * 60 + wm) - (bh * 60 + bm);
    if (diff < 0) diff += 24 * 60;
    hoursSlept = Math.round(diff / 6) / 10;
  }

  const tags = [];
  document.querySelectorAll('#tagsContainer input[type="checkbox"]:checked').forEach(cb => {
    tags.push(cb.value);
  });

  return {
    dayTitle: val('dayTitleInput'),
    overallNotes: val('overallNotesInput'),
    moodScore: numVal('moodScoreInput'),
    moodNotes: val('moodNotesInput'),
    timeBlocks,
    sleep: {
      bedtime,
      wakeTime,
      hoursSlept,
      quality: numVal('sleepQualityInput'),
      awakenings: numVal('awakeningsInput'),
      notes: val('sleepNotesInput')
    },
    exercise: {
      didExercise: val('didExerciseInput'),
      type: val('exerciseTypeInput'),
      minutes: numVal('exerciseMinutesInput'),
      intensity: val('exerciseIntensityInput'),
      timing: val('exerciseTimingInput'),
      notes: val('exerciseNotesInput')
    },
    tags,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function saveDay() {
  if (!currentUser) return;
  const date = currentDateStr || document.getElementById("dateInput").value;
  if (!date) { alert('Please select a date.'); return; }
  const data = collectForm();
  const docRef = db.collection('users').doc(currentUser.uid)
                   .collection('entries').doc(date);
  const status = document.getElementById('saveStatus');
  if (status) { status.textContent = 'Saving…'; status.style.color = 'var(--color-text-muted)'; }
  docRef.set(data, { merge: true }).then(() => {
    if (status) { status.textContent = 'Saved!'; status.style.color = 'var(--color-success)'; }
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  }).catch(err => {
    console.error('Save error:', err);
    if (status) { status.textContent = 'Error saving.'; status.style.color = 'var(--color-error)'; }
  });
}

// ---- Sleep auto-calculation ----
function setupSleepCalculation() {
  const bedtime = document.getElementById('bedtimeInput');
  const wake = document.getElementById('wakeTimeInput');
  const display = document.getElementById('hoursSleptDisplay');
  const hidden = document.getElementById('hoursSleptInput');
  if (!bedtime || !wake || !display) return;

  function calc() {
    const b = bedtime.value;
    const w = wake.value;
    if (!b || !w) { display.textContent = '\u2014'; hidden.value = ''; return; }
    const [bh, bm] = b.split(':').map(Number);
    const [wh, wm] = w.split(':').map(Number);
    let diff = (wh * 60 + wm) - (bh * 60 + bm);
    if (diff < 0) diff += 1440;
    const hrs = Math.round(diff / 6) / 10;
    display.textContent = hrs + 'h';
    hidden.value = hrs;
  }

  bedtime.addEventListener('change', calc);
  wake.addEventListener('change', calc);
}

// ---- Number Steppers ----
function setupNumberSteppers() {
  document.querySelectorAll('.number-stepper').forEach(stepper => {
    const input = stepper.querySelector('input[type="number"]');
    stepper.querySelectorAll('.stepper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step, 10);
        const min = input.min !== '' ? Number(input.min) : -Infinity;
        const max = input.max !== '' ? Number(input.max) : Infinity;
        const current = input.value === '' ? (step > 0 ? min - 1 : max + 1) : Number(input.value);
        const next = Math.min(max, Math.max(min, current + step));
        if (!isNaN(next)) input.value = next;
      });
    });
  });
}

// ---- History ----
function loadHistoryRange() {
  if (!currentUser) return;
  const fromInput = document.getElementById('historyFrom');
  const toInput   = document.getElementById('historyTo');
  if (!fromInput || !toInput) return;
  const today = getTodayStr();
  if (!toInput.value) toInput.value = today;
  const d7 = new Date(today + 'T00:00:00');
  d7.setDate(d7.getDate() - 7);
  const d7str = d7.toISOString().slice(0,10);
  if (!fromInput.value) fromInput.value = d7str;
}

document.getElementById('loadHistoryBtn') && document.getElementById('loadHistoryBtn').addEventListener('click', () => {
  if (!currentUser) return;
  const from = document.getElementById('historyFrom').value;
  const to   = document.getElementById('historyTo').value;
  if (!from || !to) { alert('Please select both From and To dates.'); return; }
  const list = document.getElementById('historyList');
  list.innerHTML = '<li>Loading…</li>';
  db.collection('users').doc(currentUser.uid)
    .collection('entries')
    .where(firebase.firestore.FieldPath.documentId(), '>=', from)
    .where(firebase.firestore.FieldPath.documentId(), '<=', to)
    .orderBy(firebase.firestore.FieldPath.documentId(), 'desc')
    .get()
    .then(snap => {
      if (snap.empty) { list.innerHTML = '<li>No entries found.</li>'; return; }
      list.innerHTML = '';
      snap.forEach(doc => {
        const d = doc.data();
        const li = document.createElement('li');
        li.className = 'history-item';
        const avg = calcAvgFunctionality(d.timeBlocks);
        li.innerHTML = `
          <div class="history-item-header">
            <span class="history-item-date">${doc.id}</span>
            ${d.dayTitle ? `<span class="history-item-title">${escHtml(d.dayTitle)}</span>` : ''}
            ${avg !== null ? `<span class="history-item-avg">Avg func: ${avg}</span>` : ''}
          </div>
          ${d.overallNotes ? `<p class="history-item-notes">${escHtml(d.overallNotes)}</p>` : ''}
          ${(d.tags||[]).length ? `<p class="history-item-tags">${d.tags.map(t=>`<span class="tag-chip">${escHtml(t)}</span>`).join('')}</p>` : ''}
        `;
        list.appendChild(li);
      });
    })
    .catch(err => {
      list.innerHTML = `<li>Error: ${err.message}</li>`;
    });
});

function calcAvgFunctionality(blocks) {
  if (!blocks) return null;
  const scores = Object.values(blocks).map(b => b.score).filter(s => s !== null && s !== '' && !isNaN(s));
  if (!scores.length) return null;
  return (scores.reduce((a,b) => a + Number(b), 0) / scores.length).toFixed(1);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Trends ----
let funcChart = null;
function loadTrends() {
  if (!currentUser) return;
  const today = getTodayStr();
  const d30 = new Date(today + 'T00:00:00');
  d30.setDate(d30.getDate() - 29);
  const from = d30.toISOString().slice(0,10);
  db.collection('users').doc(currentUser.uid)
    .collection('entries')
    .where(firebase.firestore.FieldPath.documentId(), '>=', from)
    .where(firebase.firestore.FieldPath.documentId(), '<=', today)
    .orderBy(firebase.firestore.FieldPath.documentId())
    .get()
    .then(snap => {
      const labels = [];
      const avgs = [];
      snap.forEach(doc => {
        const avg = calcAvgFunctionality(doc.data().timeBlocks);
        labels.push(doc.id.slice(5));
        avgs.push(avg !== null ? Number(avg) : null);
      });
      const ctx = document.getElementById('functionalityChart');
      if (!ctx) return;
      if (funcChart) funcChart.destroy();
      funcChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Avg Functionality',
            data: avgs,
            borderColor: '#3f51b5',
            backgroundColor: 'rgba(63,81,181,0.08)',
            tension: 0.3,
            fill: true,
            spanGaps: true
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { min: 0, max: 10, ticks: { stepSize: 1 } }
          },
          plugins: { legend: { display: false } }
        }
      });
    });
}

// ---- Build info (footer) ----
function loadBuildInfo() {
  const sha = document.getElementById('buildSha');
  const msg = document.getElementById('buildMsg');
  const date = document.getElementById('buildDate');
  if (!sha) return;

  fetch('https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits/main')
    .then(r => r.json())
    .then(data => {
      const shortSha = data.sha.slice(0,7);
      sha.textContent = shortSha;
      sha.href = `https://github.com/dennismzanetti/FibroSymptomTracker/commit/${data.sha}`;
      if (msg) msg.textContent = data.commit.message.split('\n')[0].slice(0,60);
      if (date) {
        const dt = new Date(data.commit.committer.date);
        date.textContent = dt.toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' });
        date.setAttribute('datetime', data.commit.committer.date);
      }
    })
    .catch(() => {
      if (sha) sha.textContent = 'unknown';
    });
}

// ---- ATR (Automatic Thought Records) helper stub ----
// Full ATR logic lives in mood.js; this stub prevents errors if called before mood.js loads
function setupAtrForm() {}
