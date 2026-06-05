// conditions.js — Conditions / Diagnoses tab module
// Exposes window.setupConditionsTab() and window.refreshConditionsList()

(function () {

  // ---- Firestore collection ----
  const COL = 'conditions';

  // ---- DOM helpers ----
  function el(id) { return document.getElementById(id); }

  function resetForm() {
    el('condNameInput').value      = '';
    el('condIcdInput').value       = '';
    el('condDiagnosedDateInput').value = '';
    el('condDiagnosedByInput').value = '';
    el('condStatusInput').value    = 'active';
    el('condNotesInput').value     = '';
    el('condEditingId').value      = '';
    el('condFormTitle').textContent = 'Add Condition';
    el('savCondBtn').textContent   = 'Add Condition';
    el('cancelCondEditBtn').style.display = 'none';
  }

  // ---- Render list ----
  function renderConditionsList(docs) {
    const list = el('conditionsList');
    if (!list) return;
    if (!docs.length) {
      list.innerHTML = '<li class="med-empty">No conditions recorded yet.</li>';
      return;
    }
    list.innerHTML = docs.map(({ id, data: d }) => {
      const statusLabel = {
        active:    'Active',
        managed:   'Managed',
        resolved:  'Resolved',
        suspected: 'Suspected'
      }[d.status] || d.status || 'Unknown';
      const statusClass = {
        active:    'med-status-active',
        managed:   'med-status-ok',
        resolved:  'med-status-stopped',
        suspected: 'med-status-pending'
      }[d.status] || '';
      const diagDate = d.diagnosedDate
        ? `<span class="med-detail">Diagnosed: ${d.diagnosedDate}</span>` : '';
      const diagBy = d.diagnosedBy
        ? `<span class="med-detail">By: ${d.diagnosedBy}</span>` : '';
      const icd = d.icdCode
        ? `<span class="med-detail">ICD-10: ${d.icdCode}</span>` : '';
      const notes = d.notes
        ? `<p class="med-notes">${d.notes}</p>` : '';
      return `
        <li class="med-item" data-id="${id}">
          <div class="med-item-header">
            <div class="med-item-info">
              <span class="med-name">${d.name || 'Unnamed'}</span>
              <span class="med-badge ${statusClass}">${statusLabel}</span>
              ${diagDate}${diagBy}${icd}
            </div>
            <div class="med-item-actions">
              <button class="med-edit-btn" data-id="${id}" aria-label="Edit">Edit</button>
              <button class="med-delete-btn" data-id="${id}" aria-label="Delete">Delete</button>
            </div>
          </div>
          ${notes}
        </li>`;
    }).join('');
  }

  // ---- Load from Firestore ----
  async function refreshConditionsList() {
    const list = el('conditionsList');
    if (!list) return;
    list.innerHTML = '<li class="med-empty">Loading&hellip;</li>';
    try {
      const snap = await db.collection(COL).orderBy('name').get();
      const docs = [];
      snap.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));
      renderConditionsList(docs);
    } catch (err) {
      console.error('Conditions load error:', err);
      list.innerHTML = '<li class="med-empty">&#x26A0;&#xFE0F; Failed to load conditions.</li>';
    }
  }

  // ---- Save (add / update) ----
  async function saveCondition() {
    const name = el('condNameInput').value.trim();
    if (!name) {
      if (typeof showToast === 'function') showToast('Condition name is required.', true);
      el('condNameInput').focus();
      return;
    }
    const data = {
      name,
      icdCode:       el('condIcdInput').value.trim(),
      diagnosedDate: el('condDiagnosedDateInput').value,
      diagnosedBy:   el('condDiagnosedByInput').value.trim(),
      status:        el('condStatusInput').value,
      notes:         el('condNotesInput').value.trim(),
      updatedAt:     new Date().toISOString()
    };
    const editingId = el('condEditingId').value;
    try {
      if (editingId) {
        await db.collection(COL).doc(editingId).set(data, { merge: true });
        if (typeof showToast === 'function') showToast('\u2713 Condition updated');
      } else {
        data.createdAt = new Date().toISOString();
        await db.collection(COL).add(data);
        if (typeof showToast === 'function') showToast('\u2713 Condition added');
      }
      resetForm();
      await refreshConditionsList();
    } catch (err) {
      console.error('Condition save error:', err);
      if (typeof showToast === 'function') showToast('\u26A0 Save failed', true);
    }
  }

  // ---- Delete ----
  async function deleteCondition(id) {
    if (!confirm('Delete this condition?')) return;
    try {
      await db.collection(COL).doc(id).delete();
      if (typeof showToast === 'function') showToast('Condition deleted');
      await refreshConditionsList();
    } catch (err) {
      console.error('Condition delete error:', err);
      if (typeof showToast === 'function') showToast('\u26A0 Delete failed', true);
    }
  }

  // ---- Populate form for editing ----
  async function startEditCondition(id) {
    try {
      const doc = await db.collection(COL).doc(id).get();
      if (!doc.exists) return;
      const d = doc.data();
      el('condNameInput').value          = d.name || '';
      el('condIcdInput').value           = d.icdCode || '';
      el('condDiagnosedDateInput').value = d.diagnosedDate || '';
      el('condDiagnosedByInput').value   = d.diagnosedBy || '';
      el('condStatusInput').value        = d.status || 'active';
      el('condNotesInput').value         = d.notes || '';
      el('condEditingId').value          = id;
      el('condFormTitle').textContent    = 'Edit Condition';
      el('savCondBtn').textContent       = 'Save Changes';
      el('cancelCondEditBtn').style.display = 'inline-block';
      el('condNameInput').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Condition edit load error:', err);
    }
  }

  // ---- Setup ----
  function setupConditionsTab() {
    el('savCondBtn')?.addEventListener('click', saveCondition);
    el('cancelCondEditBtn')?.addEventListener('click', resetForm);

    el('conditionsList')?.addEventListener('click', function (e) {
      const editBtn   = e.target.closest('.med-edit-btn');
      const deleteBtn = e.target.closest('.med-delete-btn');
      if (editBtn)   startEditCondition(editBtn.dataset.id);
      if (deleteBtn) deleteCondition(deleteBtn.dataset.id);
    });

    refreshConditionsList();
  }

  // Expose globals
  window.setupConditionsTab    = setupConditionsTab;
  window.refreshConditionsList = refreshConditionsList;

})();
