// ---- Firebase init -----
const firebaseConfig = {
  apiKey: "AIzaSyD75EQyz7w9ZYuK8iDewQDzI5Z2RUzMk1k",
  authDomain: "fibrosymptomtracker.firebaseapp.com",
  projectId: "fibrosymptomtracker",
  storageBucket: "fibrosymptomtracker.firebasestorage.app",
  messagingSenderId: "729903386531",
  appId: "1:729903386531:web:b73385c230369ac53b9416",
  measurementId: "G-N20WEFRW9Y"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ---- Auth ----
const auth = firebase.auth();

const signOutBtn = document.getElementById("signOutBtn");
const appMain = document.querySelector("main");

if (appMain) appMain.style.display = "none";

let _windowLoaded = false;
let _pendingSetup = false;

function runPostLoadSetup() {
  if (!_windowLoaded || !_pendingSetup) return;
  _pendingSetup = false;
  loadTodayDate();
  loadDayFromCloud(currentDateStr);
}

let _appInitialised = false;

auth.onAuthStateChanged((user) => {
  if (user) {
    const authOverlay = document.getElementById("authOverlay");
    if (authOverlay) authOverlay.style.display = "none";
    if (appMain) appMain.style.display = "";
    if (signOutBtn) signOutBtn.style.display = "inline-block";
    console.log("Signed in as", user.displayName, "UID:", user.uid);

    if (!_appInitialised) {
      _appInitialised = true;
      _pendingSetup = true;
      setupMedicationsTab();
      setupCareTeamTab();
      runPostLoadSetup();
    }
  } else {
    const authOverlay = document.getElementById("authOverlay");
    if (authOverlay) authOverlay.style.display = "flex";
    if (appMain) appMain.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "none";
    _appInitialised = false;
    _pendingSetup = false;
  }
});

signOutBtn?.addEventListener("click", () => auth.signOut());

// ---- Toast notification ----
let _toastTimer = null;
function showToast(message, isError = false) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.classList.remove("toast-success", "toast-error", "toast--hide");
  toast.style.opacity = "";
  toast.style.transition = "";
  toast.style.animation = "none";
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight;
  toast.style.animation = "";

  toast.textContent = message;
  toast.classList.add(isError ? "toast-error" : "toast-success");
  toast.style.display = "block";

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.style.transition = "opacity 0.4s ease";
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
      toast.style.opacity = "";
      toast.style.transition = "";
    }, 420);
  }, 3000);
}

// ---- Local storage helpers ----
const STORAGE_KEY = "fibroDaysLocal";
function loadAllDays() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveAllDays(days) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  } catch {
    // localStorage unavailable — silently ignore.
  }
}
function numberOrNull(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ---- Module-level current date ----
let currentDateStr = "";

function todayStr() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function syncDateInput() {
  const dateInput = document.getElementById("dateInput");
  if (dateInput) dateInput.value = currentDateStr;
  updateDateDisplay();
}

function updateDateDisplay() {
  const val = currentDateStr;
  const dowEl = document.getElementById("dayOfWeekDisplay");
  const dateEl = document.getElementById("dateDisplay");
  const entryDayLabel = document.getElementById("entryDayLabel");
  if (!val) {
    if (dowEl) dowEl.textContent = "";
    if (dateEl) dateEl.textContent = "";
    if (entryDayLabel) entryDayLabel.textContent = "";
    return;
  }
  const [year, month, day] = val.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return;
  const fullDow = date.toLocaleDateString(undefined, { weekday: "long" });
  if (dowEl) dowEl.textContent = fullDow;
  if (dateEl) dateEl.textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (entryDayLabel) entryDayLabel.textContent = fullDow;
}

function updateDayOfWeek() { updateDateDisplay(); }

function getJournalDayOfWeek(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function getJournalDateLine(dateStr) {
  if (!dateStr) return "No date recorded";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// ---- UI setup ----
window.addEventListener("load", () => {
  setupTabs();
  setupExerciseToggle();
  setupSaveDay();
  setupDateNavigation();
  setupDatePicker();
  setupSleepCalculation();
  setupNumberSteppers();
  setupAtrForm();

  const dateInput = document.getElementById("dateInput");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const v = dateInput.value;
      if (v && v !== currentDateStr) {
        currentDateStr = v;
        updateDateDisplay();
        loadDayFromCloud(currentDateStr);
      }
    });
  }

  refreshHistory();
  refreshTrends();

  _windowLoaded = true;
  runPostLoadSetup();
});

