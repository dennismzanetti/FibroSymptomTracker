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

auth.onAuthStateChanged((user) => {
  if (user) {
    if (authOverlay) authOverlay.style.display = "none";
    if (appMain) appMain.style.display = "";
    if (signOutBtn) signOutBtn.style.display = "inline-block";
    console.log("Signed in as", user.displayName, "UID:", user.uid);
  } else {
    if (authOverlay) authOverlay.style.display = "flex";
    if (appMain) appMain.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "none";
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

// ---- Day-of-week display (entry tab header) ----
function updateDayOfWeek() {
  const dateInput = document.getElementById("dateInput");
  const display = document.getElementById("dayOfWeekDisplay");
  if (!display) return;
  if (!dateInput || !dateInput.value) {
    display.textContent = "";
    return;
  }
  const [year, month, day] = dateInput.value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
    display.textContent = "";
    return;
  }
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
  setupAtrForm();
  setupExerciseToggle();
  setupSaveDay();
  loadTodayDate();
  setupDateNavigation();
  setupSleepCalculation();
  setupNumberSteppers();
  setupMedicationsTab();
  setupPrint();

  const dateInput = document.getElementById("dateInput");
  if (dateInput && dateInput.value) loadDayFromCloud(dateInput.value);

  if (dateInput) {
    ["change", "input", "blur"].forEach((evt) => {
      dateInput.addEventListener(evt, (event) => {
        if (event.target.value && evt === "change") loadDayFromCloud(event.target.value);
        updateDayOfWeek();
      });
    });
  }

  refreshHistory();
  refreshTrends();
});

// ---- Print support ----

const FREQ_LABELS = {
  daily: "Daily",
  twice_daily: "2\u00d7/day",
  three_times_daily: "3\u00d7/day",
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
    body { font-family: Arial, sans-serif; font-size: 8pt; color: #111; }
    .page { padding: 0.35in 0.4in 0.3in; }
    .doc-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5px solid #3f51b5; padding-bottom: 4px; margin-bottom: 8px; }
    .doc-header h1 { font-size: 11pt; font-weight: 800; color: #1c1d22; }
    .doc-header .meta { font-size: 7pt; color: #555; text-align: right; line-height: 1.4; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    h2 { font-size: 7.5pt; font-weight: 700; color: #3f51b5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
    thead th { background: #3f51b5; color: #fff; padding: 3px 5px; text-align: left; font-size: 6.5pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
    thead th.c { text-align: center; }
    tbody td { padding: 2px 5px; border-bottom: 1px solid #e8e8e8; vertical-align: top; line-height: 1.3; }
    tbody td.c { text-align: center; }
    tbody td.notes { color: #555; font-style: italic; max-width: 90px; }
    tbody td.empty { text-align: center; color: #888; font-style: italic; padding: 6px; }
    tbody tr:nth-child(even) td { background: #f5f7ff; }
    .footer { margin-top: 8px; font-size: 6.5pt; color: #aaa; border-top: 1px solid #e0e0e0; padding-top: 4px; display: flex; justify-content: space-between; }
    @media print { body { font-size: 8pt; } @page { margin: 0.35in 0.4in; size: letter portrait; } .page { padding: 0; } }
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
          <thead><tr><th>Name</th><th class="c">Dose</th><th class="c">Freq</th><th>Doctor</th><th>Notes</th></tr></thead>
          <tbody>${buildRows(medSnap, "doctor")}</tbody>
        </table>
      </div>
      <div>
        <h2>Supplements</h2>
        <table>
          <thead><tr><th>Name</th><th class="c">Dose</th><th class="c">Freq</th><th>Brand</th><th>Notes</th></tr></thead>
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
    if (!win) { alert("Pop-up was blocked. Please allow pop-ups for this site and try again."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();

  } catch (err) {
    console.error("Print error:", err);
    alert("Failed to load data for printing. Please try again.");
  } finally {
    if (printBtn) { printBtn.disabled = false; printBtn.textContent = "\u{1F5CE} Print / Save PDF"; }
  }
}

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
      const targetTab = document.getElementById(target);
      if (targetTab) targetTab.classList.add("active");

      if (target === "history-tab") refreshHistory();
      if (target === "trends-tab") refreshTrends();
      if (target === "journal-tab") renderJournal();
      if (target === "mood-tab") refreshMoodTab();
      if (target === "medications-tab") {
        const activeView = document.querySelector(".med-view:not([style*='display:none']):not([style*='display: none'])");
        if (activeView) refreshMedView(activeView.id);
      }
    });
  });
}

function setupExerciseToggle() {
  const sel = document.getElementById("didExerciseInput");
  const details = document.getElementById("exerciseDetails");
  if (!sel || !details) return;
  function toggle() { details.style.display = sel.value === "yes" ? "" : "none"; }
  sel.addEventListener("change", toggle);
  toggle();
}

function loadTodayDate() {
  const dateInput = document.getElementById("dateInput");
  if (!dateInput) return;
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
  updateDayOfWeek();
}

function setupDateNavigation() {
  const dateInput = document.getElementById("dateInput");
  const prevBtn = document.getElementById("prevDayBtn");
  const nextBtn = document.getElementById("nextDayBtn");
  if (!dateInput || !prevBtn || !nextBtn) return;

  function shiftDate(delta) {
    if (!dateInput.value) return;
    const [y, m, d] = dateInput.value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + delta);
    dateInput.value = date.toISOString().split("T")[0];
    updateDayOfWeek();
    loadDayFromCloud(dateInput.value);
  }

  prevBtn.addEventListener("click", () => shiftDate(-1));
  nextBtn.addEventListener("click", () => shiftDate(1));
}

function setupSleepCalculation() {
  const bedtime = document.getElementById("bedtimeInput");
  const wakeTime = document.getElementById("wakeTimeInput");
  const hoursDisplay = document.getElementById("hoursSleptDisplay");
  const hoursInput = document.getElementById("hoursSleptInput");

  function calcHours() {
    if (!bedtime?.value || !wakeTime?.value) {
      if (hoursDisplay) hoursDisplay.textContent = "\u2014";
      if (hoursInput) hoursInput.value = "";
      return;
    }
    const [bh, bm] = bedtime.value.split(":").map(Number);
    const [wh, wm] = wakeTime.value.split(":").map(Number);
    let bedMins = bh * 60 + bm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= bedMins) wakeMins += 24 * 60;
    const total = (wakeMins - bedMins) / 60;
    const display = Number.isInteger(total) ? `${total}h` : `${Math.floor(total)}h ${Math.round((total % 1) * 60)}m`;
    if (hoursDisplay) hoursDisplay.textContent = display;
    if (hoursInput) hoursInput.value = total.toFixed(2);
  }

  bedtime?.addEventListener("change", calcHours);
  wakeTime?.addEventListener("change", calcHours);
}

function setupNumberSteppers() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".stepper-btn");
    if (!btn) return;
    const step = parseInt(btn.getAttribute("data-step"), 10);
    const input = btn.parentElement?.querySelector("input[type='number']");
    if (!input) return;
    const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
    const max = input.max !== "" ? parseFloat(input.max) : Infinity;
    const current = parseFloat(input.value) || 0;
    const next = Math.min(max, Math.max(min, current + step));
    input.value = next;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// ---- Tags ----
const ALL_TAGS = [
  "Flare", "Good day", "Stressful", "Travel", "Poor sleep",
  "Weather change", "Overdid it", "Rest day", "Doctor visit", "Period"
];

function setupTagsGrid() {
  const grid = document.getElementById("tagsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  ALL_TAGS.forEach(tag => {
    const label = document.createElement("label");
    label.className = "tag-checkbox";
    label.innerHTML = `<input type="checkbox" value="${tag}" />${tag}`;
    grid.appendChild(label);
  });
}

function getSelectedTags() {
  const checks = document.querySelectorAll("#tagsGrid input[type='checkbox']:checked");
  return Array.from(checks).map(c => c.value);
}

function setSelectedTags(tags) {
  const checks = document.querySelectorAll("#tagsGrid input[type='checkbox']");
  checks.forEach(c => { c.checked = tags.includes(c.value); });
}

// ---- Save Day ----
function setupSaveDay() {
  setupTagsGrid();
  const saveBtns = document.querySelectorAll("#saveDayTop");
  saveBtns.forEach(btn => btn.addEventListener("click", saveDay));
}

async function saveDay() {
  const dateInput = document.getElementById("dateInput");
  const date = dateInput?.value;
  if (!date) { alert("Please select a date first."); return; }

  const data = {
    title: document.getElementById("dayTitleInput")?.value?.trim() || "",
    notes: document.getElementById("overallNotesInput")?.value?.trim() || "",
    mood: {
      score: numberOrNull(document.getElementById("moodScoreInput")?.value),
      notes: document.getElementById("moodNotesInput")?.value?.trim() || ""
    },
    timeBlocks: {
      earlyMorning:   { score: numberOrNull(document.getElementById("earlyMorningScore")?.value),   activity: document.getElementById("earlyMorningActivity")?.value?.trim()   || "", symptoms: document.getElementById("earlyMorningSymptoms")?.value?.trim()   || "" },
      lateMorning:    { score: numberOrNull(document.getElementById("lateMorningScore")?.value),    activity: document.getElementById("lateMorningActivity")?.value?.trim()    || "", symptoms: document.getElementById("lateMorningSymptoms")?.value?.trim()    || "" },
      earlyAfternoon: { score: numberOrNull(document.getElementById("earlyAfternoonScore")?.value), activity: document.getElementById("earlyAfternoonActivity")?.value?.trim() || "", symptoms: document.getElementById("earlyAfternoonSymptoms")?.value?.trim() || "" },
      lateAfternoon:  { score: numberOrNull(document.getElementById("lateAfternoonScore")?.value),  activity: document.getElementById("lateAfternoonActivity")?.value?.trim()  || "", symptoms: document.getElementById("lateAfternoonSymptoms")?.value?.trim()  || "" },
      earlyEvening:   { score: numberOrNull(document.getElementById("earlyEveningScore")?.value),   activity: document.getElementById("earlyEveningActivity")?.value?.trim()   || "", symptoms: document.getElementById("earlyEveningSymptoms")?.value?.trim()   || "" },
      lateEvening:    { score: numberOrNull(document.getElementById("lateEveningScore")?.value),    activity: document.getElementById("lateEveningActivity")?.value?.trim()    || "", symptoms: document.getElementById("lateEveningSymptoms")?.value?.trim()    || "" }
    },
    sleep: {
      bedtime:    document.getElementById("bedtimeInput")?.value    || "",
      wakeTime:   document.getElementById("wakeTimeInput")?.value   || "",
      hoursSlept: numberOrNull(document.getElementById("hoursSleptInput")?.value),
      quality:    numberOrNull(document.getElementById("sleepQualityInput")?.value),
      awakenings: numberOrNull(document.getElementById("awakeningsInput")?.value),
      notes:      document.getElementById("sleepNotesInput")?.value?.trim() || ""
    },
    exercise: {
      did:       document.getElementById("didExerciseInput")?.value || "no",
      type:      document.getElementById("exerciseTypeInput")?.value || "",
      minutes:   numberOrNull(document.getElementById("exerciseMinutesInput")?.value),
      intensity: document.getElementById("exerciseIntensityInput")?.value || "",
      timing:    document.getElementById("exerciseTimingInput")?.value?.trim() || "",
      notes:     document.getElementById("exerciseNotesInput")?.value?.trim() || ""
    },
    tags: [...getSelectedTags(), ...document.getElementById("customTagsInput")?.value.split(",").map(t => t.trim()).filter(Boolean) || []],
    updatedAt: new Date().toISOString()
  };

  const statusEl = document.getElementById("saveStatus");
  try {
    await db.collection("days").doc(date).set(data, { merge: true });
    if (statusEl) { statusEl.textContent = "Saved!"; statusEl.style.color = "green"; setTimeout(() => { statusEl.textContent = ""; }, 2500); }
    refreshHistory();
  } catch (err) {
    console.error("Save error:", err);
    if (statusEl) { statusEl.textContent = "Save failed. Check connection."; statusEl.style.color = "red"; }
  }
}

// ---- Load Day from Cloud ----
async function loadDayFromCloud(date) {
  if (!date) return;
  try {
    const doc = await db.collection("days").doc(date).get();
    if (!doc.exists) { clearForm(); return; }
    const d = doc.data();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
    set("dayTitleInput", d.title);
    set("overallNotesInput", d.notes);
    set("moodScoreInput", d.mood?.score);
    set("moodNotesInput", d.mood?.notes);

    const blocks = d.timeBlocks || {};
    const keys = ["earlyMorning", "lateMorning", "earlyAfternoon", "lateAfternoon", "earlyEvening", "lateEvening"];
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    keys.forEach(k => {
      set(`${k}Score`, blocks[k]?.score);
      set(`${k}Activity`, blocks[k]?.activity);
      set(`${k}Symptoms`, blocks[k]?.symptoms);
    });

    const sl = d.sleep || {};
    set("bedtimeInput", sl.bedtime);
    set("wakeTimeInput", sl.wakeTime);
    set("hoursSleptInput", sl.hoursSlept);
    set("sleepQualityInput", sl.quality);
    set("awakeningsInput", sl.awakenings);
    set("sleepNotesInput", sl.notes);

    const hoursDisplay = document.getElementById("hoursSleptDisplay");
    if (hoursDisplay) {
      const h = sl.hoursSlept;
      if (h != null) {
        const display = Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
        hoursDisplay.textContent = display;
      } else {
        hoursDisplay.textContent = "\u2014";
      }
    }

    const ex = d.exercise || {};
    set("didExerciseInput", ex.did || "no");
    document.getElementById("didExerciseInput")?.dispatchEvent(new Event("change"));
    set("exerciseTypeInput", ex.type);
    set("exerciseMinutesInput", ex.minutes);
    set("exerciseIntensityInput", ex.intensity);
    set("exerciseTimingInput", ex.timing);
    set("exerciseNotesInput", ex.notes);

    const tags = d.tags || [];
    const standardTags = tags.filter(t => ALL_TAGS.includes(t));
    const customTags = tags.filter(t => !ALL_TAGS.includes(t));
    setSelectedTags(standardTags);
    set("customTagsInput", customTags.join(", "));

  } catch (err) {
    console.error("Load error:", err);
  }
}

function clearForm() {
  const inputs = document.querySelectorAll("#entry-tab input, #entry-tab textarea, #entry-tab select");
  inputs.forEach(el => {
    if (el.type === "checkbox") el.checked = false;
    else if (el.type === "select-one") el.selectedIndex = 0;
    else el.value = "";
  });
  const hoursDisplay = document.getElementById("hoursSleptDisplay");
  if (hoursDisplay) hoursDisplay.textContent = "\u2014";
  document.getElementById("didExerciseInput")?.dispatchEvent(new Event("change"));
}

// ---- Journal ----
function renderJournal() {
  const dateInput = document.getElementById("dateInput");
  const date = dateInput?.value;
  if (!date) return;
  loadJournalFromCloud(date);
}

async function loadJournalFromCloud(date) {
  const output = document.getElementById("journalOutput");
  if (!output) return;
  output.innerHTML = "<em>Loading\u2026</em>";
  try {
    const doc = await db.collection("days").doc(date).get();
    if (!doc.exists) { output.innerHTML = "<em>No entry for this date.</em>"; return; }
    output.innerHTML = buildJournalHTML(doc.data(), date);
  } catch (err) {
    output.innerHTML = "<em>Failed to load journal.</em>";
  }
}

function buildJournalHTML(d, date) {
  const dayOfWeek = getJournalDayOfWeek(date);
  const dateLine  = getJournalDateLine(date);
  let html = `<div class="journal-date-header"><span class="journal-day-of-week">${dayOfWeek}</span><span class="journal-date-line">${dateLine}</span></div>`;

  if (d.title) html += `<h3 class="journal-day-title">${d.title}</h3>`;

  if (d.mood?.score || d.mood?.notes) {
    html += `<div class="journal-section"><h4>Mood</h4>`;
    if (d.mood.score) html += `<p><strong>Score:</strong> ${d.mood.score}/10</p>`;
    if (d.mood.notes) html += `<p>${d.mood.notes}</p>`;
    html += `</div>`;
  }

  const blocks = d.timeBlocks || {};
  const blockLabels = {
    earlyMorning: "Early Morning (5\u20139am)",
    lateMorning: "Late Morning (9am\u201312pm)",
    earlyAfternoon: "Early Afternoon (12\u20133pm)",
    lateAfternoon: "Late Afternoon (3\u20136pm)",
    earlyEvening: "Early Evening (6\u20139pm)",
    lateEvening: "Late Evening (9pm\u201312am)"
  };
  const blockKeys = Object.keys(blockLabels);
  const hasBlocks = blockKeys.some(k => blocks[k]?.score || blocks[k]?.activity || blocks[k]?.symptoms);
  if (hasBlocks) {
    html += `<div class="journal-section"><h4>Functionality</h4>`;
    blockKeys.forEach(k => {
      const b = blocks[k];
      if (!b?.score && !b?.activity && !b?.symptoms) return;
      html += `<div class="journal-block"><strong>${blockLabels[k]}</strong>`;
      if (b.score) html += ` <span class="journal-score">${b.score}/10</span>`;
      if (b.activity) html += `<br><em>Activity:</em> ${b.activity}`;
      if (b.symptoms) html += `<br><em>Symptoms:</em> ${b.symptoms}`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  const sl = d.sleep || {};
  if (sl.quality || sl.hoursSlept || sl.notes) {
    html += `<div class="journal-section"><h4>Sleep</h4>`;
    if (sl.bedtime) html += `<p><strong>Bedtime:</strong> ${sl.bedtime}</p>`;
    if (sl.wakeTime) html += `<p><strong>Wake:</strong> ${sl.wakeTime}</p>`;
    if (sl.hoursSlept != null) html += `<p><strong>Hours:</strong> ${sl.hoursSlept}h</p>`;
    if (sl.quality) html += `<p><strong>Quality:</strong> ${sl.quality}/10</p>`;
    if (sl.awakenings != null) html += `<p><strong>Awakenings:</strong> ${sl.awakenings}</p>`;
    if (sl.notes) html += `<p>${sl.notes}</p>`;
    html += `</div>`;
  }

  const ex = d.exercise || {};
  if (ex.did === "yes") {
    html += `<div class="journal-section"><h4>Exercise</h4>`;
    if (ex.type) html += `<p><strong>Type:</strong> ${ex.type}</p>`;
    if (ex.minutes) html += `<p><strong>Duration:</strong> ${ex.minutes} min</p>`;
    if (ex.intensity) html += `<p><strong>Intensity:</strong> ${ex.intensity}</p>`;
    if (ex.timing) html += `<p><strong>Timing:</strong> ${ex.timing}</p>`;
    if (ex.notes) html += `<p>${ex.notes}</p>`;
    html += `</div>`;
  }

  if (d.tags?.length) {
    html += `<div class="journal-section"><h4>Tags</h4><div class="journal-tags">${d.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div></div>`;
  }

  if (d.notes) html += `<div class="journal-section"><h4>Notes</h4><p>${d.notes}</p></div>`;

  return html;
}

// ---- History ----
async function refreshHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  list.innerHTML = "<li>Loading\u2026</li>";
  try {
    const snapshot = await db.collection("days").orderBy(firebase.firestore.FieldPath.documentId(), "desc").limit(30).get();
    if (snapshot.empty) { list.innerHTML = "<li>No entries yet.</li>"; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const li = document.createElement("li");
      li.textContent = `${doc.id}${d.title ? " \u2014 " + d.title : ""}`;
      li.style.cursor = "pointer";
      li.addEventListener("click", () => {
        const dateInput = document.getElementById("dateInput");
        if (dateInput) { dateInput.value = doc.id; updateDayOfWeek(); }
        loadDayFromCloud(doc.id);
        document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelector("[data-tab='entry-tab']")?.classList.add("active");
        document.getElementById("entry-tab")?.classList.add("active");
      });
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = "<li>Failed to load history.</li>";
  }
}

// ---- Trends ----
async function refreshTrends() {
  const ctx = document.getElementById("functionalityChart")?.getContext("2d");
  if (!ctx) return;
  try {
    const snapshot = await db.collection("days").orderBy(firebase.firestore.FieldPath.documentId(), "asc").limit(30).get();
    const labels = [];
    const data = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      const blocks = d.timeBlocks || {};
      const scores = Object.values(blocks).map(b => b?.score).filter(s => s != null);
      if (scores.length === 0) return;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      labels.push(doc.id.slice(5));
      data.push(parseFloat(avg.toFixed(2)));
    });

    if (window._functionalityChart instanceof Chart) window._functionalityChart.destroy();
    window._functionalityChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Avg Functionality",
          data,
          borderColor: "#5b6aff",
          backgroundColor: "rgba(91,106,255,0.1)",
          tension: 0.3,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 10 } }
      }
    });
  } catch (err) {
    console.error("Trends error:", err);
  }
}

