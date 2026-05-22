// ---- Mood & ATR ----

async function refreshMoodTab() {
  await Promise.all([refreshMoodSummaryTable(), refreshAtrList()]);
}

// ---- 14-Day Mood Sidebar List ----

const MOOD_TIER_COLORS = [
  null,
  { bg: "#ffebee", border: "#ef9a9a", text: "#c62828" }, // 1
  { bg: "#fff3e0", border: "#ffcc80", text: "#e65100" }, // 2
  { bg: "#fff8e1", border: "#ffe082", text: "#f57f17" }, // 3
  { bg: "#e8f5e9", border: "#a5d6a7", text: "#2e7d32" }, // 4
  { bg: "#e0f2f1", border: "#80cbc4", text: "#00695c" }  // 5
];

function moodTier(s) {
  if (s === null || s === undefined) return 0;
  if (s <= 2) return 1;
  if (s <= 4) return 2;
  if (s <= 6) return 3;
  if (s <= 8) return 4;
  return 5;
}

async function refreshMoodSummaryTable() {
  const container = document.getElementById("moodSummaryList");
  if (!container) return;
  container.innerHTML = `<p style="color:#8891ab;font-size:0.82rem;padding:0.25rem 0;">Loading&#8230;</p>`;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const snapshot = await db.collection("days")
      .where(firebase.firestore.FieldPath.documentId(), "in", dates)
      .get();

    const byDate = {};
    snapshot.forEach(doc => { byDate[doc.id] = doc.data(); });

    const DOW   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    let html = "";
    let hasAny = false;

    dates.forEach(dateStr => {
      const data  = byDate[dateStr];
      const score = data?.mood?.score ?? null;
      const notes = data?.mood?.notes || "";
      const hasData = score !== null || notes;
      if (hasData) hasAny = true;

      const d        = new Date(dateStr + "T12:00:00");
      const dow      = DOW[d.getDay()];
      const dateLbl  = `${MONTH[d.getMonth()]} ${d.getDate()}`;
      const isEmpty  = !hasData;

      // Tier + colors
      const tier  = score !== null ? moodTier(score) : 0;
      const tc    = tier ? MOOD_TIER_COLORS[tier] : null;
      const barW  = score !== null ? Math.round((score / 10) * 100) : 0;
      const barBg = tc ? tc.border : "#e3e6f0";

      const pillHtml = score !== null
        ? `<span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:999px;font-size:0.72rem;font-weight:700;background:${tc.bg};color:${tc.text};border:1px solid ${tc.border};white-space:nowrap;">${score}/10</span>`
        : `<span style="color:#c8cce0;font-size:0.75rem;">&mdash;</span>`;

      const barHtml = `<div style="height:3px;border-radius:2px;background:#eef0fb;margin-top:3px;overflow:hidden;"><div style="height:100%;width:${barW}%;background:${barBg};border-radius:2px;transition:width 0.3s;"></div></div>`;

      const notesHtml = notes
        ? `<div style="font-size:0.7rem;color:#5b6686;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${notes.replace(/"/g,'&quot;')}">${notes}</div>`
        : "";

      html += `
        <div style="display:grid;grid-template-columns:42px 1fr;align-items:center;gap:0.35rem;padding:0.28rem 0;border-bottom:1px solid #f0f2fa;opacity:${isEmpty ? 0.4 : 1};">
          <div style="line-height:1.1;">
            <div style="font-size:0.6rem;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:0.05em;">${dow}</div>
            <div style="font-size:0.75rem;font-weight:700;color:#2d3142;white-space:nowrap;">${dateLbl}</div>
          </div>
          <div style="min-width:0;">
            ${pillHtml}
            ${barHtml}
            ${notesHtml}
          </div>
        </div>`;
    });

    if (!hasAny) {
      container.innerHTML = `<p style="color:#9e9e9e;font-style:italic;font-size:0.82rem;">No mood data in the last 14 days.</p>`;
      return;
    }

    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading mood summary:", err);
    container.innerHTML = `<p style="color:#c0392b;font-size:0.82rem;">Failed to load mood data.</p>`;
  }
}

// ---- Automatic Thought Records (ATR) ----

function getAtrFormData() {
  return {
    date: document.getElementById("atrDateInput").value,
    situation: document.getElementById("atrSituationInput").value.trim(),
    emotions: document.getElementById("atrEmotionsInput").value.trim(),
    intensity: parseInt(document.getElementById("atrIntensityRange").value, 10),
    automaticThought: document.getElementById("atrAutoThoughtInput").value.trim(),
    alternativeThought: document.getElementById("atrAltThoughtInput").value.trim()
  };
}

