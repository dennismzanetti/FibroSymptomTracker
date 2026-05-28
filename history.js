import { loadRange } from './cloud.js';
import { formatDateLong } from './date.js';

function scoreColor(val) {
  if (val === undefined || val === null) return '';
  if (val <= 3) return 'score-chip score-low';
  if (val <= 6) return 'score-chip score-mid';
  return 'score-chip score-high';
}

export function setupHistory(getUid) {
  const fromEl   = document.getElementById('historyFrom');
  const toEl     = document.getElementById('historyTo');
  const loadBtn  = document.getElementById('loadHistoryBtn');
  const list     = document.getElementById('historyList');

  // Default date range: last 14 days
  const today = new Date();
  const prior = new Date();
  prior.setDate(today.getDate() - 14);
  toEl.value   = today.toISOString().slice(0, 10);
  fromEl.value = prior.toISOString().slice(0, 10);

  loadBtn.addEventListener('click', async () => {
    const uid  = getUid();
    const from = fromEl.value;
    const to   = toEl.value;
    if (!uid || !from || !to) return;

    list.innerHTML = '<li class="history-loading">Loading&#8230;</li>';
    try {
      const days = await loadRange(uid, from, to);
      if (!days.length) {
        list.innerHTML = `
          <li class="history-empty">
            <span class="history-empty-icon">📋</span>
            <p>No entries found for this date range.</p>
          </li>`;
        return;
      }

      list.innerHTML = days.map(d => {
        const scores = [
          d.painScore    != null ? `<span class="${scoreColor(d.painScore)}">Pain ${d.painScore}/10</span>` : '',
          d.fatigueScore != null ? `<span class="${scoreColor(d.fatigueScore)}">Fatigue ${d.fatigueScore}/10</span>` : '',
          d.moodScore    != null ? `<span class="${scoreColor(d.moodScore)}">Mood ${d.moodScore}/10</span>` : '',
        ].filter(Boolean).join('');

        const notePreview = d.notes
          ? `<div class="history-notes-preview">${d.notes}</div>`
          : '';

        const titleLine = d.dayTitle
          ? `<span class="history-day-title">${d.dayTitle}</span>`
          : '';

        return `
          <li class="history-item" data-date="${d.date}" title="Click to load into form">
            <div class="history-item-header">
              <span class="history-date-label">${formatDateLong(d.date)}</span>
              ${titleLine}
              <div class="history-scores">${scores}</div>
            </div>
            ${notePreview}
          </li>`;
      }).join('');

    } catch (e) {
      list.innerHTML = '<li class="history-error">Error loading history. Please try again.</li>';
    }
  });
}
