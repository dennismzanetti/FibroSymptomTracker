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

// ---- Google Sign-In ----
const googleProvider = new firebase.auth.GoogleAuthProvider();

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

const googleSignInBtn = document.getElementById('googleSignInBtn');
if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', () => {
    const authError = document.getElementById('authError');
    if (authError) authError.textContent = '';
    if (isMobile()) {
      auth.signInWithRedirect(googleProvider).catch(err => {
        console.error('Redirect sign-in error:', err);
        if (authError) authError.textContent = 'Sign-in failed. Please try again.';
      });
    } else {
      auth.signInWithPopup(googleProvider).catch(err => {
        console.error('Sign-in error:', err);
        if (authError) authError.textContent = 'Sign-in failed. Please try again.';
      });
    }
  });
}

// Consume redirect result on page load (mobile sign-in)
auth.getRedirectResult().then(result => {
  if (result && result.user) {
    console.log('Redirect sign-in complete:', result.user.displayName);
  }
}).catch(err => {
  console.error('Redirect sign-in error:', err);
  const authError = document.getElementById('authError');
  if (authError) authError.textContent = 'Sign-in failed. Please try again.';
});

// ---- Toast notification ----
let _toastTimer = null;
function showToast(message, isError = false) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.style.cssText = [
      "position:fixed","bottom:1.5rem","left:50%","transform:translateX(-50%)",
      "background:#323232","color:#fff","padding:0.6rem 1.2rem",
      "border-radius:6px","font-size:0.9rem","z-index:9999",
      "pointer-events:none","transition:opacity 0.3s","opacity:0"
    ].join(";");
    document.body.appendChild(toast);
  }
  if (isError) toast.style.background = "#c62828";
  else         toast.style.background = "#323232";
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.style.opacity = "0"; }, 3000);
}

// ---- Date handling ----
let currentDateStr = "";

