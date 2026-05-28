// ================================================================
// JOURNAL — Daily Cards with Collapsible Sections
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

function tierBarColor(avg) {
  if (avg === null) return "#e3e6f0";
  const t = scoreTier(avg);
  return TIER_COLORS[t]?.border || "#e3e6f0";
}

function scorePillHtml(score) {
  if (score === null || score === undefined) return `<span class="jv2-dash">&mdash;</span>`;
  const t = scoreTier(score);
  const c = TIER_COLORS[t];
  return `<span class="jv2-score-pill" style="background:${c.bg};color:${c.text};border-color:${c.border};">${score}<span class="jv2-score-denom">/10</span></span>`;
}

function statChipHtml(icon, label, value, colorStyle) {
  return `<div class="jv2-stat-chip" style="${colorStyle || ''}">
    <span class="jv2-stat-icon">${icon}</span>
    <div class="jv2-stat-body">
      <span class="jv2-stat-label">${label}</span>
      <span class="jv2-stat-value">${value}</span>
    </div>
  </div>`;
}

// ================================================================
// 90-DAY HEATMAP
// ================================================================

async function renderHeatmap(allDocs) {
  const wrap = document.getElementById("journalHeatmap");
  if (!wrap) return;

  const byDate = {};
  allDocs.forEach(doc => {
    const d = doc.data();
    const scores = TIME_BLOCKS
      .map(({ key }) => d.functionality?.[key]?.score)
      .filter(s => typeof s === "number");
    byDate[doc.id] = scores.length
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : null;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const DOW    = ["S","M","T","W","T","F","S"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const firstDate = new Date(days[0] + "T12:00:00");
  const startDow  = firstDate.getDay();
  const cells = [];
  for (let p = 0; p < startDow; p++) cells.push(null);
  days.forEach(d => cells.push(d));

  const numCols = Math.ceil(cells.length / 7);

  let prevMonth = -1;
  const monthRow = [];
  for (let col = 0; col < numCols; col++) {
    const cell = cells[col*7] || cells[col*7+1] || cells[col*7+2] || cells[col*7+3];
    if (cell) {
      const m = new Date(cell + "T12:00:00").getMonth();
      monthRow.push(m !== prevMonth ? MONTHS[m] : "");
      prevMonth = m;
    } else {
      monthRow.push("");
    }
  }

  const CELL = 14, GAP = 3;

  const monthLabels = `<div style="display:flex;gap:${GAP}px;">${
    monthRow.map(m => `<div style="width:${CELL}px;font-size:0.6rem;font-weight:700;color:#9e9e9e;text-align:center;white-space:nowrap;">${m}</div>`).join("")
  }</div>`;

  let colsHtml = "";
  for (let col = 0; col < numCols; col++) {
    let colCells = "";
    for (let row = 0; row < 7; row++) {
      const dateStr = cells[col * 7 + row];
      if (!dateStr) {
        colCells += `<div style="width:${CELL}px;height:${CELL}px;border-radius:3px;background:transparent;"></div>`;
        continue;
      }
      const avg = byDate[dateStr] ?? null;
      const t   = avg !== null ? scoreTier(avg) : 0;
      const c   = t ? TIER_COLORS[t] : null;
      const bg  = c ? c.bg : "#f0f2fa";
      const bdr = c ? c.border : "#e3e6f0";
      const tip = avg !== null ? `${dateStr}: ${avg.toFixed(1)}/10` : `${dateStr}: no data`;
      colCells += `<div style="width:${CELL}px;height:${CELL}px;border-radius:3px;border:1px solid ${bdr};background:${bg};cursor:pointer;transition:transform 0.1s,box-shadow 0.1s;" title="${tip}" data-hm-date="${dateStr}"></div>`;
    }
    colsHtml += `<div style="display:flex;flex-direction:column;gap:${GAP}px;">${colCells}</div>`;
  }

  const legend = [1,2,3,4,5].map(t =>
    `<div style="width:14px;height:14px;border-radius:3px;border:1px solid ${TIER_COLORS[t].border};background:${TIER_COLORS[t].bg};flex-shrink:0;"></div>`
  ).join("");

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
      <span style="font-size:0.72rem;font-weight:600;color:#9e9e9e;">Low</span>
      ${legend}
      <span style="font-size:0.72rem;font-weight:600;color:#9e9e9e;">High</span>
      <span style="font-size:0.7rem;color:#b0b8cc;margin-left:auto;">Pale = no data &nbsp;&middot;&nbsp; Click cell to jump</span>
    </div>
    <div style="display:flex;gap:${GAP}px;overflow-x:auto;padding-bottom:4px;">
      <div style="display:flex;flex-direction:column;gap:${GAP}px;padding-top:${CELL+GAP+2}px;">
        ${DOW.map(d => `<div style="width:${CELL}px;height:${CELL}px;font-size:0.62rem;font-weight:700;color:#b0b8cc;display:flex;align-items:center;justify-content:center;">${d}</div>`).join("")}
      </div>
      <div style="display:flex;flex-direction:column;gap:${GAP}px;">
        ${monthLabels}
        <div style="display:flex;gap:${GAP}px;">${colsHtml}</div>
      </div>
    </div>`;

  wrap.querySelectorAll("[data-hm-date]").forEach(cell => {
    cell.addEventListener("mouseenter", () => { cell.style.transform = "scale(1.4)"; cell.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)"; cell.style.zIndex = "1"; });
    cell.addEventListener("mouseleave", () => { cell.style.transform = ""; cell.style.boxShadow = ""; cell.style.zIndex = ""; });
    cell.addEventListener("click", () => {
      const target = document.querySelector(`[data-journal-date="${cell.dataset.hmDate}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ================================================================
// SECTION ACCORDION TOGGLE
// ================================================================

function toggleJournalSection(btn) {
  const section = btn.closest(".jv2-section");
  if (!section) return;
  const body  = section.querySelector(".jv2-section-body");
  const icon  = section.querySelector(".jv2-section-chevron");
  if (!body) return;
  const isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
  if (icon) icon.style.transform = isOpen ? "" : "rotate(90deg)";
  btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
}

// Keep legacy compat
function toggleJournalRow(expandId) {
  const panel = document.getElementById(expandId);
  const chev  = document.getElementById(expandId + "-chev");
  if (!panel) return;
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
  if (chev) chev.style.transform = isOpen ? "" : "rotate(90deg)";
}

// ================================================================
// SECTION BUILDER HELPER
// ================================================================

function buildSection(title, bodyHtml, defaultOpen) {
  const display = defaultOpen ? "block" : "none";
  const chevRot = defaultOpen ? "rotate(90deg)" : "";
  return `
    <div class="jv2-section">
      <button class="jv2-section-header" onclick="toggleJournalSection(this)" aria-expanded="${defaultOpen ? 'true' : 'false'}">
        <span class="jv2-section-title">${title}</span>
        <svg class="jv2-section-chevron" style="transform:${chevRot};" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div class="jv2-section-body" style="display:${display};">${bodyHtml}</div>
    </div>`;
}

// ================================================================
// CARD BUILDER
// ================================================================

function buildJournalCard(dateStr, d) {
  // ---- Scores & stats ----
  const scores = TIME_BLOCKS.map(({ key }) => {
    const s = d.functionality?.[key]?.score;
    return typeof s === "number" ? s : null;
  });
  const valid = scores.filter(s => s !== null);
  const avg   = valid.length
    ? parseFloat((valid.reduce((a,b)=>a+b,0)/valid.length).toFixed(1))
    : null;

  const date  = new Date(dateStr + "T12:00:00");
  const DOWS  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dow   = DOWS[date.getDay()];
  const dlbl  = `${MTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  const barColor = tierBarColor(avg);

  const title = d.dayTitle?.trim() || "";

  // ---- Stat chips (always visible in header) ----
  const avgFuncChip = avg !== null
    ? statChipHtml("⚡", "Avg Function", scorePillHtml(avg), "")
    : "";

  const sleepChip = typeof d.sleep?.hours === "number"
    ? statChipHtml("😴", "Sleep", `${d.sleep.hours}h`, "")
    : "";

  const moodChip = typeof d.mood?.score === "number"
    ? statChipHtml("😌", "Mood", scorePillHtml(d.mood.score), "")
    : "";

  // ---- Tags ----
  const tagsHtml = d.tags?.length
    ? `<div class="jv2-tags">${d.tags.map(t => `<span class="jv2-tag">${t}</span>`).join("")}</div>`
    : "";

  // ============================================================
  // SECTION: Functionality
  // ============================================================
  const hasFuncData = scores.some(s => s !== null);
  let funcBody = "";
  if (hasFuncData) {
    funcBody = `<div class="jv2-func-grid">${TIME_BLOCKS.map(({ key, label, time }, i) => {
      const b = d.functionality?.[key] || {};
      const s = scores[i];
      const t = s !== null ? scoreTier(s) : 0;
      const c = t ? TIER_COLORS[t] : null;
      const cardStyle = c ? `border-color:${c.border};background:${c.bg};` : "";
      return `<div class="jv2-func-card" style="${cardStyle}">
        <div class="jv2-func-card-head">
          <div class="jv2-func-card-label">
            <span class="jv2-func-name">${label}</span>
            <span class="jv2-func-time">${time}</span>
          </div>
          <div>${s !== null ? scorePillHtml(s) : `<span class="jv2-dash">&mdash;</span>`}</div>
        </div>
        ${b.activity ? `<div class="jv2-func-detail"><span class="jv2-detail-label">Activity</span>${b.activity}</div>` : ""}
        ${b.symptoms ? `<div class="jv2-func-detail"><span class="jv2-detail-label">Symptoms</span>${b.symptoms}</div>` : ""}
      </div>`;
    }).join("")}</div>`;
  } else {
    funcBody = `<p class="jv2-empty">No functionality data recorded.</p>`;
  }
  const funcSection = buildSection("Functionality Through the Day", funcBody, false);

  // ============================================================
  // SECTION: Sleep
  // ============================================================
  const s = d.sleep || {};
  const hasSleep = s.bedtime || s.wakeTime || s.hours != null || s.quality != null || s.awakenings != null || s.notes;
  let sleepBody;
  if (hasSleep) {
    const sleepStats = [
      s.bedtime    ? `<div class="jv2-sleep-stat"><span class="jv2-detail-label">Bedtime</span><strong>${s.bedtime}</strong></div>` : "",
      s.wakeTime   ? `<div class="jv2-sleep-stat"><span class="jv2-detail-label">Wake</span><strong>${s.wakeTime}</strong></div>` : "",
      s.hours!=null? `<div class="jv2-sleep-stat"><span class="jv2-detail-label">Hours</span><strong>${s.hours}h</strong></div>` : "",
      s.quality!=null?`<div class="jv2-sleep-stat"><span class="jv2-detail-label">Quality</span><strong>${scorePillHtml(s.quality)}</strong></div>` : "",
      s.awakenings!=null?`<div class="jv2-sleep-stat"><span class="jv2-detail-label">Awakenings</span><strong>${s.awakenings}</strong></div>` : ""
    ].filter(Boolean).join("");
    sleepBody = `<div class="jv2-sleep-grid">${sleepStats}</div>${s.notes ? `<p class="jv2-notes-text">${s.notes}</p>` : ""}`;
  } else {
    sleepBody = `<p class="jv2-empty">No sleep data recorded.</p>`;
  }
  const sleepSection = buildSection("Sleep", sleepBody, false);

  // ============================================================
  // SECTION: Exercise
  // ============================================================
  let exerciseBody;
  const didEx = d.didExercise === true || d.didExercise === "yes";
  if (didEx && d.exercise) {
    const e = d.exercise;
    const exStats = [
      e.type      ? `<div class="jv2-sleep-stat"><span class="jv2-detail-label">Type</span><strong>${e.type}</strong></div>` : "",
      e.minutes!=null?`<div class="jv2-sleep-stat"><span class="jv2-detail-label">Duration</span><strong>${e.minutes} min</strong></div>` : "",
      e.intensity ? `<div class="jv2-sleep-stat"><span class="jv2-detail-label">Intensity</span><strong>${e.intensity}</strong></div>` : "",
      e.timing    ? `<div class="jv2-sleep-stat"><span class="jv2-detail-label">Timing</span><strong>${e.timing}</strong></div>` : ""
    ].filter(Boolean).join("");
    exerciseBody = `<div class="jv2-sleep-grid">${exStats}</div>${e.notes ? `<p class="jv2-notes-text">${e.notes}</p>` : ""}`;
  } else {
    exerciseBody = `<p class="jv2-empty">No exercise recorded.</p>`;
  }
  const exerciseSection = buildSection("Exercise", exerciseBody, false);

  // ============================================================
  // SECTION: Mood
  // ============================================================
  const hasMood = d.mood?.score != null || d.mood?.notes;
  let moodBody;
  if (hasMood) {
    moodBody = `<div class="jv2-sleep-grid">${d.mood.score != null ? `<div class="jv2-sleep-stat"><span class="jv2-detail-label">Score</span><strong>${scorePillHtml(d.mood.score)}</strong></div>` : ""}</div>${d.mood.notes ? `<p class="jv2-notes-text">${d.mood.notes}</p>` : ""}`;
  } else {
    moodBody = `<p class="jv2-empty">No mood data recorded.</p>`;
  }
  const moodSection = buildSection("Mood", moodBody, false);

  // ============================================================
  // SECTION: Overall Notes
  // ============================================================
  const notesBody = d.overallNotes
    ? `<p class="jv2-notes-text">${d.overallNotes}</p>`
    : `<p class="jv2-empty">No overall notes recorded.</p>`;
  const notesSection = buildSection("Overall Notes", notesBody, !!d.overallNotes);

  // ============================================================
  // CARD ASSEMBLY
  // ============================================================
  return `
    <article class="jv2-card" data-journal-date="${dateStr}">
      <div class="jv2-card-accent" style="background:${barColor};"></div>
      <div class="jv2-card-inner">

        <!-- Header -->
        <header class="jv2-card-header">
          <div class="jv2-date-block">
            <span class="jv2-dow">${dow}</span>
            <span class="jv2-date">${dlbl}</span>
            ${title ? `<span class="jv2-title">&ldquo;${title}&rdquo;</span>` : ""}
          </div>
          <div class="jv2-header-right">
            <div class="jv2-stat-row">${avgFuncChip}${sleepChip}${moodChip}</div>
            ${tagsHtml}
          </div>
        </header>

        <!-- Accordion sections -->
        <div class="jv2-sections">
          ${funcSection}
          ${sleepSection}
          ${exerciseSection}
          ${moodSection}
          ${notesSection}
        </div>

      </div>
    </article>`;
}

// ================================================================
// FILTER UI
// ================================================================

function injectJournalFilterUI() {
  const container = document.getElementById("journalOutput");
  if (!container || document.getElementById("journalRangeSelect")) return;
  const wrap = document.createElement("div");
  wrap.className = "jv2-filter-bar";
  wrap.innerHTML = `
    <label for="journalRangeSelect" class="jv2-filter-label">Show last:</label>
    <select id="journalRangeSelect" class="jv2-filter-select">
      <option value="7">7 days</option>
      <option value="30" selected>30 days</option>
      <option value="90">90 days</option>
      <option value="0">All time</option>
    </select>`;
  container.parentElement.insertBefore(wrap, container);
  document.getElementById("journalRangeSelect").addEventListener("change", renderJournal);
}

// ================================================================
// MAIN RENDER
// ================================================================

async function renderJournal() {
  injectJournalFilterUI();
  const container = document.getElementById("journalOutput");
  if (!container) return;
  container.innerHTML = `<p class="jv2-loading">Loading journal entries&hellip;</p>`;

  try {
    const sel  = document.getElementById("journalRangeSelect");
    const days = sel ? parseInt(sel.value, 10) : 30;

    let query = db.collection("days").orderBy("__name__", "desc");
    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      query = query.where(firebase.firestore.FieldPath.documentId(), ">=", cutoff.toISOString().slice(0,10));
    }

    const snapshot = await query.get();

    let heatDocs = snapshot.docs;
    if (days > 0 && days < 90) {
      const hc = new Date();
      hc.setDate(hc.getDate() - 90);
      const hSnap = await db.collection("days").orderBy("__name__","desc")
        .where(firebase.firestore.FieldPath.documentId(),">=",hc.toISOString().slice(0,10)).get();
      heatDocs = hSnap.docs;
    }
    await renderHeatmap(heatDocs);

    if (snapshot.empty) {
      container.innerHTML = `<p class="jv2-loading" style="font-style:italic;">No journal entries found for the selected period.</p>`;
      return;
    }

    container.innerHTML = snapshot.docs.map(doc => buildJournalCard(doc.id, doc.data())).join("");

  } catch (err) {
    console.error("renderJournal error:", err);
    container.innerHTML = `<p style="color:#c0392b;padding:1rem;">Failed to load journal entries.</p>`;
  }
}
