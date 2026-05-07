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

// ---- UI setup ----
window.addEventListener("load", () => {
  setupTabs();
  setupExerciseToggle();
  setupSaveDay();
  loadTodayDate();
  setupDateNavigation();
  setupSleepCalculation();
  setupNumberSteppers();
  setupMedicationsTab();

  const dateInput = document.getElementById("dateInput");
  if (dateInput && dateInput.value) loadDayFromCloud(dateInput.value);

  if (dateInput) {
    ["change", "input", "blur"].forEach((evt) => {
      dateInput.addEventListener(evt, (event) => {
        if (event.target.value && evt === "change") loadDayFromCloud(event.target.value);
      });
    });
  }

  refreshHistory();
  refreshTrends();
});

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
      if (target === "medications-tab") refreshMedList();
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
  const dateInput = document.getElementById("dateInput");
  const today = new Date();
  dateInput.value = today.toISOString().slice(0, 10);
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
    if (hoursSleptDisplay) hoursSleptDisplay.textContent = "—";
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
  const date = document.getElementById("dateInput").value;
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
      const title = d.dayTitle ? ` – ${d.dayTitle}` : "";
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
  document.getElementById("dateInput").value = d.date || "";
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
  const dateInput = document.getElementById("dateInput");
  if (!dateInput || !dateInput.value) return;
  const current = new Date(dateInput.value);
  if (Number.isNaN(current.getTime())) return;
  current.setUTCDate(current.getUTCDate() + days);
  const y = current.getUTCFullYear();
  const m = String(current.getUTCMonth() + 1).padStart(2, "0");
  const d = String(current.getUTCDate()).padStart(2, "0");
  dateInput.value = `${y}-${m}-${d}`;
  loadDayFromCloud(dateInput.value);
}

function setupDateNavigation() {
  const dateInput = document.getElementById("dateInput");
  const prevDayBtn = document.getElementById("prevDayBtn");
  const nextDayBtn = document.getElementById("nextDayBtn");
  if (!dateInput) return;
  dateInput.addEventListener("change", async () => loadDayFromCloud(dateInput.value));
  prevDayBtn?.addEventListener("click", () => changeDateBy(-1));
  nextDayBtn?.addEventListener("click", () => changeDateBy(1));
}

