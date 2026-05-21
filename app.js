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
const provider = new firebase.auth.GoogleAuthProvider();

const authOverlay = document.getElementById("authOverlay");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const appMain = document.querySelector("main");

if (appMain) appMain.style.display = "none";

// Track whether the app has been initialised for this session so that
// onAuthStateChanged (which can fire multiple times) only runs setup once.
let _appInitialised = false;

auth.onAuthStateChanged((user) => {
  if (user) {
    if (authOverlay) authOverlay.style.display = "none";
    if (appMain) appMain.style.display = "";
    if (signOutBtn) signOutBtn.style.display = "inline-block";
    console.log("Signed in as", user.displayName, "UID:", user.uid);

    // Only run one-time setup on the very first auth confirmation.
    if (!_appInitialised) {
      _appInitialised = true;
      // Set the date AFTER auth so the DOM is fully ready and the input
      // is guaranteed to accept values without being immediately wiped.
      loadTodayDate();
      loadDayFromCloud(currentDateStr);
    }
  } else {
    if (authOverlay) authOverlay.style.display = "flex";
    if (appMain) appMain.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "none";
    _appInitialised = false;
  }
});

googleSignInBtn?.addEventListener("click", () => {
  const authError = document.getElementById("authError");
  auth.signInWithPopup(provider).catch((err) => {
    console.error("Sign-in error:", err);
    if (authError) authError.textContent = "Sign-in failed. Please try again.";
  });
});

signOutBtn?.addEventListener("click", () => auth.signOut());

// ---- Local storage helpers ----
const STORAGE_KEY = "fibroDaysLocal";
function loadAllDays() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
function saveAllDays(days) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}
function numberOrNull(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ---- Module-level current date (authoritative source of truth) ----
// We keep this in a JS variable so it is never affected by the browser
// silently clearing an <input type="date"> value when its parent tab is
// hidden (display:none).  All date navigation reads/writes go through
// currentDateStr rather than reading dateInput.value directly.
let currentDateStr = "";

function todayStr() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Sync the date input to currentDateStr and refresh derived UI. */
function syncDateInput() {
  const dateInput = document.getElementById("dateInput");
  if (dateInput) dateInput.value = currentDateStr;
  updateDayOfWeek();
}

// ---- Day-of-week display (entry tab header) ----
function updateDayOfWeek() {
  const dateInput = document.getElementById("dateInput");
  const display = document.getElementById("dayOfWeekDisplay");
  if (!display) return;
  const val = currentDateStr || (dateInput && dateInput.value) || "";
  if (!val) { display.textContent = ""; return; }
  const [year, month, day] = val.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) { display.textContent = ""; return; }
  display.textContent = date.toLocaleDateString(undefined, { weekday: "long" });
}

// ---- Date helpers for journal headers ----
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
  setupSleepCalculation();
  setupNumberSteppers();
  setupMedicationsTab();
  setupPrint();
  setupAtrForm();

  // NOTE: loadTodayDate() and the initial loadDayFromCloud() are now called
  // inside onAuthStateChanged (above) so the date is set only after Firebase
  // confirms the user is signed in and the DOM is fully settled.

  // Listen for manual date picker changes.
  // Guard: only update currentDateStr when the picker provides a real,
  // non-empty value that actually differs from what we already have.
  // This prevents a programmatic syncDateInput() call (which sets
  // dateInput.value) from firing this listener and accidentally wiping
  // currentDateStr if the browser emits a spurious "change" event.
  const dateInput = document.getElementById("dateInput");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const v = dateInput.value;
      if (v && v !== currentDateStr) {
        currentDateStr = v;
        updateDayOfWeek();
        loadDayFromCloud(currentDateStr);
      }
    });
  }

  refreshHistory();
  refreshTrends();
});

// ---- Print support ----

const FREQ_LABELS = {
  daily: "Daily",
  twice_daily: "2\u00D7/day",
  three_times_daily: "3\u00D7/day",
  as_needed: "PRN",
  weekly: "Weekly",
  other: "Other"
};

function setupPrint() {
  const printBtn = document.getElementById("printMedBtn");
  if (printBtn) {
    printBtn.removeAttribute("onclick");
    printBtn.addEventListener("click", printMedList);
  }
}

