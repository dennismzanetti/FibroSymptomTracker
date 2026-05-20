// ---- Firebase init -----
const firebaseConfig = {
  apiKey: "AIzaSyD75EQyz7w9ZYuK8iDewQDzI5Z2RUzMk1k",
  authDomain: "fibrosymptomtracker.firebaseapp.com",
  projectId: "fibrosymptomtracker",
  storageBucket: "fibrosymptomtracker.firebasestorage.app",
  messagingSenderId: "407087512984",
  appId: "1:407087512984:web:3f82b25e70ae5da5d4d7c0"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================================
// STATE
// ============================================================
let selectedDate = todayStr();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initDatePicker();
  setupTabs();
  loadDay(selectedDate);
  setupDailyEntryForm();
  setupJournalTab();
  setupHistoryTab();
  setupMedicationsTab();
  setupBuildFooter();
});

// ============================================================
// DATE PICKER
// ============================================================
function initDatePicker() {
  const input = document.getElementById("datePicker");
  const dow   = document.getElementById("dayOfWeekDisplay");
  const prevBtn = document.getElementById("prevDayBtn");
  const nextBtn = document.getElementById("nextDayBtn");

  if (!input) return;
  input.value = selectedDate;
  updateDOW(selectedDate, dow);

  input.addEventListener("change", () => {
    selectedDate = input.value;
    updateDOW(selectedDate, dow);
    loadDay(selectedDate);
  });

  prevBtn && prevBtn.addEventListener("click", () => shiftDate(-1, input, dow));
  nextBtn && nextBtn.addEventListener("click", () => shiftDate(+1, input, dow));
}

function shiftDate(delta, input, dow) {
  const d = new Date(selectedDate + "T12:00:00");
  d.setDate(d.getDate() + delta);
  selectedDate = d.toISOString().split("T")[0];
  input.value  = selectedDate;
  updateDOW(selectedDate, dow);
  loadDay(selectedDate);
}

function updateDOW(dateStr, el) {
  if (!el) return;
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  el.textContent = days[new Date(dateStr + "T12:00:00").getDay()];
}

// ============================================================
// TABS
// ============================================================
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const sections = document.querySelectorAll(".tab");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      const section = document.getElementById(target);
      if (section) section.classList.add("active");

      if (target === "journal-tab")     refreshJournal();
      if (target === "history-tab")     refreshHistory();
      if (target === "medications-tab") refreshMedTab();
    });
  });
}

// ============================================================
// LOAD / SAVE DAY
// ============================================================
async function loadDay(dateStr) {
  try {
    const doc = await db.collection("days").doc(dateStr).get();
    const data = doc.exists ? doc.data() : {};
    populateForm(data);
  } catch (err) {
    console.error("loadDay error:", err);
  }
}

async function saveDay(dateStr, data) {
  await db.collection("days").doc(dateStr).set(data, { merge: true });
}

// ============================================================
// DAILY ENTRY FORM
// ============================================================
function setupDailyEntryForm() {
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleSave);
  }

  // Steppers
  document.querySelectorAll(".stepper-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input    = document.getElementById(targetId);
      if (!input) return;
      const delta = parseInt(btn.dataset.delta, 10);
      const min   = parseFloat(input.min ?? -Infinity);
      const max   = parseFloat(input.max ?? Infinity);
      const step  = parseFloat(input.step || 1);
      let val = parseFloat(input.value || 0) + delta * step;
      val = Math.min(max, Math.max(min, val));
      input.value = Number.isInteger(val) ? val : val.toFixed(1);
      input.dispatchEvent(new Event("change"));
    });
  });

  // Sleep time inputs → compute duration
  const bedInput  = document.getElementById("bedtime");
  const wakeInput = document.getElementById("wakeTime");
  if (bedInput && wakeInput) {
    const update = () => updateSleepDuration(bedInput.value, wakeInput.value);
    bedInput.addEventListener("change", update);
    wakeInput.addEventListener("change", update);

    // Snap to nearest 15-min on blur as well
    [bedInput, wakeInput].forEach(inp => {
      inp.addEventListener("change", () => snapTo15(inp));
    });
  }
}

