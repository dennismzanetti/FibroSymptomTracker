// ============================================================
// CARE TEAM TAB
// Collections:
//   careTeam        — provider records
//   appointments    — appointment records (linked to careTeam docs)
// ============================================================

// Defensive escHtml fallback in case ui.js hasn't loaded yet
if (typeof escHtml !== 'function') {
  window.escHtml = function(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'block';
  // Scroll modal content to top each time it opens
  const inner = modal.querySelector('div');
  if (inner) inner.scrollTop = 0;
  // Trap focus on first focusable element
  const focusable = modal.querySelector('select, input, textarea, button:not([aria-label="Close"])');
  if (focusable) setTimeout(() => focusable.focus(), 50);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// ---- Sub-tab switching ----
function setupCareTeamTab() {
  document.querySelectorAll('.ct-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetViewId = btn.getAttribute('data-ct-view');
      document.querySelectorAll('.ct-sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.ct-view').forEach(view => {
        view.style.display = view.id === targetViewId ? '' : 'none';
      });
      if (targetViewId === 'ctProvidersView') refreshProviderList();
      if (targetViewId === 'ctAppointmentsView') {
        populateProviderDropdown();
        refreshAppointmentList();
      }
      if (targetViewId === 'ctPrintView') renderCTPrintPreviews();
    });
  });

  // Provider ADD modal
  document.getElementById('openProviderAddModalBtn')?.addEventListener('click', () => {
    resetProviderForm();
    openModal('ctProviderAddModal');
  });
  document.getElementById('saveProviderBtn')?.addEventListener('click', saveProvider);
  document.getElementById('cancelProviderAddBtn')?.addEventListener('click', () => closeModal('ctProviderAddModal'));
  document.getElementById('ctProviderAddModalClose')?.addEventListener('click', () => closeModal('ctProviderAddModal'));

  // Provider EDIT modal
  document.getElementById('saveProviderEditBtn')?.addEventListener('click', saveProviderEdit);
  document.getElementById('cancelProviderEditBtn')?.addEventListener('click', () => closeModal('ctProviderModal'));
  document.getElementById('ctProviderModalClose')?.addEventListener('click', () => closeModal('ctProviderModal'));

  // Appointment modal
  document.getElementById('openApptModalBtn')?.addEventListener('click', () => {
    resetApptForm();
    populateProviderDropdown().then(() => openModal('ctApptModal'));
  });
  document.getElementById('saveApptBtn')?.addEventListener('click', saveAppointment);
  document.getElementById('cancelApptEditBtn')?.addEventListener('click', () => {
    resetApptForm();
    closeModal('ctApptModal');
  });
  document.getElementById('ctApptModalClose')?.addEventListener('click', () => {
    resetApptForm();
    closeModal('ctApptModal');
  });

  // Print button
  document.getElementById('printCareTeamBtn')?.addEventListener('click', printCareTeam);

  // Close modals on backdrop click
  ['ctApptModal', 'ctProviderModal', 'ctProviderAddModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      if (e.target.id === id) closeModal(id);
    });
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('ctApptModal');
      closeModal('ctProviderModal');
      closeModal('ctProviderAddModal');
    }
  });

  // Default to Providers sub-tab on first load
  const defaultBtn = document.querySelector('.ct-sub-tab-btn[data-ct-view="ctProvidersView"]');
  if (defaultBtn) {
    defaultBtn.click();
  } else {
    refreshProviderList();
    populateProviderDropdown();
  }
}

// ============================================================
// PROVIDERS
// ============================================================

const PROVIDER_TYPE_LABELS = {
  physician:    'Primary Care',
  specialist:   'Specialist',
  rheumatology: 'Rheumatology',
  pain:         'Pain Management',
  pt:           'Physical Therapy',
  therapist:    'Mental Health',
  sleep:        'Sleep',
  neurology:    'Neurology',
  pharmacy:     'Pharmacy',
  clinic:       'Clinic',
  lab:          'Lab / Imaging',
  other:        'Other'
};