// ============================================================
// MEDICATIONS TAB
// ============================================================

function setupMedicationsTab() {
  const subTabBtns = document.querySelectorAll(".med-sub-tab-btn");
  subTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      subTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const viewId = btn.getAttribute("data-med-view");
      document.querySelectorAll(".med-view").forEach(v => v.style.display = "none");
      const view = document.getElementById(viewId);
      if (view) view.style.display = "";
      refreshMedView(viewId);
    });
  });

  const saveMedBtn = document.getElementById("saveMedBtn");
  if (saveMedBtn) saveMedBtn.addEventListener("click", saveMedication);

  const cancelMedBtn = document.getElementById("cancelMedEditBtn");
  if (cancelMedBtn) cancelMedBtn.addEventListener("click", () => resetMedForm());

  const saveSuppBtn = document.getElementById("saveSuppBtn");
  if (saveSuppBtn) saveSuppBtn.addEventListener("click", saveSupplement);

  const cancelSuppBtn = document.getElementById("cancelSuppEditBtn");
  if (cancelSuppBtn) cancelSuppBtn.addEventListener("click", () => resetSuppForm());

  refreshMedView("medListView");
}

function refreshMedView(viewId) {
  if (viewId === "medListView") refreshMedList();
  else if (viewId === "suppListView") refreshSuppList();
  else if (viewId === "medHistoryView") refreshMedHistory();
  else if (viewId === "medPrintView") refreshMedPrint();
}

