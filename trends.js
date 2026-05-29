import { loadRange } from './cloud.js';

export function setupTrends(getUid) {
  const fromEl  = document.getElementById('trendsFrom');
  const toEl    = document.getElementById('trendsTo');
  const loadBtn = document.getElementById('loadTrendsBtn');
  const canvas  = document.getElementById('trendsChart');
  let chart     = null;

  loadBtn.addEventListener('click', async () => {
    const uid  = getUid();
    const from = fromEl.value;
    const to   = toEl.value;
    if (!uid || !from || !to) return;

    const days = await loadRange(uid, from, to);
    const labels = days.map(d => d.date);
    const pain    = days.map(d => d.painScore    ?? null);
    const fatigue = days.map(d => d.fatigueScore ?? null);
    const mood    = days.map(d => d.moodScore    ?? null);

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Pain',    data: pain,    borderColor: '#e05',  tension: 0.3, spanGaps: true },
          { label: 'Fatigue', data: fatigue, borderColor: '#f80',  tension: 0.3, spanGaps: true },
          { label: 'Mood',    data: mood,    borderColor: '#08a',  tension: 0.3, spanGaps: true },
        ]
      },
      options: {
        scales: { y: { min: 1, max: 10 } },
        plugins: { legend: { position: 'top' } }
      }
    });
  });
}
