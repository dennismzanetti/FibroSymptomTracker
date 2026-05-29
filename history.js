import { loadRange } from './cloud.js';
import { formatDateLong } from './date.js';
import { initFirebase } from './firebase-init.js';

export function setupHistory(getUid, loadEntryForDate) {
  const fromEl  = document.getElementById('historyFrom');
  const toEl    = document.getElementById('historyTo');
  const loadBtn = document.getElementById('loadHistoryBtn');
  const listEl  = document.getElementById('historyList');

  loadBtn.addEventListener('click', async () => {
    const uid  = getUid();
    const from = fromEl.value;
    const to   = toEl.value;
    if (!uid || !from || !to) return;

    listEl.innerHTML = '<p>Loading…</p>';
    const days = await loadRange(uid, from, to);
    listEl.innerHTML = '';

    if (!days.length) {
      listEl.innerHTML = '<p>No entries found.</p>';
      return;
    }

    days.slice().reverse().forEach(d => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-card-header">
          <span class="history-card-date">${formatDateLong(d.date)}</span>
          <span class="history-card-title">${d.dayTitle || ''}</span>
        </div>
        <div class="history-scores">
          <span class="score-chip">Pain ${d.painScore ?? '—'}/10</span>
          <span class="score-chip">Fatigue ${d.fatigueScore ?? '—'}/10</span>
          <span class="score-chip">Mood ${d.moodScore ?? '—'}/10</span>
          <span class="score-chip">Sleep ${d.sleepHours ?? '—'} h</span>
        </div>
        ${d.overallNotes ? `<p class="history-notes">${d.overallNotes}</p>` : ''}
        <div class="history-card-actions">
          <button class="history-load-btn" data-date="${d.date}">Load this day</button>
          <button class="history-delete-btn" data-date="${d.date}">Delete</button>
        </div>
      `;

      card.querySelector('.history-load-btn').addEventListener('click', () => {
        loadEntryForDate(d.date);
      });

      card.querySelector('.history-delete-btn').addEventListener('click', async () => {
        if (!confirm('Delete entry for ' + formatDateLong(d.date) + '?')) return;
        const { db } = initFirebase();
        await db.collection('users').doc(uid).collection('days').doc(d.date).delete();
        card.remove();
      });

      listEl.appendChild(card);
    });
  });
}
