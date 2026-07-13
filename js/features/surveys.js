// ================================================================
// SURVEYS.JS — PHQ-9 and GAD-7 screening forms
// ================================================================

// ── Question definitions ─────────────────────────────────────────

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead or of hurting yourself in some way'
];

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen'
];

const LIKERT_LABELS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' }
];

// ── Severity helpers ─────────────────────────────────────────────

function phq9Severity(score) {
  if (score <= 4)  return { label: 'Minimal',           cls: 'survey-sev-minimal' };
  if (score <= 9)  return { label: 'Mild',               cls: 'survey-sev-mild' };
  if (score <= 14) return { label: 'Moderate',           cls: 'survey-sev-moderate' };
  if (score <= 19) return { label: 'Moderately Severe',  cls: 'survey-sev-severe' };
  return               { label: 'Severe',              cls: 'survey-sev-verysevere' };
}

function gad7Severity(score) {
  if (score <= 4)  return { label: 'Minimal',  cls: 'survey-sev-minimal' };
  if (score <= 9)  return { label: 'Mild',     cls: 'survey-sev-mild' };
  if (score <= 14) return { label: 'Moderate', cls: 'survey-sev-moderate' };
  return               { label: 'Severe',  cls: 'survey-sev-verysevere' };
}

// ── DOM builders ─────────────────────────────────────────────────

function buildSurveyQuestions(containerId, questions, prefix, onChangeCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  questions.forEach((qText, idx) => {
    const qNum = idx + 1;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'survey-question';
    const legend = document.createElement('legend');
    legend.className = 'survey-question-text';
    legend.innerHTML = '<span class="survey-q-num">' + qNum + '.</span> ' + qText;
    fieldset.appendChild(legend);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'survey-likert-group';
    btnGroup.setAttribute('role', 'group');

    LIKERT_LABELS.forEach(opt => {
      const id = prefix + '_q' + qNum + '_v' + opt.value;
      const label = document.createElement('label');
      label.className = 'survey-likert-btn';
      label.htmlFor = id;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = prefix + '_q' + qNum;
      input.id = id;
      input.value = opt.value;
      input.addEventListener('change', onChangeCallback);

      label.appendChild(input);
      label.appendChild(document.createTextNode(opt.label));
      btnGroup.appendChild(label);
    });

    fieldset.appendChild(btnGroup);
    container.appendChild(fieldset);
  });
}

// ── Score calculation ─────────────────────────────────────────────

function calcSurveyScore(prefix, count) {
  let score = 0;
  let complete = true;
  const answers = [];
  for (let i = 1; i <= count; i++) {
    const selected = document.querySelector('input[name="' + prefix + '_q' + i + '"]:checked');
    if (selected) {
      const val = parseInt(selected.value, 10);
      score += val;
      answers.push(val);
    } else {
      complete = false;
      answers.push(null);
    }
  }
  return { score, complete, answers };
}

// ── Live score update ─────────────────────────────────────────────

function updatePhq9Score() {
  const { score } = calcSurveyScore('phq9', PHQ9_QUESTIONS.length);
  const sev = phq9Severity(score);
  const numEl = document.getElementById('phq9ScoreNum');
  const badgeEl = document.getElementById('phq9SeverityBadge');
  if (numEl) numEl.textContent = score;
  if (badgeEl) {
    badgeEl.textContent = sev.label;
    badgeEl.className = 'survey-severity-badge ' + sev.cls;
  }
}

function updateGad7Score() {
  const { score } = calcSurveyScore('gad7', GAD7_QUESTIONS.length);
  const sev = gad7Severity(score);
  const numEl = document.getElementById('gad7ScoreNum');
  const badgeEl = document.getElementById('gad7SeverityBadge');
  if (numEl) numEl.textContent = score;
  if (badgeEl) {
    badgeEl.textContent = sev.label;
    badgeEl.className = 'survey-severity-badge ' + sev.cls;
  }
}

// ── Reset form ────────────────────────────────────────────────────

function resetSurveyForm(prefix, count, dateInputId, scoreNumId, severityFn, badgeId) {
  for (let i = 1; i <= count; i++) {
    const inputs = document.querySelectorAll('input[name="' + prefix + '_q' + i + '"]');
    inputs.forEach(inp => { inp.checked = false; });
    inputs.forEach(inp => {
      const lbl = inp.closest('label');
      if (lbl) lbl.classList.remove('selected');
    });
  }
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById(dateInputId);
  if (dateEl) dateEl.value = today;
  const numEl = document.getElementById(scoreNumId);
  if (numEl) numEl.textContent = '0';
  const sev = severityFn(0);
  const badgeEl = document.getElementById(badgeId);
  if (badgeEl) { badgeEl.textContent = sev.label; badgeEl.className = 'survey-severity-badge ' + sev.cls; }
}

