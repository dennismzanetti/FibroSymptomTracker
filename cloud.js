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
  if (!date) return;
  db.collection("days").doc(date).get().then((doc) => {
    if (doc.exists) {
      fillFormFromData(doc.data());
      if (isEntryTabActive()) showToast("Loaded from cloud \u2713");
    } else {
      clearFormFieldsExceptDate();
      if (isEntryTabActive()) showToast("No entry for that date \u2014 form cleared.");
    }
  }).catch((error) => {
    console.error("Error getting document:", error);
    clearFormFieldsExceptDate();
    if (isEntryTabActive()) showToast("Cloud load failed.");
  });
}
