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
  if (!val) {
    if (dowEl) dowEl.textContent = "";
    if (dateEl) dateEl.textContent = "";
    return;
  }
  const [year, month, day] = val.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return;
  if (dowEl) dowEl.textContent = date.toLocaleDateString(undefined, { weekday: "long" });
  if (dateEl) dateEl.textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
  bedtimeInput.addEventListener("input", updateSleepDuration);
  wakeTimeInput.addEventListener("input", updateSleepDuration);
  bedtimeInput.addEventListener("change", updateSleepDuration);
  wakeTimeInput.addEventListener("change", updateSleepDuration);
  updateSleepDuration();
}

function updateSleepDuration() {
  const bedtimeInput = document.getElementById("bedtimeInput");
  const wakeTimeInput = document.getElementById("wakeTimeInput");
  const hoursSleptInput = document.getElementById("hoursSleptInput");
  const hoursSleptDisplay = document.getElementById("hoursSleptDisplay");
  if (!bedtimeInput || !wakeTimeInput || !hoursSleptInput) return;
  const bedtime = bedtimeInput.value;
  const wakeTime = wakeTimeInput.value;
  if (!bedtime || !wakeTime) {
    hoursSleptInput.value = "";
    if (hoursSleptDisplay) hoursSleptDisplay.textContent = "\u2014";
    return;
  }
  const [bedHour, bedMinute] = bedtime.split(":").map(Number);
  const [wakeHour, wakeMinute] = wakeTime.split(":").map(Number);
  let bedtimeMinutes = bedHour * 60 + bedMinute;
  let wakeTimeMinutes = wakeHour * 60 + wakeMinute;
  if (wakeTimeMinutes <= bedtimeMinutes) wakeTimeMinutes += 24 * 60;
  const totalMinutes = wakeTimeMinutes - bedtimeMinutes;
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  hoursSleptInput.value = totalHours;
  if (hoursSleptDisplay) hoursSleptDisplay.textContent = `${totalHours.toFixed(1)} hours`;
}

function clearFormFieldsExceptDate() {
  document.getElementById("dayTitleInput").value = "";
  document.getElementById("overallNotesInput").value = "";
  const clearBlock = (prefix) => {
    document.getElementById(prefix + "Score").value = "";
    document.getElementById(prefix + "Activity").value = "";
    document.getElementById(prefix + "Symptoms").value = "";
  };
  ["earlyMorning","lateMorning","earlyAfternoon","lateAfternoon","earlyEvening","lateEvening"].forEach(clearBlock);
  document.getElementById("bedtimeInput").value = "";
  document.getElementById("wakeTimeInput").value = "";
  document.getElementById("hoursSleptInput").value = "";
  document.getElementById("sleepQualityInput").value = "";
  document.getElementById("awakeningsInput").value = "";
  document.getElementById("sleepNotesInput").value = "";
  updateSleepDuration();
  document.getElementById("didExerciseInput").value = "no";
  document.getElementById("didExerciseInput").dispatchEvent(new Event("change"));
  document.getElementById("exerciseTypeInput").value = "";
  document.getElementById("exerciseMinutesInput").value = "";
  document.getElementById("exerciseIntensityInput").value = "";
  document.getElementById("exerciseTimingInput").value = "";
  document.getElementById("exerciseNotesInput").value = "";
  document.getElementById("moodScoreInput").value = "";
  document.getElementById("moodNotesInput").value = "";
  // Clear pain & fatigue fields
  const painScoreEl = document.getElementById("painScoreInput");
  if (painScoreEl) painScoreEl.value = "";
  const painNotesEl = document.getElementById("painNotesInput");
  if (painNotesEl) painNotesEl.value = "";
  const fatigueScoreEl = document.getElementById("fatigueScoreInput");
  if (fatigueScoreEl) fatigueScoreEl.value = "";
  const fatigueNotesEl = document.getElementById("fatigueNotesInput");
  if (fatigueNotesEl) fatigueNotesEl.value = "";
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => cb.checked = false);
}