// ---- Date picker button wiring ----
function setupDatePicker() {
  const btn = document.getElementById("datePickerBtn");
  const input = document.getElementById("dateInput");
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    try {
      input.showPicker();
    } catch (e) {
      input.focus();
      input.click();
    }
  });
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
      if (target === "careteam-tab") refreshProviderList();
      if (target === "medications-tab") {
        const activeView = document.querySelector(".med-view:not([style*='display:none']):not([style*='display: none'])");
        if (activeView) refreshMedView(activeView.id);
      }
      if (target === "entry-tab") syncDateInput();
    });
  });
}

function setupExerciseToggle() {
  const didExerciseInput = document.getElementById("didExerciseInput");
  const exerciseDetails  = document.getElementById("exerciseDetails");
  if (!didExerciseInput || !exerciseDetails) return;
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
    const dayData = collectFormData();
    if (!dayData.date) {
      if (status) status.textContent = "Please select a date.";
      return;
    }
    if (status) status.textContent = "";
    const days = loadAllDays();
    const existingIndex = days.findIndex(d => d.date === dayData.date);
    if (existingIndex >= 0) days[existingIndex] = dayData;
    else days.push(dayData);
    saveAllDays(days);
    try {
      await db.collection("days").doc(dayData.date).set(dayData, { merge: false });
      showToast("\u2713 Day saved");
    } catch (err) {
      console.error("Error saving to cloud:", err);
      showToast("\u26A0 Cloud save failed \u2014 check connection", true);
    }
    refreshHistory();
    renderJournal();
    refreshTrends();
  };

  floatBtn?.addEventListener("click", handleSaveClick);
}

function setupNumberSteppers() {
  document.querySelectorAll(".number-stepper").forEach((stepper) => {
    const input = stepper.querySelector('input[type="number"]');
    const buttons = stepper.querySelectorAll(".stepper-btn");
    if (!input) return;
    const min = input.min !== "" ? Number(input.min) : null;
    const max = input.max !== "" ? Number(input.max) : null;
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const step = Number(button.dataset.step || 0);
        let current = input.value === "" ? min ?? 0 : Number(input.value);
        let next = current + step;
        if (min !== null && next < min) next = min;
        if (max !== null && next > max) next = max;
        input.value = next;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });
}

function setupSleepCalculation() {
  const bedtimeInput = document.getElementById("bedtimeInput");
  const wakeTimeInput = document.getElementById("wakeTimeInput");
  if (!bedtimeInput || !wakeTimeInput) return;
  bedtimeInput.addEventListener("change", updateSleepTotal);
  wakeTimeInput.addEventListener("change", updateSleepTotal);
}

