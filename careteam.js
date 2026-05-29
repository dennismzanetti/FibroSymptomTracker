// ============================================================
// CARE TEAM TAB
// Collections:
//   careTeam        — provider records
//   appointments    — appointment records (linked to careTeam docs)
// ============================================================

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
      if (targetViewId === 'ctAppointmentsView') refreshAppointmentList();
    });
  });

  document.getElementById('saveProviderBtn')?.addEventListener('click', saveProvider);
  document.getElementById('cancelProviderEditBtn')?.addEventListener('click', resetProviderForm);
  document.getElementById('saveApptBtn')?.addEventListener('click', saveAppointment);
  document.getElementById('cancelApptEditBtn')?.addEventListener('click', resetApptForm);

  refreshProviderList();
  populateProviderDropdown();
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

function resetProviderForm() {
  ['ctProviderName','ctProviderSpecialty','ctProviderOrg','ctProviderPhone',
   'ctProviderFax','ctProviderPortal','ctProviderAddress','ctProviderSymptoms',
   'ctProviderNotes','ctProviderEditingId'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const typeEl = document.getElementById('ctProviderType');
  if (typeEl) typeEl.value = '';
  const statusEl = document.getElementById('ctProviderStatus');
  if (statusEl) statusEl.value = 'active';
  document.getElementById('ctProviderFormTitle').textContent = 'Add Team Member';
  document.getElementById('saveProviderBtn').textContent = 'Add Team Member';
  document.getElementById('cancelProviderEditBtn').style.display = 'none';
}

async function saveProvider() {
  const data = getProviderFormData();
  if (!data.displayName) { alert('Please enter a provider name.'); return; }
  const editingId = document.getElementById('ctProviderEditingId').value;
  const now = new Date().toISOString();
  try {
    if (editingId) {
      await db.collection('careTeam').doc(editingId).set({ ...data, updatedAt: now }, { merge: true });
      showToast('\u2713 Provider updated');
    } else {
      await db.collection('careTeam').add({ ...data, createdAt: now, updatedAt: now });
      showToast('\u2713 Team member added');
    }
    resetProviderForm();
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
  document.getElementById('ctProviderName').value        = p.displayName || '';
  document.getElementById('ctProviderType').value        = p.providerType || '';
  document.getElementById('ctProviderSpecialty').value   = p.specialty || '';
  document.getElementById('ctProviderOrg').value         = p.organization || '';
  document.getElementById('ctProviderPhone').value       = p.phone || '';
  document.getElementById('ctProviderFax').value         = p.fax || '';
  document.getElementById('ctProviderPortal').value      = p.portalUrl || '';
  document.getElementById('ctProviderAddress').value     = p.address || '';
  document.getElementById('ctProviderStatus').value      = p.status || 'active';
  document.getElementById('ctProviderSymptoms').value    = p.symptomFocus || '';
  document.getElementById('ctProviderNotes').value       = p.notes || '';
  document.getElementById('ctProviderEditingId').value   = id;
  document.getElementById('ctProviderFormTitle').textContent = 'Edit Team Member';
  document.getElementById('saveProviderBtn').textContent = 'Save Changes';
  document.getElementById('cancelProviderEditBtn').style.display = 'inline-block';
  document.getElementById('ctProviderFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    snapshot.forEach(doc => {
      const p = doc.data();
      const typeLabel   = PROVIDER_TYPE_LABELS[p.providerType] || p.providerType || '';
      const statusLabel = PROVIDER_STATUS_LABELS[p.status] || p.status || '';
      const statusClass = 'ct-status-' + (p.status || 'active');

      const li = document.createElement('li');
      li.className = 'ct-provider-item';
      li.innerHTML = `
        <div class="ct-provider-header">
          <div class="ct-provider-identity">
            <span class="ct-provider-name">${escHtml(p.displayName || '')}</span>
            ${typeLabel ? `<span class="ct-badge ct-badge-type">${escHtml(typeLabel)}</span>` : ''}
            ${p.specialty ? `<span class="ct-provider-specialty">${escHtml(p.specialty)}</span>` : ''}
          </div>
          <span class="ct-badge ${statusClass}">${escHtml(statusLabel)}</span>
        </div>
        ${p.organization ? `<div class="ct-provider-org">${escHtml(p.organization)}</div>` : ''}
        <div class="ct-provider-meta">
          ${p.phone    ? `<a class="ct-meta-link" href="tel:${escHtml(p.phone)}">&#x1F4DE; ${escHtml(p.phone)}</a>` : ''}
          ${p.portalUrl ? `<a class="ct-meta-link" href="${escHtml(p.portalUrl)}" target="_blank" rel="noopener noreferrer">&#x1F517; Portal</a>` : ''}
          ${p.symptomFocus ? `<span class="ct-meta-text">Treats: ${escHtml(p.symptomFocus)}</span>` : ''}
        </div>
        ${p.notes ? `<div class="ct-provider-notes">${escHtml(p.notes)}</div>` : ''}
        <div class="ct-item-actions">
          <button class="ct-edit-btn">Edit</button>
          <button class="ct-appt-btn">+ Appointment</button>
          <button class="ct-delete-btn danger">Remove</button>
        </div>`;

      li.querySelector('.ct-edit-btn').addEventListener('click', () => startEditProvider(doc.id, p));
      li.querySelector('.ct-delete-btn').addEventListener('click', () => deleteProvider(doc.id, p.displayName));
      li.querySelector('.ct-appt-btn').addEventListener('click', () => {
        document.querySelector('.ct-sub-tab-btn[data-ct-view="ctAppointmentsView"]')?.click();
        const sel = document.getElementById('ctApptProvider');
        if (sel) sel.value = doc.id;
        document.getElementById('ctApptFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      list.appendChild(li);
    });
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
  ['ctApptDate','ctApptTime','ctApptLocation','ctApptPurpose',
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
  document.getElementById('ctApptFormTitle').textContent = 'Add Appointment';
  document.getElementById('saveApptBtn').textContent = 'Add Appointment';
  document.getElementById('cancelApptEditBtn').style.display = 'none';
}

async function saveAppointment() {
  const data = getApptFormData();
  if (!data.providerId) { alert('Please select a provider.'); return; }
  if (!data.date)        { alert('Please enter a date.'); return; }
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
  document.getElementById('ctApptProvider').value   = a.providerId || '';
  document.getElementById('ctApptDate').value       = a.date || '';
  document.getElementById('ctApptTime').value       = a.time || '';
  document.getElementById('ctApptLocation').value   = a.location || '';
  document.getElementById('ctApptPurpose').value    = a.purpose || '';
  document.getElementById('ctApptPrepNotes').value  = a.prepNotes || '';
  document.getElementById('ctApptPostNotes').value  = a.postNotes || '';
  document.getElementById('ctApptFollowUp').checked = a.followUpNeeded || false;
  document.getElementById('ctApptStatus').value     = a.status || 'upcoming';
  document.getElementById('ctApptEditingId').value  = id;
  document.getElementById('ctApptFormTitle').textContent = 'Edit Appointment';
  document.getElementById('saveApptBtn').textContent = 'Save Changes';
  document.getElementById('cancelApptEditBtn').style.display = 'inline-block';
  document.getElementById('ctApptFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const a = doc.data();
      if (a.status === 'upcoming' && a.date >= today) upcoming.push({ id: doc.id, ...a });
      else past.push({ id: doc.id, ...a });
    });

    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    past.sort((a, b) => b.date.localeCompare(a.date));

    function renderApptItem(a, listEl) {
      const [y, mo, dy] = (a.date || '').split('-').map(Number);
      const dateObj = (y && mo && dy) ? new Date(y, mo - 1, dy) : null;
      const dateLabel = dateObj
        ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : (a.date || 'No date');
      const statusLabel = APPT_STATUS_LABELS[a.status] || a.status || '';
      const statusClass = 'ct-status-' + (a.status || 'upcoming');
      const li = document.createElement('li');
      li.className = 'ct-appt-item';
      li.innerHTML = `
        <div class="ct-appt-header">
          <div class="ct-appt-who">
            <span class="ct-appt-provider">${escHtml(a.providerName || 'Unknown provider')}</span>
            <span class="ct-appt-date">${escHtml(dateLabel)}${a.time ? ' \u00B7 ' + escHtml(a.time) : ''}</span>
          </div>
          <span class="ct-badge ${statusClass}">${escHtml(statusLabel)}</span>
        </div>
        ${a.location ? `<div class="ct-appt-detail">&#x1F4CD; ${escHtml(a.location)}</div>` : ''}
        ${a.purpose  ? `<div class="ct-appt-detail">Purpose: ${escHtml(a.purpose)}</div>` : ''}
        ${a.prepNotes ? `<div class="ct-appt-notes"><span class="ct-notes-label">Prep notes:</span> ${escHtml(a.prepNotes)}</div>` : ''}
        ${a.postNotes ? `<div class="ct-appt-notes"><span class="ct-notes-label">Visit notes:</span> ${escHtml(a.postNotes)}</div>` : ''}
        ${a.followUpNeeded ? `<div class="ct-followup-flag">&#x2691; Follow-up needed</div>` : ''}
        <div class="ct-item-actions">
          <button class="ct-edit-btn">Edit</button>
          <button class="ct-delete-btn danger">Delete</button>
        </div>`;
      li.querySelector('.ct-edit-btn').addEventListener('click', () => startEditAppointment(a.id, a));
      li.querySelector('.ct-delete-btn').addEventListener('click', () =>
        deleteAppointment(a.id, `${a.providerName} \u2014 ${dateLabel}`));
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
