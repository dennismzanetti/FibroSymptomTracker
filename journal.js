function formatScore(value) { return typeof value === "number" ? value : "not recorded"; }
function formatText(value, fallback = "Not recorded.") { return value && String(value).trim() ? value : fallback; }

async function renderJournal() {
  const container = document.getElementById("journalContainer");
  if (!container) return;
  const date = currentDateStr || document.getElementById("dateInput")?.value;
  if (!date) { container.innerHTML = "<p>No date selected.</p>"; return; }
  try {
    const doc = await db.collection("days").doc(date).get();
    if (!doc.exists) {
      container.innerHTML = `<div class='journal-no-entry'><p>No entry for ${getJournalDateLine(date)}.</p></div>`;
      return;
    }
    const d = doc.data();
    const dayOfWeek = getJournalDayOfWeek(date);
    const dateLine = getJournalDateLine(date);
    const TIME_BLOCKS = [
      { key: "earlyMorning", label: "Early Morning (6-9am)" },
      { key: "lateMorning", label: "Late Morning (9am-12pm)" },
      { key: "earlyAfternoon", label: "Early Afternoon (12-3pm)" },
      { key: "lateAfternoon", label: "Late Afternoon (3-6pm)" },
      { key: "earlyEvening", label: "Early Evening (6-9pm)" },
      { key: "lateEvening", label: "Late Evening (9pm-12am)" }
    ];
    const blocksHtml = TIME_BLOCKS.map(({ key, label }) => {
      const b = d.functionality?.[key] || {};
      return `<div class="journal-block"><div class="journal-block-header">${label}</div><div class="journal-block-body"><div class="journal-field"><span class="journal-field-label">Functionality Score:</span> ${formatScore(b.score)}/10</div><div class="journal-field"><span class="journal-field-label">Activity:</span> ${formatText(b.activity)}</div><div class="journal-field"><span class="journal-field-label">Symptoms:</span> ${formatText(b.symptoms)}</div></div></div>`;
    }).join("");
    const sleepHtml = d.sleep ? `<div class="journal-section"><div class="journal-section-title">Sleep</div><div class="journal-field"><span class="journal-field-label">Bedtime:</span> ${formatText(d.sleep.bedtime)}</div><div class="journal-field"><span class="journal-field-label">Wake Time:</span> ${formatText(d.sleep.wakeTime)}</div><div class="journal-field"><span class="journal-field-label">Hours Slept:</span> ${d.sleep.hours != null ? d.sleep.hours : "not recorded"}</div><div class="journal-field"><span class="journal-field-label">Quality:</span> ${formatScore(d.sleep.quality)}/10</div><div class="journal-field"><span class="journal-field-label">Awakenings:</span> ${d.sleep.awakenings != null ? d.sleep.awakenings : "not recorded"}</div><div class="journal-field"><span class="journal-field-label">Notes:</span> ${formatText(d.sleep.notes)}</div></div>` : "";
    const exerciseHtml = d.didExercise && d.exercise ? `<div class="journal-section"><div class="journal-section-title">Exercise</div><div class="journal-field"><span class="journal-field-label">Type:</span> ${formatText(d.exercise.type)}</div><div class="journal-field"><span class="journal-field-label">Duration:</span> ${d.exercise.minutes != null ? d.exercise.minutes + " min" : "not recorded"}</div><div class="journal-field"><span class="journal-field-label">Intensity:</span> ${formatText(d.exercise.intensity)}</div><div class="journal-field"><span class="journal-field-label">Timing:</span> ${formatText(d.exercise.timing)}</div><div class="journal-field"><span class="journal-field-label">Notes:</span> ${formatText(d.exercise.notes)}</div></div>` : `<div class="journal-section"><div class="journal-section-title">Exercise</div><p>No exercise recorded.</p></div>`;
    const moodHtml = (d.mood && (d.mood.score != null || d.mood.notes)) ? `<div class="journal-section"><div class="journal-section-title">Mood</div><div class="journal-field"><span class="journal-field-label">Mood Score:</span> ${formatScore(d.mood?.score)}/10</div><div class="journal-field"><span class="journal-field-label">Notes:</span> ${formatText(d.mood?.notes)}</div></div>` : "";
    const tagsHtml = d.tags?.length ? `<div class="journal-section"><div class="journal-section-title">Tags</div><div class="journal-tags">${d.tags.map(t => `<span class="journal-tag">${t}</span>`).join(" ")}</div></div>` : "";
    container.innerHTML = `<div class="journal-day-header"><div class="journal-day-of-week">${dayOfWeek}</div><div class="journal-date-line">${dateLine}</div>${d.dayTitle ? `<div class="journal-day-title">${d.dayTitle}</div>` : ""}</div>${d.overallNotes ? `<div class="journal-section"><div class="journal-section-title">Overall Notes</div><p>${d.overallNotes}</p></div>` : ""}<div class="journal-blocks-grid">${blocksHtml}</div>${sleepHtml}${exerciseHtml}${moodHtml}${tagsHtml}`;
  } catch (err) {
    console.error("renderJournal error:", err);
    container.innerHTML = "<p>Failed to load journal entry.</p>";
  }
}
