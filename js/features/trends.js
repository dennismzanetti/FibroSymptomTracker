// trends.js
window._trendsActiveDays = 7;
window._trendsPendingRender = false;  // flag: render was deferred because tab was hidden

window.setupTrends = function setupTrends(getUid) {
  document.querySelectorAll('#trends-tab .ct-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#trends-tab .ct-sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window._trendsActiveDays = parseInt(btn.dataset.days, 10);
      window.refreshTrends();
    });
  });

  ['overlayFunctionality', 'overlayMood', 'overlayTotalSleep', 'overlaySleepQuality', 'overlayMovingAvg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => window.refreshTrends());
  });
};

// Compute a simple 7-day rolling average over a data array.
// Returns an array of the same length; positions with fewer than
// 3 data points are set to null so Chart.js skips them cleanly.
function movingAverage(data, window_size = 7) {
  return data.map((_, i) => {
    const start = Math.max(0, i - window_size + 1);
    const slice = data.slice(start, i + 1).filter(v => v !== null && v !== undefined);
    return slice.length >= 3 ? (slice.reduce((a, b) => a + b, 0) / slice.length) : null;
  });
}

// Pull CSS variable value for chart colors (falls back to a hex if undefined).
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Update the four stat cards above the chart.
function updateStatCards(allDocs) {
  const today = new Date();

  function avg(docs, field) {
    const vals = docs.map(d => d[field]).filter(v => typeof v === 'number');
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }

  function docsInLastDays(n) {
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - (n - 1));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return allDocs.filter(d => (d.date || '') >= cutoffStr);
  }

  // 7-day and 30-day averages
  const avg7  = avg(docsInLastDays(7),  'avgFunctionality');
  const avg30 = avg(docsInLastDays(30), 'avgFunctionality');

  // Best single day this calendar month
  const thisMonthStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const thisMonthDocs = allDocs.filter(d => (d.date || '').startsWith(thisMonthStr));
  const bestVal = thisMonthDocs.reduce((best, d) =>
    typeof d.avgFunctionality === 'number' && d.avgFunctionality > best ? d.avgFunctionality : best, null);

  // Trend direction: compare last 7 days avg vs previous 7 days avg
  const recent  = avg(docsInLastDays(7),  'avgFunctionality');
  const prevDocs = (() => {
    const from = new Date(today); from.setDate(from.getDate() - 14);
    const to   = new Date(today); to.setDate(to.getDate() - 7);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr   = to.toISOString().slice(0, 10);
    return allDocs.filter(d => (d.date || '') >= fromStr && (d.date || '') < toStr);
  })();
  const prev = avg(prevDocs, 'avgFunctionality');
  let trendLabel = '\u2014';
  if (recent !== null && prev !== null) {
    const diff = recent - prev;
    if (diff > 0.3)       trendLabel = '\u2191 Better';
    else if (diff < -0.3) trendLabel = '\u2193 Worse';
    else                  trendLabel = '\u2192 Stable';
  }

  const fmt = v => v !== null ? v.toFixed(1) : '\u2014';
  const el = id => document.getElementById(id);
  if (el('statAvg7'))       el('statAvg7').textContent       = fmt(avg7);
  if (el('statAvg30'))      el('statAvg30').textContent      = fmt(avg30);
  if (el('statBestMonth'))  el('statBestMonth').textContent  = fmt(bestVal);
  if (el('statTrend'))      el('statTrend').textContent      = trendLabel;
}

