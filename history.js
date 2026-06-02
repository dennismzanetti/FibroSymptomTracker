// history.js — plain global script (no ES modules)
// Exposes window.loadAndRenderHistory(startStr, endStr, containerId)

(function () {

  // ---------- date helpers (inlined from date.js) ----------
  function parseDateLocal(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function addDays(dateStr, n) {
    const d = parseDateLocal(dateStr);
    d.setDate(d.getDate() + n);
    return localDateStr(d);
  }

  function datesInRange(from, to) {
    const dates = [];
    let cur = from;
    while (cur <= to) {
      dates.push(cur);
      cur = addDays(cur, 1);
    }
    return dates;
  }

  function formatDateShort(dateStr) {
    const d = parseDateLocal(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatDow(dateStr) {
    const d = parseDateLocal(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  // ---------- deep-get helper ----------
  function getVal(obj, path) {
    if (!obj) return undefined;
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  // ---------- cell colour class ----------
  function cellClass(key, val) {
    if (val == null || val === '') return 'cell-missing';
    const num = Number(val);
    if (Number.isNaN(num)) return '';
    const isPainOrFatigue = key.startsWith('pain') || key === 'fatigue' || key === 'fatigueScore';
    const isSleep = key === 'sleep.hours' || key === 'sleep.quality';
    const isMood  = key === 'mood.score';
    const isFunctionality = key === 'avgFunctionality';
    if (isPainOrFatigue) {
      if (num <= 3) return 'cell-low';
      if (num <= 6) return 'cell-mid';
      return 'cell-high';
    }
    if (isSleep || isMood || isFunctionality) {
      if (num >= 7) return 'cell-low';
      if (num >= 4) return 'cell-mid';
      return 'cell-high';
    }
    return '';
  }

  // ---------- field definitions ----------
  const FUNCTIONALITY_FIELDS = [
    { key: 'avgFunctionality',                   label: 'Avg Functionality' },
    { key: 'functionality.earlyMorning.score',   label: 'Early Morning' },
    { key: 'functionality.lateMorning.score',    label: 'Late Morning' },
    { key: 'functionality.earlyAfternoon.score', label: 'Early Afternoon' },
    { key: 'functionality.lateAfternoon.score',  label: 'Late Afternoon' },
    { key: 'functionality.earlyEvening.score',   label: 'Early Evening' },
    { key: 'functionality.lateEvening.score',    label: 'Late Evening' },
  ];

  const WELLBEING_FIELDS = [
    { key: 'fatigueScore',   label: 'Fatigue' },
    { key: 'sleep.hours',    label: 'Sleep hrs' },
    { key: 'sleep.quality',  label: 'Sleep Quality' },
    { key: 'mood.score',     label: 'Mood' },
  ];

  const NOTE_KEYS = [
    { key: 'overallNotes',  label: 'Notes' },
    { key: 'sleep.notes',   label: 'Sleep' },
    { key: 'mood.notes',    label: 'Mood' },
    { key: 'painNotes',     label: 'Pain' },
    { key: 'fatigueNotes',  label: 'Fatigue' },
  ];

  // ---------- HTML builders ----------
  function groupHeaderRow(label, colspan) {
    return `<tr class="history-group-header"><td colspan="${colspan}">${label}</td></tr>`;
  }

  function fieldRows(fields, days, dataByDate) {
    return fields.map(({ key, label }) => {
      let row = `<tr><td class="history-field-label">${label}</td>`;
      days.forEach(d => {
        const val = getVal(dataByDate[d], key);
        const cls = cellClass(key, val);
        const display = (val != null && val !== '') ? (typeof val === 'number' ? val : val) : '&mdash;';
        row += `<td class="history-value-cell ${cls}">${display}</td>`;
      });
      row += '</tr>';
      return row;
    }).join('');
  }

  // ---------- main render function ----------
  async function loadAndRenderHistory(startStr, endStr, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p class="history-loading">Loading&hellip;</p>';

    try {
      // Use the same root "days" collection pattern as app.js
      const snapshot = await db.collection('days')
        .where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
        .where(firebase.firestore.FieldPath.documentId(), '<=', endStr)
        .orderBy(firebase.firestore.FieldPath.documentId())
        .get();

      const dataByDate = {};
      snapshot.forEach(doc => {
        dataByDate[doc.id] = Object.assign({ date: doc.id }, doc.data());
      });

      if (snapshot.empty) {
        container.innerHTML = '<p class="history-empty">No entries found for that date range.</p>';
        return;
      }

      // Build ordered day list from actual docs (not all dates in range)
      const days = datesInRange(startStr, endStr).filter(d => dataByDate[d]);

      if (!days.length) {
        container.innerHTML = '<p class="history-empty">No entries found for that date range.</p>';
        return;
      }

      const colspan = days.length + 1;

      // --- Header row ---
      let html = '<div class="history-table-wrap"><table class="history-table"><thead><tr><th class="history-field-label">Field</th>';
      days.forEach(d => {
        html += `<th class="history-date-th"><span class="history-th-dow">${formatDow(d)}</span><span class="history-th-date">${formatDateShort(d)}</span></th>`;
      });
      html += '</tr></thead><tbody>';

      // --- Functionality group ---
      html += groupHeaderRow('Functionality', colspan);
      html += fieldRows(FUNCTIONALITY_FIELDS, days, dataByDate);

      // --- Wellbeing group ---
      html += groupHeaderRow('Wellbeing', colspan);
      html += fieldRows(WELLBEING_FIELDS, days, dataByDate);

      // --- Symptoms group ---
      html += groupHeaderRow('Symptoms', colspan);
      html += '<tr><td class="history-field-label">Tags</td>';
      days.forEach(d => {
        const tags = dataByDate[d]?.tags;
        html += `<td class="symptoms-cell ${tags && tags.length ? '' : 'cell-missing'}">${
          tags && tags.length
            ? tags.map(s => `<span class="sym-tag">${s.replace(/_/g, ' ')}</span>`).join('')
            : '&mdash;'
        }</td>`;
      });
      html += '</tr>';

      // --- Notes toggle row ---
      html += `<tr class="history-notes-toggle-row">
        <td colspan="${colspan}">
          <button class="history-notes-toggle-btn" type="button">&#9656; Show Notes</button>
        </td>
      </tr>`;

      // --- Notes rows (hidden by default) ---
      NOTE_KEYS.forEach(({ key, label }) => {
        html += `<tr class="history-notes-row" style="display:none"><td class="history-field-label">${label}</td>`;
        days.forEach(d => {
          const val = getVal(dataByDate[d], key);
          html += `<td class="notes-cell ${val ? '' : 'cell-missing'}">${val ? val : '&mdash;'}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;

      // Wire notes toggle
      container.querySelector('.history-notes-toggle-btn')?.addEventListener('click', function () {
        const rows = container.querySelectorAll('.history-notes-row');
        const hidden = rows[0]?.style.display === 'none';
        rows.forEach(r => { r.style.display = hidden ? '' : 'none'; });
        this.innerHTML = hidden ? '&#9662; Hide Notes' : '&#9656; Show Notes';
      });

    } catch (err) {
      console.error('History load error:', err);
      container.innerHTML = '<p class="history-empty">&#x26A0;&#xFE0F; Failed to load history. Check your connection.</p>';
    }
  }

  // Expose as global
  window.loadAndRenderHistory = loadAndRenderHistory;

})();
