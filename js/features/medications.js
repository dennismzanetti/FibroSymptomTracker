// ---- Medications & Supplements ----

let activeMedView = 'medListView';

const FREQ_LABELS = {
  "once-daily":  "Once daily",
  "twice-daily": "Twice daily",
  "three-daily": "Three times daily",
  "four-daily":  "Four times daily",
  "as-needed":   "As needed",
  "weekly":      "Weekly",
  "bi-weekly":   "Bi-weekly",
  "monthly":     "Monthly"
};

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Modal helpers ----

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "";
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function wireModal(modalId, openBtnId, closeBtnId, cancelBtnId) {
  document.getElementById(openBtnId)?.addEventListener("click", () => openModal(modalId));
  document.getElementById(closeBtnId)?.addEventListener("click", () => closeModal(modalId));
  document.getElementById(cancelBtnId)?.addEventListener("click", () => closeModal(modalId));
  // Close on backdrop click
  document.getElementById(modalId)?.addEventListener("click", e => {
    if (e.target === document.getElementById(modalId)) closeModal(modalId);
  });
}

function setupMedicationsTab() {
  // Sub-tab switching
  document.querySelectorAll("#medications-tab .ct-sub-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetViewId = btn.getAttribute("data-med-view");
      document.querySelectorAll("#medications-tab .ct-sub-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeMedView = targetViewId;
      document.querySelectorAll(".med-view").forEach(view => {
        view.style.display = view.id === targetViewId ? "" : "none";
      });
      refreshMedView(targetViewId);
    });
  });

  // Medication Add modal
  wireModal("medAddModal", "openMedAddModalBtn", "medAddModalClose", "cancelMedAddBtn");
  document.getElementById("saveMedAddBtn")?.addEventListener("click", saveMedication);

  // Medication Edit modal
  document.getElementById("medEditModalClose")?.addEventListener("click", () => closeModal("medEditModal"));
  document.getElementById("cancelMedEditModalBtn")?.addEventListener("click", () => closeModal("medEditModal"));
  document.getElementById("medEditModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("medEditModal")) closeModal("medEditModal");
  });
  document.getElementById("saveMedEditBtn")?.addEventListener("click", saveMedication);

  // Supplement Add modal
  wireModal("suppAddModal", "openSuppAddModalBtn", "suppAddModalClose", "cancelSuppAddBtn");
  document.getElementById("saveSuppAddBtn")?.addEventListener("click", saveSupplement);

  // Supplement Edit modal
  document.getElementById("suppEditModalClose")?.addEventListener("click", () => closeModal("suppEditModal"));
  document.getElementById("cancelSuppEditModalBtn")?.addEventListener("click", () => closeModal("suppEditModal"));
  document.getElementById("suppEditModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("suppEditModal")) closeModal("suppEditModal");
  });
  document.getElementById("saveSuppEditBtn")?.addEventListener("click", saveSupplement);

  // Global Escape key handler for med/supp modals
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    ["medAddModal", "medEditModal", "suppAddModal", "suppEditModal"].forEach(id => closeModal(id));
  });

  // Print button
  document.getElementById("printMedBtn")?.addEventListener("click", () => window.print());

  // Restore last active sub-tab (defaults to medListView on first visit)
  const restoreBtn = document.querySelector(`#medications-tab .ct-sub-tab-btn[data-med-view="${activeMedView}"]`);
  if (restoreBtn) restoreBtn.click();
  else refreshMedList();
}

function refreshMedView(viewId) {
  if (viewId === "medListView") refreshMedList();
  else if (viewId === "suppListView") refreshSuppList();
  else if (viewId === "medHistoryView") refreshMedHistory();
  else if (viewId === "medPrintView") { refreshMedPrintTable(); refreshSuppPrintTable(); }
}

// ---- Medications CRUD ----

function getMedFormData(prefix) {
  return {
    name: document.getElementById(`${prefix}NameInput`).value.trim(),
    dose: document.getElementById(`${prefix}DoseInput`).value.trim(),
    frequency: document.getElementById(`${prefix}FrequencyInput`).value,
    doctor: document.getElementById(`${prefix}DoctorInput`).value.trim(),
    notes: document.getElementById(`${prefix}NotesInput`).value.trim()
  };
}