const PROVIDER_STATUS_LABELS = {
  active:        'Active',
  upcoming:      'Upcoming',
  referred:      'Referred',
  need_followup: 'Needs Follow-Up',
  former:        'Former'
};

// Reads the ADD modal form
function getProviderFormData() {
  return {
    displayName:  document.getElementById('ctProviderName').value.trim(),
    providerType: document.getElementById('ctProviderType').value,
    specialty:    document.getElementById('ctProviderSpecialty').value.trim(),
    organization: document.getElementById('ctProviderOrg').value.trim(),
    phone:        document.getElementById('ctProviderPhone').value.trim(),
    fax:          document.getElementById('ctProviderFax').value.trim(),
    portalUrl:    document.getElementById('ctProviderPortal').value.trim(),
    address:      document.getElementById('ctProviderAddress').value.trim(),
    status:       document.getElementById('ctProviderStatus').value,
    symptomFocus: document.getElementById('ctProviderSymptoms').value.trim(),
    notes:        document.getElementById('ctProviderNotes').value.trim()
  };
}

// Reads the EDIT modal form
function getProviderEditFormData() {
  return {
    displayName:  document.getElementById('ctEditProviderName').value.trim(),
    providerType: document.getElementById('ctEditProviderType').value,
    specialty:    document.getElementById('ctEditProviderSpecialty').value.trim(),
    organization: document.getElementById('ctEditProviderOrg').value.trim(),
    phone:        document.getElementById('ctEditProviderPhone').value.trim(),
    fax:          document.getElementById('ctEditProviderFax').value.trim(),
    portalUrl:    document.getElementById('ctEditProviderPortal').value.trim(),
    address:      document.getElementById('ctEditProviderAddress').value.trim(),
    status:       document.getElementById('ctEditProviderStatus').value,
    symptomFocus: document.getElementById('ctEditProviderSymptoms').value.trim(),
    notes:        document.getElementById('ctEditProviderNotes').value.trim()
  };
}

function resetProviderForm() {
  ['ctProviderName','ctProviderSpecialty','ctProviderOrg','ctProviderPhone',
   'ctProviderFax','ctProviderPortal','ctProviderAddress','ctProviderSymptoms',
   'ctProviderNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const typeEl = document.getElementById('ctProviderType');
  if (typeEl) typeEl.value = '';
  const statusEl = document.getElementById('ctProviderStatus');
  if (statusEl) statusEl.value = 'active';
}

// Save from the ADD modal (new providers only)
async function saveProvider() {
  const data = getProviderFormData();
  if (!data.displayName) { alert('Please enter a provider name.'); return; }
  const now = new Date().toISOString();
  try {
    await db.collection('careTeam').add({ ...data, createdAt: now, updatedAt: now });
    showToast('\u2713 Team member added');
    resetProviderForm();
    closeModal('ctProviderAddModal');
    refreshProviderList();
    populateProviderDropdown();
  } catch (err) {
    console.error('Error saving provider:', err);
    showToast('\u26A0 Save failed \u2014 check connection', true);
  }
}

// Save from the EDIT modal
async function saveProviderEdit() {
  const data = getProviderEditFormData();
  if (!data.displayName) { alert('Please enter a provider name.'); return; }
  const editingId = document.getElementById('ctProviderEditingId').value;
  if (!editingId) return;
  const now = new Date().toISOString();
  try {
    await db.collection('careTeam').doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
    showToast('\u2713 Provider updated');
    closeModal('ctProviderModal');
    refreshProviderList();
    populateProviderDropdown();
  } catch (err) {
    console.error('Error saving provider:', err);
    showToast('\u26A0 Save failed \u2014 check connection', true);
  }
}

async function deleteProvider(id, name) {
  if (!window.confirm(`Remove "${name}" from your care team?\n\nTheir appointments will remain in the Appointments list.`)) return;
  try {
    await db.collection('careTeam').doc(id).delete();
    refreshProviderList();
    populateProviderDropdown();
    showToast('Team member removed');
  } catch (err) {
    console.error('Error deleting provider:', err);
    showToast('\u26A0 Delete failed', true);
  }
}

function startEditProvider(id, p) {
  document.getElementById('ctEditProviderName').value      = p.displayName || '';
  document.getElementById('ctEditProviderType').value      = p.providerType || '';
  document.getElementById('ctEditProviderSpecialty').value = p.specialty || '';
  document.getElementById('ctEditProviderOrg').value       = p.organization || '';
  document.getElementById('ctEditProviderPhone').value     = p.phone || '';
  document.getElementById('ctEditProviderFax').value       = p.fax || '';
  document.getElementById('ctEditProviderPortal').value    = p.portalUrl || '';
  document.getElementById('ctEditProviderAddress').value   = p.address || '';
  document.getElementById('ctEditProviderStatus').value    = p.status || 'active';
  document.getElementById('ctEditProviderSymptoms').value  = p.symptomFocus || '';
  document.getElementById('ctEditProviderNotes').value     = p.notes || '';
  document.getElementById('ctProviderEditingId').value     = id;
  openModal('ctProviderModal');
}

// Fetches the next upcoming appointment date for a given provider ID
async function getNextAppointmentDate(providerId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const snapshot = await db.collection('appointments')
      .where('providerId', '==', providerId)
      .where('status', '==', 'upcoming')
      .where('date', '>=', today)
      .orderBy('date', 'asc')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data().date;
  } catch (err) {
    return null;
  }
}

