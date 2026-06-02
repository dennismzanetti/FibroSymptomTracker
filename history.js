import { loadRange } from './cloud.js';
import { formatDateLong, datesInRange } from './date.js';

export async function loadAndRenderHistory(startStr, endStr, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<p>Loading&hellip;</p>';

  try {
    const days  = datesInRange(startStr, endStr);
    const data  = await loadRange(startStr, endStr);

    if (!data || Object.keys(data).length === 0) {
      container.innerHTML = '<p class="history-empty">No data found for this range.</p>';
      return;
    }

    const PAIN_FIELDS = [
      { key: 'pain.overall',   label: 'Overall Pain' },
      { key: 'pain.head',      label: 'Head' },
      { key: 'pain.neck',      label: 'Neck' },
      { key: 'pain.shoulders', label: 'Shoulders' },
      { key: 'pain.back',      label: 'Back' },
      { key: 'pain.hips',      label: 'Hips' },
      { key: 'pain.knees',     label: 'Knees' },
      { key: 'pain.hands',     label: 'Hands' },
    ];

    const WELLBEING_FIELDS = [
      { key: 'fatigue',        label: 'Fatigue' },
      { key: 'sleep.hours',    label: 'Sleep hrs' },
      { key: 'sleep.quality',  label: 'Sleep Quality' },
      { key: 'mood.score',     label: 'Mood' },
    ];

    const NOTE_KEYS = [
      { key: 'generalNotes',    label: 'Notes' },
      { key: 'medicationNotes', label: 'Medication' },
      { key: 'activityNotes',   label: 'Activity' },
      { key: 'weatherNotes',    label: 'Weather' },
    ];

    function getVal(obj, path) {
      return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }

    function cellClass(key, val) {
      if (val == null || val === '') return 'cell-missing';
      const num = Number(val);
      if (Number.isNaN(num)) return '';
      const isPainOrFatigue = key.startsWith('pain') || key === 'fatigue';
      const isSleep = key === 'sleep.hours' || key === 'sleep.quality';
      const isMood  = key === 'mood.score';
      if (isPainOrFatigue) {
        if (num <= 3) return 'cell-low';
        if (num <= 6) return 'cell-mid';
        return 'cell-high';
      }
      if (isSleep || isMood) {
        if (num >= 7) return 'cell-low';
        if (num >= 4) return 'cell-mid';
        return 'cell-high';
      }
      return '';
    }

    function groupHeaderRow(label, colspan) {
      return `<tr class="history-group-header"><td colspan="${colspan}">${label}</td></tr>`;
    }

    function fieldRows(fields) {
      return fields.map(({ key, label }) => {
        let row = `<tr><td class="history-field-label">${label}</td>`;
        days.forEach(d => {
          const val = getVal(data[d], key);
          const cls = cellClass(key, val);
          const displayVal = val != null && val !== '' ? val : '&mdash;';
          row += `<td class="history-value-cell ${cls}">${displayVal}</td>`;
        });
        return row + '</tr>';
      }).join('');
    }

    const colspan = days.length + 1;

    let html = '<div class="history-table-wrap"><table class="history-table"><thead><tr><th>Field</th>';
    days.forEach(d => {
      const label = formatDateLong(d).replace(/^\w+,\s/, '');
      html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';

    // --- Pain group ---
    html += groupHeaderRow('Pain', colspan);
    html += fieldRows(PAIN_FIELDS);

    // --- Wellbeing group ---
    html += groupHeaderRow('Wellbeing', colspan);
    html += fieldRows(WELLBEING_FIELDS);

    // --- Symptoms group ---
    html += groupHeaderRow('Symptoms', colspan);
    html += '<tr><td class="history-field-label">Symptoms</td>';
    days.forEach(d => {
      const syms = data[d]?.symptoms;
      html += `<td class="symptoms-cell ${syms && syms.length ? '' : 'cell-missing'}">${
        syms && syms.length
          ? syms.map(s => `<span class="sym-tag">${s.replace(/_/g,' ')}</span>`).join('')
          : '&mdash;'
      }</td>`;
    });
    html += '</tr>';

    // --- Notes group (collapsed by default) ---
    html += `<tr class="history-notes-toggle-row">
      <td colspan="${colspan}">
        <button class="history-notes-toggle-btn" type="button">&#9656; Show Notes</button>
      </td>
    </tr>`;

    NOTE_KEYS.forEach(({ key, label }) => {
      html += `<tr class="history-notes-row" style="display:none"><td class="history-field-label">${label}</td>`;
      days.forEach(d => {
        const val = data[d]?.[key];
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
    container.innerHTML = '<p class="history-empty">Failed to load history.</p>';
  }
}
