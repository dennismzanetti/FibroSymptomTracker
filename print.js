import { loadRange } from './cloud.js';
import { formatDateLong, datesInRange } from './date.js';

export function setupPrint(getUid) {
  // Print is triggered by window.print() from the UI
  // This module just prepares a print-friendly view
  window.addEventListener('beforeprint', async () => {
    const uid = getUid();
    if (!uid) return;

    // Print last 30 days by default
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    try {
      const days = await loadRange(uid, from, to);
      const container = document.getElementById('printContent') || document.createElement('div');
      container.id = 'printContent';
      container.className = 'print-only';

      container.innerHTML = days.map(d => `
        <div class="print-day">
          <h2>${formatDateLong(d.date)}${d.dayTitle ? ' — ' + d.dayTitle : ''}</h2>
          <table>
            <tr><th>Pain</th><td>${d.painScore || '—'}/10</td></tr>
            <tr><th>Fatigue</th><td>${d.fatigueScore || '—'}/10</td></tr>
            <tr><th>Mood</th><td>${d.moodScore || '—'}/10</td></tr>
            <tr><th>Sleep</th><td>${d.hoursSlept || '—'} hrs (quality: ${d.sleepQuality || '—'}/10)</td></tr>
            <tr><th>Brain fog</th><td>${d.brainFogScore || '—'}/10</td></tr>
            <tr><th>Water</th><td>${d.water || '—'} oz</td></tr>
            ${d.tags && d.tags.length ? `<tr><th>Tags</th><td>${d.tags.join(', ')}</td></tr>` : ''}
            ${d.overallNotes ? `<tr><th>Notes</th><td>${d.overallNotes}</td></tr>` : ''}
          </table>
          ${d.journal ? `<div class="print-journal"><strong>Journal:</strong> ${d.journal}</div>` : ''}
        </div>
      `).join('<hr />');

      if (!document.getElementById('printContent')) {
        document.body.appendChild(container);
      }
    } catch (e) {
      console.error('Print prep failed:', e);
    }
  });
}