function switchToTab(tabId) {
  document.querySelectorAll(".tab-button").forEach(btn => btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId));
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.id === tabId));
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
      return `<article class="journal-entry"><header class="journal-day-header"><div><p class="journal-date">${formatText(data.date, "No date recorded")}</p><h3>${title}</h3></div><div class="journal-score-pill"><span class="journal-score-label">Avg function</span><strong>${avgFunctionality}</strong></div></header><section class="journal-section"><h4>Mood</h4><p><span class="journal-label">Score:</span> ${moodScore}</p><p>${formatText(data.mood?.notes, "No mood notes recorded.")}</p></section><section class="journal-section"><h4>Sleep summary</h4><div class="sleep-summary"><div class="sleep-stat"><span class="journal-label">Bedtime</span><strong>${formatText(data.sleep?.bedtime, "not recorded")}</strong></div><div class="sleep-stat"><span class="journal-label">Wake time</span><strong>${formatText(data.sleep?.wakeTime, "not recorded")}</strong></div><div class="sleep-stat"><span class="journal-label">Hours slept</span><strong>${sleepHours}</strong></div><div class="sleep-stat"><span class="journal-label">Sleep quality</span><strong>${sleepQuality}</strong></div><div class="sleep-stat"><span class="journal-label">Awakenings</span><strong>${awakenings}</strong></div></div><p class="sleep-notes">${formatText(data.sleep?.notes, "No sleep notes recorded.")}</p></section><section class="journal-section"><h4>Functionality through the day</h4><div class="function-grid"><div class="function-card"><div class="function-card-head"><span>Early morning</span><strong>${formatScore(data.functionality?.earlyMorning?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.earlyMorning?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.earlyMorning?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Late morning</span><strong>${formatScore(data.functionality?.lateMorning?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.lateMorning?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.lateMorning?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Early afternoon</span><strong>${formatScore(data.functionality?.earlyAfternoon?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.earlyAfternoon?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.earlyAfternoon?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Late afternoon</span><strong>${formatScore(data.functionality?.lateAfternoon?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.lateAfternoon?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.lateAfternoon?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Early evening</span><strong>${formatScore(data.functionality?.earlyEvening?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.earlyEvening?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.earlyEvening?.symptoms, "none recorded")}</p></div><div class="function-card"><div class="function-card-head"><span>Late evening</span><strong>${formatScore(data.functionality?.lateEvening?.score)}</strong></div><p><span class="journal-label">Activity:</span> ${formatText(data.functionality?.lateEvening?.activity, "none recorded")}</p><p><span class="journal-label">Symptoms:</span> ${formatText(data.functionality?.lateEvening?.symptoms, "none recorded")}</p></div></div></section><section class="journal-section"><h4>Exercise</h4>${exerciseHtml}</section><section class="journal-section"><h4>Tags</h4>${tagsHtml}</section><section class="journal-section"><h4>Overall notes</h4><p>${formatText(data.overallNotes, "No overall notes recorded.")}</p></section></article>`;
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
  const showListBtn = document.getElementById("showMedListBtn");
  const showHistoryBtn = document.getElementById("showMedHistoryBtn");
  const medListView = document.getElementById("medListView");
  const medHistoryView = document.getElementById("medHistoryView");

  showListBtn?.addEventListener("click", () => {
    showListBtn.classList.add("active");
    showHistoryBtn.classList.remove("active");
    medListView.style.display = "";
    medHistoryView.style.display = "none";
    refreshMedList();
  });

  showHistoryBtn?.addEventListener("click", () => {
    showHistoryBtn.classList.add("active");
    showListBtn.classList.remove("active");
    medHistoryView.style.display = "";
    medListView.style.display = "none";
    refreshMedHistory();
  });

  document.getElementById("saveMedBtn")?.addEventListener("click", saveMedication);
  document.getElementById("cancelMedEditBtn")?.addEventListener("click", resetMedForm);
}

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
    // Fetch old data for history diff
    const oldDoc = await db.collection("medications").doc(editingId).get();
    const oldData = oldDoc.exists ? oldDoc.data() : {};

    await db.collection("medications").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });

    // Build a readable summary of what changed
    const changes = [];
    if (oldData.name !== data.name) changes.push(`Name: "${oldData.name}" → "${data.name}"`);
    if (oldData.dose !== data.dose) changes.push(`Dose: "${oldData.dose}" → "${data.dose}"`);
    if (oldData.frequency !== data.frequency) changes.push(`Frequency: "${oldData.frequency}" → "${data.frequency}"`);
    if (oldData.doctor !== data.doctor) changes.push(`Doctor: "${oldData.doctor}" → "${data.doctor}"`);
    if (oldData.notes !== data.notes) changes.push(`Notes updated`);

    await db.collection("medicationHistory").add({
      action: "edited",
      medicationId: editingId,
      medicationName: data.name,
      changes: changes.length ? changes : ["No field changes detected"],
      snapshot: { ...data },
      timestamp: now
    });
  } else {
    const docRef = await db.collection("medications").add({ ...data, createdAt: now, updatedAt: now });

    await db.collection("medicationHistory").add({
      action: "added",
      medicationId: docRef.id,
      medicationName: data.name,
      changes: [`Added: ${data.name}${data.dose ? ` ${data.dose}` : ""}`],
      snapshot: { ...data },
      timestamp: now
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
    action: "deleted",
    medicationId: id,
    medicationName: name,
    changes: [`Deleted: ${name}${oldData.dose ? ` ${oldData.dose}` : ""}`],
    snapshot: { ...oldData },
    timestamp: now
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
    if (snapshot.empty) { list.innerHTML = "<li class='med-empty'>No medications added yet.</li>"; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const med = doc.data();
      const li = document.createElement("li");
      li.className = "med-item";

      const freqLabels = { daily: "Daily", twice_daily: "Twice daily", three_times_daily: "Three times daily", as_needed: "As needed", weekly: "Weekly", other: "Other" };

      li.innerHTML = `
        <div class="med-item-info">
          <strong class="med-name">${med.name}</strong>
          ${med.dose ? `<span class="med-dose">${med.dose}</span>` : ""}
          ${med.frequency ? `<span class="med-freq">${freqLabels[med.frequency] || med.frequency}</span>` : ""}
          ${med.doctor ? `<p class="med-detail">Dr: ${med.doctor}</p>` : ""}
          ${med.notes ? `<p class="med-detail med-notes-text">${med.notes}</p>` : ""}
        </div>
        <div class="med-item-actions">
          <button class="med-edit-btn">Edit</button>
          <button class="med-delete-btn danger">Delete</button>
        </div>
      `;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startEditMedication(doc.id, med));
      li.querySelector(".med-delete-btn").addEventListener("click", () => deleteMedication(doc.id, med.name));
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading medications:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load medications.</li>";
  }
}

async function refreshMedHistory() {
  const list = document.getElementById("medHistoryList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading...</li>";
  try {
    const snapshot = await db.collection("medicationHistory").orderBy("timestamp", "desc").get();
    if (snapshot.empty) { list.innerHTML = "<li class='med-empty'>No history yet.</li>"; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const h = doc.data();
      const li = document.createElement("li");
      li.className = "med-history-item";

      const actionLabels = { added: "➕ Added", edited: "✏️ Edited", deleted: "🗑️ Deleted" };
      const actionLabel = actionLabels[h.action] || h.action;
      const dateStr = h.timestamp ? new Date(h.timestamp).toLocaleString() : "Unknown time";
      const changesHtml = (h.changes || []).map(c => `<li>${c}</li>`).join("");

      li.innerHTML = `
        <div class="med-history-header">
          <span class="med-history-action med-action-${h.action}">${actionLabel}</span>
          <strong class="med-history-name">${h.medicationName || "Unknown"}</strong>
          <span class="med-history-date">${dateStr}</span>
        </div>
        ${changesHtml ? `<ul class="med-history-changes">${changesHtml}</ul>` : ""}
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading med history:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load history.</li>";
  }
}