function updateSleepTotal() {
  const bedtime = document.getElementById("bedtimeInput")?.value;
  const wakeTime = document.getElementById("wakeTimeInput")?.value;
  const totalEl = document.getElementById("sleepTotalDisplay");
  if (!totalEl) return;
  if (!bedtime || !wakeTime) { totalEl.textContent = "--"; return; }
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60;
  const diff = wakeMins - bedMins;
  const hours = Math.floor(diff / 60);
  const mins  = diff % 60;
  totalEl.textContent = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ---- Date navigation ----
function setupDateNavigation() {
  document.getElementById("prevDayBtn")?.addEventListener("click", () => navigateDay(-1));
  document.getElementById("nextDayBtn")?.addEventListener("click", () => navigateDay(1));
}

function navigateDay(delta) {
  if (!currentDateStr) return;
  const [y, m, d] = currentDateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  currentDateStr = `${ny}-${nm}-${nd}`;
  syncDateInput();
  loadDayFromCloud(currentDateStr);
}

// ---- Cloud load/save ----
async function loadDayFromCloud(dateStr) {
  try {
    const doc = await db.collection("days").doc(dateStr).get();
    if (doc.exists) {
      populateForm(doc.data());
    } else {
      clearForm();
    }
  } catch (err) {
    console.error("Error loading day:", err);
    clearForm();
  }
}

function collectFormData() {
  const date = currentDateStr;
  const overallPain       = numberOrNull(document.getElementById("overallPainInput")?.value);
  const morningPain       = numberOrNull(document.getElementById("morningPainInput")?.value);
  const afternoonPain     = numberOrNull(document.getElementById("afternoonPainInput")?.value);
  const eveningPain       = numberOrNull(document.getElementById("eveningPainInput")?.value);
  const fatigue           = numberOrNull(document.getElementById("fatigueInput")?.value);
  const brainFog          = numberOrNull(document.getElementById("brainFogInput")?.value);
  const sleepQuality      = numberOrNull(document.getElementById("sleepQualityInput")?.value);
  const bedtime           = document.getElementById("bedtimeInput")?.value || null;
  const wakeTime          = document.getElementById("wakeTimeInput")?.value || null;
  const mood              = numberOrNull(document.getElementById("moodInput")?.value);
  const stress            = numberOrNull(document.getElementById("stressInput")?.value);
  const didExercise       = document.getElementById("didExerciseInput")?.value || null;
  const exerciseType      = document.getElementById("exerciseTypeInput")?.value?.trim() || null;
  const exerciseDuration  = numberOrNull(document.getElementById("exerciseDurationInput")?.value);
  const weatherEffect     = document.getElementById("weatherEffectInput")?.value || null;
  const notes             = document.getElementById("notesInput")?.value?.trim() || null;

  // Tags
  const tagInputs = document.querySelectorAll('#tagsContainer input[type="checkbox"]');
  const tags = [];
  tagInputs.forEach(cb => { if (cb.checked) tags.push(cb.value); });

  // Pain locations
  const painLocations = collectPainLocations();

  // Avg functionality
  const scores = [overallPain, fatigue, brainFog, sleepQuality, mood].filter(v => v !== null);
  const avgFunctionality = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  return {
    date, overallPain, morningPain, afternoonPain, eveningPain,
    fatigue, brainFog, sleepQuality, bedtime, wakeTime,
    mood, stress, didExercise, exerciseType, exerciseDuration,
    weatherEffect, notes, tags, painLocations, avgFunctionality
  };
}

function populateForm(data) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
    else if (el) el.value = "";
  };
  setVal("overallPainInput",     data.overallPain);
  setVal("morningPainInput",     data.morningPain);
  setVal("afternoonPainInput",   data.afternoonPain);
  setVal("eveningPainInput",     data.eveningPain);
  setVal("fatigueInput",         data.fatigue);
  setVal("brainFogInput",        data.brainFog);
  setVal("sleepQualityInput",    data.sleepQuality);
  setVal("bedtimeInput",         data.bedtime);
  setVal("wakeTimeInput",        data.wakeTime);
  setVal("moodInput",            data.mood);
  setVal("stressInput",          data.stress);
  setVal("didExerciseInput",     data.didExercise);
  setVal("exerciseTypeInput",    data.exerciseType);
  setVal("exerciseDurationInput",data.exerciseDuration);
  setVal("weatherEffectInput",   data.weatherEffect);
  setVal("notesInput",           data.notes);

  // Tags
  const tagInputs = document.querySelectorAll('#tagsContainer input[type="checkbox"]');
  tagInputs.forEach(cb => { cb.checked = Array.isArray(data.tags) && data.tags.includes(cb.value); });

  // Pain locations
  if (Array.isArray(data.painLocations)) restorePainLocations(data.painLocations);
  else clearPainLocations();

  // Exercise details visibility
  const exerciseDetails = document.getElementById("exerciseDetails");
  if (exerciseDetails) exerciseDetails.style.display = data.didExercise === "yes" ? "block" : "none";

  updateSleepTotal();
}

function clearForm() {
  const ids = [
    "overallPainInput", "morningPainInput", "afternoonPainInput", "eveningPainInput",
    "fatigueInput", "brainFogInput", "sleepQualityInput", "bedtimeInput", "wakeTimeInput",
    "moodInput", "stressInput", "exerciseTypeInput", "exerciseDurationInput", "notesInput"
  ];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const didEx = document.getElementById("didExerciseInput");
  if (didEx) didEx.value = "";
  const weatherEl = document.getElementById("weatherEffectInput");
  if (weatherEl) weatherEl.value = "";
  const tagInputs = document.querySelectorAll('#tagsContainer input[type="checkbox"]');
  tagInputs.forEach(cb => { cb.checked = false; });
  clearPainLocations();
  const exerciseDetails = document.getElementById("exerciseDetails");
  if (exerciseDetails) exerciseDetails.style.display = "none";
  const totalEl = document.getElementById("sleepTotalDisplay");
  if (totalEl) totalEl.textContent = "--";
}

