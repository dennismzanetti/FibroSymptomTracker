// ---- Module-level current date ----
let currentDateStr = "";

function todayStr() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function syncDateInput() {
  requestAnimationFrame(() => {
    const dateInput = document.getElementById("dateInput");
    if (dateInput) dateInput.value = currentDateStr;
    updateDayOfWeek();
  });
}

function updateDayOfWeek() {
  const dateInput = document.getElementById("dateInput");
  const display = document.getElementById("dayOfWeekDisplay");
  if (!display) return;
  const val = currentDateStr || (dateInput && dateInput.value) || "";
  if (!val) { display.textContent = ""; return; }
  const [year, month, day] = val.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) { display.textContent = ""; return; }
  display.textContent = date.toLocaleDateString(undefined, { weekday: "long" });
}

function loadTodayDate() {
  currentDateStr = todayStr();
  syncDateInput();
}

function changeDateBy(days) {
  if (!currentDateStr) currentDateStr = todayStr();
  const [y, mo, dy] = currentDateStr.split("-").map(Number);
  const current = new Date(y, mo - 1, dy);
  if (isNaN(current.getTime())) return;
  current.setDate(current.getDate() + days);
  const ny = current.getFullYear();
  const nm = String(current.getMonth() + 1).padStart(2, "0");
  const nd = String(current.getDate()).padStart(2, "0");
  currentDateStr = `${ny}-${nm}-${nd}`;
  syncDateInput();
  loadDayFromCloud(currentDateStr);
}

function setupDateNavigation() {
  const prevDayBtn = document.getElementById("prevDayBtn");
  const nextDayBtn = document.getElementById("nextDayBtn");
  prevDayBtn?.addEventListener("click", () => changeDateBy(-1));
  nextDayBtn?.addEventListener("click", () => changeDateBy(1));
}

function getJournalDayOfWeek(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function getJournalDateLine(dateStr) {
  if (!dateStr) return "No date recorded";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
