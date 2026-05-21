// ---- Tab switching ----
function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      switchToTab(targetTab);
    });
  });
}

function switchToTab(tabId) {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  tabBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
  requestAnimationFrame(() => {
    if (tabId === "journalTab") renderJournal();
    if (tabId === "historyTab") refreshHistory();
    if (tabId === "trendsTab") refreshTrends();
    if (tabId === "medicationsTab") refreshMedView("medListView");
    if (tabId === "moodTab") refreshMoodTab();
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
