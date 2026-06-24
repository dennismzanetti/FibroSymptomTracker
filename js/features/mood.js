// ---- Mood & ATR ----

async function refreshMoodTab() {
  await Promise.all([refreshMoodSummaryTable(), refreshAtrList()]);
}

// ---- Helpers ----

function moodTier(s) {
  if (s === null || s === undefined) return 0;
  if (s <= 2) return 1;
  if (s <= 4) return 2;
  if (s <= 6) return 3;
  if (s <= 8) return 4;
  return 5;
}

function moodScorePillStyle(score) {
  if (score >= 7) return 'background:var(--color-success);color:#fff;';
  if (score >= 5) return 'background:var(--color-gold);color:#28251d;';
  if (score >= 3) return 'background:var(--color-warning);color:#fff;';
  return 'background:var(--color-error);color:#fff;';
}

// ---- 14-Day Mood Summary (chart + table) ----

let _moodTrendChart = null;

async function refreshMoodSummaryTable() {
  const tbody = document.getElementById('moodSummaryBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="mood-table-empty">Loading&#8230;</td></tr>';

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const FP = firebase.firestore.FieldPath;
    const [snap1, snap2] = await Promise.all([
      db.collection('days').where(FP.documentId(), 'in', dates.slice(0, 7)).get(),
      db.collection('days').where(FP.documentId(), 'in', dates.slice(7, 14)).get()
    ]);

    const byDate = {};
    snap1.forEach(doc => { byDate[doc.id] = doc.data(); });
    snap2.forEach(doc => { byDate[doc.id] = doc.data(); });

    const DOW   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Build arrays oldest→newest for chart, newest→oldest for table
    const chartDates  = dates.slice().reverse(); // oldest first
    const chartLabels = [];
    const chartScores = [];
    const chartNotes  = [];
    const chartHasNote = [];

    chartDates.forEach(dateStr => {
      const data  = byDate[dateStr];
      const score = data?.mood?.score ?? null;
      const note  = data?.mood?.notes || '';
      const d     = new Date(dateStr + 'T12:00:00');
      chartLabels.push(MONTH[d.getMonth()] + ' ' + d.getDate());
      chartScores.push(score);
      chartNotes.push(note);
      chartHasNote.push(!!note);
    });

    // Stats
    const validScores = chartScores.filter(s => s !== null);
    if (validScores.length) {
      const avg  = (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1);
      const high = Math.max(...validScores);
      const low  = Math.min(...validScores);
      const avgEl  = document.getElementById('moodAvgScore');
      const highEl = document.getElementById('moodHighScore');
      const lowEl  = document.getElementById('moodLowScore');
      if (avgEl)  avgEl.textContent  = avg;
      if (highEl) highEl.textContent = high;
      if (lowEl)  lowEl.textContent  = low;
    }

    // Render chart
    _renderMoodChart(chartLabels, chartScores, chartNotes, chartHasNote);

    // Notes count badge
    const notesCount = dates.filter(d => byDate[d]?.mood?.notes).length;
    const badgeEl = document.getElementById('moodNotesCount');
    if (badgeEl) badgeEl.textContent = notesCount + ' entr' + (notesCount === 1 ? 'y' : 'ies') + ' with notes';

    // Table (newest first)
    let rows = '';
    let hasAny = false;
    dates.forEach((dateStr, i) => {
      const data  = byDate[dateStr];
      const score = data?.mood?.score ?? null;
      const notes = data?.mood?.notes || '';
      const hasData = score !== null || notes;
      if (hasData) hasAny = true;

      const d      = new Date(dateStr + 'T12:00:00');
      const dow    = DOW[d.getDay()];
      const dateLbl = dow + ', ' + MONTH[d.getMonth()] + ' ' + d.getDate();

      const pillHtml = score !== null
        ? '<span class="mood-score-pill" style="' + moodScorePillStyle(score) + '">' + score + '</span>'
        : '<span class="mood-score-pill mood-score-pill-none">—</span>';

      const noteHtml = notes
        ? '<span class="mood-note-text">' + notes.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>'
        : '<span class="mood-note-empty">No notes</span>';

      rows += '<tr' + (hasData ? '' : ' style="opacity:0.45;"') + '>' +
        '<td class="mood-date-cell">' + dateLbl + '</td>' +
        '<td class="mood-score-cell">' + pillHtml + '</td>' +
        '<td>' + noteHtml + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = hasAny ? rows : '<tr><td colspan="3" class="mood-table-empty">No mood data in the last 14 days.</td></tr>';

  } catch (err) {
    console.error('Error loading mood summary:', err);
    tbody.innerHTML = '<tr><td colspan="3" class="mood-table-empty" style="color:var(--color-error);">Failed to load mood data.</td></tr>';
  }
}

function _renderMoodChart(labels, scores, notes, hasNote) {
  const canvas = document.getElementById('moodTrendChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (_moodTrendChart) {
    _moodTrendChart.destroy();
    _moodTrendChart = null;
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const style  = getComputedStyle(document.documentElement);
  const primaryColor  = style.getPropertyValue('--color-primary').trim();
  const hlColor       = style.getPropertyValue('--color-primary-highlight').trim();
  const textMuted     = style.getPropertyValue('--color-text-muted').trim();
  const textColor     = style.getPropertyValue('--color-text').trim();
  const borderColor   = style.getPropertyValue('--color-border').trim();
  const gridColor     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 180);
  if (isDark) {
    gradient.addColorStop(0, 'rgba(79,152,163,0.28)');
    gradient.addColorStop(1, 'rgba(79,152,163,0.0)');
  } else {
    gradient.addColorStop(0, 'rgba(1,105,111,0.16)');
    gradient.addColorStop(1, 'rgba(1,105,111,0.0)');
  }

  const pointColors = hasNote.map(n => n ? primaryColor : hlColor);

  _moodTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: scores,
        borderColor: primaryColor,
        borderWidth: 2.5,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        backgroundColor: gradient,
        tension: 0.35,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1c1b19' : '#fff',
          titleColor: textMuted,
          bodyColor: textColor,
          borderColor: borderColor,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx => 'Mood: ' + (ctx.parsed.y !== null ? ctx.parsed.y + '/10' : 'No entry'),
            afterLabel: (ctx) => {
              const note = notes[ctx.dataIndex];
              return note ? 'Note: ' + note.slice(0, 60) + (note.length > 60 ? '...' : '') : '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor, drawTicks: false },
          border: { dash: [4, 4], display: false },
          ticks: { color: textMuted, font: { size: 11 }, maxRotation: 45, minRotation: 0 }
        },
        y: {
          min: 0, max: 10,
          grid: { color: gridColor, drawTicks: false },
          border: { dash: [4, 4], display: false },
          ticks: { color: textMuted, font: { size: 11 }, stepSize: 2 }
        }
      }
    }
  });
}