function resetAtrForm() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("atrDateInput").value = today;
  document.getElementById("atrSituationInput").value = "";
  document.getElementById("atrEmotionsInput").value = "";
  document.getElementById("atrIntensityRange").value = 50;
  document.getElementById("atrIntensityDisplay").textContent = "50";
  document.getElementById("atrAutoThoughtInput").value = "";
  document.getElementById("atrAltThoughtInput").value = "";
  document.getElementById("atrEditingId").value = "";
  document.getElementById("atrFormTitle").textContent = "New Automatic Thought Record";
  document.getElementById("saveAtrBtn").textContent = "Save Record";
  document.getElementById("cancelAtrEditBtn").style.display = "none";
}

async function saveAtr() {
  const data = getAtrFormData();
  if (!data.date) { alert("Please select a date."); return; }
  if (!data.situation) { alert("Please describe the situation."); return; }
  if (!data.automaticThought) { alert("Please enter the automatic thought."); return; }
  const editingId = document.getElementById("atrEditingId").value;
  const now = new Date().toISOString();
  try {
    if (editingId) {
      await db.collection("automaticThoughtRecords").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
    } else {
      await db.collection("automaticThoughtRecords").add({ ...data, createdAt: now, updatedAt: now });
    }
    resetAtrForm();
    await refreshAtrList();
  } catch (err) {
    console.error("Error saving ATR:", err);
    alert("Failed to save record. Please try again.");
  }
}

async function deleteAtr(id) {
  if (!window.confirm("Delete this Automatic Thought Record? This cannot be undone.")) return;
  try {
    await db.collection("automaticThoughtRecords").doc(id).delete();
    await refreshAtrList();
  } catch (err) {
    console.error("Error deleting ATR:", err);
    alert("Failed to delete record.");
  }
}

function startEditAtr(id, data) {
  document.getElementById("atrDateInput").value = data.date || "";
  document.getElementById("atrSituationInput").value = data.situation || "";
  document.getElementById("atrEmotionsInput").value = data.emotions || "";
  document.getElementById("atrIntensityRange").value = data.intensity ?? 50;
  document.getElementById("atrIntensityDisplay").textContent = data.intensity ?? 50;
  document.getElementById("atrAutoThoughtInput").value = data.automaticThought || "";
  document.getElementById("atrAltThoughtInput").value = data.alternativeThought || "";
  document.getElementById("atrEditingId").value = id;
  document.getElementById("atrFormTitle").textContent = "Edit Automatic Thought Record";
  document.getElementById("saveAtrBtn").textContent = "Save Changes";
  document.getElementById("cancelAtrEditBtn").style.display = "inline-block";
  document.getElementById("atrFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshAtrList() {
  const container = document.getElementById("atrList");
  if (!container) return;
  container.innerHTML = `<p class="atr-empty">Loading&#8230;</p>`;
  try {
    const snapshot = await db.collection("automaticThoughtRecords")
      .orderBy("date", "desc")
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="atr-empty">No records yet. Use the form above to add one.</p>`;
      return;
    }

    const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const r = doc.data();
      const d = r.date ? new Date(r.date + "T12:00:00") : null;
      const dateStr = d ? `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "Unknown date";
      const card = document.createElement("div");
      card.className = "atr-record";
      card.innerHTML = `
        <div class="atr-record-header">
          <span class="atr-record-date">${dateStr}</span>
          ${r.emotions ? `<span class="atr-record-emotions">${r.emotions}</span>` : ""}
          ${r.intensity != null ? `<span class="atr-intensity-badge">${r.intensity}/100</span>` : ""}
          <div class="atr-record-actions">
            <button class="atr-edit-btn" aria-label="Edit record">Edit</button>
            <button class="atr-delete-btn danger" aria-label="Delete record">Delete</button>
          </div>
        </div>
        <div class="atr-record-body">
          <div class="atr-field"><span class="atr-field-label">Situation</span><p>${r.situation || "\u2014"}</p></div>
          <div class="atr-field"><span class="atr-field-label">Automatic Thought</span><p>${r.automaticThought || "\u2014"}</p></div>
          ${r.alternativeThought
            ? `<div class="atr-field atr-field-alt"><span class="atr-field-label">Alternative Thought</span><p>${r.alternativeThought}</p></div>`
            : ""}
        </div>`;
      card.querySelector(".atr-edit-btn").addEventListener("click", () => startEditAtr(doc.id, r));
      card.querySelector(".atr-delete-btn").addEventListener("click", () => deleteAtr(doc.id));
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading ATRs:", err);
    container.innerHTML = `<p class="atr-empty">Failed to load records.</p>`;
  }
}

function setupAtrForm() {
  const slider = document.getElementById("atrIntensityRange");
  const display = document.getElementById("atrIntensityDisplay");
  if (slider && display) {
    slider.addEventListener("input", () => { display.textContent = slider.value; });
  }
  const saveBtn = document.getElementById("saveAtrBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveAtr);
  const cancelBtn = document.getElementById("cancelAtrEditBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", () => resetAtrForm());
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("atrDateInput");
  if (dateInput && !dateInput.value) dateInput.value = today;
}
