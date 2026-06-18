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
const signOutBtnMobile = document.getElementById("signOutBtnMobile");
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
    if (signOutBtnMobile) signOutBtnMobile.style.display = "inline-flex";
    console.log("Signed in as", user.displayName, "UID:", user.uid);

    if (!_appInitialised) {
      _appInitialised = true;
      _pendingSetup = true;
      setupMedicationsTab();
      setupCareTeamTab();
      if (typeof setupConditionsTab === 'function') setupConditionsTab();
      runPostLoadSetup();
      if (typeof window.applySettingsOnAuth === 'function') window.applySettingsOnAuth();
    }
  } else {
    const authOverlay = document.getElementById("authOverlay");
    if (authOverlay) authOverlay.style.display = "flex";
    if (appMain) appMain.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "none";
    if (signOutBtnMobile) signOutBtnMobile.style.display = "none";
    _appInitialised = false;
    _pendingSetup = false;
  }
});

// ---- Google Sign-In ----
(function setupGoogleSignIn() {
  const signInBtn = document.getElementById("googleSignInBtn");
  const authError = document.getElementById("authError");
  if (!signInBtn) return;

  const provider = new firebase.auth.GoogleAuthProvider();

  // Consume any pending redirect result (mobile flow)
  auth.getRedirectResult().then(result => {
    if (result && result.user) {
      console.log("Redirect sign-in complete:", result.user.displayName);
    }
  }).catch(err => {
    console.error("Redirect sign-in error:", err);
    if (authError) authError.textContent = "Sign-in failed. Please try again.";
  });

  signInBtn.addEventListener("click", () => {
    if (authError) authError.textContent = "";
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      auth.signInWithRedirect(provider).catch(err => {
        console.error("Redirect sign-in error:", err);
        if (authError) authError.textContent = "Sign-in failed. Please try again.";
      });
    } else {
      auth.signInWithPopup(provider).catch(err => {
        console.error("Sign-in error:", err);
        if (authError) authError.textContent = "Sign-in failed. Please try again.";
      });
    }
  });
})();

signOutBtn?.addEventListener("click", () => auth.signOut());
signOutBtnMobile?.addEventListener("click", () => auth.signOut());

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

  // Reset state
  toast.classList.remove("toast-success", "toast-error", "show");
  toast.style.opacity = "";
  toast.style.transition = "";

  toast.textContent = message;
  toast.classList.add(isError ? "toast-error" : "toast-success");
  toast.style.display = "block";

  // Trigger reflow so the transition fires
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight;

  toast.classList.add("show");

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.style.display = "none";
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

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
  setupHistoryControls();

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
      // Keep mobile tabSelect dropdown in sync with tab button clicks
      const tabSelect = document.getElementById("tabSelect");
      if (tabSelect) tabSelect.value = target;
      if (target === "history-tab") refreshHistory();
      if (target === "journal-tab") renderJournal();
      if (target === "trends-tab") refreshTrends();
      if (target === "mood-tab") refreshMoodTab();
      if (target === "careteam-tab") refreshProviderList();
      if (target === "conditions-tab") refreshConditionsList();
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

// ---- History tab ----

function setupHistoryControls() {
  // Set default date range: last 14 days → today
  const fromEl = document.getElementById("historyFrom");
  const toEl   = document.getElementById("historyTo");
  if (fromEl && !fromEl.value) fromEl.value = nDaysAgo(13);
  if (toEl   && !toEl.value)   toEl.value   = todayStr();

  // Wire Load History button
  document.getElementById("loadHistoryBtn")?.addEventListener("click", refreshHistory);
}