function loadDayFromCloud(date) {
  if (!date) return;
  db.collection("days").doc(date).get().then((doc) => {
    if (doc.exists) {
      // Merge the doc ID as the date so fillFormFromData always has it
      const data = Object.assign({ date: doc.id }, doc.data());
      fillFormFromData(data);
      showToast("\u2601 Updated from cloud");
    } else {
      clearFormFieldsExceptDate();
      showToast("No entry for that date \u2014 form cleared");
    }
  }).catch((error) => {
    console.error("Error getting document:", error);
    clearFormFieldsExceptDate();
    showToast("\u26A0 Cloud load failed", true);
  });
}

function collectFormData() {
  const date = currentDateStr || document.getElementById("dateInput").value;
  const dayTitle = document.getElementById("dayTitleInput").value;
  const overallNotes = document.getElementById("overallNotesInput").value;
  const getBlock = (prefix) => ({
    score: numberOrNull(document.getElementById(prefix + "Score").value),
    activity: document.getElementById(prefix + "Activity").value,
    symptoms: document.getElementById(prefix + "Symptoms").value
  });
  const functionality = {
    earlyMorning: getBlock("earlyMorning"),
    lateMorning: getBlock("lateMorning"),
    earlyAfternoon: getBlock("earlyAfternoon"),
    lateAfternoon: getBlock("lateAfternoon"),
    earlyEvening: getBlock("earlyEvening"),
    lateEvening: getBlock("lateEvening")
  };
  const sleep = {
    bedtime: document.getElementById("bedtimeInput").value,
    wakeTime: document.getElementById("wakeTimeInput").value,
    hours: numberOrNull(document.getElementById("hoursSleptInput").value),
    quality: numberOrNull(document.getElementById("sleepQualityInput").value),
    awakenings: numberOrNull(document.getElementById("awakeningsInput").value),
    notes: document.getElementById("sleepNotesInput").value
  };
  const didExercise = document.getElementById("didExerciseInput").value === "yes";
  const exercise = didExercise ? {
    type: document.getElementById("exerciseTypeInput").value,
    minutes: numberOrNull(document.getElementById("exerciseMinutesInput").value),
    intensity: document.getElementById("exerciseIntensityInput").value,
    timing: document.getElementById("exerciseTimingInput").value,
    notes: document.getElementById("exerciseNotesInput").value
  } : null;
  const tags = [];
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => { if (cb.checked) tags.push(cb.value); });
  const scores = Object.values(functionality).map(b => b.score).filter(v => typeof v === "number");
  const avgFunctionality = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const moodScore = numberOrNull(document.getElementById("moodScoreInput").value);
  const moodNotes = document.getElementById("moodNotesInput").value;
  // Collect pain & fatigue fields
  const painScoreEl = document.getElementById("painScoreInput");
  const painNotesEl = document.getElementById("painNotesInput");
  const fatigueScoreEl = document.getElementById("fatigueScoreInput");
  const fatigueNotesEl = document.getElementById("fatigueNotesInput");
  const painScore = painScoreEl ? numberOrNull(painScoreEl.value) : null;
  const painNotes = painNotesEl ? painNotesEl.value : "";
  const fatigueScore = fatigueScoreEl ? numberOrNull(fatigueScoreEl.value) : null;
  const fatigueNotes = fatigueNotesEl ? fatigueNotesEl.value : "";
  return {
    date, dayTitle, overallNotes, functionality, sleep,
    didExercise, exercise, tags, avgFunctionality,
    mood: { score: moodScore, notes: moodNotes },
    painScore, painNotes, fatigueScore, fatigueNotes
  };
}

function scoreChipClass(score) {
  if (score == null) return "";
  if (score <= 3) return "score-low";
  if (score <= 6) return "score-mid";
  return "score-high";
}