async function printMedList() {
  const printBtn = document.getElementById("printMedBtn");
  if (printBtn) { printBtn.disabled = true; printBtn.textContent = "Loading\u2026"; }

  try {
    const [medSnap, suppSnap] = await Promise.all([
      db.collection("medications").orderBy("name").get(),
      db.collection("supplements").orderBy("name").get()
    ]);

    const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    const user = auth.currentUser;
    const userName = user?.displayName || "";

    function buildRows(snapshot, extraLabel) {
      if (snapshot.empty) {
        return `<tr><td colspan="5" class="empty">None on file.</td></tr>`;
      }
      let html = "";
      snapshot.forEach(doc => {
        const d = doc.data();
        const freq = FREQ_LABELS[d.frequency] || d.frequency || "\u2014";
        html += `<tr>
          <td>${escHtml(d.name || "")}</td>
          <td class="c">${escHtml(d.dose || "\u2014")}</td>
          <td class="c">${escHtml(freq)}</td>
          <td>${escHtml(d[extraLabel] || "\u2014")}</td>
          <td class="notes">${escHtml(d.notes || "")}</td>
        </tr>`;
      });
      return html;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meds &amp; Supplements</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #111;
    }
    .page {
      padding: 0.35in 0.4in 0.3in;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1.5px solid #3f51b5;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .doc-header h1 {
      font-size: 11pt;
      font-weight: 800;
      color: #1c1d22;
    }
    .doc-header .meta {
      font-size: 7pt;
      color: #555;
      text-align: right;
      line-height: 1.4;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    h2 {
      font-size: 7.5pt;
      font-weight: 700;
      color: #3f51b5;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
    }
    thead th {
      background: #3f51b5;
      color: #fff;
      padding: 3px 5px;
      text-align: left;
      font-size: 6.5pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    thead th.c { text-align: center; }
    tbody td {
      padding: 2px 5px;
      border-bottom: 1px solid #e8e8e8;
      vertical-align: top;
      line-height: 1.3;
    }
    tbody td.c { text-align: center; }
    tbody td.notes { color: #555; font-style: italic; max-width: 90px; }
    tbody td.empty { text-align: center; color: #888; font-style: italic; padding: 6px; }
    tbody tr:nth-child(even) td { background: #f5f7ff; }
    .footer {
      margin-top: 8px;
      font-size: 6.5pt;
      color: #aaa;
      border-top: 1px solid #e0e0e0;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { font-size: 8pt; }
      @page { margin: 0.35in 0.4in; size: letter portrait; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <h1>Medication &amp; Supplement List</h1>
      <div class="meta">${userName ? escHtml(userName) + "<br>" : ""}${escHtml(dateStr)}</div>
    </div>

    <div class="two-col">
      <div>
        <h2>Medications</h2>
        <table>
          <thead><tr>
            <th>Name</th>
            <th class="c">Dose</th>
            <th class="c">Freq</th>
            <th>Doctor</th>
            <th>Notes</th>
          </tr></thead>
          <tbody>${buildRows(medSnap, "doctor")}</tbody>
        </table>
      </div>
      <div>
        <h2>Supplements</h2>
        <table>
          <thead><tr>
            <th>Name</th>
            <th class="c">Dose</th>
            <th class="c">Freq</th>
            <th>Brand</th>
            <th>Notes</th>
          </tr></thead>
          <tbody>${buildRows(suppSnap, "brand")}</tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      <span>Fibromyalgia Symptom Tracker</span>
      <span>Bring this list to all medical appointments.</span>
    </div>
  </div>

  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Pop-up was blocked. Please allow pop-ups for this site and try again.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();

  } catch (err) {
    console.error("Print error:", err);
    alert("Failed to load data for printing. Please try again.");
  } finally {
    if (printBtn) { printBtn.disabled = false; printBtn.textContent = "Print / Save PDF"; }
  }
}

/** Escape HTML special chars for safe inline insertion */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      // When returning to the entry tab, re-sync the date input in case
      // the browser cleared its value while it was hidden.
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
  const topBtn = document.getElementById("saveDayTop");
  const bottomBtn = document.getElementById("saveDayBottom");
  const status = document.getElementById("saveStatus");

  const handleSaveClick = async () => {
    const dayData = collectFormData();
    if (!dayData.date) { status.textContent = "Please select a date."; return; }
    status.textContent = "Saving locally...";
    const days = loadAllDays();
    const existingIndex = days.findIndex(d => d.date === dayData.date);
    if (existingIndex >= 0) days[existingIndex] = dayData;
    else days.push(dayData);
    saveAllDays(days);
    status.textContent = "Saved locally.";
    try {
      status.textContent = "Saving to cloud...";
      await db.collection("days").doc(dayData.date).set(dayData, { merge: false });
      status.textContent = "Saved locally + cloud.";
    } catch (err) {
      console.error("Error saving to cloud:", err);
      status.textContent = "Saved locally, but cloud save failed.";
    }
    refreshHistory();
    renderJournal();
    refreshTrends();
  };

  topBtn?.addEventListener("click", handleSaveClick);
  bottomBtn?.addEventListener("click", handleSaveClick);
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
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => cb.checked = false);
}

function loadDayFromCloud(date) {
  const status = document.getElementById("saveStatus");
  if (!date) return;
  db.collection("days").doc(date).get().then((doc) => {
    if (doc.exists) {
      fillFormFromData(doc.data());
      status.textContent = "Loaded from cloud for " + date + ".";
    } else {
      clearFormFieldsExceptDate();
      status.textContent = "No cloud entry for that date. Form cleared.";
    }
  }).catch((error) => {
    console.error("Error getting document:", error);
    clearFormFieldsExceptDate();
    status.textContent = "Cloud load failed.";
  });
}

function collectFormData() {
  // Always use currentDateStr as the authoritative date so that a browser-
  // cleared hidden input never causes the date to be saved as "".
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
  return { date, dayTitle, overallNotes, functionality, sleep, didExercise, exercise, tags, avgFunctionality, mood: { score: moodScore, notes: moodNotes } };
}

async function refreshHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  list.innerHTML = "<li>Loading...</li>";
  try {
    const snapshot = await db.collection("days").orderBy(firebase.firestore.FieldPath.documentId()).get();
    const days = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      days.push({ date: data.date || doc.id, dayTitle: data.dayTitle || "", avgFunctionality: data.avgFunctionality ?? null, functionality: data.functionality || null, sleep: data.sleep || null, didExercise: data.didExercise || false, exercise: data.exercise || null, tags: data.tags || [] });
    });
    days.sort((a, b) => a.date.localeCompare(b.date)).reverse();
    list.innerHTML = "";
    if (!days.length) { list.innerHTML = "<li>No entries yet.</li>"; return; }
    days.slice(0, 30).forEach(d => {
      const li = document.createElement("li");
      const title = d.dayTitle ? ` \u2013 ${d.dayTitle}` : "";
      const avg = d.avgFunctionality != null ? ` | Avg func: ${d.avgFunctionality.toFixed(1)}` : "";
      const textSpan = document.createElement("span");
      textSpan.textContent = `${d.date}${title}${avg}`;
      li.appendChild(textSpan);
      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => { fillFormFromData(d); switchToTab("entry-tab"); });
      li.appendChild(loadBtn);
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.classList.add("danger");
      deleteBtn.addEventListener("click", async () => {
        if (!window.confirm(`Delete entry for ${d.date}?`)) return;
        try { await db.collection("days").doc(d.date).delete(); refreshHistory(); refreshTrends(); }
        catch (err) { console.error("Error deleting day:", err); alert("Failed to delete."); }
      });
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading history:", err);
    list.innerHTML = "<li>Cloud history load failed.</li>";
  }
}

function fillFormFromData(d) {
  // Update currentDateStr first so it is always in sync.
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
  updateSleepDuration();
  renderJournal();
  const tagsSet = new Set(d.tags || []);
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => cb.checked = tagsSet.has(cb.value));
}

function changeDateBy(days) {
  // Use the module-level currentDateStr — never rely on dateInput.value which
  // browsers may clear while the input's parent tab is hidden.
  if (!currentDateStr) currentDateStr = todayStr();
  const [y, mo, dy] = currentDateStr.split("-").map(Number);
  const current = new Date(y, mo - 1, dy);   // local time — avoids UTC midnight issues
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
  // Re-sync the date input whenever the entry tab is activated programmatically.
  if (tabId === "entry-tab") syncDateInput();
}

function formatScore(value) { return typeof value === "number" ? value : "not recorded"; }
function formatText(value, fallback = "Not recorded.") { return value && String(value).trim() ? value : fallback; }

async function renderJournal() {
  const container = document.getElementById("journalOutput");
  if (!container) return;
  container.innerHTML = `<p class="journal-muted">Loading journal entries...</p>`;
  try {
    const snapshot = await db.collection("days").orderBy(firebase.firestore.FieldPath.documentId()).get();
    const days = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      days.push({ date: data.date || doc.id, dayTitle: data.dayTitle || "", overallNotes: data.overallNotes || "", functionality: data.functionality || {}, sleep: data.sleep || {}, didExercise: data.didExercise || false, exercise: data.exercise || null, tags: data.tags || [], avgFunctionality: data.avgFunctionality ?? null, mood: data.mood || {} });
    });
    days.sort((a, b) => b.date.localeCompare(a.date));
    if (!days.length) { container.innerHTML = `<p class="journal-muted">No journal entries yet.</p>`; return; }
    container.innerHTML = days.map((data) => {
      const title = data.dayTitle?.trim() || "";
      const avgFunctionality = typeof data.avgFunctionality === "number" ? `${data.avgFunctionality.toFixed(1)}/10` : "Not recorded";
      const moodScore = typeof data.mood?.score === "number" ? `${data.mood.score}/10` : "Not recorded";
      const sleepHours = typeof data.sleep?.hours === "number" ? `${data.sleep.hours} hours` : "Not recorded";
      const sleepQuality = typeof data.sleep?.quality === "number" ? `${data.sleep.quality}/10` : "Not recorded";
      const awakenings = typeof data.sleep?.awakenings === "number" ? data.sleep.awakenings : "Not recorded";
      const tagsHtml = data.tags?.length ? `<div class="journal-tags">${data.tags.map(tag => `<span class="journal-tag">${tag}</span>`).join("")}</div>` : `<p class="journal-muted">No tags recorded.</p>`;
      const exerciseHtml = data.didExercise && data.exercise ? `<p><span class="journal-label">Type:</span> ${formatText(data.exercise.type, "not recorded")}</p><p><span class="journal-label">Minutes:</span> ${data.exercise.minutes ?? "not recorded"}</p><p><span class="journal-label">Intensity:</span> ${formatText(data.exercise.intensity, "not recorded")}</p><p><span class="journal-label">Timing:</span> ${formatText(data.exercise.timing, "not recorded")}</p><p>${formatText(data.exercise.notes, "No exercise notes recorded.")}</p>` : `<p>No exercise recorded.</p>`;

      const dayOfWeek = getJournalDayOfWeek(data.date);
      const dateLine = getJournalDateLine(data.date);

      return `<article class="journal-entry"><header class="journal-day-header"><div><p class="journal-dow">${dayOfWeek}</p><p class="journal-date">${dateLine}</p>${title ? `<p class="journal-title">${title}</p>` : ""}</div><div class="journal-score-pill"><span class="journal-score-label">Avg function</span><strong>${avgFunctionality}</strong></div></header><section class="journal-section"><h4>Mood</h4><p><span class="journal-label">Score:</span> ${moodScore}</p><p>${formatText(data.mood?.notes, "No mood notes recorded.")}</p></section><section class="journal-section"><h4>Sleep summary</h4><div class="sleep-summary"><div class="sleep-stat"><span class="journal-label">Bedtime</span><strong>${formatText(data.sleep?.bedtime, "not recorded")}</strong></div><div class="sleep-stat"><span class="journal-label">Wake time</span><strong>${formatText(data.sleep?.wakeTime, "not recorded")}</strong></div><div class="sleep-stat"><span class="journal-label">Hours slept</span><strong>${sleepHours}</strong></div><div class="sleep-stat"><span class="journal-label">Sleep quality</span><strong>${sleepQuality}</strong></div><div class="sleep-stat"><span class="journal-label">Awakenings</span><strong>${awakenings}</strong></div></div><p class="sleep-notes">${formatText(data.sleep?.notes, "No sleep notes recorded.")}</p></section><section class="journal-section"><h4>Functionality through the day</h4><div class="function-grid"><div class="function-card"><div class="function-card-head"><span>Early morning</span><strong>${formatScore(data.functionality?.earlyMorning?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.earlyMorning?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.earlyMorning?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Late morning</span><strong>${formatScore(data.functionality?.lateMorning?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.lateMorning?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.lateMorning?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Early afternoon</span><strong>${formatScore(data.functionality?.earlyAfternoon?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.earlyAfternoon?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.earlyAfternoon?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Late afternoon</span><strong>${formatScore(data.functionality?.lateAfternoon?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.lateAfternoon?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.lateAfternoon?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Early evening</span><strong>${formatScore(data.functionality?.earlyEvening?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.earlyEvening?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.earlyEvening?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Late evening</span><strong>${formatScore(data.functionality?.lateEvening?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.lateEvening?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.lateEvening?.symptoms, "none recorded")}</p></div></div></section><section class="journal-section"><h4>Exercise</h4>${exerciseHtml}</section><section class="journal-section"><h4>Tags</h4>${tagsHtml}</section><section class="journal-section"><h4>Overall notes</h4><p>${formatText(data.overallNotes, "No overall notes recorded.")}</p></section></article>`;
    }).join("");
  } catch (err) {
    console.error("Error loading journal:", err);
    container.innerHTML = `<p class="journal-muted">Cloud journal load failed.</p>`;
  }
}

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
// MEDICATIONS TAB
// ============================================================

