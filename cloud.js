// ---- In-memory day store (localStorage blocked in sandboxed iframes) ----
let _localDays = [];

function loadAllDays() {
  return _localDays.slice();
}
function saveAllDays(days) {
  _localDays = days.slice();
}
function numberOrNull(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function isEntryTabActive() {
  const tab = document.getElementById("entry-tab");
  return tab && tab.classList.contains("active");
}

function loadDayFromCloud(date) {
  const status = document.getElementById("saveStatus");
  if (!date) return;
  db.collection("days").doc(date).get().then((doc) => {
    if (doc.exists) {
      fillFormFromData(doc.data());
      if (status && isEntryTabActive()) status.textContent = "Loaded from cloud for " + date + ".";
    } else {
      clearFormFieldsExceptDate();
      if (status && isEntryTabActive()) status.textContent = "No cloud entry for that date. Form cleared.";
    }
  }).catch((error) => {
    console.error("Error getting document:", error);
    clearFormFieldsExceptDate();
    if (status && isEntryTabActive()) status.textContent = "Cloud load failed.";
  });
}