async function refreshHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;

  list.innerHTML = '<li class="history-loading">Loading\u2026</li>';

  try {
    const snapshot = await db.collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId())
      .get();

    const days = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      days.push({
        date: data.date || doc.id,
        dayTitle: data.dayTitle || "",
        avgFunctionality: data.avgFunctionality ?? null,
        functionality: data.functionality || null,
        sleep: data.sleep || null,
        didExercise: data.didExercise || false,
        exercise: data.exercise || null,
        tags: data.tags || [],
        overallNotes: data.overallNotes || "",
        mood: data.mood || {},
        painScore: data.painScore ?? null,
        painNotes: data.painNotes || "",
        fatigueScore: data.fatigueScore ?? null,
        fatigueNotes: data.fatigueNotes || ""
      });
    });

    days.sort((a, b) => a.date.localeCompare(b.date)).reverse();
    list.innerHTML = "";

    if (!days.length) {
      list.innerHTML = `
        <li class="history-empty">
          <span class="history-empty-icon">&#x1F4CB;</span>
          <span>No entries yet. Start by saving a day in the Daily Entry tab.</span>
        </li>`;
      return;
    }

    days.slice(0, 30).forEach(d => {
      const [y, mo, dy] = d.date.split("-").map(Number);
      const dateObj = new Date(y, mo - 1, dy);
      const dow = isNaN(dateObj.getTime()) ? "" : dateObj.toLocaleDateString(undefined, { weekday: "short" });
      const dateLabel = isNaN(dateObj.getTime())
        ? d.date
        : dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

      const avgScore = d.avgFunctionality;
      const moodScore = d.mood?.score ?? null;
      const sleepQuality = d.sleep?.quality ?? null;

      const chipsHtml = [
        avgScore != null
          ? `<span class="score-chip ${scoreChipClass(avgScore)}">Func ${avgScore.toFixed(1)}</span>`
          : "",
        moodScore != null
          ? `<span class="score-chip ${scoreChipClass(moodScore)}">Mood ${moodScore}</span>`
          : "",
        sleepQuality != null
          ? `<span class="score-chip ${scoreChipClass(sleepQuality)}">Sleep ${sleepQuality}</span>`
          : "",
        d.didExercise
          ? `<span class="score-chip score-low">&#x1F3C3; Exercise</span>`
          : ""
      ].filter(Boolean).join("");

      const notesPreview = d.overallNotes?.trim() || d.mood?.notes?.trim() || "";

      const li = document.createElement("li");
      li.className = "history-item";

      li.innerHTML = `
        <div class="history-item-header">
          <span class="history-date-label">${dow ? dow + " \u00B7 " : ""}${dateLabel}</span>
          ${d.dayTitle ? `<span class="history-day-title">${d.dayTitle}</span>` : ""}
          <div class="history-scores">${chipsHtml}</div>
        </div>
        ${notesPreview ? `<div class="history-notes-preview">${notesPreview}</div>` : ""}
        <div class="history-item-actions" style="display:flex;gap:0.5rem;margin-top:0.6rem;">
          <button class="history-load-btn">Load into entry</button>
          <button class="history-delete-btn danger">Delete</button>
        </div>`;

      li.querySelector(".history-load-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        fillFormFromData(d);
        switchToTab("entry-tab");
      });

      li.querySelector(".history-delete-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!window.confirm(`Delete entry for ${d.date}?`)) return;
        try {
          await db.collection("days").doc(d.date).delete();
          refreshHistory();
          refreshTrends();
        } catch (err) {
          console.error("Error deleting day:", err);
          alert("Failed to delete.");
        }
      });

      li.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") return;
        fillFormFromData(d);
        switchToTab("entry-tab");
      });

      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading history:", err);
    list.innerHTML = '<li class="history-error">&#x26A0;&#xFE0F; Could not load history. Please check your connection.</li>';
  }
}