// ---- Automatic Thought Records (ATR) ----

function getAtrFormData() {
  return {
    date: document.getElementById('atrDateInput').value,
    situation: document.getElementById('atrSituationInput').value.trim(),
    emotions: document.getElementById('atrEmotionsInput').value.trim(),
    intensity: parseInt(document.getElementById('atrIntensityRange').value, 10),
    automaticThought: document.getElementById('atrAutoThoughtInput').value.trim(),
    alternativeThought: document.getElementById('atrAltThoughtInput').value.trim()
  };
}

function resetAtrForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('atrDateInput').value = today;
  document.getElementById('atrSituationInput').value = '';
  document.getElementById('atrEmotionsInput').value = '';
  document.getElementById('atrIntensityRange').value = 50;
  document.getElementById('atrIntensityDisplay').textContent = '50';
  document.getElementById('atrAutoThoughtInput').value = '';
  document.getElementById('atrAltThoughtInput').value = '';
  document.getElementById('atrEditingId').value = '';
  document.getElementById('atrFormTitle').textContent = 'New Automatic Thought Record';
  document.getElementById('saveAtrBtn').textContent = 'Save Record';
  document.getElementById('cancelAtrEditBtn').style.display = 'none';
}

async function saveAtr() {
  const data = getAtrFormData();
  if (!data.date) { alert('Please select a date.'); return; }
  if (!data.situation) { alert('Please describe the situation.'); return; }
  if (!data.automaticThought) { alert('Please enter the automatic thought.'); return; }
  const editingId = document.getElementById('atrEditingId').value;
  const now = new Date().toISOString();
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) { alert('You must be signed in to save a record.'); return; }
  try {
    if (editingId) {
      await db.collection('automaticThoughtRecords').doc(editingId).set(
        { ...data, userId: uid, updatedAt: now },
        { merge: true }
      );
    } else {
      await db.collection('automaticThoughtRecords').add(
        { ...data, userId: uid, createdAt: now, updatedAt: now }
      );
    }
    resetAtrForm();
    await refreshAtrList();
  } catch (err) {
    console.error('Error saving ATR:', err);
    alert('Failed to save record. Please try again.');
  }
}

