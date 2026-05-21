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