function fillFormFromData(d) {
  if (d.date) currentDateStr = d.date;
  syncDateInput();
  document.getElementById("dayTitleInput").value = d.dayTitle || "";
  document.getElementById("overallNotesInput").value = d.overallNotes || "";
  const setBlock = (prefix, obj = {}) => {
    document.getElementById(prefix + "Score").value = obj.score ?? "";
    document.getElementById(prefix + "Activity").value = obj.activity || "";
    document.getElementById(prefix + "Symptoms").value = obj.symptoms || "";
  };
  setBlock("earlyMorning", d.functionality?.earlyMorning);
  setBlock("lateMorning", d.functionality?.lateMorning);
  setBlock("earlyAfternoon", d.functionality?.earlyAfternoon);
  setBlock("lateAfternoon", d.functionality?.lateAfternoon);
  setBlock("earlyEvening", d.functionality?.earlyEvening);
  setBlock("lateEvening", d.functionality?.lateEvening);
  if (d.sleep) {
    document.getElementById("bedtimeInput").value = d.sleep.bedtime || "";
    document.getElementById("wakeTimeInput").value = d.sleep.wakeTime || "";
    document.getElementById("hoursSleptInput").value = d.sleep.hours ?? "";
    document.getElementById("sleepQualityInput").value = d.sleep.quality ?? "";
    document.getElementById("awakeningsInput").value = d.sleep.awakenings ?? "";
    document.getElementById("sleepNotesInput").value = d.sleep.notes || "";
  }
  if (d.didExercise && d.exercise) {
    document.getElementById("didExerciseInput").value = "yes";
    document.getElementById("exerciseTypeInput").value = d.exercise.type || "";
    document.getElementById("exerciseMinutesInput").value = d.exercise.minutes ?? "";
    document.getElementById("exerciseIntensityInput").value = d.exercise.intensity || "";
    document.getElementById("exerciseTimingInput").value = d.exercise.timing || "";
    document.getElementById("exerciseNotesInput").value = d.exercise.notes || "";
  } else {
    document.getElementById("didExerciseInput").value = "no";
  }
  document.getElementById("didExerciseInput").dispatchEvent(new Event("change"));
  if (d.mood && (d.mood.score != null || d.mood.notes)) {
    document.getElementById("moodScoreInput").value = d.mood.score ?? "";
    document.getElementById("moodNotesInput").value = d.mood.notes || "";
  } else {
    document.getElementById("moodScoreInput").value = "";
    document.getElementById("moodNotesInput").value = "";
  }
  // Restore pain & fatigue fields
  const painScoreEl = document.getElementById("painScoreInput");
  if (painScoreEl) painScoreEl.value = d.painScore ?? "";
  const painNotesEl = document.getElementById("painNotesInput");
  if (painNotesEl) painNotesEl.value = d.painNotes || "";
  const fatigueScoreEl = document.getElementById("fatigueScoreInput");
  if (fatigueScoreEl) fatigueScoreEl.value = d.fatigueScore ?? "";
  const fatigueNotesEl = document.getElementById("fatigueNotesInput");
  if (fatigueNotesEl) fatigueNotesEl.value = d.fatigueNotes || "";
  updateSleepDuration();
  renderJournal();
  const tagsSet = new Set(d.tags || []);
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => cb.checked = tagsSet.has(cb.value));
}

function changeDateBy(days) {
  if (!currentDateStr) currentDateStr = todayStr();
  const [y, mo, dy] = currentDateStr.split("-").map(Number);
  const current = new Date(y, mo - 1, dy);
  if (isNaN(current.getTime())) return;
  current.setDate(current.getDate() + days);
  const ny = current.getFullYear();
  const nm = String(current.getMonth() + 1).padStart(2, "0");
  const nd = String(current.getDate()).padStart(2, "0");
  currentDateStr = `${ny}-${nm}-${nd}`;
  syncDateInput();
  loadDayFromCloud(currentDateStr);
}

function setupDateNavigation() {
  const prevDayBtn = document.getElementById("prevDayBtn");
  const nextDayBtn = document.getElementById("nextDayBtn");
  prevDayBtn?.addEventListener("click", () => changeDateBy(-1));
  nextDayBtn?.addEventListener("click", () => changeDateBy(1));
}

function switchToTab(tabId) {
  document.querySelectorAll(".tab-button").forEach(btn => btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId));
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.id === tabId));
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