// ── Save to Firestore ─────────────────────────────────────────────

async function saveSurvey(type, prefix, count, dateInputId, scoreFn, severityFn) {
  const dateVal = document.getElementById(dateInputId) && document.getElementById(dateInputId).value;
  if (!dateVal) { alert('Please select a date.'); return; }

  const { score, complete, answers } = calcSurveyScore(prefix, count);
  if (!complete) { alert('Please answer all questions before saving.'); return; }

  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) { alert('You must be signed in to save.'); return; }

  const sev = severityFn(score);
  const now = new Date().toISOString();

  try {
    await db.collection('surveys').add({
      type,
      userId: uid,
      date: dateVal,
      answers,
      score,
      severity: sev.label,
      createdAt: now
    });

    resetSurveyForm(
      prefix, count, dateInputId,
      type === 'phq9' ? 'phq9ScoreNum' : 'gad7ScoreNum',
      severityFn,
      type === 'phq9' ? 'phq9SeverityBadge' : 'gad7SeverityBadge'
    );

    if (type === 'phq9') await loadSurveyHistory('phq9', 'phq9HistoryBody', 'phq9HistoryCount', phq9Severity);
    if (type === 'gad7') await loadSurveyHistory('gad7', 'gad7HistoryBody', 'gad7HistoryCount', gad7Severity);

  } catch (err) {
    console.error('Error saving survey:', err);
    alert('Failed to save. Please try again.');
  }
}

// ── Trend chart ───────────────────────────────────────────────────

const _surveyCharts = {};

/**
 * Severity zone band definitions for PHQ-9 and GAD-7.
 * Each zone = { min, max, color } where color is an rgba string.
 */
const SURVEY_ZONES = {
  phq9: [
    { min: 0,  max: 4,  color: 'rgba(67,122,34,0.10)'  },  // Minimal — green
    { min: 5,  max: 9,  color: 'rgba(209,153,0,0.10)'  },  // Mild — gold
    { min: 10, max: 14, color: 'rgba(150,66,25,0.12)'  },  // Moderate — warning
    { min: 15, max: 19, color: 'rgba(161,44,123,0.12)' },  // Moderately Severe — error
    { min: 20, max: 27, color: 'rgba(161,53,68,0.14)'  }   // Severe — notification
  ],
  gad7: [
    { min: 0,  max: 4,  color: 'rgba(67,122,34,0.10)'  },  // Minimal
    { min: 5,  max: 9,  color: 'rgba(209,153,0,0.10)'  },  // Mild
    { min: 10, max: 14, color: 'rgba(150,66,25,0.12)'  },  // Moderate
    { min: 15, max: 21, color: 'rgba(161,53,68,0.14)'  }   // Severe
  ]
};

function _renderSurveyChart(canvasId, type, labels, scores, severityFn) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  if (_surveyCharts[canvasId]) {
    _surveyCharts[canvasId].destroy();
    delete _surveyCharts[canvasId];
  }

  if (!labels.length) return;

  const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
  const style     = getComputedStyle(document.documentElement);
  const primary   = style.getPropertyValue('--color-primary').trim();
  const hlColor   = style.getPropertyValue('--color-primary-highlight').trim();
  const textMuted = style.getPropertyValue('--color-text-muted').trim();
  const textColor = style.getPropertyValue('--color-text').trim();
  const borderClr = style.getPropertyValue('--color-border').trim();
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const maxY = type === 'phq9' ? 27 : 21;
  const zones = SURVEY_ZONES[type];

  // Gradient fill under the line
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  if (isDark) {
    gradient.addColorStop(0, 'rgba(79,152,163,0.30)');
    gradient.addColorStop(1, 'rgba(79,152,163,0.00)');
  } else {
    gradient.addColorStop(0, 'rgba(1,105,111,0.18)');
    gradient.addColorStop(1, 'rgba(1,105,111,0.00)');
  }

  // Color each point by its severity
  const pointColors = scores.map(s => {
    if (s === null) return hlColor;
    const sev = severityFn(s);
    const map = {
      'survey-sev-minimal':    isDark ? '#6daa45' : '#437a22',
      'survey-sev-mild':       isDark ? '#e8af34' : '#d19900',
      'survey-sev-moderate':   isDark ? '#bb653b' : '#964219',
      'survey-sev-severe':     isDark ? '#d163a7' : '#a12c7b',
      'survey-sev-verysevere': isDark ? '#dd6974' : '#a13544'
    };
    return map[sev.cls] || primary;
  });

  // Build annotation boxes for severity zones
  const annotations = {};
  zones.forEach((z, i) => {
    annotations['zone' + i] = {
      type: 'box',
      yMin: z.min,
      yMax: Math.min(z.max, maxY),
      backgroundColor: z.color,
      borderWidth: 0
    };
  });

  _surveyCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: scores,
        borderColor: primary,
        borderWidth: 2.5,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        backgroundColor: gradient,
        tension: 0.35,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: { annotations },
        tooltip: {
          backgroundColor: isDark ? '#1c1b19' : '#fff',
          titleColor: textMuted,
          bodyColor: textColor,
          borderColor: borderClr,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx => {
              const s = ctx.parsed.y;
              if (s === null) return 'No entry';
              const sev = severityFn(s);
              return 'Score: ' + s + '/' + maxY + '  (' + sev.label + ')';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor, drawTicks: false },
          border: { dash: [4, 4], display: false },
          ticks: { color: textMuted, font: { size: 11 }, maxRotation: 45, minRotation: 0 }
        },
        y: {
          min: 0,
          max: maxY,
          grid: { color: gridColor, drawTicks: false },
          border: { dash: [4, 4], display: false },
          ticks: { color: textMuted, font: { size: 11 }, stepSize: type === 'phq9' ? 5 : 3 }
        }
      }
    }
  });
}

