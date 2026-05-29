import { loadRange } from './cloud.js';
import { formatDateLong } from './date.js';

export function setupPrint(getUid) {
  const printBtn = document.getElementById('printReportBtn');
  if (!printBtn) return;

  printBtn.addEventListener('click', async () => {
    const uid   = getUid();
    const from  = document.getElementById('trendsFrom')?.value;
    const to    = document.getElementById('trendsTo')?.value;
    if (!uid || !from || !to) {
      alert('Please set a date range in the Trends tab first.');
      return;
    }

    const days = await loadRange(uid, from, to);
    if (!days.length) {
      alert('No entries found for that date range.');
      return;
    }

    const html = days.map(d => `
      <div class="print-day">
        <h2>${formatDateLong(d.date)}</h2>
        <table>
          <thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Pain</td><td>${d.painScore ?? '—'}/10</td></tr>
            <tr><td>Fatigue</td><td>${d.fatigueScore ?? '—'}/10</td></tr>
            <tr><td>Mood</td><td>${d.moodScore ?? '—'}/10</td></tr>
            <tr><td>Sleep</td><td>${d.sleepHours ?? '—'} h (quality ${d.sleepQuality ?? '—'}/10)</td></tr>
            <tr><td>Title</td><td>${d.dayTitle || '—'}</td></tr>
            <tr><td>Notes</td><td>${d.overallNotes || '—'}</td></tr>
          </tbody>
        </table>
      </div>
    `).join('');

    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="UTF-8">
        <title>Symptom Report</title>
        <style>
          body { font-family: sans-serif; font-size: 12pt; }
          h2 { margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
          th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid #ccc; }
          .print-day { page-break-inside: avoid; margin-bottom: 1.5rem; }
        </style>
      </head><body>
        <h1>Symptom Report: ${from} – ${to}</h1>
        ${html}
      </body></html>
    `);
    win.document.close();
    win.print();
  });
}
