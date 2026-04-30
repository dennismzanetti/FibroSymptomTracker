import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD75EQyz7w9ZYuK8iDewQDzI5Z2RUzMk1k",
  authDomain: "fibrosymptomtracker.firebaseapp.com",
  projectId: "fibrosymptomtracker",
  storageBucket: "fibrosymptomtracker.firebasestorage.app",
  messagingSenderId: "729903386531",
  appId: "1:729903386531:web:b73385c230369ac53b9416",
  measurementId: "G-N20WEFRW9Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUserId = null;
let functionalityChart = null;

document.addEventListener("DOMContentLoaded", () => {
  setupUserSection();
  setupTabs();
  setupExerciseToggle();
  setupSaveDay();
  loadTodayDate();
});

function setupUserSection() {
  const userInput = document.getElementById("userIdInput");
  const setUserBtn = document.getElementById("setUserBtn");
  const userStatus = document.getElementById("userStatus");

  const savedUser = localStorage.getItem("fibroTrackerUserId");
  if (savedUser) {
    userInput.value = savedUser;
    currentUserId = savedUser;
    userStatus.textContent = `Current user: ${savedUser}`;
    loadHistory();
    loadTrends();
  }

  setUserBtn.addEventListener("click", () => {
    const val = (userInput.value || "").trim();

    if (!val) {
      userStatus.textContent = "Please enter a user ID.";
      return;
    }

    currentUserId = val;
    localStorage.setItem("fibroTrackerUserId", val);
    userStatus.textContent = `Current user: ${val}`;
    loadHistory();
    loadTrends();
  });
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const tabs = document.querySelectorAll(".tab");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");

      buttons.forEach((b) => b.classList.remove("active"));
      tabs.forEach((t) => t.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });
}

function setupExerciseToggle() {
  const didExerciseInput = document.getElementById("didExerciseInput");
  const exerciseDetails = document.getElementById("exerciseDetails");

  function updateVisibility() {
    exerciseDetails.style.display =
      didExerciseInput.value === "yes" ? "block" : "none";
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
  const saveBtn = document.getElementById("saveDayBtn");
  const status = document.getElementById("saveStatus");

  saveBtn.addEventListener("click", async () => {
    if (!currentUserId) {
      status.textContent = "Set a user ID first.";
      return;
    }

    const dayData = collectFormData();

    if (!dayData.date) {
      status.textContent = "Please select a date.";
      return;
    }

    saveBtn.disabled = true;
    status.textContent = "Saving...";

    try {
      await addDoc(collection(db, "fibroDays"), {
        userId: currentUserId,
        ...dayData
      });

      status.textContent = "Saved.";
      await loadHistory();
      await loadTrends();
    } catch (err) {
      console.error(err);
      status.textContent = "Error saving. Check console.";
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function collectFormData() {
  const date = document.getElementById("dateInput").value;
  const dayTitle = document.getElementById("dayTitleInput").value;
  const overallNotes = document.getElementById("overallNotesInput").value;

  const getBlock = (prefix) => ({
    score: numberOrNull(document.getElementById(`${prefix}Score`).value),
    activity: document.getElementById(`${prefix}Activity`).value,
    symptoms: document.getElementById(`${prefix}Symptoms`).value
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

  const exercise = didExercise
    ? {
        type: document.getElementById("exerciseTypeInput").value,
        minutes: numberOrNull(document.getElementById("exerciseMinutesInput").value),
        intensity: document.getElementById("exerciseIntensityInput").value,
        timing: document.getElementById("exerciseTimingInput").value,
        notes: document.getElementById("exerciseNotesInput").value
      }
    : null;

  const tags = [];
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach((cb) => {
    if (cb.checked) tags.push(cb.value);
  });

  const scores = Object.values(functionality)
    .map((block) => block.score)
    .filter((value) => typeof value === "number");

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

function numberOrNull(val) {
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

async function loadHistory() {
  if (!currentUserId) return;

  const list = document.getElementById("historyList");
  list.innerHTML = "Loading...";

  try {
    const q = query(
      collection(db, "fibroDays"),
      where("userId", "==", currentUserId),
      orderBy("date", "desc"),
      limit(30)
    );

    const snap = await getDocs(q);
    list.innerHTML = "";

    if (snap.empty) {
      list.innerHTML = "<li>No entries yet.</li>";
      return;
    }

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const li = document.createElement("li");

      const title = d.dayTitle ? ` — ${d.dayTitle}` : "";
      const avg =
        d.avgFunctionality != null
          ? ` — Avg func: ${Number(d.avgFunctionality).toFixed(1)}`
          : "";

      li.textContent = `${d.date}${title}${avg}`;

      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        fillFormFromData(d);
        switchToTab("entry-tab");
      });

      li.appendChild(loadBtn);
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<li>Error loading history.</li>";
  }
}

function fillFormFromData(d) {
  document.getElementById("dateInput").value = d.date || "";
  document.getElementById("dayTitleInput").value = d.dayTitle || "";
  document.getElementById("overallNotesInput").value = d.overallNotes || "";

  const setBlock = (prefix, obj = {}) => {
    document.getElementById(`${prefix}Score`).value = obj.score ?? "";
    document.getElementById(`${prefix}Activity`).value = obj.activity || "";
    document.getElementById(`${prefix}Symptoms`).value = obj.symptoms || "";
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
  } else {
    document.getElementById("bedtimeInput").value = "";
    document.getElementById("wakeTimeInput").value = "";
    document.getElementById("hoursSleptInput").value = "";
    document.getElementById("sleepQualityInput").value = "";
    document.getElementById("awakeningsInput").value = "";
    document.getElementById("sleepNotesInput").value = "";
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
    document.getElementById("exerciseTypeInput").value = "";
    document.getElementById("exerciseMinutesInput").value = "";
    document.getElementById("exerciseIntensityInput").value = "";
    document.getElementById("exerciseTimingInput").value = "";
    document.getElementById("exerciseNotesInput").value = "";
  }

  document.getElementById("didExerciseInput").dispatchEvent(new Event("change"));

  const tagsSet = new Set(d.tags || []);
  document.querySelectorAll("#tagsContainer input[type=checkbox]").forEach((cb) => {
    cb.checked = tagsSet.has(cb.value);
  });
}

async function loadTrends() {
  if (!currentUserId) return;

  const canvas = document.getElementById("functionalityChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  try {
    const q = query(
      collection(db, "fibroDays"),
      where("userId", "==", currentUserId),
      orderBy("date", "asc")
    );

    const snap = await getDocs(q);
    const labels = [];
    const data = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.avgFunctionality != null) {
        labels.push(d.date);
        data.push(d.avgFunctionality);
      }
    });

    if (functionalityChart) {
      functionalityChart.destroy();
    }

    functionalityChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Average daily functionality",
            data,
            borderColor: "#3f51b5",
            backgroundColor: "rgba(63, 81, 181, 0.15)",
            tension: 0.2,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            suggestedMin: 0,
            suggestedMax: 10
          }
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
}

function switchToTab(tabId) {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.id === tabId);
  });
}