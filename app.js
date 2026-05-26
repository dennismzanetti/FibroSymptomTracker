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
  toast.textContent = message;
  toast.style.background = isError ? "#b71c1c" : "#1c1d22";
  toast.classList.add("toast--visible");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, 3000);
}

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

// ---- Floating Save Day button visibility ----
function setSaveFloatVisible(visible) {
  const btn = document.getElementById("saveDayFloat");
  if (btn) btn.style.display = visible ? "inline-flex" : "none";
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

  // Show float button on initial load (entry tab is active by default)
  setSaveFloatVisible(true);

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
      // Show floating Save Day button only on the entry tab
      setSaveFloatVisible(target === "entry-tab");
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
  const floatBtn = document.getElementById("saveDayFloat");
  const status = document.getElementById("saveStatus");

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
      showToast("\u2713 Saved locally + cloud");
    } catch (err) {
      console.error("Error saving to cloud:", err);
      showToast("\u26A0 Saved locally \u2014 cloud save failed", true);
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
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => cb.checked = false);
}

function loadDayFromCloud(date) {
  const status = document.getElementById("saveStatus");
  if (!date) return;
  db.collection("days").doc(date).get().then((doc) => {
    if (doc.exists) {
      fillFormFromData(doc.data());
      if (status) status.textContent = "Loaded from cloud for " + date + ".";
    } else {
      clearFormFieldsExceptDate();
      if (status) status.textContent = "No cloud entry for that date. Form cleared.";
    }
  }).cat