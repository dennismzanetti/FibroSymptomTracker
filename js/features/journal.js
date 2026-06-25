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

// ================================================================
// QUICK TAG META — mirrors the daily entry quick-tag definitions
// ================================================================

const TAG_META = {
  flare:          { icon: '\u{1F525}', label: 'Flare',                  cls: 'tag-flare' },
  crash:          { icon: '\u26A1',    label: 'Crash / post-exertional', cls: 'tag-crash' },
  better:         { icon: '\u2728',    label: 'Better than usual',       cls: 'tag-better' },
  poor_sleep:     { icon: '\u{1F319}', label: 'Poor sleep',              cls: 'tag-poor-sleep' },
  high_stress:    { icon: '\u{1F4A2}', label: 'High stress',             cls: 'tag-stress' },
  weather_change: { icon: '\u{1F327}\uFE0F', label: 'Weather change',  cls: 'tag-weather' }
};

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
// QUICK TAGS — returns array of pill HTML strings (no wrapper div)
// ================================================================

function tagPillsHtml(d) {
  const tags = Array.isArray(d.tags) ? d.tags.filter(t => t && String(t).trim()) : [];
  if (!tags.length) return '';

  return tags.map(tag => {
    const meta = TAG_META[tag];
    if (meta) {
      return `<span class="tag-pill ${meta.cls} jv3-tag-readonly" aria-label="${meta.label}">`
           + `<span class="tag-pill-icon" aria-hidden="true">${meta.icon}</span>`
           + `<span class="tag-pill-label">${meta.label}</span>`
           + `</span>`;
    }
    return `<span class="tag-pill jv3-tag-readonly">`
         + `<span class="tag-pill-label">${tag}</span>`
         + `</span>`;
  }).join('');
}

// ================================================================
// COLLECT ALL NOTES FROM A DAY DOCUMENT
// ================================================================

function collectNotes(d) {
  const notes = [];

  if (d.dayTitle && d.dayTitle.trim()) {
    notes.unshift({ source: "general", label: "Day Title", text: `"${d.dayTitle.trim()}"`, score: null });
  }

  TIME_BLOCKS.forEach(({ key, label }) => {
    const b = d.functionality?.[key] || {};
    const blockScore = typeof b.score === "number" ? b.score : null;
    if (b.symptoms && b.symptoms.trim()) {
      notes.push({ source: "functionality", label: `Symptoms · ${label}`, text: b.symptoms.trim(), score: blockScore });
    }
    if (b.activity && b.activity.trim()) {
      notes.push({ source: "functionality", label: `Activity · ${label}`, text: b.activity.trim(), score: blockScore });
    }
  });

  if (d.sleep?.notes && d.sleep.notes.trim()) {
    const sleepScore = typeof d.sleep?.quality === "number" ? d.sleep.quality : null;
    notes.push({ source: "sleep", label: "Sleep", text: d.sleep.notes.trim(), score: sleepScore });
  }

  if (d.exercise?.notes && d.exercise.notes.trim()) {
    const exScore = typeof d.exercise?.score === "number" ? d.exercise.score : null;
    notes.push({ source: "exercise", label: "Exercise", text: d.exercise.notes.trim(), score: exScore });
  }

  if (d.mood?.notes && d.mood.notes.trim()) {
    const moodScore = typeof d.mood?.score === "number" ? d.mood.score : null;
    notes.push({ source: "mood", label: "Mood", text: d.mood.notes.trim(), score: moodScore });
  }

  if (d.overallNotes && d.overallNotes.trim()) {
    notes.push({ source: "general", label: "General", text: d.overallNotes.trim(), score: null });
  }

  return notes;
}

// ================================================================
// SOURCE LABEL COLOR CLASS
// ================================================================

const SOURCE_LABEL_CLASS = {
  functionality: "jv3-lbl-func",
  sleep:         "jv3-lbl-sleep",
  exercise:      "jv3-lbl-exercise",
  mood:          "jv3-lbl-mood",
  general:       "jv3-lbl-general"
};

// ================================================================
// MINI CHART HELPERS
// ================================================================

function sevenDayWindow(dateStr) {
  const dates = [];
  const base = new Date(dateStr + "T12:00:00");
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function shortDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
}

