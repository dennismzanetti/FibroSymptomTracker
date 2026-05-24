import { loadRange } from './cloud.js';
import { formatDateLong } from './date.js';

export function setupHistory(getUid) {
  const fromEl   = document.getElementById('historyFrom');
  const toEl     = document.getElementById('historyTo');
  const loadBtn  = document.getElementById('loadHistoryBtn');
  const list     = document.getElementById('historyList');

  loadBtn.addEventListener('click', async () => {
    const uid  = getUid();
    const from = fromEl.value;
    const to   = toEl.value;
    if (!uid || !from || !to) return;

    list.innerHTML = '<li>Loading…</li>';
    try {
      const days = await loadRange(uid, from, to);
      if (!days.length) { list.innerHTML = '<li>No entries found.</li>'; return; }
      list.innerHTML = days.map(d => `
        <li>
          <strong>${formatDateLong(d.date)}</strong>
          ${d.dayTitle ? `<em>${d.dayTitle}</em>` : ''}
          <ul>
            ${d.painScore    ? `<li>Pain: ${d.painScore}/10</li>` : ''}
            ${d.fatigueScore ? `<li>Fatigue: ${d.fatigueScore}/10</li>` : ''}
            ${d.moodScore    ? `<li>Mood: ${d.moodScore}/10</li>` : ''}
          </ul>
        </li>
      `).join('');
    } catch (e) {
      list.innerHTML = '<li>Error loading history.</li>';
    }
  });
}
