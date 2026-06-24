// trends.js
window._trendsActiveDays = 7;

window.setupTrends = function setupTrends(getUid) {
  document.querySelectorAll('#trends-tab .ct-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#trends-tab .ct-sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window._trendsActiveDays = parseInt(btn.dataset.days, 10);
      window.refreshTrends();
    });
  });
};

window.refreshTrends = async function refreshTrends() {
  const canvas = document.getElementById('functionalityChart');
  if (!canvas) return;

  FibroDiag.debug('Trends', 'Fetching trend data from Firestore...');
  FibroDiag.time('trends-fetch');

  const ctx = canvas.getContext('2d');
  const days = window._trendsActiveDays || 0;

  try {
    let query = db.collection('days').orderBy(firebase.firestore.FieldPath.documentId());

    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days - 1));
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;
      query = query.where(firebase.firestore.FieldPath.documentId(), '>=', cutoffStr);
      FibroDiag.debug('Trends', `Filtering from ${cutoffStr} (last ${days} days)`);
    }

    const snapshot = await query.get();

    const labels = [], data = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      if (typeof d.avgFunctionality === 'number') {
        labels.push(d.date || doc.id);
        data.push(d.avgFunctionality);
      }
    });

    FibroDiag.timeEnd('trends-fetch');
    FibroDiag.debug('Trends', `${snapshot.size} day docs fetched, ${data.length} have avgFunctionality`);

    if (window.functionalityChart) window.functionalityChart.destroy();

    if (data.length === 0) {
      const existingMsg = canvas.parentElement.querySelector('.trends-empty');
      if (!existingMsg) {
        const msg = document.createElement('p');
        msg.className = 'trends-empty';
        msg.textContent = 'No data found for this period. Start logging in the Today tab!';
        canvas.parentElement.insertBefore(msg, canvas);
      }
      canvas.style.display = 'none';
      FibroDiag.debug('Trends', 'No data — showing empty state');
      return;
    }

    const existingMsg = canvas.parentElement.querySelector('.trends-empty');
    if (existingMsg) existingMsg.remove();
    canvas.style.display = '';

    window.functionalityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Avg Functionality',
          data,
          borderColor: '#3f51b5',
          backgroundColor: 'rgba(63,81,181,0.15)',
          tension: 0.2,
          pointRadius: data.length <= 14 ? 4 : 2
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { suggestedMin: 0, suggestedMax: 10 },
          x: {
            ticks: {
              maxTicksLimit: days === 7 ? 7 : days === 30 ? 10 : 12,
              maxRotation: 45
            }
          }
        }
      }
    });

    FibroDiag.debug('Trends', 'Chart rendered successfully');
  } catch (err) {
    FibroDiag.error('Trends', 'Failed to load trend data', err);
    console.error('Error loading trends:', err);
  }
};