// ── Load history ──────────────────────────────────────────────────

async function loadSurveyHistory(type, tbodyId, countBadgeId, severityFn) {
  const tbody = document.getElementById(tbodyId);
  const countBadge = document.getElementById(countBadgeId);
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="mood-table-empty">Loading&#8230;</td></tr>';

  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) {
    tbody.innerHTML = '<tr><td colspan="4" class="mood-table-empty">Sign in to view history.</td></tr>';
    return;
  }

  try {
    const snap = await db.collection('surveys')
      .where('type', '==', type)
      .where('userId', '==', uid)
      .orderBy('date', 'desc')
      .limit(20)
      .get();

    if (countBadge) countBadge.textContent = snap.size + ' submission' + (snap.size === 1 ? '' : 's');

    // ── Stat strip ──────────────────────────────────────────────
    const allDocs = [];
    snap.forEach(doc => allDocs.push(doc.data()));

    const scores = allDocs.map(d => d.score ?? 0);
    const prefix = type === 'phq9' ? 'phq9' : 'gad7';

    const latestEl = document.getElementById(prefix + 'StatLatest');
    const avgEl    = document.getElementById(prefix + 'StatAvg');
    const bestEl   = document.getElementById(prefix + 'StatBest');

    if (scores.length) {
      const avg  = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      const best = Math.min(...scores);
      if (latestEl) latestEl.textContent = scores[0];   // already ordered desc
      if (avgEl)    avgEl.textContent    = avg;
      if (bestEl)   bestEl.textContent   = best;
    } else {
      if (latestEl) latestEl.textContent = '—';
      if (avgEl)    avgEl.textContent    = '—';
      if (bestEl)   bestEl.textContent   = '—';
    }

    // ── Trend chart ─────────────────────────────────────────────
    // Build oldest→newest for the chart
    const chartData = allDocs.slice().reverse();
    const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const chartLabels = chartData.map(d => {
      if (!d.date) return '';
      const dt = new Date(d.date + 'T12:00:00');
      return MONTH[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
    });
    const chartScores = chartData.map(d => d.score ?? null);
    const canvasId = type === 'phq9' ? 'phq9TrendChart' : 'gad7TrendChart';
    _renderSurveyChart(canvasId, type, chartLabels, chartScores, severityFn);

    // ── History table ────────────────────────────────────────────
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" class="mood-table-empty">No submissions yet.</td></tr>';
      return;
    }

    let rows = '';
    allDocs.forEach((d, idx) => {
      const dateObj = d.date ? new Date(d.date + 'T12:00:00') : null;
      const dateStr = dateObj
        ? MONTH[dateObj.getMonth()] + ' ' + dateObj.getDate() + ', ' + dateObj.getFullYear()
        : '—';
      const sev = severityFn(d.score || 0);
      // We need the doc id for delete — re-iterate snap
      let docId = '';
      let i = 0;
      snap.forEach(doc => { if (i++ === idx) docId = doc.id; });
      rows += '<tr>' +
        '<td>' + dateStr + '</td>' +
        '<td class="mood-score-cell"><span class="mood-score-pill" style="' + surveySeverityPillStyle(sev.cls) + '">' + d.score + '</span></td>' +
        '<td><span class="survey-severity-badge ' + sev.cls + '">' + sev.label + '</span></td>' +
        '<td><button class="atr-delete-btn" aria-label="Delete submission" onclick="deleteSurvey(\'' + docId + '\', \'' + type + '\')">Delete</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = rows;

  } catch (err) {
    console.error('Error loading survey history:', err);
    tbody.innerHTML = '<tr><td colspan="4" class="mood-table-empty" style="color:var(--color-error);">Failed to load history.</td></tr>';
  }
}

function surveySeverityPillStyle(cls) {
  const map = {
    'survey-sev-minimal':    'background:var(--color-success);color:#fff;',
    'survey-sev-mild':       'background:var(--color-gold);color:#28251d;',
    'survey-sev-moderate':   'background:var(--color-warning);color:#fff;',
    'survey-sev-severe':     'background:var(--color-error);color:#fff;',
    'survey-sev-verysevere': 'background:var(--color-notification);color:#fff;'
  };
  return map[cls] || '';
}

async function deleteSurvey(id, type) {
  if (!window.confirm('Delete this submission? This cannot be undone.')) return;
  try {
    await db.collection('surveys').doc(id).delete();
    const severityFn = type === 'phq9' ? phq9Severity : gad7Severity;
    const tbodyId    = type === 'phq9' ? 'phq9HistoryBody' : 'gad7HistoryBody';
    const countId    = type === 'phq9' ? 'phq9HistoryCount' : 'gad7HistoryCount';
    await loadSurveyHistory(type, tbodyId, countId, severityFn);
  } catch (err) {
    console.error('Error deleting survey:', err);
    alert('Failed to delete.');
  }
}

// ── Sub-tab switcher ──────────────────────────────────────────────

function switchMoodSubTab(tab) {
  ['tracker', 'phq9', 'gad7'].forEach(t => {
    const panel = document.getElementById('mood-subtab-' + t);
    const btn   = document.getElementById('mood-tab-btn-' + t);
    if (!panel || !btn) return;
    const isActive = t === tab;
    panel.hidden = !isActive;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

// ── Init ──────────────────────────────────────────────────────────

let _surveysAuthListenerAttached = false;

function initSurveys() {
  const today = new Date().toISOString().split('T')[0];

  const phq9Date = document.getElementById('phq9DateInput');
  if (phq9Date && !phq9Date.value) phq9Date.value = today;
  const gad7Date = document.getElementById('gad7DateInput');
  if (gad7Date && !gad7Date.value) gad7Date.value = today;

  buildSurveyQuestions('phq9Questions', PHQ9_QUESTIONS, 'phq9', updatePhq9Score);
  buildSurveyQuestions('gad7Questions', GAD7_QUESTIONS, 'gad7', updateGad7Score);

  document.getElementById('phq9Questions') && document.getElementById('phq9Questions').addEventListener('change', e => {
    if (e.target.type === 'radio') {
      const name = e.target.name;
      document.querySelectorAll('input[name="' + name + '"]').forEach(inp => {
        inp.closest('label').classList.toggle('selected', inp.checked);
      });
    }
  });
  document.getElementById('gad7Questions') && document.getElementById('gad7Questions').addEventListener('change', e => {
    if (e.target.type === 'radio') {
      const name = e.target.name;
      document.querySelectorAll('input[name="' + name + '"]').forEach(inp => {
        inp.closest('label').classList.toggle('selected', inp.checked);
      });
    }
  });

  const savePhq9Btn = document.getElementById('savePhq9Btn');
  if (savePhq9Btn) savePhq9Btn.addEventListener('click', () =>
    saveSurvey('phq9', 'phq9', PHQ9_QUESTIONS.length, 'phq9DateInput', calcSurveyScore, phq9Severity)
  );
  const saveGad7Btn = document.getElementById('saveGad7Btn');
  if (saveGad7Btn) saveGad7Btn.addEventListener('click', () =>
    saveSurvey('gad7', 'gad7', GAD7_QUESTIONS.length, 'gad7DateInput', calcSurveyScore, gad7Severity)
  );

  if (!_surveysAuthListenerAttached) {
    _surveysAuthListenerAttached = true;
    auth.onAuthStateChanged(user => {
      if (user) {
        loadSurveyHistory('phq9', 'phq9HistoryBody', 'phq9HistoryCount', phq9Severity);
        loadSurveyHistory('gad7', 'gad7HistoryBody', 'gad7HistoryCount', gad7Severity);
      }
    });
  } else if (auth.currentUser) {
    loadSurveyHistory('phq9', 'phq9HistoryBody', 'phq9HistoryCount', phq9Severity);
    loadSurveyHistory('gad7', 'gad7HistoryBody', 'gad7HistoryCount', gad7Severity);
  }
}

async function refreshSurveys() {
  await Promise.all([
    loadSurveyHistory('phq9', 'phq9HistoryBody', 'phq9HistoryCount', phq9Severity),
    loadSurveyHistory('gad7', 'gad7HistoryBody', 'gad7HistoryCount', gad7Severity)
  ]);
}
