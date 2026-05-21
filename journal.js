function formatScore(value) { return typeof value === "number" ? value : "—"; }
function formatText(value, fallback = "Not recorded.") { return value && String(value).trim() ? value : fallback; }

async function renderJournal() {
  const container = document.getElementById("journalOutput");
  if (!container) return;
  const date = currentDateStr || document.getElementById("dateInput")?.value;
  if (!date) { container.innerHTML = "<p>No date selected.</p>"; return; }

  try {
    const doc = await db.collection("days").doc(date).get();
    if (!doc.exists) {
      container.innerHTML = `<div class="journal-no-entry"><p>No entry for ${getJournalDateLine(date)}.</p></div>`;
      return;
    }

    const d = doc.data();
    const dow = getJournalDayOfWeek(date);
    const dateLine = getJournalDateLine(date);

    // ---- Avg functionality score for header pill ----
    const TIME_BLOCKS = [
      { key: "earlyMorning",    label: "Early Morning (6–9am)" },
      { key: "lateMorning",     label: "Late Morning (9am–12pm)" },
      { key: "earlyAfternoon",  label: "Early Afternoon (12–3pm)" },
      { key: "lateAfternoon",   label: "Late Afternoon (3–6pm)" },
      { key: "earlyEvening",    label: "Early Evening (6–9pm)" },
      { key: "lateEvening",     label: "Late Evening (9pm–12am)" }
    ];

    const scores = TIME_BLOCKS
      .map(({ key }) => d.functionality?.[key]?.score)
      .filter(s => typeof s === "number");
    const avg = scores.length
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : null;

    // ---- Header ----
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

    // ---- Overall notes ----
    const overallHtml = d.overallNotes ? `
      <div class="journal-section">
        <h4>Overall Notes</h4>
        <p>${d.overallNotes}</p>
      </div>` : "";

    // ---- Functionality blocks ----
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

    // ---- Sleep ----
    let sleepHtml = "";
    if (d.sleep) {
      const s = d.sleep;
      sleepHtml = `
        <div class="journal-section">
          <h4>Sleep</h4>
          <div class="sleep-summary">
            ${s.bedtime   ? `<div class="sleep-stat"><span class="journal-label">Bedtime</span><strong>${s.bedtime}</strong></div>` : ""}
            ${s.wakeTime  ? `<div class="sleep-stat"><span class="journal-label">Wake Time</span><strong>${s.wakeTime}</strong></div>` : ""}
            ${s.hours != null ? `<div class="sleep-stat"><span class="journal-label">Hours</span><strong>${s.hours}</strong></div>` : ""}
            ${typeof s.quality === "number" ? `<div class="sleep-stat"><span class="journal-label">Quality</span><strong>${s.quality}/10</strong></div>` : ""}
            ${s.awakenings != null ? `<div class="sleep-stat"><span class="journal-label">Awakenings</span><strong>${s.awakenings}</strong></div>` : ""}
          </div>
          ${s.notes ? `<div class="sleep-notes"><span class="journal-label">Notes:</span> ${s.notes}</div>` : ""}
        </div>`;
    }

    // ---- Exercise ----
    let exerciseHtml = "";
    if (d.didExercise && d.exercise) {
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
    } else {
      exerciseHtml = `
        <div class="journal-section">
          <h4>Exercise</h4>
          <p style="color:#b0b8cc;font-style:italic;">No exercise recorded.</p>
        </div>`;
    }

    // ---- Mood ----
    let moodHtml = "";
    if (d.mood && (d.mood.score != null || d.mood.notes)) {
      moodHtml = `
        <div class="journal-section">
          <h4>Mood</h4>
          ${typeof d.mood.score === "number" ? `<p><span class="journal-label">Score:</span> ${d.mood.score}/10</p>` : ""}
          ${d.mood.notes ? `<p><span class="journal-label">Notes:</span> ${d.mood.notes}</p>` : ""}
        </div>`;
    }

    // ---- Tags ----
    const tagsHtml = d.tags?.length ? `
      <div class="journal-section">
        <h4>Tags</h4>
        <div class="journal-tags">
          ${d.tags.map(t => `<span class="journal-tag">${t}</span>`).join("")}
        </div>
      </div>` : "";

    // ---- Assemble ----
    container.innerHTML = `
      <div class="journal-entry">
        ${headerHtml}
        ${overallHtml}
        ${blocksHtml}
        ${sleepHtml}
        ${exerciseHtml}
        ${moodHtml}
        ${tagsHtml}
      </div>`;

  } catch (err) {
    console.error("renderJournal error:", err);
    container.innerHTML = "<p>Failed to load journal entry.</p>";
  }
}
