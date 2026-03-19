// ---- Firebase init (only once) -----
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

// Simple test: write a document when the page loads
db.collection("testCollection").add({
  createdAt: new Date().toISOString(),
  note: "Hello from GitHub Pages"
}).then((docRef) => {
  console.log("Test doc written with ID: ", docRef.id);
}).catch((error) => {
  console.error("Error adding test doc: ", error);
});

// ---- Simple local storage helpers ----
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
  console.log("window load handler running");

  setupTabs();
  setupExerciseToggle();
  setupSaveDay();
  loadTodayDate();
  setupDateNavigation();

  const dateInput = document.getElementById("dateInput");
  console.log("dateInput on load:", dateInput);

  if (dateInput && dateInput.value) {
    loadDayFromCloud(dateInput.value);
  }

  if (dateInput) {
    ["change", "input", "blur"].forEach((evt) => {
      dateInput.addEventListener(evt, (event) => {
        console.log("date event", evt, "value =", event.target.value);
        const newDate = event.target.value;
        if (newDate && evt === "change") {
          loadDayFromCloud(newDate);
        }
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

      // Extra: refresh when History tab is opened
      if (target === "history-tab") {
        refreshHistory();
      }

      // Optional: refresh trends when Trends tab opened
      if (target === "trends-tab") {
        refreshTrends();
      }
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
    if (!dayData.date) {
      status.textContent = "Please select a date.";
      return;
    }

    status.textContent = "Saving locally...";

    const days = loadAllDays();
    const existingIndex = days.findIndex(d => d.date === dayData.date);
    if (existingIndex >= 0) {
      days[existingIndex] = dayData;
    } else {
      days.push(dayData);
    }
    saveAllDays(days);

    status.textContent = "Saved locally.";

    try {
      status.textContent = "Saving to cloud...";

      const dayRef = db.collection("days").doc(dayData.date);
      await dayRef.set(dayData, { merge: false });

      status.textContent = "Saved locally + cloud.";
      console.log("Saved day to cloud for", dayData.date);
    } catch (err) {
      console.error("Error saving to cloud:", err);
      status.textContent = "Saved locally, but cloud save failed.";
    }

    // refresh after a successful save
    refreshHistory();
    refreshTrends();
  };

  topBtn?.addEventListener("click", handleSaveClick);
  bottomBtn?.addEventListener("click", handleSaveClick);
}


function clearFormFieldsExceptDate() {
  document.getElementById("dayTitleInput").value = "";
  document.getElementById("overallNotesInput").value = "";

  const clearBlock = (prefix) => {
    document.getElementById(prefix + "Score").value = "";
    document.getElementById(prefix + "Activity").value = "";
    document.getElementById(prefix + "Symptoms").value = "";
  };

  clearBlock("earlyMorning");
  clearBlock("lateMorning");
  clearBlock("earlyAfternoon");
  clearBlock("lateAfternoon");
  clearBlock("earlyEvening");
  clearBlock("lateEvening");

  document.getElementById("bedtimeInput").value = "";
  document.getElementById("wakeTimeInput").value = "";
  document.getElementById("hoursSleptInput").value = "";
  document.getElementById("sleepQualityInput").value = "";
  document.getElementById("awakeningsInput").value = "";
  document.getElementById("sleepNotesInput").value = "";

  document.getElementById("didExerciseInput").value = "no";
  document.getElementById("didExerciseInput").dispatchEvent(new Event("change"));
  document.getElementById("exerciseTypeInput").value = "";
  document.getElementById("exerciseMinutesInput").value = "";
  document.getElementById("exerciseIntensityInput").value = "";
  document.getElementById("exerciseTimingInput").value = "";
  document.getElementById("exerciseNotesInput").value = "";

  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => {
    cb.checked = false;
  });
}

function loadDayFromCloud(date) {
  const status = document.getElementById("saveStatus");
  if (!date) return;

  const docRef = db.collection("days").doc(date);
  docRef.get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      fillFormFromData(data);
      status.textContent = "Loaded from cloud for " + date + ".";
      console.log("Loaded day from cloud for", date);
    } else {
      clearFormFieldsExceptDate();
      status.textContent = "No cloud entry for that date. Form cleared.";
      console.log("No such document for", date);
    }
  }).catch((error) => {
    console.error("Error getting document:", error);
    clearFormFieldsExceptDate();
    status.textContent = "Cloud load failed.";
  });
}

function clearFormFields() {
  document.getElementById("dayTitleInput").value = "";
  document.getElementById("overallNotesInput").value = "";

  const clearBlock = (prefix) => {
    document.getElementById(prefix + "Score").value = "";
    document.getElementById(prefix + "Activity").value = "";
    document.getElementById(prefix + "Symptoms").value = "";
  };

  clearBlock("earlyMorning");
  clearBlock("lateMorning");
  clearBlock("earlyAfternoon");
  clearBlock("lateAfternoon");
  clearBlock("earlyEvening");
  clearBlock("lateEvening");

  document.getElementById("bedtimeInput").value = "";
  document.getElementById("wakeTimeInput").value = "";
  document.getElementById("hoursSleptInput").value = "";
  document.getElementById("sleepQualityInput").value = "";
  document.getElementById("awakeningsInput").value = "";
  document.getElementById("sleepNotesInput").value = "";

  document.getElementById("didExerciseInput").value = "no";
  document.getElementById("didExerciseInput").dispatchEvent(new Event("change"));
  document.getElementById("exerciseTypeInput").value = "";
  document.getElementById("exerciseMinutesInput").value = "";
  document.getElementById("exerciseIntensityInput").value = "";
  document.getElementById("exerciseTimingInput").value = "";
  document.getElementById("exerciseNotesInput").value = "";

  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => {
    cb.checked = false;
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
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => {
    if (cb.checked) tags.push(cb.value);
  });

  const scores = Object.values(functionality)
    .map(b => b.score)
    .filter(v => typeof v === "number");
  const avgFunctionality = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  return {
    date,
    dayTitle,
    overallNotes,
    functionality,
    sleep,
    didExercise,
    exercise,
    tags,
    avgFunctionality
  };
}