function setupMedicationsTab() {
  document.getElementById("saveMedBtn")?.addEventListener("click", saveMedication);
  document.getElementById("cancelMedEditBtn")?.addEventListener("click", resetMedForm);
  document.getElementById("saveSuppBtn")?.addEventListener("click", saveSupplement);
  document.getElementById("cancelSuppEditBtn")?.addEventListener("click", resetSuppForm);

  document.querySelectorAll(".med-sub-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetViewId = btn.getAttribute("data-med-view");
      document.querySelectorAll(".med-sub-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".med-view").forEach(view => {
        view.style.display = view.id === targetViewId ? "" : "none";
      });
      refreshMedView(targetViewId);
    });
  });

  refreshMedList();
}

function refreshMedView(viewId) {
  if (viewId === "medListView") refreshMedList();
  else if (viewId === "suppListView") refreshSuppList();
  else if (viewId === "medHistoryView") refreshMedHistory();
  else if (viewId === "medPrintView") { refreshMedPrintTable(); refreshSuppPrintTable(); }
}

// ---- Medications CRUD ----

function getMedFormData() {
  return {
    name: document.getElementById("medNameInput").value.trim(),
    dose: document.getElementById("medDoseInput").value.trim(),
    frequency: document.getElementById("medFrequencyInput").value,
    doctor: document.getElementById("medDoctorInput").value.trim(),
    notes: document.getElementById("medNotesInput").value.trim()
  };
}