function chartCellHtml({ id, canvasCls, label, badge = '', ariaLabel, isLast = false }) {
  const extraCls = isLast ? ' jv3-stat-cell--last' : '';
  return `
    <div class="jv3-stat-cell jv3-stat-cell--chart${extraCls}">
      <span class="jv3-stat-label">${label}${badge ? `<span class="jv3-stat-badge">${badge}</span>` : ''}</span>
      <div class="jv3-mini-chart-wrap">
        <canvas id="${id}" class="${canvasCls}" aria-label="${ariaLabel}"></canvas>
      </div>
    </div>`;
}

// ================================================================
// RENDER ALL SPARKLINES
// ================================================================

function renderMiniCharts(allDocsMap) {

  // ── Functionality sparklines ───────────────────────────────────
  document.querySelectorAll('.jv3-func-chart-canvas').forEach(canvas => {
    const dateStr = canvas.id.replace('jv3-func-chart-', '');
    const dates   = sevenDayWindow(dateStr);
    const labels  = dates.map(shortDay);
    const data    = dates.map(d => {
      const doc = allDocsMap[d];
      if (!doc) return null;
      const scores = TIME_BLOCKS.map(({ key }) => {
        const s = doc.functionality?.[key]?.score;
        return typeof s === 'number' ? s : null;
      }).filter(s => s !== null);
      if (!scores.length) return null;
      return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
    });

    if (data.every(v => v === null)) return;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const colPrimary = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary').trim() || '#01696f';

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: colPrimary,
          backgroundColor: colPrimary + '26',
          borderWidth: 1.5,
          tension: 0.3,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          fill: true,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => ctx[0].label,
              label: ctx => ctx.parsed.y !== null ? `Func: ${ctx.parsed.y.toFixed(1)}/10` : 'No data'
            }
          }
        },
        scales: {
          y: { display: false, suggestedMin: 0, suggestedMax: 10 },
          x: {
            ticks: { font: { size: 9 }, color: '#999', maxRotation: 0 },
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    });
  });

  // ── Sleep sparklines ───────────────────────────────────────────
  document.querySelectorAll('.jv3-sleep-chart-canvas').forEach(canvas => {
    const dateStr  = canvas.id.replace('jv3-sleep-chart-', '');
    const dates    = sevenDayWindow(dateStr);
    const labels   = dates.map(shortDay);

    const hoursData = dates.map(d => {
      const doc = allDocsMap[d];
      if (!doc) return null;
      return typeof doc.sleep?.hours === 'number' ? doc.sleep.hours : null;
    });

    if (hoursData.every(v => v === null)) return;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const colBlue = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-blue').trim() || '#006494';

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Sleep Hours',
          data: hoursData,
          borderColor: colBlue,
          backgroundColor: colBlue + '22',
          borderWidth: 1.5,
          tension: 0.3,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          fill: true,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => ctx[0].label,
              label: ctx => {
                if (ctx.parsed.y === null) return 'No data';
                const d   = dates[ctx.dataIndex];
                const doc = allDocsMap[d];
                const q   = doc?.sleep?.quality;
                const qs  = q != null ? ` · Quality: ${q}/10` : '';
                return `Sleep: ${ctx.parsed.y.toFixed(1)}h${qs}`;
              }
            }
          }
        },
        scales: {
          y: { display: false, suggestedMin: 0, suggestedMax: 12 },
          x: {
            ticks: { font: { size: 9 }, color: '#999', maxRotation: 0 },
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    });
  });
}

// ================================================================
// STATS BANNER HTML — 2 uniform chart cells
// ================================================================