function loadTodayDate() {
  const today = new Date();
  currentDateStr = formatDate(today);
  renderDateDisplay(today);
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function renderDateDisplay(d) {
  const opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  const full = d.toLocaleDateString("en-US", opts);
  // Split "Wednesday, May 28, 2026" -> weekday + rest
  const [weekday, ...rest] = full.split(", ");
  const dateOnly = rest.join(", ");

  // Desktop header
  const wkEl   = document.getElementById("headerWeekday");
  const dtEl   = document.getElementById("headerDate");
  if (wkEl) wkEl.textContent = weekday;
  if (dtEl) dtEl.textContent = dateOnly;

  // Mobile header
  const mWkEl  = document.getElementById("mHeaderWeekday");
  const mDtEl  = document.getElementById("mHeaderDate");
  if (mWkEl) mWkEl.textContent = weekday;
  if (mDtEl) mDtEl.textContent = dateOnly;

  // Entry tab day label
  const dayLabel = document.getElementById("entryDayLabel");
  if (dayLabel) dayLabel.textContent = weekday + ", " + dateOnly;
}

function navigateDate(delta) {
  const d = parseDate(currentDateStr);
  d.setDate(d.getDate() + delta);
  currentDateStr = formatDate(d);
  renderDateDisplay(d);
  loadDayFromCloud(currentDateStr);
}

function jumpToDate(str) {
  if (!str) return;
  currentDateStr = str;
  renderDateDisplay(parseDate(str));
  loadDayFromCloud(str);
}

// Expose for inline onclick handlers
window.navigateDate = navigateDate;
window.jumpToDate   = jumpToDate;

// ---- Cloud data (Firestore) ----
let currentUserId = "";

auth.onAuthStateChanged((user) => {
  if (user) currentUserId = user.uid;
});

function userDocRef(date) {
  return db.collection("users").doc(currentUserId).collection("days").doc(date);
}

function loadDayFromCloud(date) {
  if (!currentUserId) return;
  userDocRef(date).get().then(doc => {
    if (doc.exists) {
      populateFormFromData(doc.data());
    } else {
      clearForm();
    }
  }).catch(err => {
    console.error("Load error:", err);
    showToast("Failed to load data.", true);
  });
}

function saveDayToCloud(date, data) {
  if (!currentUserId) { showToast("Not signed in.", true); return; }
  userDocRef(date).set(data, { merge: true }).then(() => {
    showToast("Saved!");
  }).catch(err => {
    console.error("Save error:", err);
    showToast("Save failed.", true);
  });
}

// ---- Form population & clearing ----
function populateFormFromData(data) {
  setValue("dayTitle",    data.dayTitle    || "");
  setValue("overallNotes",data.overallNotes|| "");
  setValue("moodScore",   data.moodScore   != null ? data.moodScore : 5);
  setValue("moodNotes",   data.moodNotes   || "");

  // Functionality by time of day
  ["morning", "afternoon", "evening"].forEach(t => {
    setValue(`func_${t}`,       data[`func_${t}`]       != null ? data[`func_${t}`] : 5);
    setValue(`func_${t}_notes`, data[`func_${t}_notes`] || "");
  });

  // Pain
  setValue("painScore",   data.painScore   != null ? data.painScore : 0);
  setValue("painNotes",   data.painNotes   || "");

  // Sleep
  setValue("sleepHours",  data.sleepHours  != null ? data.sleepHours : 7);
  setValue("sleepQuality",data.sleepQuality!= null ? data.sleepQuality : 5);
  setValue("sleepNotes",  data.sleepNotes  || "");

  // Energy
  setValue("energyScore", data.energyScore != null ? data.energyScore : 5);
  setValue("energyNotes", data.energyNotes || "");

  // Fatigue
  setValue("fatigueScore",data.fatigueScore!= null ? data.fatigueScore : 5);
  setValue("fatigueNotes",data.fatigueNotes|| "");

  // Brain fog
  setValue("fogScore",    data.fogScore    != null ? data.fogScore : 0);
  setValue("fogNotes",    data.fogNotes    || "");

  // Stress
  setValue("stressScore", data.stressScore != null ? data.stressScore : 0);
  setValue("stressNotes", data.stressNotes || "");

  // Exercise
  setValue("exerciseDone",  data.exerciseDone   ? "true" : "false");
  setValue("exerciseType",  data.exerciseType   || "");
  setValue("exerciseMins",  data.exerciseMins   != null ? data.exerciseMins : 0);
  setValue("exerciseNotes", data.exerciseNotes  || "");

  // Nutrition
  setValue("nutritionScore",data.nutritionScore != null ? data.nutritionScore : 5);
  setValue("nutritionNotes",data.nutritionNotes || "");

  // Hydration
  setValue("hydrationScore",data.hydrationScore != null ? data.hydrationScore : 5);
  setValue("hydrationNotes",data.hydrationNotes || "");

  // Stress triggers / weather
  setValue("stressTriggers",data.stressTriggers || "");
  setValue("weatherNotes",  data.weatherNotes   || "");

  // Custom fields
  setValue("customField1",  data.customField1   || "");
  setValue("customField2",  data.customField2   || "");
  setValue("customField3",  data.customField3   || "");

  updateAllStepperDisplays();
  updateAllSliderDisplays();
}

function clearForm() {
  const defaults = {
    dayTitle: "", overallNotes: "",
    moodScore: 5, moodNotes: "",
    func_morning: 5, func_morning_notes: "",
    func_afternoon: 5, func_afternoon_notes: "",
    func_evening: 5, func_evening_notes: "",
    painScore: 0, painNotes: "",
    sleepHours: 7, sleepQuality: 5, sleepNotes: "",
    energyScore: 5, energyNotes: "",
    fatigueScore: 5, fatigueNotes: "",
    fogScore: 0, fogNotes: "",
    stressScore: 0, stressNotes: "",
    exerciseDone: "false", exerciseType: "", exerciseMins: 0, exerciseNotes: "",
    nutritionScore: 5, nutritionNotes: "",
    hydrationScore: 5, hydrationNotes: "",
    stressTriggers: "", weatherNotes: "",
    customField1: "", customField2: "", customField3: ""
  };
  populateFormFromData(defaults);
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = !!val;
  else el.value = val;
}

// ---- Stepper buttons ----
function updateAllStepperDisplays() {
  document.querySelectorAll(".number-stepper").forEach(stepper => {
    const input  = stepper.querySelector("input[type='number']");
    const display = stepper.querySelector(".stepper-display");
    if (input && display) display.textContent = input.value;
  });
}

window.stepperChange = function(btn, delta) {
  const stepper  = btn.closest(".number-stepper");
  const input    = stepper.querySelector("input[type='number']");
  const display  = stepper.querySelector(".stepper-display");
  if (!input) return;
  const min = parseFloat(input.min ?? "-Infinity");
  const max = parseFloat(input.max ??  "Infinity");
  let val = parseFloat(input.value || 0) + delta;
  val = Math.min(max, Math.max(min, val));
  input.value = val;
  if (display) display.textContent = val;
};

// ---- Range slider displays ----
function updateAllSliderDisplays() {
  document.querySelectorAll("input[type='range']").forEach(slider => {
    const id = slider.id;
    const out = document.getElementById(id + "_out");
    if (out) out.textContent = slider.value;
  });
}

document.querySelectorAll("input[type='range']").forEach(slider => {
  slider.addEventListener("input", () => {
    const out = document.getElementById(slider.id + "_out");
    if (out) out.textContent = slider.value;
  });
});

// ---- Save button ----
const saveBtn = document.getElementById("saveBtn");
if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    const data = collectFormData();
    saveDayToCloud(currentDateStr, data);
  });
}

