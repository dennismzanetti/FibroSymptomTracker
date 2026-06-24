// ================================================================
// JOURNAL — Chronological Notes Feed, Grouped by Date
// ================================================================

const TIME_BLOCKS = [
  { key: "earlyMorning",   label: "Early Morning",   time: "6–9 am",    short: "AM1" },
  { key: "lateMorning",    label: "Late Morning",    time: "9 am–12 pm", short: "AM2" },
  { key: "earlyAfternoon", label: "Early Afternoon", time: "12–3 pm",   short: "PM1" },
  { key: "lateAfternoon",  label: "Late Afternoon",  time: "3–6 pm",    short: "PM2" },
  { key: "earlyEvening",   label: "Early Evening",   time: "6–9 pm",    short: "EVE" },
  { key: "lateEvening",    label: "Late Evening",    time: "9 pm–12 am", short: "NGT" }
];

function scoreTier(s) {
  if (s === null || s === undefined) return 0;
  if (s <= 2) return 1;
  if (s <= 4) return 2;
  if (s <= 6) return 3;
  if (s <= 8) return 4;
  return 5;
}

const TIER_COLORS = {
  1: { bg: "#ffebee", border: "#ef9a9a", text: "#c62828" },
  2: { bg: "#fff3e0", border: "#ffcc80", text: "#e65100" },
  3: { bg: "#fff8e1", border: "#ffe082", text: "#f57f17" },
  4: { bg: "#e8f5e9", border: "#a5d6a7", text: "#2e7d32" },
  5: { bg: "#e0f2f1", border: "#80cbc4", text: "#00695c" }
};

function scorePillHtml(score) {
  if (score === null || score === undefined) return `<span class="jv3-dash">&mdash;</span>`;
  const t = scoreTier(score);
  const c = TIER_COLORS[t];
  return `<span class="jv3-score-pill" style="background:${c.bg};color:${c.text};border-color:${c.border};">${score}<span class="jv3-score-denom">/10</span></span>`;
}

// ================================================================
// COLLECT ALL NOTES FROM A DAY DOCUMENT
// Returns array of { source, label, text } objects
// ================================================================

function collectNotes(d) {
  const notes = [];

  // Functionality time-block notes
  TIME_BLOCKS.forEach(({ key, label }) => {
    const b = d.functionality?.[key] || {};
    if (b.symptoms && b.symptoms.trim()) {
      notes.push({ source: "functionality", label: `Functionality · ${label}`, text: b.symptoms.trim() });
    }
    if (b.activity && b.activity.trim()) {
      notes.push({ source: "functionality", label: `Activity · ${label}`, text: b.activity.trim() });
    }
  });

  // Sleep notes
  if (d.sleep?.notes && d.sleep.notes.trim()) {
    notes.push({ source: "sleep", label: "Sleep", text: d.sleep.notes.trim() });
  }

  // Exercise notes
  if (d.exercise?.notes && d.exercise.notes.trim()) {
    notes.push({ source: "exercise", label: "Exercise", text: d.exercise.notes.trim() });
  }

  // Mood notes
  if (d.mood?.notes && d.mood.notes.trim()) {
    notes.push({ source: "mood", label: "Mood", text: d.mood.notes.trim() });
  }

  // Overall / general notes
  if (d.overallNotes && d.overallNotes.trim()) {
    notes.push({ source: "general", label: "General", text: d.overallNotes.trim() });
  }

  // Day title as a note
  if (d.dayTitle && d.dayTitle.trim()) {
    notes.unshift({ source: "general", label: "Day Title", text: `"${d.dayTitle.trim()}"` });
  }

  return notes;
}

// ================================================================
// SOURCE BADGE HTML
// ================================================================

const SOURCE_BADGE = {
  functionality: "jv3-badge-func",
  sleep:         "jv3-badge-sleep",
  exercise:      "jv3-badge-exercise",
  mood:          "jv3-badge-mood",
  general:       "jv3-badge-general"
};

function noteBadgeHtml(source, label) {
  const cls = SOURCE_BADGE[source] || "jv3-badge-general";
  return `<span class="jv3-note-badge ${cls}">${label}</span>`;
}

// ================================================================
// STATS BANNER HTML
// ================================================================

function statsBannerHtml(d) {
  const scores = TIME_BLOCKS.map(({ key }) => {
    const s = d.functionality?.[key]?.score;
    return typeof s === "number" ? s : null;
  });
  const valid = scores.filter(s => s !== null);
  const avg = valid.length
    ? parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1))
    : null;

  const sl = d.sleep || {};

  const avgCell = `
    <div class="jv3-stat-cell">
      <span class="jv3-stat-label">Avg Function</span>
      <span class="jv3-stat-value">${avg !== null ? scorePillHtml(avg) : '<span class="jv3-dash">&mdash;</span>'}</span>
    </div>`;

  const sleepHrsCell = `
    <div class="jv3-stat-cell">
      <span class="jv3-stat-label">Sleep</span>
      <span class="jv3-stat-value">${sl.hours != null ? `${sl.hours}h` : '<span class="jv3-dash">&mdash;</span>'}</span>
    </div>`;

  let qualLabel = "&mdash;";
  let qualCls = "";
  if (sl.quality != null) {
    const t = scoreTier(sl.quality);
    if (t <= 2)      { qualLabel = "Poor";      qualCls = "jv3-qual-poor"; }
    else if (t <= 3) { qualLabel = "Fair";      qualCls = "jv3-qual-mid"; }
    else if (t <= 4) { qualLabel = "Good";      qualCls = "jv3-qual-good"; }
    else             { qualLabel = "Excellent"; qualCls = "jv3-qual-good"; }
  }

  const sleepQualCell = `
    <div class="jv3-stat-cell">
      <span class="jv3-stat-label">Sleep Quality</span>
      <span class="jv3-stat-value ${qualCls}">${qualLabel}</span>
    </div>`;

  return `<div class="jv3-stats-banner">${avgCell}${sleepHrsCell}${sleepQualCell}</div>`;
}