function formatApptDate(dateStr) {
  if (!dateStr) return null;
  const [y, mo, dy] = dateStr.split('-').map(Number);
  if (!y || !mo || !dy) return dateStr;
  return new Date(y, mo - 1, dy).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

function formatEndDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

function apptEffectiveEndDate(a) {
  return (a.endDate && a.endDate >= a.date) ? a.endDate : a.date;
}

async function refreshProviderList() {
  const list = document.getElementById('ctProviderList');
  if (!list) return;
  list.innerHTML = '<li class="ct-empty">Loading\u2026</li>';
  try {
    const snapshot = await db.collection('careTeam').orderBy('displayName').get();
    if (snapshot.empty) {
      list.innerHTML = `
        <li class="ct-empty-state">
          <div class="ct-empty-icon">&#x1FA7A;</div>
          <h3>Build your care team</h3>
          <p>Add the doctors, specialists, therapists, and clinics involved in your fibro care.</p>
        </li>`;
      return;
    }
    list.innerHTML = '';

    const items = [];
    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

    const groups = {};
    for (const p of items) {
      const letter = (p.displayName || '?').trim().charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(p);
    }
    const sortedLetters = Object.keys(groups).sort();

    for (const letter of sortedLetters) {
      const headerLi = document.createElement('li');
      headerLi.className = 'ct-alpha-header';
      headerLi.setAttribute('aria-hidden', 'true');
      headerLi.textContent = letter;
      list.appendChild(headerLi);

      for (const p of groups[letter]) {
        const typeLabel   = PROVIDER_TYPE_LABELS[p.providerType] || p.providerType || '';
        const statusLabel = PROVIDER_STATUS_LABELS[p.status] || p.status || '';
        const statusClass = 'ct-status-' + (p.status || 'active');

        const nextApptDate = await getNextAppointmentDate(p.id);
        const nextApptHtml = nextApptDate
          ? `<div class="ct-provider-next-appt">&#x1F4C5; Next: ${escHtml(formatApptDate(nextApptDate))}</div>`
          : '';

        const subParts = [p.specialty, p.organization].filter(Boolean);
        const subHtml  = subParts.length
          ? `<div class="ct-provider-sub">${subParts.map(escHtml).join(' &middot; ')}</div>`
          : '';

        const metaItems = [
          p.phone        ? `<a class="ct-meta-link" href="tel:${escHtml(p.phone)}">&#x1F4DE; ${escHtml(p.phone)}</a>` : '',
          p.fax          ? `<span class="ct-meta-text">&#x1F4E0; Fax: ${escHtml(p.fax)}</span>` : '',
          p.portalUrl    ? `<a class="ct-meta-link" href="${escHtml(p.portalUrl)}" target="_blank" rel="noopener noreferrer">&#x1F517; Patient Portal</a>` : '',
          p.address      ? `<a class="ct-meta-link" href="https://maps.google.com/?q=${encodeURIComponent(p.address)}" target="_blank" rel="noopener noreferrer">&#x1F4CD; ${escHtml(p.address)}</a>` : '',
          p.symptomFocus ? `<span class="ct-meta-text">Treats: ${escHtml(p.symptomFocus)}</span>` : ''
        ].filter(Boolean).join('');
        const metaHtml = metaItems
          ? `<div class="ct-provider-meta">${metaItems}</div>`
          : '';

        const notesHtml = p.notes
          ? `<div class="ct-provider-notes">${escHtml(p.notes)}</div>`
          : '';

        const li = document.createElement('li');
        li.className = 'ct-provider-item';
        li.dataset.status = p.status || 'active';
        li.innerHTML = `
          <div class="ct-provider-body">
            <div class="ct-provider-identity">
              <div class="ct-provider-name-row">
                <span class="ct-provider-name">${escHtml(p.displayName || '')}</span>
                ${typeLabel ? `<span class="ct-badge ct-badge-type">${escHtml(typeLabel)}</span>` : ''}
              </div>
              ${subHtml}
              ${metaHtml}
              ${nextApptHtml}
            </div>
            <div class="ct-provider-status-wrap">
              <span class="ct-badge ${statusClass}">${escHtml(statusLabel)}</span>
            </div>
          </div>
          ${notesHtml}
          <div class="ct-item-actions">
            <button class="ct-edit-btn">Edit</button>
            <button class="ct-appt-btn">+ Appointment</button>
            <button class="ct-delete-btn danger">Remove</button>
          </div>`;

        li.querySelector('.ct-edit-btn').addEventListener('click', () => startEditProvider(p.id, p));
        li.querySelector('.ct-delete-btn').addEventListener('click', () => deleteProvider(p.id, p.displayName));
        li.querySelector('.ct-appt-btn').addEventListener('click', () => {
          // Switch to Appointments tab, then open modal with provider pre-selected
          document.querySelector('.ct-sub-tab-btn[data-ct-view="ctAppointmentsView"]')?.click();
          populateProviderDropdown().then(() => {
            resetApptForm();
            const sel = document.getElementById('ctApptProvider');
            if (sel) sel.value = p.id;
            openModal('ctApptModal');
          });
        });

        list.appendChild(li);
      }
    }
  } catch (err) {
    console.error('Error loading providers:', err);
    list.innerHTML = '<li class="ct-empty">&#x26A0; Failed to load care team.</li>';
  }
}

// ============================================================
// APPOINTMENTS
// ============================================================

const APPT_STATUS_LABELS = {
  upcoming:    'Upcoming',
  completed:   'Completed',
  cancelled:   'Cancelled',
  rescheduled: 'Rescheduled'
};

async function populateProviderDropdown() {
  const sel = document.getElementById('ctApptProvider');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">Select provider\u2026</option>';
  try {
    const snapshot = await db.collection('careTeam').orderBy('displayName').get();
    snapshot.forEach(doc => {
      const p = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = p.displayName + (p.specialty ? ` \u2014 ${p.specialty}` : '');
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  } catch (err) {
    console.error('Error populating provider dropdown:', err);
  }
}

function getApptFormData() {
  const providerSel  = document.getElementById('ctApptProvider');
  const providerName = providerSel?.options[providerSel.selectedIndex]?.text || '';
  return {
    providerId:     providerSel?.value || '',
    providerName:   providerName.split(' \u2014 ')[0],
    date:           document.getElementById('ctApptDate').value,
    endDate:        document.getElementById('ctApptEndDate')?.value || '',
    time:           document.getElementById('ctApptTime').value,
    location:       document.getElementById('ctApptLocation').value.trim(),
    purpose:        document.getElementById('ctApptPurpose').value.trim(),
    prepNotes:      document.getElementById('ctApptPrepNotes').value.trim(),
    postNotes:      document.getElementById('ctApptPostNotes').value.trim(),
    followUpNeeded: document.getElementById('ctApptFollowUp').checked,
    status:         document.getElementById('ctApptStatus').value
  };
}

function resetApptForm() {
  ['ctApptDate','ctApptEndDate','ctApptTime','ctApptLocation','ctApptPurpose',
   'ctApptPrepNotes','ctApptPostNotes','ctApptEditingId'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const provSel = document.getElementById('ctApptProvider');
  if (provSel) provSel.value = '';
  const statusEl = document.getElementById('ctApptStatus');
  if (statusEl) statusEl.value = 'upcoming';
  const followUpEl = document.getElementById('ctApptFollowUp');
  if (followUpEl) followUpEl.checked = false;
  document.getElementById('ctApptModalTitle').textContent = 'Add Appointment';
  document.getElementById('saveApptBtn').textContent = 'Add Appointment';
}

async function saveAppointment() {
  const data = getApptFormData();
  if (!data.providerId) { alert('Please select a provider.'); return; }
  if (!data.date)        { alert('Please enter a date.'); return; }

  if (data.endDate && data.endDate < data.date) {
    alert('End date cannot be before the start date.');
    return;
  }

  const editingId = document.getElementById('ctApptEditingId').value;
  const now = new Date().toISOString();
  try {
    if (editingId) {
      await db.collection('appointments').doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
      showToast('\u2713 Appointment updated');
    } else {
      await db.collection('appointments').add({ ...data, createdAt: now, updatedAt: now });
      showToast('\u2713 Appointment added');
    }
    resetApptForm();
    closeModal('ctApptModal');
    refreshAppointmentList();
  } catch (err) {
    console.error('Error saving appointment:', err);
    showToast('\u26A0 Save failed \u2014 check connection', true);
  }
}

async function deleteAppointment(id, label) {
  if (!window.confirm(`Delete this appointment?\n\n${label}`)) return;
  try {
    await db.collection('appointments').doc(id).delete();
    refreshAppointmentList();
    showToast('Appointment deleted');
  } catch (err) {
    console.error('Error deleting appointment:', err);
    showToast('\u26A0 Delete failed', true);
  }
}

function startEditAppointment(id, a) {
  populateProviderDropdown().then(() => {
    document.getElementById('ctApptProvider').value   = a.providerId || '';
    document.getElementById('ctApptDate').value       = a.date || '';
    document.getElementById('ctApptEndDate').value    = a.endDate || '';
    document.getElementById('ctApptTime').value       = a.time || '';
    document.getElementById('ctApptLocation').value   = a.location || '';
    document.getElementById('ctApptPurpose').value    = a.purpose || '';
    document.getElementById('ctApptPrepNotes').value  = a.prepNotes || '';
    document.getElementById('ctApptPostNotes').value  = a.postNotes || '';
    document.getElementById('ctApptFollowUp').checked = a.followUpNeeded || false;
    document.getElementById('ctApptStatus').value     = a.status || 'upcoming';
    document.getElementById('ctApptEditingId').value  = id;
    document.getElementById('ctApptModalTitle').textContent = 'Edit Appointment';
    document.getElementById('saveApptBtn').textContent = 'Save Changes';
    openModal('ctApptModal');
  });
}

async function refreshAppointmentList() {
  const upcomingList = document.getElementById('ctUpcomingAppts');
  const pastList     = document.getElementById('ctPastAppts');
  if (!upcomingList || !pastList) return;

  upcomingList.innerHTML = '<li class="ct-empty">Loading\u2026</li>';
  pastList.innerHTML     = '<li class="ct-empty">Loading\u2026</li>';

  try {
    const snapshot = await db.collection('appointments').orderBy('date', 'desc').get();
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [], past = [];

    snapshot.forEach(doc => {
      const a = { id: doc.id, ...doc.data() };
      const effectiveEnd = apptEffectiveEndDate(a);
      if (a.status === 'upcoming' && effectiveEnd >= today) upcoming.push(a);
      else past.push(a);
    });

    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    past.sort((a, b) => b.date.localeCompare(a.date));

    function renderApptItem(a, listEl) {
      const [y, mo, dy] = (a.date || '').split('-').map(Number);
      const dateObj = (y && mo && dy) ? new Date(y, mo - 1, dy) : null;
      const dateLabel = dateObj
        ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : (a.date || 'No date');

      const endDateLabel = a.endDate ? ' \u2192 ' + formatEndDate(a.endDate) : '';
      const dateLabelDisplay = dateLabel + endDateLabel;

      const timeStr = a.time ? ' \u00B7 ' + escHtml(a.time) : '';
      const statusLabel = APPT_STATUS_LABELS[a.status] || a.status || '';
      const statusClass = 'ct-status-' + (a.status || 'upcoming');

      const detailParts = [
        a.location ? '\uD83D\uDCCD ' + escHtml(a.location) : '',
        a.purpose  ? escHtml(a.purpose) : ''
      ].filter(Boolean);
      const detailHtml = detailParts.length
        ? `<div class="ct-appt-detail">${detailParts.join(' &middot; ')}</div>`
        : '';

      const notesParts = [
        a.prepNotes  ? `<span class="ct-notes-label">Prep:</span> ${escHtml(a.prepNotes)}`  : '',
        a.postNotes  ? `<span class="ct-notes-label">Visit:</span> ${escHtml(a.postNotes)}` : ''
      ].filter(Boolean);
      const notesHtml = notesParts.length
        ? `<div class="ct-appt-notes">${notesParts.join(' &nbsp;&#x7C;&nbsp; ')}</div>`
        : '';

      const followUpHtml = a.followUpNeeded
        ? `<span class="ct-followup-flag">&#x2691; Follow-up</span>`
        : '';

      const li = document.createElement('li');
      li.className = 'ct-appt-item';
      li.innerHTML = `
        <div class="ct-appt-compact">
          <div class="ct-appt-main">
            <div class="ct-appt-row1">
              <span class="ct-appt-provider">${escHtml(a.providerName || 'Unknown provider')}</span>
              <span class="ct-appt-datetime">${escHtml(dateLabelDisplay)}${timeStr}</span>
              <span class="ct-badge ${statusClass}">${escHtml(statusLabel)}</span>
              ${followUpHtml}
            </div>
            ${detailHtml}
            ${notesHtml}
          </div>
          <div class="ct-appt-actions">
            <button class="ct-icon-btn ct-icon-edit" title="Edit" aria-label="Edit appointment">&#x270E;</button>
            <button class="ct-icon-btn ct-icon-delete" title="Delete" aria-label="Delete appointment">&#x1F5D1;</button>
          </div>
        </div>`;

      li.querySelector('.ct-icon-edit').addEventListener('click', () => startEditAppointment(a.id, a));
      li.querySelector('.ct-icon-delete').addEventListener('click', () =>
        deleteAppointment(a.id, `${a.providerName} \u2014 ${dateLabelDisplay}`));
      listEl.appendChild(li);
    }

    upcomingList.innerHTML = '';
    if (upcoming.length === 0) {
      upcomingList.innerHTML = '<li class="ct-empty">No upcoming appointments.</li>';
    } else {
      upcoming.forEach(a => renderApptItem(a, upcomingList));
    }

    pastList.innerHTML = '';
    if (past.length === 0) {
      pastList.innerHTML = '<li class="ct-empty">No past appointments recorded.</li>';
    } else {
      past.forEach(a => renderApptItem(a, pastList));
    }

  } catch (err) {
    console.error('Error loading appointments:', err);
    upcomingList.innerHTML = '<li class="ct-empty">&#x26A0; Failed to load appointments.</li>';
    pastList.innerHTML = '';
  }
}

// ============================================================
// PRINT / EXPORT
// ============================================================

async function renderCTPrintPreviews() {
  await renderCareTeamPrintTable();
  await renderAppointmentsPrintTable();
}

async function renderCareTeamPrintTable() {
  const tbody = document.getElementById('ctProviderPrintTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading\u2026</td></tr>';
  try {
    const snapshot = await db.collection('careTeam').orderBy('displayName').get();
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--color-text-muted);">No providers on record.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    snapshot.forEach(doc => {
      const p = doc.data();
      const typeLabel   = PROVIDER_TYPE_LABELS[p.providerType] || p.providerType || '';
      const statusLabel = PROVIDER_STATUS_LABELS[p.status] || p.status || '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escHtml(p.displayName || '')}</td>
        <td>${escHtml(typeLabel)}</td>
        <td>${escHtml(p.specialty || '')}${p.organization ? '<br><span style="color:var(--color-text-muted);font-size:0.8em;">' + escHtml(p.organization) + '</span>' : ''}</td>
        <td>${p.phone ? escHtml(p.phone) : ''}</td>
        <td>${escHtml(statusLabel)}</td>
        <td>${escHtml(p.notes || '')}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error rendering care team print table:', err);
    tbody.innerHTML = '<tr><td colspan="6">&#x26A0; Failed to load.</td></tr>';
  }
}

async function renderAppointmentsPrintTable() {
  const tbody = document.getElementById('ctApptPrintTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading\u2026</td></tr>';
  try {
    const snapshot = await db.collection('appointments').orderBy('date', 'asc').get();
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--color-text-muted);">No appointments on record.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    snapshot.forEach(doc => {
      const a = doc.data();
      const [y, mo, dy] = (a.date || '').split('-').map(Number);
      const dateLabel = (y && mo && dy)
        ? new Date(y, mo - 1, dy).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : (a.date || '');
      const endLabel = a.endDate ? ' \u2013 ' + formatEndDate(a.endDate) : '';
      const statusLabel = APPT_STATUS_LABELS[a.status] || a.status || '';
      const notesArr = [
        a.prepNotes  ? 'Prep: ' + a.prepNotes  : '',
        a.postNotes  ? 'Visit: ' + a.postNotes : ''
      ].filter(Boolean);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escHtml(a.providerName || '')}</td>
        <td>${escHtml(dateLabel + endLabel)}${a.time ? '<br><span style="font-size:0.85em;color:var(--color-text-muted);">' + escHtml(a.time) + '</span>' : ''}</td>
        <td>${escHtml(a.location || '')}</td>
        <td>${escHtml(a.purpose || '')}</td>
        <td>${escHtml(statusLabel)}${a.followUpNeeded ? '<br><span style="font-size:0.8em;color:var(--color-primary);">\u2691 Follow-up</span>' : ''}</td>
        <td>${notesArr.map(escHtml).join('<br>')}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error rendering appointments print table:', err);
    tbody.innerHTML = '<tr><td colspan="6">&#x26A0; Failed to load.</td></tr>';
  }
}

async function printCareTeam() {
  const includeAppts = document.getElementById('includeAppointmentsChk')?.checked || false;

  await renderCareTeamPrintTable();
  if (includeAppts) await renderAppointmentsPrintTable();

  // Show/hide the appointments section based on checkbox
  const apptSection = document.getElementById('ctApptPrintSection');
  if (apptSection) apptSection.style.display = includeAppts ? '' : 'none';

  window.print();

  // Restore appointments section visibility after printing
  if (apptSection) apptSection.style.display = '';
}