// ---- History from Firestore ----
async function refreshHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;

  list.innerHTML = "<li>Loading...</li>";

  try {
    const snapshot = await db
      .collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId()) // order by date string (doc id)
      .get();                                            // [web:731][web:733][web:734]

    const days = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      days.push({
        // ensure we always have a date field; doc.id is your YYYY-MM-DD
        date: data.date || doc.id,
        dayTitle: data.dayTitle || "",
        avgFunctionality: data.avgFunctionality ?? null,
        functionality: data.functionality || null,
        sleep: data.sleep || null,
        didExercise: data.didExercise || false,
        exercise: data.exercise || null,
        tags: data.tags || []
      });
    });

    // newest first
    days.sort((a, b) => a.date.localeCompare(b.date)).reverse();

    list.innerHTML = "";

    if (!days.length) {
      list.innerHTML = "<li>No entries yet.</li>";
      return;
    }

days.slice(0, 30).forEach(d => {
  const li = document.createElement("li");
  const title = d.dayTitle ? ` – ${d.dayTitle}` : "";
  const avg = d.avgFunctionality != null ? ` | Avg func: ${d.avgFunctionality.toFixed(1)}` : "";

  const textSpan = document.createElement("span");
  textSpan.textContent = `${d.date}${title}${avg}`;
  li.appendChild(textSpan);

  // Load button
  const loadBtn = document.createElement("button");
  loadBtn.textContent = "Load";
  loadBtn.addEventListener("click", () => {
    fillFormFromData(d);
    switchToTab("entry-tab");
  });
  li.appendChild(loadBtn);

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.classList.add("danger"); // optional styling
  deleteBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(`Delete entry for ${d.date}?`);
    if (!confirmed) return;

    try {
      await db.collection("days").doc(d.date).delete();  // delete Firestore doc[web:758][web:760]
      console.log("Deleted day", d.date);
      refreshHistory(); // reload list
      refreshTrends();  // keep chart in sync
    } catch (err) {
      console.error("Error deleting day:", err);
      alert("Failed to delete this entry from the cloud.");
    }
  });
  li.appendChild(deleteBtn);

  list.appendChild(li);
});

  } catch (err) {
    console.error("Error loading history from cloud:", err);
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

  const tagsSet = new Set(d.tags || []);
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach(cb => {
    cb.checked = tagsSet.has(cb.value);
  });
}

function changeDateBy(days) {
  const dateInput = document.getElementById("dateInput");
  if (!dateInput || !dateInput.value) {
    console.log("changeDateBy: no date value yet");
    return;
  }

  const current = new Date(dateInput.value);
  if (Number.isNaN(current.getTime())) {
    console.log("changeDateBy: invalid current date", dateInput.value);
    return;
  }

  console.log("changeDateBy called with days =", days, "current =", current.toISOString().slice(0, 10));

  current.setUTCDate(current.getUTCDate() + days);

  const y = current.getUTCFullYear();
  const m = String(current.getUTCMonth() + 1).padStart(2, "0");
  const d = String(current.getUTCDate()).padStart(2, "0");
  const newValue = `${y}-${m}-${d}`;

  console.log("new date =", newValue);

  dateInput.value = newValue;
  loadDayFromCloud(newValue);
}

function setupDateNavigation() {
  const prevBtn = document.getElementById("prevDateBtn");
  const nextBtn = document.getElementById("nextDateBtn");

  console.log("setupDateNavigation:", { prevBtn, nextBtn });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => changeDateBy(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => changeDateBy(1));
  }
}

function switchToTab(tabId) {
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.id === tabId);
  });
}

// ---- Trends ----
let functionalityChart = null;

async function refreshTrends() {
  const canvas = document.getElementById("functionalityChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  try {
    const snapshot = await db
      .collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId())
      .get();

    console.log("Trends snapshot size:", snapshot.size);

    const labels = [];
    const data = [];

    snapshot.forEach(doc => {
      const d = doc.data();
      const date = d.date || doc.id;
      const avg = d.avgFunctionality;

      console.log("Trend doc:", doc.id, "avgFunctionality:", avg);

      if (typeof avg === "number") {
        labels.push(date);
        data.push(avg);
      }
    });

    if (functionalityChart) {
      functionalityChart.destroy();
    }

    functionalityChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Average daily functionality",
          data,
          borderColor: "#3f51b5",
          backgroundColor: "rgba(63,81,181,0.15)",
          tension: 0.2
        }]
      },
      options: {
        scales: {
          y: {
            suggestedMin: 0,
            suggestedMax: 10
          }
        }
      }
    });
  } catch (err) {
    console.error("Error loading trends from cloud:", err);
  }
}

