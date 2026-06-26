// history.js — plain global script (no ES modules)
// Loads Firestore data for the Analysis tab and feeds it to AI Insights.
// The data table has been removed; only the AI Insights panel is rendered.

(function () {

  // ---------- date helpers ----------
  function parseDateLocal(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function addDays(dateStr, n) {
    const d = parseDateLocal(dateStr);
    d.setDate(d.getDate() + n);
    return localDateStr(d);
  }

  function datesInRange(from, to) {
    const dates = [];
    let cur = from;
    while (cur <= to) {
      dates.push(cur);
      cur = addDays(cur, 1);
    }
    return dates;
  }

  // ---------- main load function ----------
  async function loadAndRenderHistory(startStr, endStr, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    try {
      const snapshot = await db.collection('days')
        .where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
        .where(firebase.firestore.FieldPath.documentId(), '<=', endStr)
        .orderBy(firebase.firestore.FieldPath.documentId())
        .get();

      const dataByDate = {};
      snapshot.forEach(doc => {
        dataByDate[doc.id] = Object.assign({ date: doc.id }, doc.data());
      });

      if (snapshot.empty) {
        container.innerHTML = '<p class="history-empty">No entries found for that date range.</p>';
        return;
      }

      const days = datesInRange(startStr, endStr).filter(d => dataByDate[d]);

      if (!days.length) {
        container.innerHTML = '<p class="history-empty">No entries found for that date range.</p>';
        return;
      }

      // Feed data to AI Insights panel
      if (typeof window.generateInsights === 'function') {
        window.generateInsights(dataByDate, days, startStr, endStr);
      }

    } catch (err) {
      console.error('History load error:', err);
      container.innerHTML = '<p class="history-empty">&#x26A0;&#xFE0F; Failed to load history. Check your connection.</p>';
    }
  }

  window.loadAndRenderHistory = loadAndRenderHistory;

})();
