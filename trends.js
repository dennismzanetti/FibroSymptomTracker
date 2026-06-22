// trends.js
window.setupTrends = function setupTrends(getUid) {
  // nothing to wire up at init time; refreshTrends() in app.js drives rendering
};

window.refreshTrends = async function refreshTrends() {
  const canvas = document.getElementById('functionalityChart');
  if (!canvas) return;

  FibroDiag.debug('Trends', 'Fetching trend data from Firestore...');
  FibroDiag.time('trends-fetch');

  const ctx = canvas.getContext('2d');
  try {
    const snapshot = await db.collection('days')
      .orderBy(firebase.firestore.FieldPath.documentId())
      .get();

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
    window.functionalityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Average daily functionality',
          data,
          borderColor: '#3f51b5',
          backgroundColor: 'rgba(63,81,181,0.15)',
          tension: 0.2
        }]
      },
      options: { scales: { y: { suggestedMin: 0, suggestedMax: 10 } } }
    });

    FibroDiag.debug('Trends', 'Chart rendered successfully');
  } catch (err) {
    FibroDiag.error('Trends', 'Failed to load trend data', err);
    console.error('Error loading trends:', err);
  }
};
