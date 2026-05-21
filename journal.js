// ---- Journal helpers ----

const TIME_BLOCKS = [
  { key: "earlyMorning",   label: "Early Morning (6\u20139am)" },
  { key: "lateMorning",    label: "Late Morning (9am\u201312pm)" },
  { key: "earlyAfternoon", label: "Early Afternoon (12\u20133pm)" },
  { key: "lateAfternoon",  label: "Late Afternoon (3\u20136pm)" },
  { key: "earlyEvening",   label: "Early Evening (6\u20139pm)" },
  { key: "lateEvening",    label: "Late Evening (9pm\u201312am)" }
];

function buildJournalEntryHtml(dateStr, d) {
  const dow      = getJournalDayOfWeek(dateStr);
  const dateLine = getJournalDateLine(dateStr);

  // Avg functionality score
  const scores = TIME_BLOCKS
    .map(({ key }) => d.functionality?.[key]?.score)
    .filter(s => typeof s === "number");
  const avg = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : null;

  // Header
  const headerHtml = `
    <div class="journal-day-header">
      <div class="journal-header-left">
        <div class="journal-header-dateline">
          <span class="journal-dow">${dow}</span>
          <span class="journal-date">${dateLine}</span>
        </div>
        ${d.dayTitle ? `<span class="journal-title">${d.dayTitle}</span>` : ""}
      </div>
      ${avg !== null ? `
        <div class="journal-score-pill">
          <span class="journal-score-label">Avg</span>
          <strong>${avg}/10</strong>
        </div>` : ""}
    </div>`;

  // Overall notes
  const overallHtml = d.overallNotes ? `
    <div class="journal-section">
      <h4>Overall Notes</h4>
      <p>${d.overallNotes}</p>
    </div>` : "";

  // Functionality blocks
  const blocksHtml = `
    <div class="journal-section">
      <h4>Functionality by Time of Day</h4>
      <div class="function-grid">
        ${TIME_BLOCKS.map(({ key, label }) => {
          const b = d.functionality?.[key] || {};
          return `
            <div class="function-card">
              <div class="function-card-head">
                <span>${label}</span>
                ${typeof b.score === "number" ? `<strong>${b.score}/10</strong>` : ""}
              </div>
              ${b.activity  ? `<p><span class="journal-label">Activity:</span> ${b.activity}</p>`  : ""}
              ${b.symptoms  ? `<p><span class="journal-label">Symptoms:</span> ${b.symptoms}</p>`  : ""}
              ${!b.activity && !b.symptoms ? `<p style="color:#b0b8cc;font-style:italic;font-size:0.88rem;">No data recorded.</p>` : ""}
            </div>`;
        }).join("")}
      </div>
    </div>`;

  // Sleep
  let sleepHtml = "";
  if (d.sleep) {
    const s = d.sleep;
    const stats = [
      s.bedtime   ? `<div class="sleep-stat"><span class="journal-label">Bedtime</span><strong>${s.bedtime}</strong></div>` : "",
      s.wakeTime  ? `<div class="sleep-stat"><span class="journal-label">Wake Time</span><strong>${s.wakeTime}</strong></div>` : "",
      s.hours != null ? `<div class="sleep-stat"><span class="journal-label">Hours</span><strong>${s.hours}</strong></div>` : "",
      typeof s.quality === "number" ? `<div class="sleep-stat"><span class="journal-label">Quality</span><strong>${s.quality}/10</strong></div>` : "",
      s.awakenings != null ? `<div class="sleep-stat"><span class="journal-label">Awakenings</span><strong>${s.awakenings}</strong></div>` : ""
    ].filter(Boolean).join("");

    if (stats) {
      sleepHtml = `
        <div class="journal-section">
          <h4>Sleep</h4>
          <div class="sleep-summary">${stats}</div>
          ${s.notes ? `<div class="sleep-notes"><span class="journal-label">Notes:</span> ${s.notes}</div>` : ""}
        </div>`;
    }
  }

  // Exercise
  let exerciseHtml = "";
  if (d.didExercise === "yes" && d.exercise) {
    const e = d.exercise;
    exerciseHtml = `
      <div class="journal-section">
        <h4>Exercise</h4>
        ${e.type      ? `<p><span class="journal-label">Type:</span> ${e.type}</p>` : ""}
        ${e.minutes != null ? `<p><span class="journal-label">Duration:</span> ${e.minutes} min</p>` : ""}
        ${e.intensity ? `<p><span class="journal-label">Intensity:</span> ${e.intensity}</p>` : ""}
        ${e.timing    ? `<p><span class="journal-label">Timing:</span> ${e.timing}</p>` : ""}
        ${e.notes     ? `<p><span class="journal-label">Notes:</span> ${e.notes}</p>` : ""}
      </div>`;
  }

  // Mood
  let moodHtml = "";
  if (d.mood && (d.mood.score != null || d.mood.notes)) {
    moodHtml = `
      <div class="journal-section">
        <h4>Mood</h4>
        ${typeof d.mood.score === "number" ? `<p><span class="journal-label">Score:</span> ${d.mood.score}/10</p>` : ""}
        ${d.mood.notes ? `<p><span class="journal-label">Notes:</span> ${d.mood.notes}</p>` : ""}
      </div>`;
  }

  // Tags
  const tagsHtml = d.tags?.length ? `
    <div class="journal-section">
      <h4>Tags</h4>
      <div class="journal-tags">
        ${d.tags.map(t => `<span class="journal-tag">${t}</span>`).join("")}
      </div>
    </div>` : "";

  return `
    <div class="journal-entry">
      ${headerHtml}
      ${overallHtml}
      ${blocksHtml}
      ${sleepHtml}
      ${exerciseHtml}
      ${moodHtml}
      ${tagsHtml}
    </div>`;
}

// ---- Filter UI ----

function getFilterDays() {
  const sel = document.getElementById("journalRangeSelect");
  return sel ? parseInt(sel.value, 10) : 30;
}

function injectJournalFilterUI() {
  const container = document.getElementById("journalOutput");
  if (!container || document.getElementById("journalRangeSelect")) return;

  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;";
  wrap.innerHTML = `
    <label for="journalRangeSelect" style="font-weight:700;font-size:0.9rem;color:#5b6686;white-space:nowrap;">Show last:</label>
    <select id="journalRangeSelect" style="width:auto;margin-top:0;">
      <option value="7">7 days</option>
      <option value="30" selected>30 days</option>
      <option value="90">90 days</option>
      <option value="0">All time</option>
    </select>`;
  container.parentElement.insertBefore(wrap, container);

  document.getElementById("journalRangeSelect").addEventListener("change", renderJournal);
}

// ---- Main render ----

async function renderJournal() {
  injectJournalFilterUI();

  const container = document.getElementById("journalOutput");
  if (!container) return;

  container.innerHTML = `<p style="color:#8891ab;">Loading journal entries&hellip;</p>`;

  try {
    const days = getFilterDays();
    let query = db.collection("days").orderBy("__name__", "desc");

    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD
      query = query.where(firebase.firestore.FieldPath.documentId(), ">=", cutoffStr);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="journal-muted">No journal entries found for the selected period.</p>`;
      return;
    }

    const html = snapshot.docs.map(doc => buildJournalEntryHtml(doc.id, doc.data())).join("");
    container.innerHTML = html;

  } catch (err) {
    console.error("renderJournal error:", err);
    container.innerHTML = `<p style="color:#c0392b;">Failed to load journal entries. Check console for details.</p>`;
  }
}