function refreshHistory() {
  const fromEl = document.getElementById("historyFrom");
  const toEl   = document.getElementById("historyTo");
  const from   = fromEl?.value || nDaysAgo(13);
  const to     = toEl?.value   || todayStr();

  if (typeof window.loadAndRenderHistory === "function") {
    window.loadAndRenderHistory(from, to, "historyList");
  } else {
    const list = document.getElementById("historyList");
    if (list) list.innerHTML = "<p class='history-empty'>History renderer not loaded.</p>";
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

// ================================================================
//  EXPORT / IMPORT DATA
// ================================================================

async function exportAllData() {
  const statusEl = document.getElementById("exportImportStatus");
  const btn = document.getElementById("exportDataBtn");

  statusEl.style.display = "block";
  statusEl.className = "settings-status settings-status-info";
  statusEl.textContent = "Exporting… please wait.";
  btn.disabled = true;

  try {
    const collections = [
      "days",
      "medications",
      "supplements",
      "medicationHistory",
      "careTeam",
      "appointments",
      "automaticThoughtRecords",
      "conditions"
    ];

    const backup = {
      exportedAt: new Date().toISOString(),
      appVersion: "FibroSymptomTracker",
      collections: {}
    };

    for (const col of collections) {
      const snap = await db.collection(col).get();
      backup.collections[col] = {};
      snap.forEach(doc => {
        backup.collections[col][doc.id] = doc.data();
      });
      const count = snap.size;
      statusEl.textContent = `Exporting ${col}… (${count} records)`;
    }

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `fibro-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    let total = 0;
    for (const col of collections) total += Object.keys(backup.collections[col]).length;
    statusEl.className = "settings-status settings-status-success";
    statusEl.textContent = `✓ Export complete — ${total} total records downloaded.`;
  } catch (err) {
    console.error("Export error:", err);
    statusEl.className = "settings-status settings-status-error";
    statusEl.textContent = "Export failed: " + err.message;
  } finally {
    btn.disabled = false;
  }
}

let pendingImportData = null;

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById("exportImportStatus");
  const confirmBox = document.getElementById("importConfirmBox");
  const confirmMsg = document.getElementById("importConfirmMsg");

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.collections) throw new Error("Invalid backup file format.");

      let total = 0;
      const cols = Object.keys(data.collections);
      cols.forEach(c => total += Object.keys(data.collections[c]).length);

      pendingImportData = data;
      confirmMsg.textContent = `Import ${total} records across ${cols.length} collections from backup dated ${data.exportedAt ? data.exportedAt.slice(0,10) : "unknown"}? This will overwrite existing matching records.`;
      confirmBox.style.display = "block";
      statusEl.style.display = "none";
    } catch (err) {
      statusEl.style.display = "block";
      statusEl.className = "settings-status settings-status-error";
      statusEl.textContent = "Could not read file: " + err.message;
    }
  };
  reader.readAsText(file);
  // Reset input so same file can be re-selected
  e.target.value = "";
}

async function confirmImport() {
  const statusEl = document.getElementById("exportImportStatus");
  const confirmBox = document.getElementById("importConfirmBox");
  const confirmBtn = document.getElementById("importConfirmBtn");

  if (!pendingImportData) return;
  confirmBox.style.display = "none";
  statusEl.style.display = "block";
  statusEl.className = "settings-status settings-status-info";
  statusEl.textContent = "Importing… please wait.";
  confirmBtn.disabled = true;

  try {
    const collections = pendingImportData.collections;
    let total = 0;

    for (const col of Object.keys(collections)) {
      const docs = collections[col];
      for (const [id, data] of Object.entries(docs)) {
        await db.collection(col).doc(id).set(data, { merge: true });
        total++;
      }
      statusEl.textContent = `Importing ${col}…`;
    }

    statusEl.className = "settings-status settings-status-success";
    statusEl.textContent = `✓ Import complete — ${total} records restored.`;
    pendingImportData = null;
  } catch (err) {
    console.error("Import error:", err);
    statusEl.className = "settings-status settings-status-error";
    statusEl.textContent = "Import failed: " + err.message;
  } finally {
    confirmBtn.disabled = false;
  }
}

function cancelImport() {
  pendingImportData = null;
  document.getElementById("importConfirmBox").style.display = "none";
  document.getElementById("importFileInput").value = "";
}

// Wire up export/import listeners after DOM ready
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("exportDataBtn")?.addEventListener("click", exportAllData);
  document.getElementById("importFileInput")?.addEventListener("change", handleImportFile);
  document.getElementById("importConfirmBtn")?.addEventListener("click", confirmImport);
  document.getElementById("importCancelBtn")?.addEventListener("click", cancelImport);
});