// ---- History ----
async function refreshHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  list.innerHTML = '<li style="color:#888; font-style:italic; padding:0.5rem 0;">Loading…</li>';
  try {
    const snapshot = await db.collection("days").orderBy(firebase.firestore.FieldPath.documentId(), "desc").get();
    if (snapshot.empty) { list.innerHTML = '<li style="color:#888; font-style:italic;">No entries yet.</li>'; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const li = document.createElement("li");
      li.className = "history-item";
      const avg = typeof d.avgFunctionality === "number" ? d.avgFunctionality.toFixed(1) : "--";
      const tagsHtml = Array.isArray(d.tags) && d.tags.length
        ? d.tags.map(t => `<span class="tag-chip">${t}</span>`).join("")
        : "";
      li.innerHTML = `
        <div class="history-item-header">
          <span class="history-item-date">${d.date || doc.id}</span>
          <span class="history-item-title">${getJournalDayOfWeek(d.date || doc.id)}</span>
          <span class="history-item-avg">avg ${avg}</span>
        </div>
        ${d.notes ? `<div class="history-item-notes">${d.notes}</div>` : ""}
        ${tagsHtml ? `<div class="history-item-tags">${tagsHtml}</div>` : ""}
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading history:", err);
    list.innerHTML = '<li style="color:red;">Error loading history.</li>';
  }
}

function refreshHistory_nocloud() {
  const list = document.getElementById("historyList");
  if (!list) return;
  const days = loadAllDays().slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!days.length) { list.innerHTML = '<li style="color:#888; font-style:italic;">No entries yet.</li>'; return; }
  list.innerHTML = "";
  days.forEach(d => {
    const li = document.createElement("li");
    li.className = "history-item";
    const avg = typeof d.avgFunctionality === "number" ? d.avgFunctionality.toFixed(1) : "--";
    const tagsHtml = Array.isArray(d.tags) && d.tags.length
      ? d.tags.map(t => `<span class="tag-chip">${t}</span>`).join("")
      : "";
    li.innerHTML = `
      <div class="history-item-header">
        <span class="history-item-date">${d.date || ""}</span>
        <span class="history-item-title">${getJournalDayOfWeek(d.date || "")}</span>
        <span class="history-item-avg">avg ${avg}</span>
      </div>
      ${d.notes ? `<div class="history-item-notes">${d.notes}</div>` : ""}
      ${tagsHtml ? `<div class="history-item-tags">${tagsHtml}</div>` : ""}
    `;
    list.appendChild(li);
  });
}

// ---- Journal ----
async function renderJournal() {
  const container = document.getElementById("journalContainer");
  if (!container) return;
  container.innerHTML = '<p style="color:#888; font-style:italic;">Loading…</p>';
  try {
    const snapshot = await db.collection("days").orderBy(firebase.firestore.FieldPath.documentId(), "desc").get();
    if (snapshot.empty) { container.innerHTML = '<p style="color:#888; font-style:italic;">No entries yet.</p>'; return; }
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const card = document.createElement("div");
      card.className = "card journal-entry";
      card.innerHTML = `
        <div class="journal-entry-header">
          <div>
            <div class="journal-entry-dow">${getJournalDayOfWeek(d.date || doc.id)}</div>
            <div class="journal-entry-date">${getJournalDateLine(d.date || doc.id)}</div>
          </div>
        </div>
        <div class="journal-entry-body">
          <div class="journal-scores">
            <span>Pain: ${formatScore(d.overallPain)}</span>
            <span>Fatigue: ${formatScore(d.fatigue)}</span>
            <span>Brain Fog: ${formatScore(d.brainFog)}</span>
            <span>Sleep Quality: ${formatScore(d.sleepQuality)}</span>
            <span>Mood: ${formatScore(d.mood)}</span>
            <span>Stress: ${formatScore(d.stress)}</span>
          </div>
          ${d.notes ? `<div class="journal-notes">${d.notes}</div>` : ""}
          ${
            Array.isArray(d.tags) && d.tags.length
              ? `<div class="journal-tags">${d.tags.map(t => `<span class="tag-chip">${t}</span>`).join("")}</div>`
              : ""
          }
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading journal:", err);
    container.innerHTML = '<p style="color:red;">Error loading journal.</p>';
  }
}

// ---- Tab navigation helper ----
function switchToTab(tabId) {
  const buttons = document.querySelectorAll(".tab-button");
  const tabs = document.querySelectorAll(".tab");
  buttons.forEach(b => b.classList.remove("active"));
  tabs.forEach(t => t.classList.remove("active"));
  const btn = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
  const tab = document.getElementById(tabId);
  if (btn) btn.classList.add("active");
  if (tab) tab.classList.add("active");
  if (tabId === "entry-tab") syncDateInput();
}

function formatScore(value) { return typeof value === "number" ? value : "not recorded"; }
function formatText(value, fallback = "Not recorded.") { return value && String(value).trim() ? value : fallback; }

let functionalityChart = null;
async function refreshTrends() {
  const canvas = document.getElementById("functionalityChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  try {
    const snapshot = await db.collection("days").orderBy(firebase.firestore.FieldPath.documentId()).get();
    const labels = [], data = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      if (typeof d.avgFunctionality === "number") { labels.push(d.date || doc.id); data.push(d.avgFunctionality); }
    });
    if (functionalityChart) functionalityChart.destroy();
    functionalityChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: "Average daily functionality", data, borderColor: "#3f51b5", backgroundColor: "rgba(63,81,181,0.15)", tension: 0.2 }] },
      options: { scales: { y: { suggestedMin: 0, suggestedMax: 10 } } }
    });
  } catch (err) { console.error("Error loading trends:", err); }
}

// ============================================================
// MOOD TAB — owned entirely by mood.js
// ============================================================