function collectFormData() {
  const get = id => {
    const el = document.getElementById(id);
    if (!el) return undefined;
    if (el.type === "checkbox") return el.checked;
    const v = el.value;
    const n = parseFloat(v);
    return isNaN(n) ? v : n;
  };
  return {
    dayTitle:        get("dayTitle"),
    overallNotes:    get("overallNotes"),
    moodScore:       get("moodScore"),
    moodNotes:       get("moodNotes"),
    func_morning:    get("func_morning"),
    func_morning_notes: get("func_morning_notes"),
    func_afternoon:  get("func_afternoon"),
    func_afternoon_notes: get("func_afternoon_notes"),
    func_evening:    get("func_evening"),
    func_evening_notes: get("func_evening_notes"),
    painScore:       get("painScore"),
    painNotes:       get("painNotes"),
    sleepHours:      get("sleepHours"),
    sleepQuality:    get("sleepQuality"),
    sleepNotes:      get("sleepNotes"),
    energyScore:     get("energyScore"),
    energyNotes:     get("energyNotes"),
    fatigueScore:    get("fatigueScore"),
    fatigueNotes:    get("fatigueNotes"),
    fogScore:        get("fogScore"),
    fogNotes:        get("fogNotes"),
    stressScore:     get("stressScore"),
    stressNotes:     get("stressNotes"),
    exerciseDone:    get("exerciseDone") === "true" || get("exerciseDone") === true,
    exerciseType:    get("exerciseType"),
    exerciseMins:    get("exerciseMins"),
    exerciseNotes:   get("exerciseNotes"),
    nutritionScore:  get("nutritionScore"),
    nutritionNotes:  get("nutritionNotes"),
    hydrationScore:  get("hydrationScore"),
    hydrationNotes:  get("hydrationNotes"),
    stressTriggers:  get("stressTriggers"),
    weatherNotes:    get("weatherNotes"),
    customField1:    get("customField1"),
    customField2:    get("customField2"),
    customField3:    get("customField3"),
    savedAt:         new Date().toISOString()
  };
}

// ---- Window load ----
window.addEventListener("load", () => {
  _windowLoaded = true;
  runPostLoadSetup();
});

// ---- Tab switching ----
function showTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));

  const tab = document.getElementById(name + "-tab");
  if (tab) tab.classList.add("active");

  const btn = document.querySelector(`.tab-button[data-tab='${name}']`);
  if (btn) btn.classList.add("active");

  // Sync mobile select
  const sel = document.getElementById("tabSelect");
  if (sel) sel.value = name;

  // Trigger tab-specific init
  if (name === "trends")  renderTrends();
  if (name === "history") renderHistory();
}

