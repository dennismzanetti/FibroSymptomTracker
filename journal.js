// ================================================================
// JOURNAL — Compact Timeline Feed + 90-Day Heatmap
// ================================================================

const TIME_BLOCKS = [
  { key: "earlyMorning",   label: "Early Morning (6\u20139am)",   short: "AM1" },
  { key: "lateMorning",    label: "Late Morning (9am\u201312pm)",  short: "AM2" },
  { key: "earlyAfternoon", label: "Early Afternoon (12\u20133pm)", short: "PM1" },
  { key: "lateAfternoon",  label: "Late Afternoon (3\u20136pm)",   short: "PM2" },
  { key: "earlyEvening",   label: "Early Evening (6\u20139pm)",    short: "EVE" },
  { key: "lateEvening",    label: "Late Evening (9pm\u201312am)",  short: "NGT" }
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

function scorePillHtml(score, size) {
  if (score === null || score === undefined) return `<span style="color:#b0b8cc;">&mdash;</span>`;
  const t = scoreTier(score);
  const c = TIER_COLORS[t];
  const fs = size === "sm" ? "0.72rem" : "0.8rem";
  const px = size === "sm" ? "0.15rem 0.45rem" : "0.2rem 0.55rem";
  return `<span style="display:inline-block;padding:${px};border-radius:999px;font-size:${fs};font-weight:700;background:${c.bg};color:${c.text};border:1px solid ${c.border};white-space:nowrap;">${score}/10</span>`;
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
        colCells += `<div style="width:${CELL}px;height:${CELL}px;border-radius:3px;border:1px solid transparent;background:transparent;"></div>`;
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
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

// ================================================================
// TIMELINE ROW
// ================================================================

function buildTimelineRow(dateStr, d) {
  const scores = TIME_BLOCKS.map(({ key }) => {
    const s = d.functionality?.[key]?.score;
    return typeof s === "number" ? s : null;
  });
  const valid = scores.filter(s => s !== null);
  const avg   = valid.length
    ? parseFloat((valid.reduce((a,b)=>a+b,0)/valid.length).toFixed(1))
    : null;

  const date  = new Date(dateStr + "T12:00:00");
  const DOWS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MTHS  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dow   = DOWS[date.getDay()];
  const dlbl  = `${MTHS[date.getMonth()]} ${date.getDate()}`;
  const barC  = tierBarColor(avg);

  // Compact block pills — tighter padding, no stacked label
  const blockPills = TIME_BLOCKS.map(({ short }, i) => {
    const s = scores[i];
    const t = s !== null ? scoreTier(s) : 0;
    const c = t ? TIER_COLORS[t] : null;
    const bg  = c ? c.bg  : "#f0f2fa";
    const bdr = c ? c.border : "#e0e4ef";
    const tc  = c ? c.text : "#b0b8cc";
    const val = s !== null ? s : "\u2014";
    return `<span style="display:inline-flex;align-items:center;gap:2px;padding:0.1rem 0.3rem;border-radius:5px;border:1px solid ${bdr};background:${bg};color:${tc};font-size:0.72rem;white-space:nowrap;" title="${TIME_BLOCKS[i].label}"><span style="font-weight:600;color:inherit;opacity:0.7;font-size:0.62rem;">${short}</span><span style="font-weight:700;">${val}</span></span>`;
  }).join("");

  let sleepBadge = "", moodBadge = "";
  if (d.sleep?.hours != null) sleepBadge = `<span style="font-size:0.72rem;font-weight:600;padding:0.1rem 0.4rem;border-radius:999px;border:1px solid #90caf9;background:#e3f2fd;color:#1565c0;white-space:nowrap;">&#128164; ${d.sleep.hours}h</span>`;
  if (typeof d.mood?.score === "number") {
    const t = scoreTier(d.mood.score); const c = TIER_COLORS[t];
    moodBadge = `<span style="font-size:0.72rem;font-weight:600;padding:0.1rem 0.4rem;border-radius:999px;border:1px solid ${c.border};background:${c.bg};color:${c.text};white-space:nowrap;">&#128522; ${d.mood.score}/10</span>`;
  }

  const tagsHtml = d.tags?.length
    ? d.tags.map(t => `<span style="font-size:0.68rem;font-weight:600;padding:0.08rem 0.4rem;border-radius:999px;background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;">${t}</span>`).join("")
    : "";

  const expandId = `jfe-${dateStr}`;

  const funcDetail = TIME_BLOCKS.map(({ key, label }, i) => {
    const b = d.functionality?.[key] || {};
    const s = scores[i];
    return `<div style="background:#fff;border:1px solid #e3e6f0;border-radius:7px;padding:0.5rem 0.65rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">
        <span style="font-size:0.72rem;font-weight:700;color:#3f51b5;text-transform:uppercase;letter-spacing:0.04em;">${label}</span>
        ${s !== null ? scorePillHtml(s, "sm") : "<span style='color:#b0b8cc;'>\u2014</span>"}
      </div>
      ${b.activity ? `<div style="font-size:0.8rem;color:#2d3142;line-height:1.5;"><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;margin-right:4px;">Activity</span>${b.activity}</div>` : ""}
      ${b.symptoms ? `<div style="font-size:0.8rem;color:#2d3142;line-height:1.5;"><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;margin-right:4px;">Symptoms</span>${b.symptoms}</div>` : ""}
    </div>`;
  }).join("");

  let sleepDetail = "", exDetail = "", moodDetail = "", overallDetail = "";

  if (d.sleep) {
    const s = d.sleep;
    const parts = [
      s.bedtime   ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Bedtime</span>${s.bedtime}</span>` : "",
      s.wakeTime  ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Wake</span>${s.wakeTime}</span>` : "",
      s.hours!=null ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Hours</span>${s.hours}</span>` : "",
      typeof s.quality==="number" ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Quality</span>${s.quality}/10</span>` : "",
      s.awakenings!=null ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Wakes</span>${s.awakenings}</span>` : ""
    ].filter(Boolean).join("");
    if (parts) sleepDetail = `<div style="margin-bottom:0.6rem;"><strong style="font-size:0.82rem;display:block;margin-bottom:0.3rem;color:#2d3142;">Sleep</strong><div style="display:flex;flex-wrap:wrap;gap:0.75rem;font-size:0.82rem;color:#2d3142;font-weight:600;">${parts}</div>${s.notes ? `<div style="font-size:0.82rem;margin-top:0.3rem;">${s.notes}</div>` : ""}</div>`;
  }

  if (d.didExercise === "yes" && d.exercise) {
    const e = d.exercise;
    exDetail = `<div style="margin-bottom:0.6rem;"><strong style="font-size:0.82rem;display:block;margin-bottom:0.3rem;color:#2d3142;">Exercise</strong><div style="display:flex;flex-wrap:wrap;gap:0.75rem;font-size:0.82rem;color:#2d3142;font-weight:600;">
      ${e.type ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Type</span>${e.type}</span>` : ""}
      ${e.minutes!=null ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Duration</span>${e.minutes} min</span>` : ""}
      ${e.intensity ? `<span><span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;display:block;">Intensity</span>${e.intensity}</span>` : ""}
    </div></div>`;
  }

  if (d.mood?.notes) moodDetail = `<div style="margin-bottom:0.6rem;"><strong style="font-size:0.82rem;display:block;margin-bottom:0.3rem;color:#2d3142;">Mood Notes</strong><div style="font-size:0.85rem;">${d.mood.notes}</div></div>`;
  if (d.overallNotes) overallDetail = `<div style="margin-bottom:0.6rem;"><strong style="font-size:0.82rem;display:block;margin-bottom:0.3rem;color:#2d3142;">Overall Notes</strong><div style="font-size:0.85rem;">${d.overallNotes}</div></div>`;

  return `
    <div style="display:flex;border-radius:6px;overflow:hidden;border:1px solid #e3e6f0;background:#fff;margin-bottom:1px;" data-journal-date="${dateStr}">
      <div style="width:4px;flex-shrink:0;background:${barC};"></div>
      <div style="flex:1;min-width:0;">
        <div onclick="toggleJournalRow('${expandId}')" style="padding:0.28rem 0.6rem;cursor:pointer;user-select:none;">
          <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
            <div style="display:flex;align-items:baseline;gap:0.3rem;min-width:60px;flex-shrink:0;">
              <span style="font-size:0.68rem;font-weight:700;color:#9e9e9e;text-transform:uppercase;letter-spacing:0.05em;">${dow}</span>
              <span style="font-size:0.82rem;font-weight:700;color:#2d3142;white-space:nowrap;">${dlbl}</span>
            </div>
            <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">${blockPills}</div>
            <div style="display:flex;gap:0.25rem;flex-wrap:wrap;align-items:center;">${sleepBadge}${moodBadge}</div>
            ${tagsHtml ? `<div style="display:flex;gap:0.2rem;flex-wrap:wrap;">${tagsHtml}</div>` : ""}
            ${avg !== null ? `<div style="margin-left:auto;flex-shrink:0;">${scorePillHtml(avg, "sm")}</div>` : ""}
            <span id="${expandId}-chev" style="color:#c8cce0;font-size:1rem;font-weight:700;line-height:1;flex-shrink:0;transition:transform 0.2s;">&rsaquo;</span>
          </div>
        </div>
        <div id="${expandId}" style="display:none;padding:0.6rem 0.75rem 0.7rem;border-top:1px solid #eef0fb;background:#f8f9fd;">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:0.5rem;margin-bottom:0.75rem;">${funcDetail}</div>
          ${sleepDetail}${exDetail}${moodDetail}${overallDetail}
        </div>
      </div>
    </div>`;
}

function toggleJournalRow(expandId) {
  const panel = document.getElementById(expandId);
  const chev  = document.getElementById(expandId + "-chev");
  if (!panel) return;
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
  if (chev) chev.style.transform = isOpen ? "" : "rotate(90deg)";
}

// ================================================================
// FILTER UI
// ================================================================

function injectJournalFilterUI() {
  const container = document.getElementById("journalOutput");
  if (!container || document.getElementById("journalRangeSelect")) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;";
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

// ================================================================
// MAIN RENDER
// ================================================================

async function renderJournal() {
  injectJournalFilterUI();
  const container = document.getElementById("journalOutput");
  if (!container) return;
  container.innerHTML = `<p style="color:#8891ab;padding:1rem 0;">Loading journal entries&hellip;</p>`;

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

    // Heatmap always shows 90 days regardless of filter
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
      container.innerHTML = `<p style="color:#9e9e9e;font-style:italic;padding:1rem 0;">No journal entries found for the selected period.</p>`;
      return;
    }

    container.innerHTML = snapshot.docs.map(doc => buildTimelineRow(doc.id, doc.data())).join("");

  } catch (err) {
    console.error("renderJournal error:", err);
    container.innerHTML = `<p style="color:#c0392b;">Failed to load journal entries.</p>`;
  }
}
