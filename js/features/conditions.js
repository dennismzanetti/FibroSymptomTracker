// conditions.js — Conditions / Diagnoses tab module
// Exposes window.setupConditionsTab() and window.refreshConditionsList()

(function () {

  const COL = 'conditions';

  function el(id) { return document.getElementById(id); }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Modal helpers ----
  function openModal(id) {
    const m = el(id);
    if (m) { m.style.display = 'block'; }
  }

  function closeModal(id) {
    const m = el(id);
    if (m) { m.style.display = 'none'; }
  }

  // ---- Reset / clear Add modal form ----
  function resetAddForm() {
    el('condNameInput').value          = '';
    el('condIcdInput').value           = '';
    el('condDiagnosedDateInput').value = '';
    el('condDiagnosedByInput').value   = '';
    el('condStatusInput').value        = 'active';
    el('condNotesInput').value         = '';
  }

  // ---- Reset / clear Edit modal form ----
  function resetEditForm() {
    el('condEditNameInput').value          = '';
    el('condEditIcdInput').value           = '';
    el('condEditDiagnosedDateInput').value = '';
    el('condEditDiagnosedByInput').value   = '';
    el('condEditStatusInput').value        = 'active';
    el('condEditNotesInput').value         = '';
    el('condEditingId').value              = '';
  }

  // ---- Render list ----
  function renderConditionsList(docs) {
    const list = el('conditionsList');
    if (!list) return;
    if (!docs.length) {
      list.innerHTML = '<li class="med-empty">No conditions recorded yet.</li>';
      return;
    }
    list.innerHTML = '';
    docs.forEach(({ id, data: d }) => {
      const statusLabel = {
        active:    'Active',
        managed:   'Managed',
        resolved:  'Resolved',
        suspected: 'Suspected'
      }[d.status] || d.status || 'Unknown';

      const metaParts = [
        d.icdCode       ? 'ICD-10: ' + escHtml(d.icdCode)          : '',
        d.diagnosedDate ? 'Diagnosed: ' + escHtml(d.diagnosedDate) : '',
        d.diagnosedBy   ? 'By: ' + escHtml(d.diagnosedBy)          : ''
      ].filter(Boolean);

      const li = document.createElement('li');
      li.className = 'med-item';
      li.dataset.id = id;
      li.innerHTML = `
        <div class="med-item-header">
          <div>
            <span class="med-item-name">${escHtml(d.name || 'Unnamed')}</span>
            <span class="med-item-meta">${escHtml(statusLabel)}</span>
            ${metaParts.length ? `<div class="med-item-meta">${metaParts.join(' &bull; ')}</div>` : ''}
            ${d.notes ? `<div class="med-item-meta" style="font-style:italic;margin-top:0.15rem;">${escHtml(d.notes)}</div>` : ''}
          </div>
          <div class="med-item-actions">
            <button class="med-btn med-btn-edit">Edit</button>
            <button class="med-btn med-btn-delete">Delete</button>
          </div>
        </div>`;

      li.querySelector('.med-btn-edit').addEventListener('click', () => startEditCondition(id));
      li.querySelector('.med-btn-delete').addEventListener('click', () => deleteCondition(id, d.name));
      list.appendChild(li);
    });
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

  // ---- Add condition (from Add modal) ----
  async function addCondition() {
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
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString()
    };
    try {
      await db.collection(COL).add(data);
      if (typeof showToast === 'function') showToast('\u2713 Condition added');
      resetAddForm();
      closeModal('condAddModal');
      await refreshConditionsList();
    } catch (err) {
      console.error('Condition add error:', err);
      if (typeof showToast === 'function') showToast('\u26A0 Save failed', true);
    }
  }

  // ---- Save edit (from Edit modal) ----
  async function saveEditCondition() {
    const editingId = el('condEditingId').value;
    if (!editingId) return;
    const name = el('condEditNameInput').value.trim();
    if (!name) {
      if (typeof showToast === 'function') showToast('Condition name is required.', true);
      el('condEditNameInput').focus();
      return;
    }
    const data = {
      name,
      icdCode:       el('condEditIcdInput').value.trim(),
      diagnosedDate: el('condEditDiagnosedDateInput').value,
      diagnosedBy:   el('condEditDiagnosedByInput').value.trim(),
      status:        el('condEditStatusInput').value,
      notes:         el('condEditNotesInput').value.trim(),
      updatedAt:     new Date().toISOString()
    };
    try {
      await db.collection(COL).doc(editingId).set(data, { merge: true });
      if (typeof showToast === 'function') showToast('\u2713 Condition updated');
      resetEditForm();
      closeModal('condEditModal');
      await refreshConditionsList();
    } catch (err) {
      console.error('Condition save error:', err);
      if (typeof showToast === 'function') showToast('\u26A0 Save failed', true);
    }
  }

  // ---- Delete ----
  async function deleteCondition(id, name) {
    if (!window.confirm(`Delete "${name}" from your conditions list?`)) return;
    try {
      await db.collection(COL).doc(id).delete();
      if (typeof showToast === 'function') showToast('Condition deleted');
      await refreshConditionsList();
    } catch (err) {
      console.error('Condition delete error:', err);
      if (typeof showToast === 'function') showToast('\u26A0 Delete failed', true);
    }
  }

  // ---- Open Edit modal pre-populated ----
  async function startEditCondition(id) {
    try {
      const doc = await db.collection(COL).doc(id).get();
      if (!doc.exists) return;
      const d = doc.data();
      el('condEditNameInput').value          = d.name          || '';
      el('condEditIcdInput').value           = d.icdCode       || '';
      el('condEditDiagnosedDateInput').value = d.diagnosedDate || '';
      el('condEditDiagnosedByInput').value   = d.diagnosedBy   || '';
      el('condEditStatusInput').value        = d.status        || 'active';
      el('condEditNotesInput').value         = d.notes         || '';
      el('condEditingId').value              = id;
      openModal('condEditModal');
    } catch (err) {
      console.error('Condition edit load error:', err);
    }
  }

  // ---- Setup ----
  function setupConditionsTab() {
    // Add modal
    el('openCondAddModalBtn')?.addEventListener('click', () => {
      resetAddForm();
      openModal('condAddModal');
    });
    el('condAddModalClose')?.addEventListener('click', () => closeModal('condAddModal'));
    el('cancelCondAddBtn')?.addEventListener('click',  () => closeModal('condAddModal'));
    el('saveCondAddBtn')?.addEventListener('click', addCondition);

    // Edit modal
    el('condEditModalClose')?.addEventListener('click', () => closeModal('condEditModal'));
    el('cancelCondEditModalBtn')?.addEventListener('click', () => closeModal('condEditModal'));
    el('saveCondEditBtn')?.addEventListener('click', saveEditCondition);

    // Close on backdrop click
    el('condAddModal')?.addEventListener('click', e => { if (e.target === el('condAddModal')) closeModal('condAddModal'); });
    el('condEditModal')?.addEventListener('click', e => { if (e.target === el('condEditModal')) closeModal('condEditModal'); });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal('condAddModal');
        closeModal('condEditModal');
      }
    });

    refreshConditionsList();
  }

  // Expose globals
  window.setupConditionsTab    = setupConditionsTab;
  window.refreshConditionsList = refreshConditionsList;

})();