async function deleteAtr(id) {
  if (!window.confirm('Delete this Automatic Thought Record? This cannot be undone.')) return;
  try {
    await db.collection('automaticThoughtRecords').doc(id).delete();
    await refreshAtrList();
  } catch (err) {
    console.error('Error deleting ATR:', err);
    alert('Failed to delete record.');
  }
}

function startEditAtr(id, data) {
  document.getElementById('atrDateInput').value = data.date || '';
  document.getElementById('atrSituationInput').value = data.situation || '';
  document.getElementById('atrEmotionsInput').value = data.emotions || '';
  document.getElementById('atrIntensityRange').value = data.intensity ?? 50;
  document.getElementById('atrIntensityDisplay').textContent = data.intensity ?? 50;
  document.getElementById('atrAutoThoughtInput').value = data.automaticThought || '';
  document.getElementById('atrAltThoughtInput').value = data.alternativeThought || '';
  document.getElementById('atrEditingId').value = id;
  document.getElementById('atrFormTitle').textContent = 'Edit Automatic Thought Record';
  document.getElementById('saveAtrBtn').textContent = 'Save Changes';
  document.getElementById('cancelAtrEditBtn').style.display = 'inline-block';
  document.getElementById('atrFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function refreshAtrList() {
  const container = document.getElementById('atrList');
  if (!container) return;
  container.innerHTML = '<p class="atr-empty">Loading&#8230;</p>';
  try {
    const snapshot = await db.collection('automaticThoughtRecords')
      .orderBy('date', 'desc')
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<p class="atr-empty">No records yet. Use the form above to add one.</p>';
      return;
    }

    const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    container.className = 'atr-list';
    container.innerHTML = '';
    snapshot.forEach(doc => {
      const r = doc.data();
      const d = r.date ? new Date(r.date + 'T12:00:00') : null;
      const dateStr = d ? MONTH[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() : 'Unknown date';
      const card = document.createElement('div');
      card.className = 'atr-record';
      card.innerHTML =
        '<div class="atr-record-header">' +
          '<span class="atr-record-date">' + dateStr + '</span>' +
          (r.emotions ? '<span class="atr-record-emotions">' + r.emotions + '</span>' : '') +
          (r.intensity != null ? '<span class="atr-intensity-badge">' + r.intensity + '/100</span>' : '') +
          '<div class="atr-record-actions">' +
            '<button class="atr-edit-btn" aria-label="Edit record">Edit</button>' +
            '<button class="atr-delete-btn" aria-label="Delete record">Delete</button>' +
          '</div>' +
        '</div>' +
        '<div class="atr-record-body">' +
          '<div class="atr-field">' +
            '<span class="atr-field-label">Situation</span>' +
            '<p>' + (r.situation || '\u2014') + '</p>' +
          '</div>' +
          '<div class="atr-field">' +
            '<span class="atr-field-label">Automatic Thought</span>' +
            '<p>' + (r.automaticThought || '\u2014') + '</p>' +
          '</div>' +
          (r.alternativeThought
            ? '<div class="atr-field atr-field-alt">' +
                '<span class="atr-field-label">Alternative Thought</span>' +
                '<p>' + r.alternativeThought + '</p>' +
              '</div>'
            : '') +
        '</div>';
      card.querySelector('.atr-edit-btn').addEventListener('click', () => startEditAtr(doc.id, r));
      card.querySelector('.atr-delete-btn').addEventListener('click', () => deleteAtr(doc.id));
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading ATRs:', err);
    container.innerHTML = '<p class="atr-empty">Failed to load records.</p>';
  }
}

function setupAtrForm() {
  const slider  = document.getElementById('atrIntensityRange');
  const display = document.getElementById('atrIntensityDisplay');
  if (slider && display) {
    slider.addEventListener('input', () => { display.textContent = slider.value; });
  }
  const saveBtn = document.getElementById('saveAtrBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveAtr);
  const cancelBtn = document.getElementById('cancelAtrEditBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => resetAtrForm());
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('atrDateInput');
  if (dateInput && !dateInput.value) dateInput.value = today;
}