// ================================================================
// DAY CARD BUILDER
// ================================================================

function buildJournalCard(dateStr, d, activeFilter) {
  const date  = new Date(dateStr + "T12:00:00");
  const DOWS  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dow   = DOWS[date.getDay()];
  const dlbl  = `${MTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  const allNotes = collectNotes(d);
  const filteredNotes = activeFilter === "all"
    ? allNotes
    : allNotes.filter(n => n.source === activeFilter);

  const notesHtml = filteredNotes.length
    ? filteredNotes.map(n => `
        <div class="jv3-note-item">
          ${noteBadgeHtml(n.source, n.label)}
          <p class="jv3-note-text">${n.text}</p>
        </div>`).join("")
    : `<p class="jv3-no-notes">No notes recorded for this day.</p>`;

  return `
    <article class="jv3-day-card" data-journal-date="${dateStr}">
      <div class="jv3-date-label">
        <span class="jv3-dow">${dow}</span>
        <span class="jv3-date">${dlbl}</span>
      </div>
      ${statsBannerHtml(d)}
      <div class="jv3-notes-list">${notesHtml}</div>
    </article>`;
}

// ================================================================
// FILTER UI
// ================================================================

let _activeFilter = "all";

function injectJournalFilterUI() {
  const container = document.getElementById("journalOutput");
  if (!container || document.getElementById("jv3FilterBar")) return;

  const bar = document.createElement("div");
  bar.id = "jv3FilterBar";
  bar.className = "jv3-filter-bar";
  bar.innerHTML = `
    <div class="jv3-filter-chips" role="group" aria-label="Filter by section">
      <button class="jv3-chip active" data-filter="all">All</button>
      <button class="jv3-chip" data-filter="functionality">Functionality</button>
      <button class="jv3-chip" data-filter="sleep">Sleep</button>
      <button class="jv3-chip" data-filter="exercise">Exercise</button>
      <button class="jv3-chip" data-filter="mood">Mood</button>
      <button class="jv3-chip" data-filter="general">General</button>
    </div>
    <div class="jv3-filter-range">
      <label for="jv3RangeSelect" class="jv3-range-label">Show:</label>
      <select id="jv3RangeSelect" class="jv3-range-select">
        <option value="7">7 days</option>
        <option value="30" selected>30 days</option>
        <option value="90">90 days</option>
        <option value="0">All time</option>
      </select>
    </div>`;

  container.parentElement.insertBefore(bar, container);

  bar.querySelectorAll(".jv3-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      bar.querySelectorAll(".jv3-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _activeFilter = btn.dataset.filter;
      renderJournal();
    });
  });

  document.getElementById("jv3RangeSelect").addEventListener("change", renderJournal);
}

// ================================================================
// RANGE LABEL
// ================================================================

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const MTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function renderRangeLabel(docs) {
  const existing = document.getElementById("jv3-range-label");
  if (existing) existing.remove();
  if (!docs.length) return;

  const ids   = docs.map(d => d.id).sort();
  const from  = formatDateLabel(ids[0]);
  const to    = formatDateLabel(ids[ids.length - 1]);
  const count = docs.length;
  const noun  = count === 1 ? "entry" : "entries";

  const label = document.createElement("p");
  label.id = "jv3-range-label";
  label.className = "jv3-range-label";
  label.textContent = `Showing ${count} ${noun} · ${from} – ${to}`;

  const container = document.getElementById("journalOutput");
  if (container) container.parentElement.insertBefore(label, container);
}

// ================================================================
// MAIN RENDER
// ================================================================

async function renderJournal() {
  injectJournalFilterUI();
  const container = document.getElementById("journalOutput");
  if (!container) return;
  container.innerHTML = `<p class="jv3-loading">Loading journal entries&hellip;</p>`;

  try {
    const sel  = document.getElementById("jv3RangeSelect");
    const days = sel ? parseInt(sel.value, 10) : 30;

    let query = db.collection("days").orderBy("__name__", "desc");
    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      query = query.where(firebase.firestore.FieldPath.documentId(), ">=", cutoff.toISOString().slice(0,10));
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      renderRangeLabel([]);
      container.innerHTML = `<p class="jv3-loading" style="font-style:italic;">No journal entries found for the selected period.</p>`;
      return;
    }

    renderRangeLabel(snapshot.docs);
    container.innerHTML = snapshot.docs
      .map(doc => buildJournalCard(doc.id, doc.data(), _activeFilter))
      .join("");

  } catch (err) {
    console.error("renderJournal error:", err);
    container.innerHTML = `<p style="color:#c0392b;padding:1rem;">Failed to load journal entries.</p>`;
  }
}