function statsBannerHtml(d, dateStr) {
  const scores = TIME_BLOCKS.map(({ key }) => {
    const s = d.functionality?.[key]?.score;
    return typeof s === "number" ? s : null;
  });
  const valid = scores.filter(s => s !== null);
  const avg = valid.length
    ? parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1))
    : null;

  const avgBadge = avg !== null ? scorePillHtml(avg) : '<span class="jv3-dash">&mdash;</span>';

  const sl = d.sleep || {};
  const hoursVal = sl.hours  != null ? sl.hours  : null;
  const qualVal  = sl.quality != null ? sl.quality : null;
  let qualLabel = '', qualCls = '';
  if (qualVal != null) {
    const t = scoreTier(qualVal);
    if      (t <= 2) { qualLabel = 'Poor';      qualCls = 'jv3-qual-poor'; }
    else if (t <= 3) { qualLabel = 'Fair';      qualCls = 'jv3-qual-mid';  }
    else if (t <= 4) { qualLabel = 'Good';      qualCls = 'jv3-qual-good'; }
    else             { qualLabel = 'Excellent'; qualCls = 'jv3-qual-good'; }
  }
  const sleepBadge = (hoursVal != null || qualLabel)
    ? (hoursVal != null ? `${hoursVal}h` : '')
      + (hoursVal != null && qualLabel ? ` &middot; ` : '')
      + (qualLabel ? `<span class="${qualCls}">${qualLabel}</span>` : '')
    : '';

  const funcCell  = chartCellHtml({
    id: `jv3-func-chart-${dateStr}`,
    canvasCls: 'jv3-func-chart-canvas',
    label: 'Avg Functionality',
    badge: avgBadge,
    ariaLabel: '7-day functionality trend'
  });

  const sleepCell = chartCellHtml({
    id: `jv3-sleep-chart-${dateStr}`,
    canvasCls: 'jv3-sleep-chart-canvas',
    label: '7-Day Sleep',
    badge: sleepBadge,
    ariaLabel: '7-day sleep trend',
    isLast: true
  });

  return `<div class="jv3-stats-banner">${funcCell}${sleepCell}</div>`;
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

  let notesHtml;
  if (filteredNotes.length) {
    const rows = filteredNotes.map(n => {
      const cls = SOURCE_LABEL_CLASS[n.source] || "jv3-lbl-general";
      return `<tr>
        <td class="jv3-tbl-score">${scorePillHtml(n.score)}</td>
        <td class="jv3-tbl-label"><span class="jv3-note-label ${cls}">${n.label}</span></td>
        <td class="jv3-tbl-note">${n.text}</td>
      </tr>`;
    }).join("");
    notesHtml = `<table class="jv3-notes-table"><tbody>${rows}</tbody></table>`;
  } else {
    notesHtml = `<p class="jv3-no-notes">No notes recorded for this day.</p>`;
  }

  // Tags HTML — empty string when no tags
  const tagPills = tagPillsHtml(d);
  const tagsHtml = tagPills
    ? `<div class="jv3-header-tags">${tagPills}</div>`
    : '';

  return `
    <article class="jv3-day-card" data-journal-date="${dateStr}">
      <div class="jv3-card-header">
        <div class="jv3-date-block">
          <span class="jv3-dow">${dow}</span>
          <span class="jv3-date">${dlbl}</span>
        </div>${tagsHtml}
      </div>
      ${statsBannerHtml(d, dateStr)}
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

    const allDocsMap = {};
    snapshot.docs.forEach(doc => { allDocsMap[doc.id] = doc.data(); });

    try {
      const sortedIds = snapshot.docs.map(d => d.id).sort();
      const earliest  = sortedIds[0];
      const lookback  = new Date(earliest + "T12:00:00");
      lookback.setDate(lookback.getDate() - 6);
      const lookbackStr = lookback.toISOString().slice(0, 10);

      const priorSnap = await db.collection("days")
        .where(firebase.firestore.FieldPath.documentId(), ">=", lookbackStr)
        .where(firebase.firestore.FieldPath.documentId(), "<", earliest)
        .get();
      priorSnap.forEach(doc => { allDocsMap[doc.id] = doc.data(); });
    } catch (_) { /* non-critical */ }

    renderRangeLabel(snapshot.docs);
    container.innerHTML = snapshot.docs
      .map(doc => buildJournalCard(doc.id, doc.data(), _activeFilter))
      .join("");

    renderMiniCharts(allDocsMap);

  } catch (err) {
    console.error("renderJournal error:", err);
    container.innerHTML = `<p style="color:#c0392b;padding:1rem;">Failed to load journal entries.</p>`;
  }
}
