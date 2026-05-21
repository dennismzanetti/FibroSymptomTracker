// ---- Medications & Supplements ----

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setupMedicationsTab() {
  document.getElementById("saveMedBtn")?.addEventListener("click", saveMedication);
  document.getElementById("cancelMedEditBtn")?.addEventListener("click", resetMedForm);
  document.getElementById("saveSuppBtn")?.addEventListener("click", saveSupplement);
  document.getElementById("cancelSuppEditBtn")?.addEventListener("click", resetSuppForm);

  document.querySelectorAll(".med-sub-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetViewId = btn.getAttribute("data-med-view");
      document.querySelectorAll(".med-sub-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".med-view").forEach(view => {
        view.style.display = view.id === targetViewId ? "" : "none";
      });
      refreshMedView(targetViewId);
    });
  });

  refreshMedList();
}

function refreshMedView(viewId) {
  if (viewId === "medListView") refreshMedList();
  else if (viewId === "suppListView") refreshSuppList();
  else if (viewId === "medHistoryView") refreshMedHistory();
  else if (viewId === "medPrintView") { refreshMedPrintTable(); refreshSuppPrintTable(); }
}

// ---- Medications CRUD ----

function getMedFormData() {
  return {
    name: document.getElementById("medNameInput").value.trim(),
    dose: document.getElementById("medDoseInput").value.trim(),
    frequency: document.getElementById("medFrequencyInput").value,
    doctor: document.getElementById("medDoctorInput").value.trim(),
    notes: document.getElementById("medNotesInput").value.trim()
  };
}

function resetMedForm() {
  document.getElementById("medNameInput").value = "";
  document.getElementById("medDoseInput").value = "";
  document.getElementById("medFrequencyInput").value = "";
  document.getElementById("medDoctorInput").value = "";
  document.getElementById("medNotesInput").value = "";
  document.getElementById("medEditingId").value = "";
  document.getElementById("medFormTitle").textContent = "Add Medication";
  document.getElementById("saveMedBtn").textContent = "Add Medication";
  document.getElementById("cancelMedEditBtn").style.display = "none";
}

async function saveMedication() {
  const data = getMedFormData();
  if (!data.name) { alert("Please enter a medication name."); return; }
  const editingId = document.getElementById("medEditingId").value;
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
  } else {
    const docRef = await db.collection("medications").add({ ...data, createdAt: now, updatedAt: now });
    await db.collection("medicationHistory").add({
      type: "medication", action: "added", medicationId: docRef.id, medicationName: data.name,
      changes: [`Added: ${data.name}${data.dose ? ` ${data.dose}` : ""}`],
      snapshot: { ...data }, timestamp: now
    });
  }
  resetMedForm();
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
  document.getElementById("medNameInput").value = med.name || "";
  document.getElementById("medDoseInput").value = med.dose || "";
  document.getElementById("medFrequencyInput").value = med.frequency || "";
  document.getElementById("medDoctorInput").value = med.doctor || "";
  document.getElementById("medNotesInput").value = med.notes || "";
  document.getElementById("medEditingId").value = id;
  document.getElementById("medFormTitle").textContent = "Edit Medication";
  document.getElementById("saveMedBtn").textContent = "Save Changes";
  document.getElementById("cancelMedEditBtn").style.display = "inline-block";
  document.getElementById("medFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
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
      li.innerHTML = `
        <div class="med-item-info">
          <span class="med-item-name">${escHtml(med.name || "")}</span>
          ${med.dose ? `<span class="med-item-detail">${escHtml(med.dose)}</span>` : ""}
          ${freq ? `<span class="med-item-detail">${escHtml(freq)}</span>` : ""}
          ${med.doctor ? `<span class="med-item-detail">Dr. ${escHtml(med.doctor)}</span>` : ""}
          ${med.notes ? `<span class="med-item-notes">${escHtml(med.notes)}</span>` : ""}
        </div>
        <div class="med-item-actions">
          <button class="med-edit-btn">Edit</button>
          <button class="med-delete-btn danger">Delete</button>
        </div>`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startEditMedication(doc.id, med));
      li.querySelector(".med-delete-btn").addEventListener("click", () => deleteMedication(doc.id, med.name));
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading medications:", err);
    list.innerHTML = "<li class='med-empty'>Failed to load medications.</li>";
  }
}

// ---- Supplements CRUD ----

function getSuppFormData() {
  return {
    name: document.getElementById("suppNameInput").value.trim(),
    dose: document.getElementById("suppDoseInput").value.trim(),
    frequency: document.getElementById("suppFrequencyInput").value,
    brand: document.getElementById("suppBrandInput").value.trim(),
    notes: document.getElementById("suppNotesInput").value.trim()
  };
}

function resetSuppForm() {
  document.getElementById("suppNameInput").value = "";
  document.getElementById("suppDoseInput").value = "";
  document.getElementById("suppFrequencyInput").value = "";
  document.getElementById("suppBrandInput").value = "";
  document.getElementById("suppNotesInput").value = "";
  document.getElementById("suppEditingId").value = "";
  document.getElementById("suppFormTitle").textContent = "Add Supplement";
  document.getElementById("saveSuppBtn").textContent = "Add Supplement";
  document.getElementById("cancelSuppEditBtn").style.display = "none";
}

async function saveSupplement() {
  const data = getSuppFormData();
  if (!data.name) { alert("Please enter a supplement name."); return; }
  const editingId = document.getElementById("suppEditingId").value;
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
  } else {
    const docRef = await db.collection("supplements").add({ ...data, createdAt: now, updatedAt: now });
    await db.collection("medicationHistory").add({
      type: "supplement", action: "added", medicationId: docRef.id, medicationName: data.name,
      changes: [`Added: ${data.name}${data.dose ? ` ${data.dose}` : ""}`],
      snapshot: { ...data }, timestamp: now
    });
  }
  resetSuppForm();
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
  document.getElementById("suppNameInput").value = supp.name || "";
  document.getElementById("suppDoseInput").value = supp.dose || "";
  document.getElementById("suppFrequencyInput").value = supp.frequency || "";
  document.getElementById("suppBrandInput").value = supp.brand || "";
  document.getElementById("suppNotesInput").value = supp.notes || "";
  document.getElementById("suppEditingId").value = id;
  document.getElementById("suppFormTitle").textContent = "Edit Supplement";
  document.getElementById("saveSuppBtn").textContent = "Save Changes";
  document.getElementById("cancelSuppEditBtn").style.display = "inline-block";
  document.getElementById("suppFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
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
      li.innerHTML = `
        <div class="med-item-info">
          <span class="med-item-name">${escHtml(supp.name || "")}</span>
          ${supp.dose ? `<span class="med-item-detail">${escHtml(supp.dose)}</span>` : ""}
          ${freq ? `<span class="med-item-detail">${escHtml(freq)}</span>` : ""}
          ${supp.brand ? `<span class="med-item-detail">${escHtml(supp.brand)}</span>` : ""}
          ${supp.notes ? `<span class="med-item-notes">${escHtml(supp.notes)}</span>` : ""}
        </div>
        <div class="med-item-actions">
          <button class="med-edit-btn">Edit</button>
          <button class="med-delete-btn danger">Delete</button>
        </div>`;
      li.querySelector(".med-edit-btn").addEventListener("click", () => startEditSupplement(doc.id, supp));
      li.querySelector(".med-delete-btn").addEventListener("click", () => deleteSupplement(doc.id, supp.name));
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
  // ID corrected: medPrintTableBody (matches index.html)
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
  // ID corrected: suppPrintTableBody (matches index.html)
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
