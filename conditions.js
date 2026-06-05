// conditions.js — Conditions / Diagnoses tab module
// Exposes window.setupConditionsTab() and window.refreshConditionsList()

(function () {

  // ---- Firestore collection ----
  const COL = 'conditions';

  // ---- DOM helpers ----
  function el(id) { return document.getElementById(id); }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resetForm() {
    el('condNameInput').value          = '';
    el('condIcdInput').value           = '';
    el('condDiagnosedDateInput').value = '';
    el('condDiagnosedByInput').value   = '';
    el('condStatusInput').value        = 'active';
    el('condNotesInput').value         = '';
    el('condEditingId').value          = '';
    el('condFormTitle').textContent    = 'Add Condition';
    el('savCondBtn').textContent       = 'Add Condition';
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
    list.innerHTML = '';
    docs.forEach(({ id, data: d }) => {
      const statusLabel = {
        active:    'Active',
        managed:   'Managed',
        resolved:  'Resolved',
        suspected: 'Suspected'
      }[d.status] || d.status || 'Unknown';

      const metaParts = [
        d.icdCode       ? 'ICD-10: ' + escHtml(d.icdCode)           : '',
        d.diagnosedDate ? 'Diagnosed: ' + escHtml(d.diagnosedDate)  : '',
        d.diagnosedBy   ? 'By: ' + escHtml(d.diagnosedBy)           : ''
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
      el('condFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Condition edit load error:', err);
    }
  }

  // ---- Setup ----
  function setupConditionsTab() {
    el('savCondBtn')?.addEventListener('click', saveCondition);
    el('cancelCondEditBtn')?.addEventListener('click', resetForm);
    refreshConditionsList();
  }

  // Expose globals
  window.setupConditionsTab    = setupConditionsTab;
  window.refreshConditionsList = refreshConditionsList;

})();