function snapTo15(input) {
  if (!input.value) return;
  const [h, m] = input.value.split(":").map(Number);
  const snapped = Math.round(m / 15) * 15;
  const finalM  = snapped === 60 ? 0 : snapped;
  const finalH  = snapped === 60 ? (h + 1) % 24 : h;
  input.value   = `${String(finalH).padStart(2,"0")}:${String(finalM).padStart(2,"0")}`;
}

function updateSleepDuration(bedVal, wakeVal) {
  const display = document.getElementById("sleepDurationDisplay");
  if (!display) return;
  if (!bedVal || !wakeVal) { display.textContent = "—"; return; }

  const [bh, bm] = bedVal.split(":").map(Number);
  const [wh, wm] = wakeVal.split(":").map(Number);
  let bedMins  = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60;
  const diff = wakeMins - bedMins;
  const hours = Math.floor(diff / 60);
  const mins  = diff % 60;
  display.textContent = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function populateForm(data) {
  // ---- Sleep ----
  setVal("bedtime",  data.sleep?.bedtime  || "");
  setVal("wakeTime", data.sleep?.wakeTime || "");
  updateSleepDuration(data.sleep?.bedtime || "", data.sleep?.wakeTime || "");
  setVal("sleepQuality", data.sleep?.quality ?? "");
  setVal("sleepNotes",   data.sleep?.notes   || "");

  // ---- Symptoms (morning) ----
  setVal("mPain",      data.morning?.pain      ?? "");
  setVal("mFatigue",   data.morning?.fatigue   ?? "");
  setVal("mFogScore",  data.morning?.fogScore  ?? "");
  setVal("mStiffness", data.morning?.stiffness ?? "");
  setVal("mNotes",     data.morning?.notes     || "");
  setChecks("mSymptoms", data.morning?.symptoms || []);

  // ---- Symptoms (afternoon) ----
  setVal("aPain",      data.afternoon?.pain      ?? "");
  setVal("aFatigue",   data.afternoon?.fatigue   ?? "");
  setVal("aFogScore",  data.afternoon?.fogScore  ?? "");
  setVal("aStiffness", data.afternoon?.stiffness ?? "");
  setVal("aNotes",     data.afternoon?.notes     || "");
  setChecks("aSymptoms", data.afternoon?.symptoms || []);

  // ---- Symptoms (evening) ----
  setVal("ePain",      data.evening?.pain      ?? "");
  setVal("eFatigue",   data.evening?.fatigue   ?? "");
  setVal("eFogScore",  data.evening?.fogScore  ?? "");
  setVal("eStiffness", data.evening?.stiffness ?? "");
  setVal("eNotes",     data.evening?.notes     || "");
  setChecks("eSymptoms", data.evening?.symptoms || []);

  // ---- Mood ----
  setVal("moodScore", data.mood?.score ?? "");
  setVal("moodNotes", data.mood?.notes || "");

  // ---- Triggers & Activity ----
  setChecks("triggers", data.triggers || []);
  setVal("activityType",     data.activity?.type     || "");
  setVal("activityDuration", data.activity?.duration ?? "");
  setVal("activityIntensity",data.activity?.intensity ?? "");
  setVal("activityNotes",    data.activity?.notes    || "");

  // ---- Medications ----
  setVal("medsNotes", data.medsNotes || "");

  // ---- Day Notes ----
  setVal("dayNotes", data.dayNotes || "");
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setChecks(groupName, checked) {
  document.querySelectorAll(`input[name="${groupName}"]`).forEach(cb => {
    cb.checked = checked.includes(cb.value);
  });
}

function getChecks(groupName) {
  return [...document.querySelectorAll(`input[name="${groupName}"]:checked`)]
    .map(cb => cb.value);
}

function getNum(id) {
  const v = document.getElementById(id)?.value;
  return v === "" || v === undefined ? null : Number(v);
}

function getStr(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

async function handleSave() {
  const statusEl = document.getElementById("saveStatus");
  if (statusEl) { statusEl.textContent = "Saving…"; statusEl.style.color = "#5c6bc0"; }

  const data = {
    sleep: {
      bedtime:  getStr("bedtime"),
      wakeTime: getStr("wakeTime"),
      quality:  getNum("sleepQuality"),
      notes:    getStr("sleepNotes")
    },
    morning: {
      pain:      getNum("mPain"),
      fatigue:   getNum("mFatigue"),
      fogScore:  getNum("mFogScore"),
      stiffness: getNum("mStiffness"),
      notes:     getStr("mNotes"),
      symptoms:  getChecks("mSymptoms")
    },
    afternoon: {
      pain:      getNum("aPain"),
      fatigue:   getNum("aFatigue"),
      fogScore:  getNum("aFogScore"),
      stiffness: getNum("aStiffness"),
      notes:     getStr("aNotes"),
      symptoms:  getChecks("aSymptoms")
    },
    evening: {
      pain:      getNum("ePain"),
      fatigue:   getNum("eFatigue"),
      fogScore:  getNum("eFogScore"),
      stiffness: getNum("eStiffness"),
      notes:     getStr("eNotes"),
      symptoms:  getChecks("eSymptoms")
    },
    mood: {
      score: getNum("moodScore"),
      notes: getStr("moodNotes")
    },
    triggers: getChecks("triggers"),
    activity: {
      type:      getStr("activityType"),
      duration:  getNum("activityDuration"),
      intensity: getNum("activityIntensity"),
      notes:     getStr("activityNotes")
    },
    medsNotes: getStr("medsNotes"),
    dayNotes:  getStr("dayNotes")
  };

  try {
    await saveDay(selectedDate, data);
    if (statusEl) {
      statusEl.textContent = "✓ Saved";
      statusEl.style.color = "#2e7d32";
      setTimeout(() => { statusEl.textContent = ""; }, 2500);
    }
  } catch (err) {
    console.error("Save error:", err);
    if (statusEl) { statusEl.textContent = "Error saving."; statusEl.style.color = "#c62828"; }
  }
}

// ============================================================
// JOURNAL TAB
// ============================================================
function setupJournalTab() {
  const btn = document.getElementById("refreshJournalBtn");
  if (btn) btn.addEventListener("click", refreshJournal);
}

async function refreshJournal() {
  const output = document.getElementById("journalOutput");
  if (!output) return;
  output.innerHTML = "<p>Loading…</p>";

  try {
    const snap = await db.collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
      .limit(30)
      .get();

    if (snap.empty) { output.innerHTML = "<p>No entries yet.</p>"; return; }

    const DOW   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const MONTH = ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"];

    let html = "";
    snap.forEach(doc => {
      const d    = doc.data();
      const date = new Date(doc.id + "T12:00:00");
      const dow  = DOW[date.getDay()];
      const dateLabel = `${MONTH[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

      html += `
        <div class="journal-output" style="margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #e8eaf6">
          <div class="journal-date-header">
            <span class="journal-day-of-week">${dow}</span>
            <span class="journal-date-line">${dateLabel}</span>
          </div>

          ${journalSleepBlock(d.sleep)}
          ${journalTimeBlock("Morning",   d.morning)}
          ${journalTimeBlock("Afternoon", d.afternoon)}
          ${journalTimeBlock("Evening",   d.evening)}
          ${journalMoodBlock(d.mood)}
          ${journalTriggersBlock(d.triggers)}
          ${journalActivityBlock(d.activity)}
          ${journalNotesBlock("Day Notes", d.dayNotes)}
        </div>`;
    });
    output.innerHTML = html;
  } catch (err) {
    console.error("Journal error:", err);
    output.innerHTML = "<p>Error loading journal.</p>";
  }
}

function journalSleepBlock(sleep) {
  if (!sleep) return "";
  const parts = [];
  if (sleep.bedtime && sleep.wakeTime) parts.push(`Bed: ${sleep.bedtime} → Wake: ${sleep.wakeTime}`);
  if (sleep.quality != null) parts.push(`Quality: ${sleep.quality}/10`);
  if (sleep.notes) parts.push(sleep.notes);
  if (!parts.length) return "";
  return `<div class="journal-section"><h4>Sleep</h4>${parts.map(p => `<div class="journal-block">${p}</div>`).join("")}</div>`;
}

function journalTimeBlock(label, block) {
  if (!block) return "";
  const scores = [];
  if (block.pain      != null) scores.push(`Pain ${block.pain}`);
  if (block.fatigue   != null) scores.push(`Fatigue ${block.fatigue}`);
  if (block.fogScore  != null) scores.push(`Fog ${block.fogScore}`);
  if (block.stiffness != null) scores.push(`Stiffness ${block.stiffness}`);
  const hasSymptoms = block.symptoms?.length;
  const hasNotes    = block.notes;
  if (!scores.length && !hasSymptoms && !hasNotes) return "";

  let html = `<div class="journal-section"><h4>${label}</h4>`;
  if (scores.length) html += `<div class="journal-block">${scores.join(" · ")}</div>`;
  if (hasSymptoms)   html += `<div class="journal-tags">${block.symptoms.map(s => `<span class="tag">${s}</span>`).join("")}</div>`;
  if (hasNotes)      html += `<div class="journal-block">${block.notes}</div>`;
  html += "</div>";
  return html;
}

function journalMoodBlock(mood) {
  if (!mood) return "";
  const parts = [];
  if (mood.score != null) parts.push(`Mood: ${mood.score}/10`);
  if (mood.notes) parts.push(mood.notes);
  if (!parts.length) return "";
  return `<div class="journal-section"><h4>Mood</h4>${parts.map(p => `<div class="journal-block">${p}</div>`).join("")}</div>`;
}

function journalTriggersBlock(triggers) {
  if (!triggers?.length) return "";
  return `<div class="journal-section"><h4>Triggers</h4><div class="journal-tags">${triggers.map(t => `<span class="tag">${t}</span>`).join("")}</div></div>`;
}

function journalActivityBlock(act) {
  if (!act) return "";
  const parts = [];
  if (act.type)      parts.push(act.type);
  if (act.duration)  parts.push(`${act.duration} min`);
  if (act.intensity) parts.push(`Intensity: ${act.intensity}`);
  if (act.notes)     parts.push(act.notes);
  if (!parts.length) return "";
  return `<div class="journal-section"><h4>Activity</h4><div class="journal-block">${parts.join(" · ")}</div></div>`;
}

function journalNotesBlock(label, notes) {
  if (!notes) return "";
  return `<div class="journal-section"><h4>${label}</h4><div class="journal-block">${notes}</div></div>`;
}

// ============================================================
// HISTORY TAB
// ============================================================
function setupHistoryTab() {
  const btn = document.getElementById("loadHistoryBtn");
  if (btn) btn.addEventListener("click", refreshHistory);
}

async function refreshHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  list.innerHTML = "<li>Loading…</li>";

  try {
    const snap = await db.collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
      .limit(60)
      .get();

    if (snap.empty) { list.innerHTML = "<li>No entries found.</li>"; return; }

    const MONTH = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"];
    list.innerHTML = "";
    snap.forEach(doc => {
      const d    = doc.data();
      const date = new Date(doc.id + "T12:00:00");
      const label = `${MONTH[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

      const avgPain = avgScore([d.morning?.pain, d.afternoon?.pain, d.evening?.pain]);
      const avgFat  = avgScore([d.morning?.fatigue, d.afternoon?.fatigue, d.evening?.fatigue]);
      const mood    = d.mood?.score != null ? `Mood ${d.mood.score}` : "";
      const sleep   = d.sleep?.bedtime ? `Sleep ${d.sleep.bedtime}→${d.sleep.wakeTime || "?"}` : "";

      const parts = [
        avgPain != null ? `Pain ${avgPain}` : null,
        avgFat  != null ? `Fatigue ${avgFat}` : null,
        mood  || null,
        sleep || null
      ].filter(Boolean).join(" · ");

      const li = document.createElement("li");
      li.innerHTML = `<strong style="cursor:pointer;color:#3f51b5">${label}</strong> ${parts ? "— " + parts : ""}`;
      li.querySelector("strong").addEventListener("click", () => {
        selectedDate = doc.id;
        document.getElementById("datePicker").value = doc.id;
        updateDOW(doc.id, document.getElementById("dayOfWeekDisplay"));
        loadDay(doc.id);
        document.querySelector('[data-tab="daily-tab"]').click();
      });
      list.appendChild(li);
    });
  } catch (err) {
    console.error("History error:", err);
    list.innerHTML = "<li>Error loading history.</li>";
  }
}

function avgScore(arr) {
  const vals = arr.filter(v => v != null);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

// ============================================================
// MEDICATIONS TAB
// ============================================================

// ---- Sub-tab switching ----
function setupMedicationsTab() {
  const subBtns = document.querySelectorAll(".med-sub-tab-btn");
  const subSections = document.querySelectorAll(".med-sub-section");

  subBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      subBtns.forEach(b => b.classList.remove("active"));
      subSections.forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.subTab);
      if (target) target.classList.add("active");
    });
  });

  setupMedForm();
  setupSuppForm();
  setupMedHistoryTab();
  setupMedPrintView();
}

function refreshMedTab() {
  refreshMedList();
  refreshSuppList();
  refreshMedHistory();
  refreshPrintView();
}

// ---- Medications CRUD ----

function setupMedForm() {
  const saveBtn   = document.getElementById("saveMedBtn");
  const cancelBtn = document.getElementById("cancelMedEditBtn");
  if (saveBtn)   saveBtn.addEventListener("click",   saveMed);
  if (cancelBtn) cancelBtn.addEventListener("click", cancelMedEdit);
}

function getMedFormData() {
  return {
    name:        document.getElementById("medName")?.value.trim()        || "",
    dose:        document.getElementById("medDose")?.value.trim()        || "",
    frequency:   document.getElementById("medFrequency")?.value.trim()   || "",
    prescriber:  document.getElementById("medPrescriber")?.value.trim()  || "",
    startDate:   document.getElementById("medStartDate")?.value          || "",
    indication:  document.getElementById("medIndication")?.value.trim()  || "",
    sideEffects: document.getElementById("medSideEffects")?.value.trim() || "",
    notes:       document.getElementById("medNotes")?.value.trim()       || ""
  };
}

function resetMedForm() {
  ["medName","medDose","medFrequency","medPrescriber","medStartDate",
   "medIndication","medSideEffects","medNotes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("medEditingId").value = "";
  document.getElementById("medFormTitle").textContent = "Add Medication";
  document.getElementById("saveMedBtn").textContent   = "Save Medication";
  document.getElementById("cancelMedEditBtn").style.display = "none";
}

async function saveMed() {
  const data = getMedFormData();
  if (!data.name) { alert("Medication name is required."); return; }
  const editingId = document.getElementById("medEditingId").value;
  const now = new Date().toISOString();
  try {
    if (editingId) {
      await db.collection("medications").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
      await logMedHistory("edited", data.name, "medication");
    } else {
      await db.collection("medications").add({ ...data, createdAt: now, updatedAt: now });
      await logMedHistory("added", data.name, "medication");
    }
    resetMedForm();
    refreshMedList();
    refreshMedHistory();
    refreshPrintView();
  } catch (err) { console.error(err); alert("Error saving medication."); }
}

async function deleteMed(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    await db.collection("medications").doc(id).delete();
    await logMedHistory("deleted", name, "medication");
    refreshMedList();
    refreshMedHistory();
    refreshPrintView();
  } catch (err) { console.error(err); alert("Error deleting medication."); }
}

function startMedEdit(id, data) {
  document.getElementById("medName").value        = data.name        || "";
  document.getElementById("medDose").value        = data.dose        || "";
  document.getElementById("medFrequency").value   = data.frequency   || "";
  document.getElementById("medPrescriber").value  = data.prescriber  || "";
  document.getElementById("medStartDate").value   = data.startDate   || "";
  document.getElementById("medIndication").value  = data.indication  || "";
  document.getElementById("medSideEffects").value = data.sideEffects || "";
  document.getElementById("medNotes").value       = data.notes       || "";
  document.getElementById("medEditingId").value   = id;
  document.getElementById("medFormTitle").textContent = "Edit Medication";
  document.getElementById("saveMedBtn").textContent   = "Save Changes";
  document.getElementById("cancelMedEditBtn").style.display = "inline-block";
  document.getElementById("medFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelMedEdit() { resetMedForm(); }

async function refreshMedList() {
  const list = document.getElementById("medList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading…</li>";
  try {
    const snap = await db.collection("medications").orderBy("name").get();
    if (snap.empty) { list.innerHTML = "<li class='med-empty'>No medications added yet.</li>"; return; }
    list.innerHTML = "";
    snap.forEach(doc => {
      const d  = doc.data();
      const li = document.createElement("li");
      li.className = "med-item";
      li.innerHTML = `
        <div class="med-item-header">
          <span class="med-item-name">${d.name}</span>
          ${d.dose      ? `<span class="med-item-dose">${d.dose}</span>` : ""}
          ${d.frequency ? `<span class="med-item-freq">${d.frequency}</span>` : ""}
          <div class="med-item-actions">
            <button class="med-edit-btn">Edit</button>
            <button class="danger">Delete</button>
          </div>
        </div>
        ${d.prescriber  ? `<div class="med-item-detail"><span class="med-detail-label">Prescriber: </span>${d.prescriber}</div>`  : ""}
        ${d.startDate   ? `<div class="med-item-detail"><span class="med-detail-label">Start date: </span>${d.startDate}</div>`  : ""}
        ${d.indication  ? `<div class="med-item-detail"><span class="med-detail-label">Indication: </span>${d.indication}</div>` : ""}
        ${d.sideEffects ? `<div class="med-item-detail"><span class="med-detail-label">Side effects: </span>${d.sideEffects}</div>` : ""}
        ${d.notes       ? `<div class="med-item-detail med-item-notes">${d.notes}</div>` : ""}`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startMedEdit(doc.id, d));
      li.querySelector(".danger").addEventListener("click",       () => deleteMed(doc.id, d.name));
      list.appendChild(li);
    });
  } catch (err) { console.error(err); list.innerHTML = "<li class='med-empty'>Error loading medications.</li>"; }
}

// ---- Supplements CRUD ----

function setupSuppForm() {
  const saveBtn   = document.getElementById("saveSuppBtn");
  const cancelBtn = document.getElementById("cancelSuppEditBtn");
  if (saveBtn)   saveBtn.addEventListener("click",   saveSupp);
  if (cancelBtn) cancelBtn.addEventListener("click", cancelSuppEdit);
}

function getSuppFormData() {
  return {
    name:      document.getElementById("suppName")?.value.trim()      || "",
    dose:      document.getElementById("suppDose")?.value.trim()      || "",
    frequency: document.getElementById("suppFrequency")?.value.trim() || "",
    purpose:   document.getElementById("suppPurpose")?.value.trim()   || "",
    notes:     document.getElementById("suppNotes")?.value.trim()     || ""
  };
}

function resetSuppForm() {
  ["suppName","suppDose","suppFrequency","suppPurpose","suppNotes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("suppEditingId").value = "";
  document.getElementById("suppFormTitle").textContent = "Add Supplement";
  document.getElementById("saveSuppBtn").textContent   = "Save Supplement";
  document.getElementById("cancelSuppEditBtn").style.display = "none";
}

async function saveSupp() {
  const data = getSuppFormData();
  if (!data.name) { alert("Supplement name is required."); return; }
  const editingId = document.getElementById("suppEditingId").value;
  const now = new Date().toISOString();
  try {
    if (editingId) {
      await db.collection("supplements").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
      await logMedHistory("edited", data.name, "supplement");
    } else {
      await db.collection("supplements").add({ ...data, createdAt: now, updatedAt: now });
      await logMedHistory("added", data.name, "supplement");
    }
    resetSuppForm();
    refreshSuppList();
    refreshMedHistory();
    refreshPrintView();
  } catch (err) { console.error(err); alert("Error saving supplement."); }
}

async function deleteSupp(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    await db.collection("supplements").doc(id).delete();
    await logMedHistory("deleted", name, "supplement");
    refreshSuppList();
    refreshMedHistory();
    refreshPrintView();
  } catch (err) { console.error(err); alert("Error deleting supplement."); }
}

function startSuppEdit(id, data) {
  document.getElementById("suppName").value      = data.name      || "";
  document.getElementById("suppDose").value      = data.dose      || "";
  document.getElementById("suppFrequency").value = data.frequency || "";
  document.getElementById("suppPurpose").value   = data.purpose   || "";
  document.getElementById("suppNotes").value     = data.notes     || "";
  document.getElementById("suppEditingId").value = id;
  document.getElementById("suppFormTitle").textContent = "Edit Supplement";
  document.getElementById("saveSuppBtn").textContent   = "Save Changes";
  document.getElementById("cancelSuppEditBtn").style.display = "inline-block";
  document.getElementById("suppFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelSuppEdit() { resetSuppForm(); }

async function refreshSuppList() {
  const list = document.getElementById("suppList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading…</li>";
  try {
    const snap = await db.collection("supplements").orderBy("name").get();
    if (snap.empty) { list.innerHTML = "<li class='med-empty'>No supplements added yet.</li>"; return; }
    list.innerHTML = "";
    snap.forEach(doc => {
      const d  = doc.data();
      const li = document.createElement("li");
      li.className = "med-item supp-item";
      li.innerHTML = `
        <div class="med-item-header">
          <span class="med-item-name">${d.name}</span>
          ${d.dose      ? `<span class="med-item-dose">${d.dose}</span>` : ""}
          ${d.frequency ? `<span class="med-item-freq supp-freq">${d.frequency}</span>` : ""}
          <div class="med-item-actions">
            <button class="med-edit-btn">Edit</button>
            <button class="danger">Delete</button>
          </div>
        </div>
        ${d.purpose ? `<div class="med-item-detail"><span class="med-detail-label">Purpose: </span>${d.purpose}</div>` : ""}
        ${d.notes   ? `<div class="med-item-detail med-item-notes">${d.notes}</div>` : ""}`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startSuppEdit(doc.id, d));
      li.querySelector(".danger").addEventListener("click",       () => deleteSupp(doc.id, d.name));
      list.appendChild(li);
    });
  } catch (err) { console.error(err); list.innerHTML = "<li class='med-empty'>Error loading supplements.</li>"; }
}

// ---- Med History log ----

function setupMedHistoryTab() { /* refreshed when tab loads */ }

async function logMedHistory(action, name, type) {
  try {
    await db.collection("medHistory").add({
      action, name, type,
      timestamp: new Date().toISOString()
    });
  } catch (err) { console.error("logMedHistory error:", err); }
}

async function refreshMedHistory() {
  const list = document.getElementById("medHistoryList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading…</li>";
  try {
    const snap = await db.collection("medHistory")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();
    if (snap.empty) { list.innerHTML = "<li class='med-empty'>No history yet.</li>"; return; }
    list.innerHTML = "";
    snap.forEach(doc => {
      const h  = doc.data();
      const li = document.createElement("li");
      li.className = "med-history-item";
      const actionClass = h.action === "added" ? "med-history-added" :
                          h.action === "edited" ? "med-history-edited" : "med-history-deleted";
      const ts = h.timestamp ? new Date(h.timestamp).toLocaleString() : "";
      li.innerHTML = `
        <span class="med-history-action ${actionClass}">${h.action}</span>
        <strong>${h.name}</strong>
        <span class="med-history-type">(${h.type})</span>
        <span class="med-history-date">${ts}</span>`;
      list.appendChild(li);
    });
  } catch (err) { list.innerHTML = "<li class='med-empty'>Error loading history.</li>"; }
}

// ---- Print / Export View ----

function setupMedPrintView() {
  const printBtn  = document.getElementById("printMedListBtn");
  const exportBtn = document.getElementById("exportMedCsvBtn");
  if (printBtn)  printBtn.addEventListener("click",  () => window.print());
  if (exportBtn) exportBtn.addEventListener("click", exportMedCsv);
}

async function refreshPrintView() {
  await Promise.all([renderPrintMeds(), renderPrintSupps()]);
}

async function renderPrintMeds() {
  const tbody = document.getElementById("printMedsTbody");
  if (!tbody) return;
  try {
    const snap = await db.collection("medications").orderBy("name").get();
    if (snap.empty) { tbody.innerHTML = `<tr><td colspan="6" class="med-table-empty">No medications</td></tr>`; return; }
    tbody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      tbody.innerHTML += `<tr>
        <td>${d.name || ""}</td>
        <td>${d.dose || ""}</td>
        <td>${d.frequency || ""}</td>
        <td>${d.prescriber || ""}</td>
        <td>${d.indication || ""}</td>
        <td>${d.sideEffects || ""}</td>
      </tr>`;
    });
  } catch (err) { tbody.innerHTML = `<tr><td colspan="6" class="med-table-empty">Error</td></tr>`; }
}

async function renderPrintSupps() {
  const tbody = document.getElementById("printSuppsTbody");
  if (!tbody) return;
  try {
    const snap = await db.collection("supplements").orderBy("name").get();
    if (snap.empty) { tbody.innerHTML = `<tr><td colspan="4" class="med-table-empty">No supplements</td></tr>`; return; }
    tbody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      tbody.innerHTML += `<tr>
        <td>${d.name || ""}</td>
        <td>${d.dose || ""}</td>
        <td>${d.frequency || ""}</td>
        <td>${d.purpose || ""}</td>
      </tr>`;
    });
  } catch (err) { tbody.innerHTML = `<tr><td colspan="4" class="med-table-empty">Error</td></tr>`; }
}

async function exportMedCsv() {
  try {
    const [medSnap, suppSnap] = await Promise.all([
      db.collection("medications").orderBy("name").get(),
      db.collection("supplements").orderBy("name").get()
    ]);

    let csv = "Type,Name,Dose,Frequency,Prescriber,Indication,SideEffects,Notes\n";
    medSnap.forEach(doc => {
      const d = doc.data();
      csv += ["Medication", d.name, d.dose, d.frequency, d.prescriber, d.indication, d.sideEffects, d.notes]
        .map(v => `"${(v||"").replace(/"/g, '""')}"`).join(",") + "\n";
    });
    suppSnap.forEach(doc => {
      const d = doc.data();
      csv += ["Supplement", d.name, d.dose, d.frequency, "", d.purpose, "", d.notes]
        .map(v => `"${(v||"").replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "medications.csv"; a.click();
    URL.revokeObjectURL(url);
  } catch (err) { alert("Export failed."); }
}

// ============================================================
// BUILD FOOTER
// ============================================================
async function setupBuildFooter() {
  const shaEl  = document.getElementById("buildSha");
  const msgEl  = document.getElementById("buildMsg");
  const dateEl = document.getElementById("buildDate");
  if (!shaEl) return;

  try {
    const res  = await fetch("https://api.github.com/repos/dennismzanetti/FibroSymptomTracker/commits/main");
    const data = await res.json();
    const sha  = data.sha?.slice(0, 7) || "?";
    const msg  = data.commit?.message?.split("\n")[0] || "";
    const date = data.commit?.author?.date
      ? new Date(data.commit.author.date).toLocaleString()
      : "";
    shaEl.textContent = sha;
    shaEl.href        = data.html_url || "#";
    if (msgEl)  msgEl.textContent  = msg;
    if (dateEl) dateEl.textContent = date;
  } catch (e) {
    shaEl.textContent = "offline";
  }
}
