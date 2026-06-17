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
    });
  });

  document.getElementById('saveProviderBtn')?.addEventListener('click', saveProvider);
  document.getElementById('cancelProviderEditBtn')?.addEventListener('click', resetProviderForm);
  document.getElementById('saveApptBtn')?.addEventListener('click', saveAppointment);
  document.getElementById('cancelApptEditBtn')?.addEventListener('click', resetApptForm);

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

// Format an end date compactly — no year, to avoid repeating it when
// start and end are in the same year (e.g. "Fri, Jun 20")
function formatEndDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

// Returns the effective end date of an appointment for sorting/bucketing:
// uses endDate if present, otherwise falls back to date.
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

    // Group by first letter of displayName
    const groups = {};
    for (const p of items) {
      const letter = (p.displayName || '?').trim().charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(p);
    }
    const sortedLetters = Object.keys(groups).sort();

    for (const letter of sortedLetters) {
      // Alpha group header
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

        // Build sub-line: specialty · org
        const subParts = [p.specialty, p.organization].filter(Boolean);
        const subHtml  = subParts.length
          ? `<div class="ct-provider-sub">${subParts.map(escHtml).join(' &middot; ')}</div>`
          : '';

        // Meta pills: phone, fax, portal, address, symptom focus
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
          document.querySelector('.ct-sub-tab-btn[data-ct-view="ctAppointmentsView"]')?.click();
          const sel = document.getElementById('ctApptProvider');
          if (sel) sel.value = p.id;
          document.getElementById('ctApptFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  document.getElementById('ctApptFormTitle').textContent = 'Add Appointment';
  document.getElementById('saveApptBtn').textContent = 'Add Appointment';
  document.getElementById('cancelApptEditBtn').style.display = 'none';
}

async function saveAppointment() {
  const data = getApptFormData();
  if (!data.providerId) { alert('Please select a provider.'); return; }
  if (!data.date)        { alert('Please enter a date.'); return; }

  // Validate end date is not before start date
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
  document.getElementById('ctApptEndDate').value    = a.endDate || '';
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

      const statusLabel = APPT_STATUS_LABELS[a.status] || a.status || '';
      const statusClass = 'ct-status-' + (a.status || 'upcoming');
      const li = document.createElement('li');
      li.className = 'ct-appt-item';
      li.innerHTML = `
        <div class="ct-appt-header">
          <div class="ct-appt-who">
            <span class="ct-appt-provider">${escHtml(a.providerName || 'Unknown provider')}</span>
            <span class="ct-appt-date">${escHtml(dateLabelDisplay)}${a.time ? ' &middot; ' + escHtml(a.time) : ''}</span>
          </div>
          <span class="ct-badge ${statusClass}">${escHtml(statusLabel)}</span>
        </div>
        ${a.location  ? `<div class="ct-appt-detail">&#x1F4CD; ${escHtml(a.location)}</div>` : ''}
        ${a.purpose   ? `<div class="ct-appt-detail">Purpose: ${escHtml(a.purpose)}</div>` : ''}
        ${a.prepNotes ? `<div class="ct-appt-notes"><span class="ct-notes-label">Prep notes:</span> ${escHtml(a.prepNotes)}</div>` : ''}
        ${a.postNotes ? `<div class="ct-appt-notes"><span class="ct-notes-label">Visit notes:</span> ${escHtml(a.postNotes)}</div>` : ''}
        ${a.followUpNeeded ? `<div class="ct-followup-flag">&#x2691; Follow-up needed</div>` : ''}
        <div class="ct-item-actions">
          <button class="ct-edit-btn">Edit</button>
          <button class="ct-delete-btn danger">Delete</button>
        </div>`;
      li.querySelector('.ct-edit-btn').addEventListener('click', () => startEditAppointment(a.id, a));
      li.querySelector('.ct-delete-btn').addEventListener('click', () =>
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