function resetMedForm() {
  document.getElementById("medNameInput").value = "";
  document.getElementById("medDoseInput").value = "";
  document.getElementById("medFrequencyInput").value = "";
  document.getElementById("medDoctorInput").value = "";
  document.getElementById("medNotesInput").value = "";
  document.getElementById("medEditingId").value = "";
  document.getElementById("medFormTitle").textContent = "Add Medication";
  document.getElementById("saveMedBtn").textContent = "Add Medication";
  document.getElementById("cancelMedEditBtn").style.display = "none";
}

async function saveMedication() {
  const data = getMedFormData();
  if (!data.name) { alert("Please enter a medication name."); return; }
  const editingId = document.getElementById("medEditingId").value;
  const now = new Date().toISOString();
  if (editingId) {
    const oldDoc = await db.collection("medications").doc(editingId).get();
    const oldData = oldDoc.exists ? oldDoc.data() : {};
    await db.collection("medications").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
    const changes = [];
    if (oldData.name !== data.name) changes.push(`Name: "${oldData.name}" \u2192 "${data.name}"`);
    if (oldData.dose !== data.dose) changes.push(`Dose: "${oldData.dose}" \u2192 "${data.dose}"`);
    if (oldData.frequency !== data.frequency) changes.push(`Frequency: "${oldData.frequency}" \u2192 "${data.frequency}"`);
    if (oldData.doctor !== data.doctor) changes.push(`Doctor: "${oldData.doctor}" \u2192 "${data.doctor}"`);
    if (oldData.notes !== data.notes) changes.push(`Notes updated`);
    await db.collection("medicationHistory").add({
      type: "medication", action: "edited", medicationId: editingId, medicationName: data.name,
      changes: changes.length ? changes : ["No field changes detected"],
      snapshot: { ...data }, timestamp: now
    });
  } else {
    const docRef = await db.collection("medications").add({ ...data, createdAt: now, updatedAt: now });
    await db.collection("medicationHistory").add({
      type: "medication", action: "added", medicationId: docRef.id, medicationName: data.name,
      changes: [`Added: ${data.name}${data.dose ? ` ${data.dose}` : ""}`],
      snapshot: { ...data }, timestamp: now
    });
  }
  resetMedForm();
  refreshMedList();
}