window.showTab = showTab;

// Mobile tab select
const tabSelect = document.getElementById("tabSelect");
if (tabSelect) {
  tabSelect.addEventListener("change", e => showTab(e.target.value));
}

// Desktop tab buttons
document.querySelectorAll(".tab-button").forEach(btn => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

// ---- Export / Import ----
const exportBtn = document.getElementById("exportDataBtn");
if (exportBtn) {
  exportBtn.addEventListener("click", exportAllData);
}

const importFileInput = document.getElementById("importFileInput");
if (importFileInput) {
  importFileInput.addEventListener("change", handleImportFile);
}

const importConfirmBtn = document.getElementById("importConfirmBtn");
if (importConfirmBtn) {
  importConfirmBtn.addEventListener("click", confirmImport);
}

const importCancelBtn = document.getElementById("importCancelBtn");
if (importCancelBtn) {
  importCancelBtn.addEventListener("click", cancelImport);
}

let _importPayload = null;

function exportAllData() {
  if (!currentUserId) { showToast("Not signed in.", true); return; }
  const status = document.getElementById("exportImportStatus");
  if (status) { status.style.display = ""; status.textContent = "Exporting…"; }

  const collections = [
    { name: "days",        key: "days" },
    { name: "medications", key: "medications" },
    { name: "supplements", key: "supplements" },
    { name: "careteam",    key: "careteam" },
    { name: "appointments",key: "appointments" },
    { name: "mood",        key: "mood" }
  ];

  const base = db.collection("users").doc(currentUserId);
  const promises = collections.map(c =>
    base.collection(c.name).get().then(snap => ({
      key: c.key,
      docs: snap.docs.map(d => ({ id: d.id, ...d.data() }))
    }))
  );

  Promise.all(promises).then(results => {
    const payload = {};
    results.forEach(r => payload[r.key] = r.docs);
    payload.exportedAt = new Date().toISOString();

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fibro-data-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (status) status.textContent = "Export complete!";
  }).catch(err => {
    console.error("Export error:", err);
    if (status) status.textContent = "Export failed.";
    showToast("Export failed.", true);
  });
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      _importPayload = JSON.parse(ev.target.result);
      const confirmBox = document.getElementById("importConfirmBox");
      const confirmMsg = document.getElementById("importConfirmMsg");
      const counts = Object.entries(_importPayload)
        .filter(([k]) => k !== "exportedAt")
        .map(([k, v]) => `${v.length} ${k}`)
        .join(", ");
      if (confirmMsg) confirmMsg.textContent = `Import ${counts}? This will merge with existing data.`;
      if (confirmBox) confirmBox.style.display = "";
    } catch {
      showToast("Invalid file.", true);
    }
  };
  reader.readAsText(file);
}

function confirmImport() {
  if (!_importPayload || !currentUserId) return;
  const status = document.getElementById("exportImportStatus");
  if (status) { status.style.display = ""; status.textContent = "Importing…"; }

  const base = db.collection("users").doc(currentUserId);
  const writes = [];

  Object.entries(_importPayload).forEach(([col, docs]) => {
    if (col === "exportedAt" || !Array.isArray(docs)) return;
    docs.forEach(doc => {
      const { id, ...data } = doc;
      writes.push(base.collection(col).doc(id).set(data, { merge: true }));
    });
  });

  Promise.all(writes).then(() => {
    if (status) status.textContent = `Imported ${writes.length} records.`;
    showToast("Import complete!");
    cancelImport();
    loadDayFromCloud(currentDateStr);
  }).catch(err => {
    console.error("Import error:", err);
    if (status) status.textContent = "Import failed.";
    showToast("Import failed.", true);
  });
}

function cancelImport() {
  _importPayload = null;
  const confirmBox = document.getElementById("importConfirmBox");
  if (confirmBox) confirmBox.style.display = "none";
  const fileInput = document.getElementById("importFileInput");
  if (fileInput) fileInput.value = "";
}