window.refreshTrends = async function refreshTrends() {
  const canvas = document.getElementById('trends-chart-canvas');
  if (!canvas) return;

  if (canvas.offsetParent === null) {
    window._trendsPendingRender = true;
    FibroDiag.debug('Trends', 'Canvas not visible (tab hidden) \u2014 deferring chart render');
    return;
  }
  window._trendsPendingRender = false;

  FibroDiag.debug('Trends', 'Fetching trend data from Firestore...');
  FibroDiag.time('trends-fetch');

  const days = window._trendsActiveDays || 0;

  const overlayFunc       = document.getElementById('overlayFunctionality');
  const overlayMood       = document.getElementById('overlayMood');
  const overlayTotalSleep = document.getElementById('overlayTotalSleep');
  const overlaySleepQual  = document.getElementById('overlaySleepQuality');
  const overlayMovAvg     = document.getElementById('overlayMovingAvg');

  const showFunc       = overlayFunc       ? overlayFunc.checked       : true;
  const showMood       = overlayMood       ? overlayMood.checked       : false;
  const showTotalSleep = overlayTotalSleep ? overlayTotalSleep.checked : false;
  const showSleepQual  = overlaySleepQual  ? overlaySleepQual.checked  : false;
  const showMovAvg     = overlayMovAvg     ? overlayMovAvg.checked     : false;

  try {
    let query = db.collection('days').orderBy(firebase.firestore.FieldPath.documentId());

    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days - 1));
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      query = query.where(firebase.firestore.FieldPath.documentId(), '>=', cutoffStr);
      FibroDiag.debug('Trends', `Filtering from ${cutoffStr} (last ${days} days)`);
    }

    const snapshot = await query.get();

    const allDocs = [];
    snapshot.forEach(doc => {
      allDocs.push({ date: doc.id, ...doc.data() });
    });

    // Always compute stat cards from a full 30-day fetch even if chart shows less
    let statDocs = allDocs;
    if (days > 0 && days < 30) {
      try {
        const cutoff30 = new Date();
        cutoff30.setDate(cutoff30.getDate() - 29);
        const cutoff30Str = cutoff30.toISOString().slice(0, 10);
        const snap30 = await db.collection('days')
          .orderBy(firebase.firestore.FieldPath.documentId())
          .where(firebase.firestore.FieldPath.documentId(), '>=', cutoff30Str)
          .get();
        statDocs = [];
        snap30.forEach(d => statDocs.push({ date: d.id, ...d.data() }));
      } catch (_) { /* fall back to allDocs */ }
    }
    updateStatCards(statDocs);

    FibroDiag.timeEnd('trends-fetch');
    FibroDiag.debug('Trends', `${snapshot.size} day docs fetched`);

    // --- Destroy old chart instance and fully reset canvas ---
    if (window._trendsChartInstance instanceof Chart) {
      window._trendsChartInstance.destroy();
    }
    window._trendsChartInstance = null;
    canvas.removeAttribute('style');
    canvas.removeAttribute('width');
    canvas.removeAttribute('height');

    const ctx = canvas.getContext('2d');

    // --- Build labels and data series ---
    const labels         = allDocs.map(d => d.date);
    const funcData       = allDocs.map(d => typeof d.avgFunctionality === 'number' ? d.avgFunctionality : null);
    const moodData       = allDocs.map(d => {
      const score = d.mood?.score ?? d.moodScore;
      return typeof score === 'number' ? score : null;
    });
    const totalSleepData = allDocs.map(d => typeof d.totalSleep === 'number' ? d.totalSleep : null);
    const sleepQualData  = allDocs.map(d => typeof d.sleepQuality === 'number' ? d.sleepQuality : null);

    const hasAny = funcData.some(v => v !== null) ||
                   moodData.some(v => v !== null) ||
                   totalSleepData.some(v => v !== null) ||
                   sleepQualData.some(v => v !== null);

    // --- Empty state ---
    const existingMsg = canvas.parentElement.querySelector('.trends-empty');
    if (!hasAny) {
      if (!existingMsg) {
        const msg = document.createElement('div');
        msg.className = 'trends-empty empty-state';
        msg.innerHTML = '<div class="empty-state-icon">\ud83d\udcc8</div><p>No data yet \u2014 start logging in the Today tab!</p>';
        canvas.parentElement.insertBefore(msg, canvas);
      }
      canvas.style.display = 'none';
      FibroDiag.debug('Trends', 'No data \u2014 showing empty state');
      return;
    }
    if (existingMsg) existingMsg.remove();
    canvas.style.display = '';

    // --- Colors ---
    const colPrimary = cssVar('--color-primary', '#6c63ff');
    const colSuccess = cssVar('--color-success',  '#2f9e44');
    const colBlue    = cssVar('--color-blue',     '#006494');
    const colPurple  = cssVar('--color-purple',   '#7a39bb');
    const colWarning = cssVar('--color-warning',  '#e67700');

    // --- Datasets ---
    const datasets = [];

    if (showFunc) {
      datasets.push({
        label: 'Functionality',
        data: funcData,
        borderColor: colPrimary,
        backgroundColor: colPrimary + '26',
        tension: 0.2,
        pointRadius: labels.length <= 14 ? 4 : 2,
        fill: true,
        spanGaps: true
      });
    }

    if (showMood) {
      datasets.push({
        label: 'Mood',
        data: moodData,
        borderColor: colSuccess,
        backgroundColor: 'transparent',
        tension: 0.2,
        pointRadius: labels.length <= 14 ? 3 : 1,
        borderDash: [3, 3],
        spanGaps: true
      });
    }

    if (showTotalSleep) {
      datasets.push({
        label: 'Total Hours Slept',
        data: totalSleepData,
        borderColor: colBlue,
        backgroundColor: 'transparent',
        tension: 0.2,
        pointRadius: labels.length <= 14 ? 3 : 1,
        borderDash: [5, 3],
        spanGaps: true
      });
    }

    if (showSleepQual) {
      datasets.push({
        label: 'Sleep Quality',
        data: sleepQualData,
        borderColor: colPurple,
        backgroundColor: 'transparent',
        tension: 0.2,
        pointRadius: labels.length <= 14 ? 3 : 1,
        borderDash: [2, 4],
        spanGaps: true
      });
    }

    if (showMovAvg && funcData.some(v => v !== null)) {
      datasets.push({
        label: '7-Day Avg',
        data: movingAverage(funcData),
        borderColor: colWarning,
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [8, 4],
        spanGaps: false
      });
    }

    window._trendsChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: 'top',
            labels: { boxWidth: 12, font: { size: 11 } }
          },
          tooltip: { callbacks: {
            label: ctx => ctx.parsed.y !== null ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}` : null
          }}
        },
        scales: {
          y: {
            suggestedMin: 0,
            suggestedMax: 10,
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            ticks: {
              maxTicksLimit: days === 7 ? 7 : days === 30 ? 10 : 12,
              maxRotation: 45
            },
            grid: { display: false }
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