async function deleteMedication(id, name) {
  if (!window.confirm(`Delete "${name}" from your medication list?\n\nThis will be recorded in the change history.`)) return;
  const now = new Date().toISOString();
  const oldDoc = await db.collection("medications").doc(id).get();
  const oldData = oldDoc.exists ? oldDoc.data() : {};
  await db.collection("medications").doc(id).delete();
  await db.collection("medicationHistory").add({
    type: "medication", action: "deleted", medicationId: id, medicationName: name,
    changes: [`Deleted: ${name}${oldData.dose ? ` ${oldData.dose}` : ""}`],
    snapshot: { ...oldData }, timestamp: now
  });
  refreshMedList();
}

function startEditMedication(id, med) {
  document.getElementById("medNameInput").value = med.name || "";
  document.getElementById("medDoseInput").value = med.dose || "";
  document.getElementById("medFrequencyInput").value = med.frequency || "";
  document.getElementById("medDoctorInput").value = med.doctor || "";
  document.getElementById("medNotesInput").value = med.notes || "";
  document.getElementById("medEditingId").value = id;
  document.getElementById("medFormTitle").textContent = "Edit Medication";
  document.getElementById("saveMedBtn").textContent = "Save Changes";
  document.getElementById("cancelMedEditBtn").style.display = "inline-block";
  document.getElementById("medFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshMedList() {
  const list = document.getElementById("medList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading...</li>";
  try {
    const snapshot = await db.collection("medications").orderBy("name").get();
    if (snapshot.empty) {
      list.innerHTML = "<li class='med-empty'>No medications added yet.</li>";
      return;
    }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const med = doc.data();
      const li = document.createElement("li");
      li.className = "med-item";
      const freq = FREQ_LABELS[med.frequency] || med.frequency || "";
      li.innerHTML = `
        <div class="med-item-info">
          <span class="med-item-name">${escHtml(med.name || "")}</span>
          ${med.dose ? `<span class="med-item-detail">${escHtml(med.dose)}</span>` : ""}
          ${freq ? `<span class="med-item-detail">${escHtml(freq)}</span>` : ""}
          ${med.doctor ? `<span class="med-item-detail">Dr. ${escHtml(med.doctor)}</span>` : ""}
          ${med.notes ? `<span class="med-item-notes">${escHtml(med.notes)}</span>` : ""}
        </div>
        <div class="med-item-actions">
          <button class="med-edit-btn">Edit</button>
          <button class="med-delete-btn danger">Delete</button>
        </div>`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startEditMedication(doc.id, med));
      li.querySelector(".med-delete-btn").addEventListener("click", () => deleteMedication(doc.id, med.name));
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading medications:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load medications.</li>";
  }
}

// ---- Supplements CRUD ----

function getSuppFormData() {
  return {
    name: document.getElementById("suppNameInput").value.trim(),
    dose: document.getElementById("suppDoseInput").value.trim(),
    frequency: document.getElementById("suppFrequencyInput").value,
    brand: document.getElementById("suppBrandInput").value.trim(),
    notes: document.getElementById("suppNotesInput").value.trim()
  };
}

function resetSuppForm() {
  document.getElementById("suppNameInput").value = "";
  document.getElementById("suppDoseInput").value = "";
  document.getElementById("suppFrequencyInput").value = "";
  document.getElementById("suppBrandInput").value = "";
  document.getElementById("suppNotesInput").value = "";
  document.getElementById("suppEditingId").value = "";
  document.getElementById("suppFormTitle").textContent = "Add Supplement";
  document.getElementById("saveSuppBtn").textContent = "Add Supplement";
  document.getElementById("cancelSuppEditBtn").style.display = "none";
}

async function saveSupplement() {
  const data = getSuppFormData();
  if (!data.name) { alert("Please enter a supplement name."); return; }
  const editingId = document.getElementById("suppEditingId").value;
  const now = new Date().toISOString();
  if (editingId) {
    const oldDoc = await db.collection("supplements").doc(editingId).get();
    const oldData = oldDoc.exists ? oldDoc.data() : {};
    await db.collection("supplements").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
    const changes = [];
    if (oldData.name !== data.name) changes.push(`Name: "${oldData.name}" \u2192 "${data.name}"`);
    if (oldData.dose !== data.dose) changes.push(`Dose: "${oldData.dose}" \u2192 "${data.dose}"`);
    if (oldData.frequency !== data.frequency) changes.push(`Frequency: "${oldData.frequency}" \u2192 "${data.frequency}"`);
    if (oldData.brand !== data.brand) changes.push(`Brand: "${oldData.brand}" \u2192 "${data.brand}"`);
    if (oldData.notes !== data.notes) changes.push(`Notes updated`);
    await db.collection("medicationHistory").add({
      type: "supplement", action: "edited", medicationId: editingId, medicationName: data.name,
      changes: changes.length ? changes : ["No field changes detected"],
      snapshot: { ...data }, timestamp: now
    });
  } else {
    const docRef = await db.collection("supplements").add({ ...data, createdAt: now, updatedAt: now });
    await db.collection("medicationHistory").add({
      type: "supplement", action: "added", medicationId: docRef.id, medicationName: data.name,
      changes: [`Added: ${data.name}${data.dose ? ` ${data.dose}` : ""}`],
      snapshot: { ...data }, timestamp: now
    });
  }
  resetSuppForm();
  refreshSuppList();
}

async function deleteSupplement(id, name) {
  if (!window.confirm(`Delete "${name}" from your supplement list?\n\nThis will be recorded in the change history.`)) return;
  const now = new Date().toISOString();
  const oldDoc = await db.collection("supplements").doc(id).get();
  const oldData = oldDoc.exists ? oldDoc.data() : {};
  await db.collection("supplements").doc(id).delete();
  await db.collection("medicationHistory").add({
    type: "supplement", action: "deleted", medicationId: id, medicationName: name,
    changes: [`Deleted: ${name}${oldData.dose ? ` ${oldData.dose}` : ""}`],
    snapshot: { ...oldData }, timestamp: now
  });
  refreshSuppList();
}

function startEditSupplement(id, supp) {
  document.getElementById("suppNameInput").value = supp.name || "";
  document.getElementById("suppDoseInput").value = supp.dose || "";
  document.getElementById("suppFrequencyInput").value = supp.frequency || "";
  document.getElementById("suppBrandInput").value = supp.brand || "";
  document.getElementById("suppNotesInput").value = supp.notes || "";
  document.getElementById("suppEditingId").value = id;
  document.getElementById("suppFormTitle").textContent = "Edit Supplement";
  document.getElementById("saveSuppBtn").textContent = "Save Changes";
  document.getElementById("cancelSuppEditBtn").style.display = "inline-block";
  document.getElementById("suppFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshSuppList() {
  const list = document.getElementById("suppList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading...</li>";
  try {
    const snapshot = await db.collection("supplements").orderBy("name").get();
    if (snapshot.empty) {
      list.innerHTML = "<li class='med-empty'>No supplements added yet.</li>";
      return;
    }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const supp = doc.data();
      const li = document.createElement("li");
      li.className = "med-item";
      const freq = FREQ_LABELS[supp.frequency] || supp.frequency || "";
      li.innerHTML = `
        <div class="med-item-info">
          <span class="med-item-name">${escHtml(supp.name || "")}</span>
          ${supp.dose ? `<span class="med-item-detail">${escHtml(supp.dose)}</span>` : ""}
          ${freq ? `<span class="med-item-detail">${escHtml(freq)}</span>` : ""}
          ${supp.brand ? `<span class="med-item-detail">${escHtml(supp.brand)}</span>` : ""}
          ${supp.notes ? `<span class="med-item-notes">${escHtml(supp.notes)}</span>` : ""}
        </div>
        <div class="med-item-actions">
          <button class="med-edit-btn">Edit</button>
          <button class="med-delete-btn danger">Delete</button>
        </div>`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startEditSupplement(doc.id, supp));
      li.querySelector(".med-delete-btn").addEventListener("click", () => deleteSupplement(doc.id, supp.name));
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading supplements:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load supplements.</li>";
  }
}

// ---- Medication History ----

async function refreshMedHistory() {
  const list = document.getElementById("medHistoryList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading...</li>";
  try {
    const snapshot = await db.collection("medicationHistory")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();
    if (snapshot.empty) {
      list.innerHTML = "<li class='med-empty'>No medication changes recorded yet.</li>";
      return;
    }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const h = doc.data();
      const li = document.createElement("li");
      li.className = "med-history-item";
      const ts = h.timestamp ? new Date(h.timestamp).toLocaleString() : "Unknown time";
      const actionLabel = { added: "Added", edited: "Edited", deleted: "Deleted" }[h.action] || h.action;
      const typeLabel = h.type === "supplement" ? "Supplement" : "Medication";
      li.innerHTML = `
        <div class="med-history-header">
          <span class="med-history-action med-history-${h.action}">${actionLabel}</span>
          <span class="med-history-type">${typeLabel}</span>
          <span class="med-history-name">${escHtml(h.medicationName || "")}</span>
          <span class="med-history-ts">${ts}</span>
        </div>
        ${h.changes?.length ? `<ul class="med-history-changes">${h.changes.map(c => `<li>${escHtml(c)}</li>`).join("")}</ul>` : ""}`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading medication history:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load history.</li>";
  }
}

// ---- Print view tables ----

async function refreshMedPrintTable() {
  const tbody = document.getElementById("medPrintTableBody");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";
  try {
    const snapshot = await db.collection("medications").orderBy("name").get();
    if (snapshot.empty) { tbody.innerHTML = "<tr><td colspan='5' class='med-empty'>No medications on file.</td></tr>"; return; }
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const m = doc.data();
      const freq = FREQ_LABELS[m.frequency] || m.frequency || "\u2014";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escHtml(m.name||"")}</td><td>${escHtml(m.dose||"\u2014")}</td><td>${escHtml(freq)}</td><td>${escHtml(m.doctor||"\u2014")}</td><td>${escHtml(m.notes||"")}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { tbody.innerHTML = "<tr><td colspan='5'>Failed to load.</td></tr>"; }
}

async function refreshSuppPrintTable() {
  const tbody = document.getElementById("suppPrintTableBody");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";
  try {
    const snapshot = await db.collection("supplements").orderBy("name").get();
    if (snapshot.empty) { tbody.innerHTML = "<tr><td colspan='5' class='med-empty'>No supplements on file.</td></tr>"; return; }
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const s = doc.data();
      const freq = FREQ_LABELS[s.frequency] || s.frequency || "\u2014";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escHtml(s.name||"")}</td><td>${escHtml(s.dose||"\u2014")}</td><td>${escHtml(freq)}</td><td>${escHtml(s.brand||"\u2014")}</td><td>${escHtml(s.notes||"")}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { tbody.innerHTML = "<tr><td colspan='5'>Failed to load.</td></tr>"; }
}

// ============================================================
// MOOD TAB — 14-Day Mood Summary + Automatic Thought Records
// ============================================================

async function refreshMoodTab() {
  await Promise.all([refreshMoodSummaryTable(), refreshAtrList()]);
}

// ---- 14-Day Mood Summary Table ----

async function refreshMoodSummaryTable() {
  const tbody = document.getElementById("moodSummaryBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="mood-table-empty">Loading&#8230;</td></tr>`;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

const snapshot = await db.collection("days")
  .where(firebase.firestore.FieldPath.documentId(), "in", dates)
  .get();

    const byDate = {};
    snapshot.forEach(doc => { byDate[doc.id] = doc.data(); });

    const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    tbody.innerHTML = "";
    let hasAny = false;
    dates.forEach(dateStr => {
      const data = byDate[dateStr];
      const moodScore = data?.mood?.score ?? null;
      const moodNotes = data?.mood?.notes || "";

      const d = new Date(dateStr + "T12:00:00");
      const dayLabel = DOW[d.getDay()];
      const dateLabel = `${MONTH[d.getMonth()]} ${d.getDate()}`;

      const hasData = moodScore !== null || moodNotes;
      if (hasData) hasAny = true;

      const scoreCell = moodScore !== null
        ? `<span class="mood-score-pill mood-score-${Math.ceil(moodScore / 3)}">${moodScore}/10</span>`
        : `<span class="mood-score-empty">—</span>`;

      const tr = document.createElement("tr");
      if (!hasData) tr.classList.add("mood-row-empty");
      tr.innerHTML = `
        <td class="mood-date-cell">${dateLabel}</td>
        <td class="mood-day-cell">${dayLabel}</td>
        <td class="mood-score-cell">${scoreCell}</td>
        <td class="mood-notes-cell">${moodNotes
          ? `<span>${moodNotes}</span>`
          : `<span class="mood-score-empty">—</span>`}</td>`;
      tbody.appendChild(tr);
    });

    if (!hasAny) {
      tbody.innerHTML = `<tr><td colspan="4" class="mood-table-empty">No mood data in the last 14 days. Add entries in the Daily Entry tab.</td></tr>`;
    }
  } catch (err) {
    console.error("Error loading mood summary:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="mood-table-empty">Failed to load mood data.</td></tr>`;
  }
}

// ---- Automatic Thought Records (ATR) ----

function getAtrFormData() {
  return {
    date: document.getElementById("atrDateInput").value,
    situation: document.getElementById("atrSituationInput").value.trim(),
    emotions: document.getElementById("atrEmotionsInput").value.trim(),
    intensity: parseInt(document.getElementById("atrIntensityRange").value, 10),
    automaticThought: document.getElementById("atrAutoThoughtInput").value.trim(),
    alternativeThought: document.getElementById("atrAltThoughtInput").value.trim()
  };
}

function resetAtrForm() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("atrDateInput").value = today;
  document.getElementById("atrSituationInput").value = "";
  document.getElementById("atrEmotionsInput").value = "";
  document.getElementById("atrIntensityRange").value = 50;
  document.getElementById("atrIntensityDisplay").textContent = "50";
  document.getElementById("atrAutoThoughtInput").value = "";
  document.getElementById("atrAltThoughtInput").value = "";
  document.getElementById("atrEditingId").value = "";
  document.getElementById("atrFormTitle").textContent = "New Automatic Thought Record";
  document.getElementById("saveAtrBtn").textContent = "Save Record";
  document.getElementById("cancelAtrEditBtn").style.display = "none";
}

async function saveAtr() {
  const data = getAtrFormData();
  if (!data.date) { alert("Please select a date."); return; }
  if (!data.situation) { alert("Please describe the situation."); return; }
  if (!data.automaticThought) { alert("Please enter the automatic thought."); return; }
  const editingId = document.getElementById("atrEditingId").value;
  const now = new Date().toISOString();
  try {
    if (editingId) {
      await db.collection("automaticThoughtRecords").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
    } else {
      await db.collection("automaticThoughtRecords").add({ ...data, createdAt: now, updatedAt: now });
    }
    resetAtrForm();
    await refreshAtrList();
  } catch (err) {
    console.error("Error saving ATR:", err);
    alert("Failed to save record. Please try again.");
  }
}

async function deleteAtr(id) {
  if (!window.confirm("Delete this Automatic Thought Record? This cannot be undone.")) return;
  try {
    await db.collection("automaticThoughtRecords").doc(id).delete();
    await refreshAtrList();
  } catch (err) {
    console.error("Error deleting ATR:", err);
    alert("Failed to delete record.");
  }
}

function startEditAtr(id, data) {
  document.getElementById("atrDateInput").value = data.date || "";
  document.getElementById("atrSituationInput").value = data.situation || "";
  document.getElementById("atrEmotionsInput").value = data.emotions || "";
  document.getElementById("atrIntensityRange").value = data.intensity ?? 50;
  document.getElementById("atrIntensityDisplay").textContent = data.intensity ?? 50;
  document.getElementById("atrAutoThoughtInput").value = data.automaticThought || "";
  document.getElementById("atrAltThoughtInput").value = data.alternativeThought || "";
  document.getElementById("atrEditingId").value = id;
  document.getElementById("atrFormTitle").textContent = "Edit Automatic Thought Record";
  document.getElementById("saveAtrBtn").textContent = "Save Changes";
  document.getElementById("cancelAtrEditBtn").style.display = "inline-block";
  document.getElementById("atrFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshAtrList() {
  const container = document.getElementById("atrList");
  if (!container) return;
  container.innerHTML = `<p class="atr-empty">Loading&#8230;</p>`;
  try {
    const snapshot = await db.collection("automaticThoughtRecords")
      .orderBy("date", "desc")
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="atr-empty">No records yet. Use the form above to add one.</p>`;
      return;
    }

    const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const r = doc.data();
      const d = r.date ? new Date(r.date + "T12:00:00") : null;
      const dateStr = d ? `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "Unknown date";
      const card = document.createElement("div");
      card.className = "atr-record";
      card.innerHTML = `
        <div class="atr-record-header">
          <span class="atr-record-date">${dateStr}</span>
          ${r.emotions ? `<span class="atr-record-emotions">${r.emotions}</span>` : ""}
          ${r.intensity != null ? `<span class="atr-intensity-badge">${r.intensity}/100</span>` : ""}
          <div class="atr-record-actions">
            <button class="atr-edit-btn" aria-label="Edit record">Edit</button>
            <button class="atr-delete-btn danger" aria-label="Delete record">Delete</button>
          </div>
        </div>
        <div class="atr-record-body">
          <div class="atr-field"><span class="atr-field-label">Situation</span><p>${r.situation || "—"}</p></div>
          <div class="atr-field"><span class="atr-field-label">Automatic Thought</span><p>${r.automaticThought || "—"}</p></div>
          ${r.alternativeThought
            ? `<div class="atr-field atr-field-alt"><span class="atr-field-label">Alternative Thought</span><p>${r.alternativeThought}</p></div>`
            : ""}
        </div>`;
      card.querySelector(".atr-edit-btn").addEventListener("click", () => startEditAtr(doc.id, r));
      card.querySelector(".atr-delete-btn").addEventListener("click", () => deleteAtr(doc.id));
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading ATRs:", err);
    container.innerHTML = `<p class="atr-empty">Failed to load records.</p>`;
  }
}

function setupAtrForm() {
  const slider = document.getElementById("atrIntensityRange");
  const display = document.getElementById("atrIntensityDisplay");
  if (slider && display) {
    slider.addEventListener("input", () => { display.textContent = slider.value; });
  }
  const saveBtn = document.getElementById("saveAtrBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveAtr);
  const cancelBtn = document.getElementById("cancelAtrEditBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", () => resetAtrForm());
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("atrDateInput");
  if (dateInput && !dateInput.value) dateInput.value = today;
}
