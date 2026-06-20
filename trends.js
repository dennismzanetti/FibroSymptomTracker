// trends.js — uses global `db` and `auth` from app.js (no ES module import needed)
// NOTE: days are stored at the top-level `days` collection (not under users/{uid}/days)

function setupTrends(getUid) {
  const fromEl  = document.getElementById('trendsFrom');
  const toEl    = document.getElementById('trendsTo');
  const loadBtn = document.getElementById('loadTrendsBtn');
  const canvas  = document.getElementById('trendsChart');
  let chart     = null;

  if (!loadBtn || !canvas) return;

  loadBtn.addEventListener('click', async () => {
    const from = fromEl ? fromEl.value : null;
    const to   = toEl   ? toEl.value   : null;
    if (!from || !to) return;

    try {
      const snap = await db
        .collection('days')
        .where(firebase.firestore.FieldPath.documentId(), '>=', from)
        .where(firebase.firestore.FieldPath.documentId(), '<=', to)
        .orderBy(firebase.firestore.FieldPath.documentId())
        .get();

      const days = snap.docs.map(d => ({ date: d.id, ...d.data() }));

      const labels  = days.map(d => d.date);
      const pain    = days.map(d => d.painScore    ?? null);
      const fatigue = days.map(d => d.fatigueScore ?? null);
      const mood    = days.map(d => d.mood ? (d.mood.score ?? null) : null);

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
    } catch (err) {
      console.error('Error loading trends range:', err);
    }
  });
}
