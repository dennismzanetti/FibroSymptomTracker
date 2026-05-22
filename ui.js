// ---- Tab switching ----
function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-button");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      switchToTab(targetTab);
    });
  });
}

function updateFloatBtn(tabId) {
  const floatBtn = document.getElementById("saveDayFloat");
  if (!floatBtn) return;
  floatBtn.style.display = tabId === "entry-tab" ? "block" : "none";
}

function switchToTab(tabId) {
  const tabBtns = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab");
  tabBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
  updateFloatBtn(tabId);
  requestAnimationFrame(() => {
    if (tabId === "journal-tab")     renderJournal();
    if (tabId === "history-tab")     refreshHistory();
    if (tabId === "trends-tab")      refreshTrends();
    if (tabId === "medications-tab") refreshMedView("medListView");
    if (tabId === "mood-tab")        refreshMoodTab();
    syncDateInput();
  });
}

// ---- App bootstrap ----
window.addEventListener("load", () => {
  setupTabs();
  setupExerciseToggle();
  setupSaveDay();
  setupDateNavigation();
  setupSleepCalculation();
  setupNumberSteppers();
  setupMedicationsTab();
  setupPrint();
  setupAtrForm();
  updateFloatBtn("entry-tab"); // show on initial load (entry tab is default)

  const dateInput = document.getElementById("dateInput");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const v = dateInput.value;
      if (v && v !== currentDateStr) {
        currentDateStr = v;
        updateDayOfWeek();
        loadDayFromCloud(currentDateStr);
      }
    });
  }

  refreshHistory();
  refreshTrends();
});
