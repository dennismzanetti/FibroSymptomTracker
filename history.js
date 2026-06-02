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

    const FIELDS = [
      { key: 'pain.overall',      label: 'Overall Pain' },
      { key: 'pain.head',         label: 'Head' },
      { key: 'pain.neck',         label: 'Neck' },
      { key: 'pain.shoulders',    label: 'Shoulders' },
      { key: 'pain.back',         label: 'Back' },
      { key: 'pain.hips',         label: 'Hips' },
      { key: 'pain.knees',        label: 'Knees' },
      { key: 'pain.hands',        label: 'Hands' },
      { key: 'fatigue',           label: 'Fatigue' },
      { key: 'sleep.hours',       label: 'Sleep hrs' },
      { key: 'sleep.quality',     label: 'Sleep Quality' },
      { key: 'mood.score',        label: 'Mood' },
    ];

    function getVal(obj, path) {
      return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }

    let html = '<div class="history-scroll"><table class="history-table"><thead><tr><th>Field</th>';
    days.forEach(d => {
      const label = formatDateLong(d).replace(/^\w+,\s/, '');
      html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';

    FIELDS.forEach(({ key, label }) => {
      html += `<tr><td class="history-field-label">${label}</td>`;
      days.forEach(d => {
        const val = getVal(data[d], key);
        html += `<td>${val != null ? val : '&mdash;'}</td>`;
      });
      html += '</tr>';
    });

    // Symptoms row
    html += '<tr><td class="history-field-label">Symptoms</td>';
    days.forEach(d => {
      const syms = data[d]?.symptoms;
      html += `<td class="symptoms-cell">${syms && syms.length ? syms.map(s => `<span class="sym-tag">${s.replace(/_/g,' ')}</span>`).join('') : '&mdash;'}</td>`;
    });
    html += '</tr>';

    // Notes rows
    ['generalNotes','medicationNotes','activityNotes','weatherNotes'].forEach(noteKey => {
      const labelMap = { generalNotes: 'Notes', medicationNotes: 'Medication Notes', activityNotes: 'Activity', weatherNotes: 'Weather' };
      html += `<tr><td class="history-field-label">${labelMap[noteKey]}</td>`;
      days.forEach(d => {
        const val = data[d]?.[noteKey];
        html += `<td class="notes-cell">${val ? val : '&mdash;'}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch (err) {
    console.error('History load error:', err);
    container.innerHTML = '<p class="history-empty">Failed to load history.</p>';
  }
}