function resetMedForm() {
  ["medAddNameInput","medAddDoseInput","medAddDoctorInput","medAddNotesInput"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const freq = document.getElementById("medAddFrequencyInput");
  if (freq) freq.value = "";
}

function resetMedEditForm() {
  ["medEditNameInput","medEditDoseInput","medEditDoctorInput","medEditNotesInput"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const freq = document.getElementById("medEditFrequencyInput");
  if (freq) freq.value = "";
  const hidden = document.getElementById("medEditingId");
  if (hidden) hidden.value = "";
}

async function saveMedication() {
  const editingId = document.getElementById("medEditingId")?.value || "";
  const prefix = editingId ? "medEdit" : "medAdd";
  const data = getMedFormData(prefix);
  if (!data.name) { alert("Please enter a medication name."); return; }
  const now = new Date().toISOString();
  if (editingId) {
    const oldDoc = await db.collection("medications").doc(editingId).get();
    const oldData = oldDoc.exists ? oldDoc.data() : {};
    await db.collection("medications").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
    const changes = [];
    if (oldData.name !== data.name) changes.push(`Name: "${oldData.name}" \u2192 "${data.name}"`);
    if (oldData.dose !== data.dose) changes.push(`Dose: "${oldData.dose}" \u2192 "${data.dose}"`);
    if (oldData.frequency !== data.frequency) changes.push(`Frequency: "${oldData.frequency}" \u2192 "${data.frequency}"`);
    if (oldData.doctor !== data.doctor) changes.push(`Doctor: "${oldData.doctor}" \u2192 "${data.doctor}"`);
    if (oldData.notes !== data.notes) changes.push(`Notes updated`);
    await db.collection("medicationHistory").add({
      type: "medication", action: "edited", medicationId: editingId, medicationName: data.name,
      changes: changes.length ? changes : ["No field changes detected"],
      snapshot: { ...data }, timestamp: now
    });
    resetMedEditForm();
    closeModal("medEditModal");
  } else {
    const docRef = await db.collection("medications").add({ ...data, createdAt: now, updatedAt: now });
    await db.collection("medicationHistory").add({
      type: "medication", action: "added", medicationId: docRef.id, medicationName: data.name,
      changes: [`Added: ${data.name}${data.dose ? ` ${data.dose}` : ""}`],
      snapshot: { ...data }, timestamp: now
    });
    resetMedForm();
    closeModal("medAddModal");
  }
  refreshMedList();
}

async function deleteMedication(id, name) {
  if (!window.confirm(`Delete "${name}" from your medication list?\n\nThis will be recorded in the change history.`)) return;
  const now = new Date().toISOString();
  const oldDoc = await db.collection("medications").doc(id).get();
  const oldData = oldDoc.exists ? oldDoc.data() : {};
  await db.collection("medications").doc(id).delete();
  await db.collection("medicationHistory").add({
    type: "medication", action: "deleted", medicationId: id, medicationName: name,
    changes: [`Deleted: ${name}${oldData.dose ? ` ${oldData.dose}` : ""}`],
    snapshot: { ...oldData }, timestamp: now
  });
  refreshMedList();
}

function startEditMedication(id, med) {
  document.getElementById("medEditNameInput").value = med.name || "";
  document.getElementById("medEditDoseInput").value = med.dose || "";
  document.getElementById("medEditFrequencyInput").value = med.frequency || "";
  document.getElementById("medEditDoctorInput").value = med.doctor || "";
  document.getElementById("medEditNotesInput").value = med.notes || "";
  document.getElementById("medEditingId").value = id;
  openModal("medEditModal");
}

async function refreshMedList() {
  const list = document.getElementById("medList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading...</li>";
  try {
    const snapshot = await db.collection("medications").orderBy("name").get();
    if (snapshot.empty) {
      list.innerHTML = "<li class='med-empty'>No medications added yet.</li>";
      return;
    }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const med = doc.data();
      const li = document.createElement("li");
      li.className = "med-item";
      const freq = FREQ_LABELS[med.frequency] || med.frequency || "";
      const hasDoctor = !!med.doctor;
      const hasNotes  = !!med.notes;
      const hasBody   = hasDoctor || hasNotes;
      li.innerHTML = `
        <div class="med-item-header">
          <span class="med-item-name">${escHtml(med.name || "")}${med.dose ? ` <span class="med-item-dose">${escHtml(med.dose)}</span>` : ""}${freq ? ` <span class="med-item-freq">${escHtml(freq)}</span>` : ""}</span>
          <div class="med-item-actions">
            <button class="med-btn med-btn-edit">Edit</button>
            <button class="med-btn med-btn-delete">Delete</button>
          </div>
        </div>
        ${hasBody ? `<div class="med-item-body">
          <span class="med-item-meta">${hasDoctor ? `<span class="med-item-label">Prescriber</span>Dr. ${escHtml(med.doctor)}` : ""}</span>
          <span class="med-item-meta med-item-notes">${hasNotes ? escHtml(med.notes) : ""}</span>
        </div>` : ""}`;
      li.querySelector(".med-btn-edit").addEventListener("click", () => startEditMedication(doc.id, med));
      li.querySelector(".med-btn-delete").addEventListener("click", () => deleteMedication(doc.id, med.name));
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading medications:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load medications.</li>";
  }
}

// ---- Supplements CRUD ----

function getSuppFormData(prefix) {
  return {
    name: document.getElementById(`${prefix}NameInput`).value.trim(),
    dose: document.getElementById(`${prefix}DoseInput`).value.trim(),
    frequency: document.getElementById(`${prefix}FrequencyInput`).value,
    brand: document.getElementById(`${prefix}BrandInput`).value.trim(),
    notes: document.getElementById(`${prefix}NotesInput`).value.trim()
  };
}

function resetSuppForm() {
  ["suppAddNameInput","suppAddDoseInput","suppAddBrandInput","suppAddNotesInput"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const freq = document.getElementById("suppAddFrequencyInput");
  if (freq) freq.value = "";
}

function resetSuppEditForm() {
  ["suppEditNameInput","suppEditDoseInput","suppEditBrandInput","suppEditNotesInput"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const freq = document.getElementById("suppEditFrequencyInput");
  if (freq) freq.value = "";
  const hidden = document.getElementById("suppEditingId");
  if (hidden) hidden.value = "";
}

async function saveSupplement() {
  const editingId = document.getElementById("suppEditingId")?.value || "";
  const prefix = editingId ? "suppEdit" : "suppAdd";
  const data = getSuppFormData(prefix);
  if (!data.name) { alert("Please enter a supplement name."); return; }
  const now = new Date().toISOString();
  if (editingId) {
    const oldDoc = await db.collection("supplements").doc(editingId).get();
    const oldData = oldDoc.exists ? oldDoc.data() : {};
    await db.collection("supplements").doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
    const changes = [];
    if (oldData.name !== data.name) changes.push(`Name: "${oldData.name}" \u2192 "${data.name}"`);
    if (oldData.dose !== data.dose) changes.push(`Dose: "${oldData.dose}" \u2192 "${data.dose}"`);
    if (oldData.frequency !== data.frequency) changes.push(`Frequency: "${oldData.frequency}" \u2192 "${data.frequency}"`);
    if (oldData.brand !== data.brand) changes.push(`Brand: "${oldData.brand}" \u2192 "${data.brand}"`);
    if (oldData.notes !== data.notes) changes.push(`Notes updated`);
    await db.collection("medicationHistory").add({
      type: "supplement", action: "edited", medicationId: editingId, medicationName: data.name,
      changes: changes.length ? changes : ["No field changes detected"],
      snapshot: { ...data }, timestamp: now
    });
    resetSuppEditForm();
    closeModal("suppEditModal");
  } else {
    const docRef = await db.collection("supplements").add({ ...data, createdAt: now, updatedAt: now });
    await db.collection("medicationHistory").add({
      type: "supplement", action: "added", medicationId: docRef.id, medicationName: data.name,
      changes: [`Added: ${data.name}${data.dose ? ` ${data.dose}` : ""}`],
      snapshot: { ...data }, timestamp: now
    });
    resetSuppForm();
    closeModal("suppAddModal");
  }
  refreshSuppList();
}

async function deleteSupplement(id, name) {
  if (!window.confirm(`Delete "${name}" from your supplement list?\n\nThis will be recorded in the change history.`)) return;
  const now = new Date().toISOString();
  const oldDoc = await db.collection("supplements").doc(id).get();
  const oldData = oldDoc.exists ? oldDoc.data() : {};
  await db.collection("supplements").doc(id).delete();
  await db.collection("medicationHistory").add({
    type: "supplement", action: "deleted", medicationId: id, medicationName: name,
    changes: [`Deleted: ${name}${oldData.dose ? ` ${oldData.dose}` : ""}`],
    snapshot: { ...oldData }, timestamp: now
  });
  refreshSuppList();
}

function startEditSupplement(id, supp) {
  document.getElementById("suppEditNameInput").value = supp.name || "";
  document.getElementById("suppEditDoseInput").value = supp.dose || "";
  document.getElementById("suppEditFrequencyInput").value = supp.frequency || "";
  document.getElementById("suppEditBrandInput").value = supp.brand || "";
  document.getElementById("suppEditNotesInput").value = supp.notes || "";
  document.getElementById("suppEditingId").value = id;
  openModal("suppEditModal");
}

async function refreshSuppList() {
  const list = document.getElementById("suppList");
  if (!list) return;
  list.innerHTML = "<li class='med-empty'>Loading...</li>";
  try {
    const snapshot = await db.collection("supplements").orderBy("name").get();
    if (snapshot.empty) {
      list.innerHTML = "<li class='med-empty'>No supplements added yet.</li>";
      return;
    }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const supp = doc.data();
      const li = document.createElement("li");
      li.className = "med-item";
      const freq = FREQ_LABELS[supp.frequency] || supp.frequency || "";
      const hasBrand = !!supp.brand;
      const hasNotes = !!supp.notes;
      const hasBody  = hasBrand || hasNotes;
      li.innerHTML = `
        <div class="med-item-header">
          <span class="med-item-name">${escHtml(supp.name || "")}${supp.dose ? ` <span class="med-item-dose">${escHtml(supp.dose)}</span>` : ""}${freq ? ` <span class="med-item-freq">${escHtml(freq)}</span>` : ""}</span>
          <div class="med-item-actions">
            <button class="med-btn med-btn-edit">Edit</button>
            <button class="med-btn med-btn-delete">Delete</button>
          </div>
        </div>
        ${hasBody ? `<div class="med-item-body">
          <span class="med-item-meta">${hasBrand ? `<span class="med-item-label">Brand</span>${escHtml(supp.brand)}` : ""}</span>
          <span class="med-item-meta med-item-notes">${hasNotes ? escHtml(supp.notes) : ""}</span>
        </div>` : ""}`;
      li.querySelector(".med-btn-edit").addEventListener("click", () => startEditSupplement(doc.id, supp));
      li.querySelector(".med-btn-delete").addEventListener("click", () => deleteSupplement(doc.id, supp.name));
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading supplements:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load supplements.</li>";
  }
}

// ---- Medication Change History ----

async function refreshMedHistory() {
  const container = document.getElementById("medHistoryList");
  if (!container) return;
  container.innerHTML = "<p>Loading history...</p>";
  try {
    const snapshot = await db.collection("medicationHistory")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();
    if (snapshot.empty) {
      container.innerHTML = "<p class='med-empty'>No change history yet.</p>";
      return;
    }
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const h = doc.data();
      const ts = h.timestamp ? new Date(h.timestamp) : null;
      const dateStr = ts ? ts.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown date";
      const actionLabel = { added: "Added", edited: "Edited", deleted: "Deleted" }[h.action] || h.action;
      const typeLabel = h.type === "supplement" ? "Supplement" : "Medication";
      const div = document.createElement("div");
      div.className = `med-history-item med-history-${h.action}`;
      div.innerHTML = `
        <div class="med-history-header">
          <span class="med-history-action">${actionLabel} ${typeLabel}</span>
          <span class="med-history-name">${escHtml(h.medicationName || "")}</span>
          <span class="med-history-date">${dateStr}</span>
        </div>
        <ul class="med-history-changes">
          ${(h.changes || []).map(c => `<li>${escHtml(c)}</li>`).join("")}
        </ul>`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading medication history:", err);
    container.innerHTML = "<p class='med-empty'>Failed to load history.</p>";
  }
}

// ---- Print Preview Tables (in-page) ----

async function refreshMedPrintTable() {
  const tbody = document.getElementById("medPrintTableBody");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";
  try {
    const snapshot = await db.collection("medications").orderBy("name").get();
    if (snapshot.empty) { tbody.innerHTML = "<tr><td colspan='5' class='med-empty'>No medications on file.</td></tr>"; return; }
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const m = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escHtml(m.name||"")} </td><td>${escHtml(m.dose||"\u2014")}</td><td>${escHtml(FREQ_LABELS[m.frequency]||m.frequency||"\u2014")}</td><td>${escHtml(m.doctor||"\u2014")}</td><td>${escHtml(m.notes||"")} </td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { tbody.innerHTML = "<tr><td colspan='5'>Failed to load.</td></tr>"; }
}

async function refreshSuppPrintTable() {
  const tbody = document.getElementById("suppPrintTableBody");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";
  try {
    const snapshot = await db.collection("supplements").orderBy("name").get();
    if (snapshot.empty) { tbody.innerHTML = "<tr><td colspan='5' class='med-empty'>No supplements on file.</td></tr>"; return; }
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const s = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escHtml(s.name||"")} </td><td>${escHtml(s.dose||"\u2014")}</td><td>${escHtml(FREQ_LABELS[s.frequency]||s.frequency||"\u2014")}</td><td>${escHtml(s.brand||"\u2014")}</td><td>${escHtml(s.notes||"")} </td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { tbody.innerHTML = "<tr><td colspan='5'>Failed to load.</td></tr>"; }
}
