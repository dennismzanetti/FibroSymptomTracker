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

  // ---------- sparkline SVG builder ----------
  function buildSparkline(points, higherIsBetter) {
    const nums = points.map(p => (p.val != null && p.val !== '') ? Number(p.val) : null);
    const valid = nums.filter(v => v !== null);
    if (valid.length < 2) return '';

    const W = 36, H = 16, PAD = 1;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;

    const coords = [];
    let xi = 0;
    const step = (W - PAD * 2) / (nums.length - 1);
    nums.forEach((v, i) => {
      if (v === null) { xi++; return; }
      const x = PAD + i * step;
      const y = PAD + (H - PAD * 2) * (1 - (v - min) / range);
      coords.push([x, y]);
      xi++;
    });

    if (coords.length < 2) return '';

    const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');

    const first = valid[0];
    const last  = valid[valid.length - 1];
    let color;
    if (Math.abs(last - first) < 0.5) {
      color = 'var(--color-text-faint)';
    } else if (higherIsBetter ? last > first : last < first) {
      color = 'var(--color-success)';
    } else {
      color = 'var(--color-error, var(--color-danger, #c0392b))';
    }

    return `<svg class="history-sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // ---------- field definitions ----------
  const FUNCTIONALITY_FIELDS = [
    { key: 'avgFunctionality',                   label: 'Avg Functionality',  higherIsBetter: true },
    { key: 'functionality.earlyMorning.score',   label: 'Early Morning',      higherIsBetter: true },
    { key: 'functionality.lateMorning.score',    label: 'Late Morning',       higherIsBetter: true },
    { key: 'functionality.earlyAfternoon.score', label: 'Early Afternoon',    higherIsBetter: true },
    { key: 'functionality.lateAfternoon.score',  label: 'Late Afternoon',     higherIsBetter: true },
    { key: 'functionality.earlyEvening.score',   label: 'Early Evening',      higherIsBetter: true },
    { key: 'functionality.lateEvening.score',    label: 'Late Evening',       higherIsBetter: true },
  ];

  const WELLBEING_FIELDS = [
    { key: 'fatigueScore',   label: 'Fatigue',       higherIsBetter: false },
    { key: 'sleep.hours',    label: 'Sleep hrs',     higherIsBetter: true  },
    { key: 'sleep.quality',  label: 'Sleep Quality', higherIsBetter: true  },
    { key: 'mood.score',     label: 'Mood',          higherIsBetter: true  },
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
    return fields.map(({ key, label, higherIsBetter }) => {
      const points = days.map(d => ({ date: d, val: getVal(dataByDate[d], key) }));
      const spark = buildSparkline(points, higherIsBetter !== false);

      let row = `<tr><td class="history-field-label"><span class="history-field-label-text">${label}</span>${spark}</td>`;
      days.forEach(d => {
        const val = getVal(dataByDate[d], key);
        const cls = cellClass(key, val);
        const display = (val != null && val !== '') ? val : '&mdash;';
        row += `<td class="history-value-cell ${cls}">${display}</td>`;
      });
      row += '</tr>';
      return row;
    }).join('');
  }

  // ---------- navigate to Daily Entry for a given date ----------
  function jumpToDate(dateStr) {
    if (typeof window.setCurrentDate === 'function') {
      window.setCurrentDate(dateStr);
    } else if (typeof window.currentDate !== 'undefined') {
      window.currentDate = dateStr;
    }
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
      dateInput.value = dateStr;
      dateInput.dispatchEvent(new Event('change'));
    }
    const entryBtn = document.querySelector('[data-tab="entry-tab"]');
    if (entryBtn) {
      entryBtn.click();
    } else {
      const tabSelect = document.getElementById('tabSelect');
      if (tabSelect) {
        tabSelect.value = 'entry-tab';
        tabSelect.dispatchEvent(new Event('change'));
      }
    }
    if (typeof window.loadDay === 'function') {
      window.loadDay(dateStr);
    }
  }

  // ---------- main render function ----------
  async function loadAndRenderHistory(startStr, endStr, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p class="history-loading">Loading&hellip;</p>';

    try {
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

      const days = datesInRange(startStr, endStr).filter(d => dataByDate[d]);

      if (!days.length) {
        container.innerHTML = '<p class="history-empty">No entries found for that date range.</p>';
        return;
      }

      const colspan = days.length + 1;

      let html = '<div class="history-table-wrap"><table class="history-table"><thead><tr><th class="history-field-label">Field</th>';
      days.forEach(d => {
        html += `<th class="history-date-th"><button class="history-date-btn" data-date="${d}" title="Go to ${d} in Daily Entry"><span class="history-th-dow">${formatDow(d)}</span><span class="history-th-date">${formatDateShort(d)}</span></button></th>`;
      });
      html += '</tr></thead><tbody>';

      html += groupHeaderRow('Functionality', colspan);
      html += fieldRows(FUNCTIONALITY_FIELDS, days, dataByDate);

      html += groupHeaderRow('Wellbeing', colspan);
      html += fieldRows(WELLBEING_FIELDS, days, dataByDate);

      html += groupHeaderRow('Symptoms', colspan);
      html += '<tr><td class="history-field-label"><span class="history-field-label-text">Tags</span></td>';
      days.forEach(d => {
        const tags = dataByDate[d]?.tags;
        html += `<td class="symptoms-cell ${tags && tags.length ? '' : 'cell-missing'}">${
          tags && tags.length
            ? tags.map(s => `<span class="sym-tag">${s.replace(/_/g, ' ')}</span>`).join('')
            : '&mdash;'
        }</td>`;
      });
      html += '</tr>';

      html += `<tr class="history-notes-toggle-row">
        <td colspan="${colspan}">
          <button class="history-notes-toggle-btn" type="button">&#9656; Show Notes</button>
        </td>
      </tr>`;

      NOTE_KEYS.forEach(({ key, label }) => {
        html += `<tr class="history-notes-row" style="display:none"><td class="history-field-label"><span class="history-field-label-text">${label}</span></td>`;
        days.forEach(d => {
          const val = getVal(dataByDate[d], key);
          html += `<td class="notes-cell ${val ? '' : 'cell-missing'}">${val ? val : '&mdash;'}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;

      container.querySelector('.history-notes-toggle-btn')?.addEventListener('click', function () {
        const rows = container.querySelectorAll('.history-notes-row');
        const hidden = rows[0]?.style.display === 'none';
        rows.forEach(r => { r.style.display = hidden ? '' : 'none'; });
        this.innerHTML = hidden ? '&#9662; Hide Notes' : '&#9656; Show Notes';
      });

      container.addEventListener('click', function (e) {
        const btn = e.target.closest('.history-date-btn');
        if (btn) {
          jumpToDate(btn.dataset.date);
        }
      });

      // --- Trigger AI Insights after table renders ---
      if (typeof window.generateInsights === 'function') {
        window.generateInsights(dataByDate, days, startStr, endStr);
      }

    } catch (err) {
      console.error('History load error:', err);
      container.innerHTML = '<p class="history-empty">&#x26A0;&#xFE0F; Failed to load history. Check your connection.</p>';
    }
  }

  window.loadAndRenderHistory = loadAndRenderHistory;

})();
