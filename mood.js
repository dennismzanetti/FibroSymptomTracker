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
  const tbody = document.getElementById("moodSummaryBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="mood-table-empty">Loading&#8230;</td></tr>`;
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

    let rows = "";
    let hasAny = false;

    dates.forEach(dateStr => {
      const data  = byDate[dateStr];
      const score = data?.mood?.score ?? null;
      const notes = data?.mood?.notes || "";
      const hasData = score !== null || notes;
      if (hasData) hasAny = true;

      const d       = new Date(dateStr + "T12:00:00");
      const dow     = DOW[d.getDay()];
      const dateLbl = `${MONTH[d.getMonth()]} ${d.getDate()}`;

      const tier = score !== null ? moodTier(score) : 0;
      const tc   = tier ? MOOD_TIER_COLORS[tier] : null;

      const pillHtml = score !== null
        ? `<span style="display:inline-block;padding:0.1rem 0.45rem;border-radius:999px;font-size:0.75rem;font-weight:700;background:${tc.bg};color:${tc.text};border:1px solid ${tc.border};white-space:nowrap;">${score}/10</span>`
        : `<span style="color:#bbb;">&#8212;</span>`;

      const rowOpacity = hasData ? "1" : "0.4";

      rows += `
        <tr style="opacity:${rowOpacity};">
          <td style="white-space:nowrap;font-size:0.82rem;color:var(--color-text);">${dateLbl}</td>
          <td style="font-size:0.82rem;color:var(--color-text-muted);">${dow}</td>
          <td>${pillHtml}</td>
          <td style="font-size:0.78rem;color:var(--color-text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${notes.replace(/"/g,'&quot;')}">${notes || "&#8212;"}</td>
        </tr>`;
    });

    if (!hasAny) {
      tbody.innerHTML = `<tr><td colspan="4" class="mood-table-empty" style="font-style:italic;color:#9e9e9e;">No mood data in the last 14 days.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows;
  } catch (err) {
    console.error("Error loading mood summary:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="mood-table-empty" style="color:#c0392b;">Failed to load mood data.</td></tr>`;
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