// ---- Medications CRUD ----

function resetMedForm() {
  ["medNameInput","medDoseInput","medFrequencyInput","medDoctorInput","medNotesInput","medEditingId"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const title = document.getElementById("medFormTitle");
  if (title) title.textContent = "Add Medication";
  const saveBtn = document.getElementById("saveMedBtn");
  if (saveBtn) saveBtn.textContent = "Add Medication";
  const cancelBtn = document.getElementById("cancelMedEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

async function saveMedication() {
  const name = document.getElementById("medNameInput")?.value?.trim();
  if (!name) { alert("Please enter a medication name."); return; }
  const data = {
    name,
    dose:      document.getElementById("medDoseInput")?.value?.trim() || "",
    frequency: document.getElementById("medFrequencyInput")?.value || "",
    doctor:    document.getElementById("medDoctorInput")?.value?.trim() || "",
    notes:     document.getElementById("medNotesInput")?.value?.trim() || "",
    updatedAt: new Date().toISOString()
  };
  const editingId = document.getElementById("medEditingId")?.value;
  try {
    if (editingId) {
      await db.collection("medications").doc(editingId).set(data, { merge: true });
      await logMedHistory("edited", "medication", data.name, data);
    } else {
      data.createdAt = new Date().toISOString();
      const ref = await db.collection("medications").add(data);
      await logMedHistory("added", "medication", data.name, data);
    }
    resetMedForm();
    refreshMedList();
    refreshMedPrint();
  } catch (err) {
    console.error("Save med error:", err);
    alert("Failed to save medication.");
  }
}

async function deleteMedication(id, name) {
  if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await db.collection("medications").doc(id).delete();
    await logMedHistory("deleted", "medication", name, {});
    refreshMedList();
    refreshMedPrint();
  } catch (err) { alert("Failed to delete."); }
}

function startEditMed(id, data) {
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ""; };
  set("medNameInput", data.name);
  set("medDoseInput", data.dose);
  set("medFrequencyInput", data.frequency);
  set("medDoctorInput", data.doctor);
  set("medNotesInput", data.notes);
  set("medEditingId", id);
  const title = document.getElementById("medFormTitle");
  if (title) title.textContent = "Edit Medication";
  const saveBtn = document.getElementById("saveMedBtn");
  if (saveBtn) saveBtn.textContent = "Save Changes";
  const cancelBtn = document.getElementById("cancelMedEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  document.getElementById("medFormTitle")?.scrollIntoView({ behavior: "smooth" });
}

async function refreshMedList() {
  const list = document.getElementById("medList");
  if (!list) return;
  list.innerHTML = `<li class="med-empty">Loading\u2026</li>`;
  try {
    const snapshot = await db.collection("medications").orderBy("name").get();
    if (snapshot.empty) { list.innerHTML = `<li class="med-empty">No medications added yet.</li>`; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const freq = FREQ_LABELS[d.frequency] || d.frequency || "";
      const li = document.createElement("li");
      li.className = "med-item";
      li.innerHTML = `
        <div class="med-item-header">
          <span class="med-item-name">${d.name}</span>
          ${d.dose ? `<span class="med-item-dose">${d.dose}</span>` : ""}
          ${freq ? `<span class="med-item-freq">${freq}</span>` : ""}
          <div class="med-item-actions">
            <button class="med-edit-btn" aria-label="Edit medication">Edit</button>
            <button class="med-delete-btn danger" aria-label="Delete medication">Delete</button>
          </div>
        </div>
        ${d.doctor ? `<div class="med-item-detail"><span class="med-detail-label">Dr:</span> ${d.doctor}</div>` : ""}
        ${d.notes  ? `<div class="med-item-detail med-item-notes">${d.notes}</div>` : ""}`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startEditMed(doc.id, d));
      li.querySelector(".med-delete-btn").addEventListener("click", () => deleteMedication(doc.id, d.name));
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = `<li class="med-empty">Failed to load.</li>`;
  }
}

// ---- Supplements CRUD ----

function resetSuppForm() {
  ["suppNameInput","suppDoseInput","suppFrequencyInput","suppBrandInput","suppNotesInput","suppEditingId"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const title = document.getElementById("suppFormTitle");
  if (title) title.textContent = "Add Supplement";
  const saveBtn = document.getElementById("saveSuppBtn");
  if (saveBtn) saveBtn.textContent = "Add Supplement";
  const cancelBtn = document.getElementById("cancelSuppEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

async function saveSupplement() {
  const name = document.getElementById("suppNameInput")?.value?.trim();
  if (!name) { alert("Please enter a supplement name."); return; }
  const data = {
    name,
    dose:      document.getElementById("suppDoseInput")?.value?.trim() || "",
    frequency: document.getElementById("suppFrequencyInput")?.value || "",
    brand:     document.getElementById("suppBrandInput")?.value?.trim() || "",
    notes:     document.getElementById("suppNotesInput")?.value?.trim() || "",
    updatedAt: new Date().toISOString()
  };
  const editingId = document.getElementById("suppEditingId")?.value;
  try {
    if (editingId) {
      await db.collection("supplements").doc(editingId).set(data, { merge: true });
      await logMedHistory("edited", "supplement", data.name, data);
    } else {
      data.createdAt = new Date().toISOString();
      await db.collection("supplements").add(data);
      await logMedHistory("added", "supplement", data.name, data);
    }
    resetSuppForm();
    refreshSuppList();
    refreshMedPrint();
  } catch (err) {
    console.error("Save supp error:", err);
    alert("Failed to save supplement.");
  }
}

async function deleteSupplement(id, name) {
  if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await db.collection("supplements").doc(id).delete();
    await logMedHistory("deleted", "supplement", name, {});
    refreshSuppList();
    refreshMedPrint();
  } catch (err) { alert("Failed to delete."); }
}

function startEditSupp(id, data) {
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ""; };
  set("suppNameInput", data.name);
  set("suppDoseInput", data.dose);
  set("suppFrequencyInput", data.frequency);
  set("suppBrandInput", data.brand);
  set("suppNotesInput", data.notes);
  set("suppEditingId", id);
  const title = document.getElementById("suppFormTitle");
  if (title) title.textContent = "Edit Supplement";
  const saveBtn = document.getElementById("saveSuppBtn");
  if (saveBtn) saveBtn.textContent = "Save Changes";
  const cancelBtn = document.getElementById("cancelSuppEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  document.getElementById("suppFormTitle")?.scrollIntoView({ behavior: "smooth" });
}

async function refreshSuppList() {
  const list = document.getElementById("suppList");
  if (!list) return;
  list.innerHTML = `<li class="med-empty">Loading\u2026</li>`;
  try {
    const snapshot = await db.collection("supplements").orderBy("name").get();
    if (snapshot.empty) { list.innerHTML = `<li class="med-empty">No supplements added yet.</li>`; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const freq = FREQ_LABELS[d.frequency] || d.frequency || "";
      const li = document.createElement("li");
      li.className = "med-item supp-item";
      li.innerHTML = `
        <div class="med-item-header">
          <span class="med-item-name">${d.name}</span>
          ${d.dose ? `<span class="med-item-dose">${d.dose}</span>` : ""}
          ${freq ? `<span class="med-item-freq supp-freq">${freq}</span>` : ""}
          <div class="med-item-actions">
            <button class="med-edit-btn" aria-label="Edit supplement">Edit</button>
            <button class="med-delete-btn danger" aria-label="Delete supplement">Delete</button>
          </div>
        </div>
        ${d.brand ? `<div class="med-item-detail"><span class="med-detail-label">Brand:</span> ${d.brand}</div>` : ""}
        ${d.notes ? `<div class="med-item-detail med-item-notes">${d.notes}</div>` : ""}`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startEditSupp(doc.id, d));
      li.querySelector(".med-delete-btn").addEventListener("click", () => deleteSupplement(doc.id, d.name));
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = `<li class="med-empty">Failed to load.</li>`;
  }
}

// ---- Med History ----
async function logMedHistory(action, type, name, data) {
  try {
    await db.collection("medHistory").add({
      action, type, name,
      dose: data.dose || "",
      frequency: data.frequency || "",
      timestamp: new Date().toISOString()
    });
  } catch (err) { console.warn("History log failed:", err); }
}

async function refreshMedHistory() {
  const list = document.getElementById("medHistoryList");
  if (!list) return;
  list.innerHTML = `<li class="med-empty">Loading\u2026</li>`;
  try {
    const snapshot = await db.collection("medHistory").orderBy("timestamp", "desc").limit(50).get();
    if (snapshot.empty) { list.innerHTML = `<li class="med-empty">No history yet.</li>`; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const dt = new Date(d.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const li = document.createElement("li");
      li.className = "med-history-item";
      li.innerHTML = `<span class="med-history-action med-history-${d.action}">${d.action}</span> <strong>${d.name}</strong>${d.dose ? " \u2014 " + d.dose : ""}${d.frequency ? " (" + (FREQ_LABELS[d.frequency] || d.frequency) + ")" : ""} <span class="med-history-type">${d.type}</span> <span class="med-history-date">${dt}</span>`;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = `<li class="med-empty">Failed to load history.</li>`;
  }
}

// ---- Med Print View ----
async function refreshMedPrint() {
  const medBody = document.getElementById("medPrintTableBody");
  const suppBody = document.getElementById("suppPrintTableBody");
  const dateEl = document.getElementById("medPrintDate");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  async function fillTable(body, collection, extraLabel) {
    if (!body) return;
    body.innerHTML = `<tr><td colspan="5" class="med-table-empty">Loading\u2026</td></tr>`;
    try {
      const snapshot = await db.collection(collection).orderBy("name").get();
      if (snapshot.empty) { body.innerHTML = `<tr><td colspan="5" class="med-table-empty">None on file.</td></tr>`; return; }
      body.innerHTML = "";
      snapshot.forEach(doc => {
        const d = doc.data();
        const freq = FREQ_LABELS[d.frequency] || d.frequency || "\u2014";
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${d.name || ""}</td><td>${d.dose || "\u2014"}</td><td>${freq}</td><td>${d[extraLabel] || "\u2014"}</td><td>${d.notes || ""}</td>`;
        body.appendChild(tr);
      });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="5" class="med-table-empty">Failed to load.</td></tr>`;
    }
  }

  await Promise.all([
    fillTable(medBody, "medications", "doctor"),
    fillTable(suppBody, "supplements", "brand")
  ]);
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
      .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
      .limit(14)
      .get();

    const byDate = {};
    snapshot.forEach(doc => { byDate[doc.id] = doc.data(); });

    const DOW   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    tbody.innerHTML = "";
    let hasAny = false;

    dates.forEach(dateStr => {
      const data = byDate[dateStr];
      const moodScore = data?.mood?.score ?? null;
      const moodNotes = data?.mood?.notes || "";

      const d = new Date(dateStr + "T12:00:00");
      const dayLabel  = DOW[d.getDay()];
      const dateLabel = `${MONTH[d.getMonth()]} ${d.getDate()}`;

      const hasData = moodScore !== null || moodNotes;
      if (hasData) hasAny = true;

      // Color tier: 1-3 = low, 4-6 = mid, 7-10 = good
      const tier = moodScore !== null ? Math.ceil(moodScore / 3) : 0;
      const scoreCell = moodScore !== null
        ? `<span class="mood-score-pill mood-score-${Math.min(tier, 3)}">${moodScore}/10</span>`
        : `<span class="mood-score-empty">\u2014</span>`;

      const tr = document.createElement("tr");
      if (!hasData) tr.classList.add("mood-row-empty");
      tr.innerHTML = `
        <td class="mood-date-cell">${dateLabel}</td>
        <td class="mood-day-cell">${dayLabel}</td>
        <td class="mood-score-cell">${scoreCell}</td>
        <td class="mood-notes-cell">${moodNotes
          ? `<span>${moodNotes}</span>`
          : `<span class="mood-score-empty">\u2014</span>`}</td>`;
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
    date:             document.getElementById("atrDateInput")?.value || "",
    situation:        document.getElementById("atrSituationInput")?.value?.trim() || "",
    emotions:         document.getElementById("atrEmotionsInput")?.value?.trim() || "",
    intensity:        parseInt(document.getElementById("atrIntensityRange")?.value || "50", 10),
    automaticThought: document.getElementById("atrAutoThoughtInput")?.value?.trim() || "",
    alternativeThought: document.getElementById("atrAltThoughtInput")?.value?.trim() || ""
  };
}

function resetAtrForm() {
  const today = new Date().toISOString().split("T")[0];
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set("atrDateInput", today);
  set("atrSituationInput", "");
  set("atrEmotionsInput", "");
  set("atrIntensityRange", 50);
  set("atrAutoThoughtInput", "");
  set("atrAltThoughtInput", "");
  set("atrEditingId", "");
  const display = document.getElementById("atrIntensityDisplay");
  if (display) display.textContent = "50";
  const title = document.getElementById("atrFormTitle");
  if (title) title.textContent = "New Automatic Thought Record";
  const saveBtn = document.getElementById("saveAtrBtn");
  if (saveBtn) saveBtn.textContent = "Save Record";
  const cancelBtn = document.getElementById("cancelAtrEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

async function saveAtr() {
  const data = getAtrFormData();
  if (!data.date)             { alert("Please select a date.");                return; }
  if (!data.situation)        { alert("Please describe the situation.");       return; }
  if (!data.automaticThought) { alert("Please enter the automatic thought."); return; }

  const editingId = document.getElementById("atrEditingId")?.value;
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
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ""; };
  set("atrDateInput",         data.date             || "");
  set("atrSituationInput",    data.situation        || "");
  set("atrEmotionsInput",     data.emotions         || "");
  set("atrIntensityRange",    data.intensity        ?? 50);
  set("atrAutoThoughtInput",  data.automaticThought || "");
  set("atrAltThoughtInput",   data.alternativeThought || "");
  set("atrEditingId",         id);

  const display = document.getElementById("atrIntensityDisplay");
  if (display) display.textContent = data.intensity ?? 50;

  const title = document.getElementById("atrFormTitle");
  if (title) title.textContent = "Edit Automatic Thought Record";
  const saveBtn = document.getElementById("saveAtrBtn");
  if (saveBtn) saveBtn.textContent = "Save Changes";
  const cancelBtn = document.getElementById("cancelAtrEditBtn");
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  document.getElementById("atrFormTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const dateStr = d
        ? `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
        : "Unknown date";

      const card = document.createElement("div");
      card.className = "atr-record";
      card.innerHTML = `
        <div class="atr-record-header">
          <span class="atr-record-date">${dateStr}</span>
          ${r.emotions  ? `<span class="atr-record-emotions">${r.emotions}</span>` : ""}
          ${r.intensity != null ? `<span class="atr-intensity-badge">${r.intensity}/100</span>` : ""}
          <div class="atr-record-actions">
            <button class="atr-edit-btn"   aria-label="Edit record">Edit</button>
            <button class="atr-delete-btn danger" aria-label="Delete record">Delete</button>
          </div>
        </div>
        <div class="atr-record-body">
          <div class="atr-field">
            <span class="atr-field-label">Situation</span>
            <p>${r.situation || "\u2014"}</p>
          </div>
          <div class="atr-field">
            <span class="atr-field-label">Automatic Thought</span>
            <p>${r.automaticThought || "\u2014"}</p>
          </div>
          ${r.alternativeThought
            ? `<div class="atr-field atr-field-alt">
                 <span class="atr-field-label">Alternative Thought</span>
                 <p>${r.alternativeThought}</p>
               </div>`
            : ""}
        </div>`;

      card.querySelector(".atr-edit-btn")  .addEventListener("click", () => startEditAtr(doc.id, r));
      card.querySelector(".atr-delete-btn").addEventListener("click", () => deleteAtr(doc.id));
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading ATRs:", err);
    container.innerHTML = `<p class="atr-empty">Failed to load records.</p>`;
  }
}

function setupAtrForm() {
  // Live-update intensity display as slider moves
  const slider  = document.getElementById("atrIntensityRange");
  const display = document.getElementById("atrIntensityDisplay");
  if (slider && display) {
    slider.addEventListener("input", () => { display.textContent = slider.value; });
  }

  const saveBtn   = document.getElementById("saveAtrBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveAtr);

  const cancelBtn = document.getElementById("cancelAtrEditBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", resetAtrForm);

  // Use today's date as default
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("atrDateInput");
  if (dateInput && !dateInput.value) dateInput.value = today;
}
