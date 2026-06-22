// print.js — no ES module imports; uses global `db` and `auth` from app.js

(function () {
  let _printCache = null; // pre-built HTML string, cleared after print

  // ── Format helpers ──────────────────────────────────────────────
  function formatDateLong(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function val(v, unit) {
    return (v !== null && v !== undefined && v !== '') ? v + (unit || '') : '—';
  }

  // ── Build HTML from day records ──────────────────────────────────
  function buildPrintHTML(days) {
    if (!days.length) return '<p>No entries found for the selected range.</p>';
    return days.map(d => `
      <div class="print-day">
        <h2>${formatDateLong(d.date)}${d.dayTitle ? ' — ' + d.dayTitle : ''}</h2>
        <table>
          <tr><th>Pain</th><td>${val(d.painScore, '/10')}</td></tr>
          <tr><th>Fatigue</th><td>${val(d.fatigueScore, '/10')}</td></tr>
          <tr><th>Mood</th><td>${val(d.mood && d.mood.score !== undefined ? d.mood.score : d.moodScore, '/10')}</td></tr>
          <tr><th>Sleep</th><td>${val(d.sleep ? d.sleep.hours : d.hoursSlept)} hrs &nbsp;·&nbsp; quality ${val(d.sleep ? d.sleep.quality : d.sleepQuality, '/10')}</td></tr>
          ${d.tags && d.tags.length ? `<tr><th>Tags</th><td>${d.tags.join(', ')}</td></tr>` : ''}
          ${d.overallNotes ? `<tr><th>Notes</th><td>${d.overallNotes}</td></tr>` : ''}
        </table>
        ${d.mood && d.mood.notes ? `<div class="print-journal"><strong>Mood notes:</strong> ${d.mood.notes}</div>` : ''}
      </div>
    `).join('<hr/>');
  }

  // ── Fetch from Firestore using global db ─────────────────────────
  async function fetchDays(from, to) {
    const snap = await db.collection('days')
      .where(firebase.firestore.FieldPath.documentId(), '>=', from)
      .where(firebase.firestore.FieldPath.documentId(), '<=', to)
      .orderBy(firebase.firestore.FieldPath.documentId())
      .get();
    return snap.docs.map(doc => ({ date: doc.id, ...doc.data() }));
  }

  // ── Inject/update the hidden print-only container ────────────────
  function injectPrintContent(html) {
    let container = document.getElementById('printContent');
    if (!container) {
      container = document.createElement('div');
      container.id = 'printContent';
      container.className = 'print-only';
      document.body.appendChild(container);
    }
    container.innerHTML = html;
  }

  // ── Wire a single print button ───────────────────────────────────
  function wirePrintButton(btn, getDays) {
    btn.addEventListener('click', async () => {
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Loading…';

      try {
        const days = await getDays();
        _printCache = buildPrintHTML(days);
        injectPrintContent(_printCache);
        window.print();
      } catch (e) {
        console.error('Print failed:', e);
        showToast('⚠ Print failed — check connection', true);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  // ── Public setup called from app.js partialsLoaded ───────────────
  window.setupPrint = function () {
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    // Wire every element that has data-print-btn
    document.querySelectorAll('[data-print-btn]').forEach(btn => {
      const range = btn.dataset.printBtn; // 'default' | '7' | '90' | custom
      let getDays;
      if (range && range !== 'default' && !isNaN(Number(range))) {
        const days = Number(range);
        const f = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        getDays = () => fetchDays(f, to);
      } else {
        getDays = () => fetchDays(from, to);
      }
      wirePrintButton(btn, getDays);
    });

    // Also catch any button with id="printBtn" for backwards compatibility
    const legacyBtn = document.getElementById('printBtn');
    if (legacyBtn && !legacyBtn.dataset.printBtn) {
      wirePrintButton(legacyBtn, () => fetchDays(from, to));
    }

    // beforeprint: content is already injected — nothing async needed
    window.addEventListener('beforeprint', () => {
      if (!_printCache) {
        // Fallback: if someone triggers Ctrl+P without using the button
        injectPrintContent('<p>Use the Print button in the app to generate a full report.</p>');
      }
    });

    window.addEventListener('afterprint', () => {
      _printCache = null; // clear cache so next print gets fresh data
    });
  };
})();
