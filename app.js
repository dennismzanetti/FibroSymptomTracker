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

// Detect mobile browsers (iOS Safari, Android Chrome/WebView, etc.)
// These environments block signInWithPopup, so we use signInWithRedirect instead.
function isMobileBrowser() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

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

// Handle the result of a redirect sign-in (mobile flow).
// Must be called on every page load so the auth token is consumed after redirect.
auth.getRedirectResult().then((result) => {
  // result.user will be null if there was no pending redirect — that's fine.
  if (result && result.user) {
    console.log("Redirect sign-in complete:", result.user.displayName);
  }
}).catch((err) => {
  console.error("Redirect sign-in error:", err);
  const authError = document.getElementById("authError");
  if (authError) authError.textContent = "Sign-in failed. Please try again.";
});

googleSignInBtn?.addEventListener("click", () => {
  const authError = document.getElementById("authError");
  if (authError) authError.textContent = "";

  if (isMobileBrowser()) {
    // Redirect flow — browser navigates away and returns with credentials.
    // No popup needed; works on all mobile browsers including iOS Safari.
    auth.signInWithRedirect(provider).catch((err) => {
      console.error("Redirect sign-in error:", err);
      if (authError) authError.textContent = "Sign-in failed. Please try again.";
    });
  } else {
    // Popup flow — preferred on desktop where popups are not blocked.
    auth.signInWithPopup(provider).catch((err) => {
      console.error("Sign-in error:", err);
      if (authError) authError.textContent = "Sign-in failed. Please try again.";
    });
  }
});

signOutBtn?.addEventListener("click", () => auth.signOut());

// ---- Toast notification ----
// Uses .toast-success / .toast-error CSS classes defined in styles.css.
// The toast element is created once, reused on subsequent calls.
let _toastTimer = null;
function showToast(message, isError = false) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  // Reset: remove both state classes and any inline fade
  toast.classList.remove("toast-success", "toast-error", "toast--hide");
  toast.style.opacity = "";
  toast.style.transition = "";
  // Remove and re-add to restart the CSS keyframe animation
  toast.style.animation = "none";
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight; // force reflow
  toast.style.animation = "";

  toast.textContent = message;
  toast.classList.add(isError ? "toast-error" : "toast-success");
  toast.style.display = "block";

  if (_toastTimer) clearTimeout(_toastTimer);
  // After 3 s, fade out over 0.4 s, then hide
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

// ---- Local storage helpers (graceful degradation for sandboxed environments) ----
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
    // localStorage unavailable (sandboxed iframe, private mode, etc.) — silently ignore.
    // Cloud (Firestore) save is the primary persistence mechanism.
  }
}
function numberOrNull(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ---- Module-level current date (authoritative source of truth) ----
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
  updateDateDisplay();
}

// ---- Date display in header button ----
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

// Keep legacy reference used in setupTabs → syncDateInput already calls updateDateDisplay
function updateDayOfWeek() { updateDateDisplay(); }

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
  setupDatePicker();
  setupSleepCalculation();
  setupNumberSteppers();
  setupMedicationsTab();
  setupPrint();
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
  const wakeInput    = document.getElementById("wakeInput");
  const totalDisplay = document.getElementById("sleepTotal");
  if (!bedtimeInput || !wakeInput || !totalDisplay) return;

  function calcSleep() {
    const bed  = bedtimeInput.value;
    const wake = wakeInput.value;
    if (!bed || !wake) { totalDisplay.textContent = "--"; return; }
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = wake.split(":").map(Number);
    let bedMins  = bh * 60 + bm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= bedMins) wakeMins += 1440;
    const diff = wakeMins - bedMins;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    totalDisplay.textContent = `${h}h ${m}m`;
  }

  bedtimeInput.addEventListener("change", calcSleep);
  wakeInput.addEventListener("change", calcSleep);
  calcSleep();
}

function setupDateNavigation() {
  const prevBtn = document.getElementById("prevDayBtn");
  const nextBtn = document.getElementById("nextDayBtn");

  function shiftDate(delta) {
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

  prevBtn?.addEventListener("click", () => shiftDate(-1));
  nextBtn?.addEventListener("click", () => shiftDate(1));
}

// ---- Cloud load / save ----

async function loadDayFromCloud(dateStr) {
  if (!dateStr) return;
  try {
    const doc = await db.collection("days").doc(dateStr).get();
    if (doc.exists) {
      populateForm(doc.data());
      showToast("\u2601 Updated from cloud");
    } else {
      clearForm();
    }
  } catch (err) {
    console.error("Error loading from cloud:", err);
    showToast("\u26A0 Could not load from cloud", true);
  }
}
