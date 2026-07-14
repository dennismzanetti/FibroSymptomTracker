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

// ── Trend chart ───────────────────────────────────────────────────

// Severity colour for the bold total-score line
function _surveySeverityColor(score, type) {
  const sev = type === 'phq9' ? phq9Severity(score) : gad7Severity(score);
  const map = {
    'survey-sev-minimal':    '#437a22',
    'survey-sev-mild':       '#d19900',
    'survey-sev-moderate':   '#964219',
    'survey-sev-severe':     '#a12c7b',
    'survey-sev-verysevere': '#a13544'
  };
  return map[sev.cls] || '#01696f';
}

// Muted per-question palette (10 distinct hues, alpha-softened)
const _Q_COLORS = [
  'rgba(1,105,111,0.45)',   // teal
  'rgba(100,100,200,0.45)', // blue-purple
  'rgba(180,100,40,0.45)',  // brown
  'rgba(60,150,80,0.45)',   // green
  'rgba(200,80,130,0.45)',  // pink
  'rgba(140,80,200,0.45)',  // purple
  'rgba(220,140,40,0.45)',  // amber
  'rgba(60,160,200,0.45)',  // sky blue
  'rgba(200,60,60,0.45)',   // red
];

// Chart instances keyed by canvasId so we can destroy/rebuild on reload
const _surveyCharts = {};

function renderSurveyTrendChart(type, entries) {
  // entries: array of {date, score, answers} sorted oldest→newest
  const canvasId  = type + 'TrendChart';
  const legendId  = type + 'TrendLegend';
  const questions = type === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS;
  const maxScore  = type === 'phq9' ? 27 : 21;

  const canvas = document.getElementById(canvasId);
  const legendEl = document.getElementById(legendId);
  if (!canvas) return;

  // Destroy existing chart before rebuilding
  if (_surveyCharts[canvasId]) {
    _surveyCharts[canvasId].destroy();
    delete _surveyCharts[canvasId];
  }

  if (!entries || entries.length === 0) {
    canvas.style.display = 'none';
    if (legendEl) legendEl.innerHTML = '<p class="ai-insights-hint" style="font-size:var(--text-sm);color:var(--color-text-muted);">No submissions yet — submit a ' + type.toUpperCase() + ' to see trends.</p>';
    return;
  }

  canvas.style.display = '';

  const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const labels = entries.map(e => {
    const d = new Date(e.date + 'T12:00:00');
    return MONTH[d.getMonth()] + ' ' + d.getDate();
  });

  // Per-question datasets (thin, muted)
  const qDatasets = questions.map((qText, idx) => ({
    label: 'Q' + (idx + 1) + ': ' + qText.substring(0, 40) + (qText.length > 40 ? '…' : ''),
    data: entries.map(e => Array.isArray(e.answers) ? (e.answers[idx] ?? null) : null),
    borderColor: _Q_COLORS[idx % _Q_COLORS.length],
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    pointRadius: 2,
    pointHoverRadius: 4,
    tension: 0.3,
    spanGaps: true,
  }));

  // Derive a representative severity color for the total line based on the latest score
  const latestScore = entries[entries.length - 1].score;
  const totalColor  = _surveySeverityColor(latestScore, type);

  // Bold total-score dataset
  const totalDataset = {
    label: 'Total Score',
    data: entries.map(e => e.score),
    borderColor: totalColor,
    backgroundColor: totalColor.replace(')', ', 0.08)').replace('rgb', 'rgba'),
    borderWidth: 3,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: totalColor,
    tension: 0.3,
    fill: true,
    spanGaps: true,
    order: 0, // draw on top
  };

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.hasAttribute('data-theme') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const gridColor  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const tickColor  = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

  _surveyCharts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [...qDatasets, totalDataset] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // custom legend below
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.dataset.label === 'Total Score') {
                const score = ctx.parsed.y;
                const sev   = type === 'phq9' ? phq9Severity(score) : gad7Severity(score);
                return ' Total: ' + score + ' (' + sev.label + ')';
              }
              return ' ' + ctx.dataset.label.split(':')[0] + ': ' + ctx.parsed.y;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { size: 11 } }
        },
        y: {
          min: 0,
          max: maxScore,
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { size: 11 }, stepSize: type === 'phq9' ? 9 : 7 },
          title: { display: true, text: 'Score', color: tickColor, font: { size: 11 } }
        }
      }
    }
  });

  // Build custom legend
  if (legendEl) {
    let html = '<div class="survey-trend-legend-inner">';
    // Total score entry
    html += '<span class="survey-legend-item survey-legend-item--total">' +
      '<span class="survey-legend-swatch" style="background:' + totalColor + ';width:18px;height:4px;border-radius:2px;display:inline-block;vertical-align:middle;margin-right:4px;"></span>' +
      '<strong>Total Score</strong></span>';
    // Per-question entries
    questions.forEach((qText, idx) => {
      const color = _Q_COLORS[idx % _Q_COLORS.length];
      html += '<span class="survey-legend-item">' +
        '<span class="survey-legend-swatch" style="background:' + color + ';width:14px;height:2px;border-radius:1px;display:inline-block;vertical-align:middle;margin-right:4px;"></span>' +
        'Q' + (idx + 1) + ': ' + qText.substring(0, 35) + (qText.length > 35 ? '…' : '') +
        '</span>';
    });
    html += '</div>';
    legendEl.innerHTML = html;
  }
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

// ── Pre-populate helpers ──────────────────────────────────────────

// Show/hide the "Updating existing entry" badge in the modal header
function _setSurveyUpdateBadge(type, visible) {
  const badge = document.getElementById(type + 'UpdateBadge');
  if (!badge) return;
  badge.hidden = !visible;
}

// Populate radio buttons from a saved answers array and refresh the live score
function _populateSurveyAnswers(prefix, answers, count, updateScoreFn) {
  for (let i = 1; i <= count; i++) {
    const val = Array.isArray(answers) ? answers[i - 1] : undefined;
    const inputs = document.querySelectorAll('input[name="' + prefix + '_q' + i + '"]');
    inputs.forEach(inp => {
      const checked = (val !== null && val !== undefined && parseInt(inp.value, 10) === val);
      inp.checked = checked;
      const lbl = inp.closest('label');
      if (lbl) lbl.classList.toggle('selected', checked);
    });
  }
  if (typeof updateScoreFn === 'function') updateScoreFn();
}

// Fetch Firestore for an existing entry on the given date; pre-populate if found
async function _checkAndPrefillSurvey(type, dateVal) {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid || !dateVal) return;

  const prefix      = type;
  const count       = type === 'phq9' ? PHQ9_QUESTIONS.length : GAD7_QUESTIONS.length;
  const updateFn    = type === 'phq9' ? updatePhq9Score : updateGad7Score;
  const docId       = uid + '_' + type + '_' + dateVal;

  try {
    const snap = await db.collection('surveys').doc(docId).get();
    if (snap.exists) {
      const data = snap.data();
      _populateSurveyAnswers(prefix, data.answers || [], count, updateFn);
      _setSurveyUpdateBadge(type, true);
    } else {
      // No entry for this date — clear any pre-filled answers
      const severityFn  = type === 'phq9' ? phq9Severity : gad7Severity;
      const scoreNumId  = type + 'ScoreNum';
      const badgeId     = type + 'SeverityBadge';
      resetSurveyForm(prefix, count, type + 'DateInput', scoreNumId, severityFn, badgeId);
      // Restore the date (resetSurveyForm sets it to today)
      const dateEl = document.getElementById(type + 'DateInput');
      if (dateEl) dateEl.value = dateVal;
      _setSurveyUpdateBadge(type, false);
    }
  } catch (err) {
    console.warn('Could not check for existing survey entry:', err);
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

// ── Modal open / close ────────────────────────────────────────────

async function openSurveyModal(type) {
  const modal = document.getElementById('surveyModal-' + type);
  if (!modal) return;

  // Reset to a clean state first
  if (type === 'phq9') {
    resetSurveyForm('phq9', PHQ9_QUESTIONS.length, 'phq9DateInput', 'phq9ScoreNum', phq9Severity, 'phq9SeverityBadge');
  } else {
    resetSurveyForm('gad7', GAD7_QUESTIONS.length, 'gad7DateInput', 'gad7ScoreNum', gad7Severity, 'gad7SeverityBadge');
  }
  _setSurveyUpdateBadge(type, false);

  modal.hidden = false;
  modal.classList.add('survey-modal-open');
  document.body.classList.add('survey-modal-active');

  // Focus the date input for accessibility
  const dateInput = document.getElementById(type + 'DateInput');
  if (dateInput) setTimeout(() => dateInput.focus(), 50);

  // Fetch existing entry for today's date (after reset so we start clean)
  const today = new Date().toISOString().split('T')[0];
  await _checkAndPrefillSurvey(type, today);
}

function closeSurveyModal(type) {
  const modal = document.getElementById('surveyModal-' + type);
  if (!modal) return;
  modal.classList.remove('survey-modal-open');
  document.body.classList.remove('survey-modal-active');
  _setSurveyUpdateBadge(type, false);
  // Small delay to allow CSS transition before hiding
  setTimeout(() => { modal.hidden = true; }, 200);
}

// Close modal on backdrop click
function _initSurveyModalBackdropClose() {
  ['phq9', 'gad7'].forEach(type => {
    const modal = document.getElementById('surveyModal-' + type);
    if (!modal) return;
    modal.addEventListener('click', e => {
      if (e.target === modal) closeSurveyModal(type);
    });
  });
  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['phq9', 'gad7'].forEach(t => {
        const m = document.getElementById('surveyModal-' + t);
        if (m && !m.hidden) closeSurveyModal(t);
      });
    }
  });
}

// ── Date-change re-fetch ──────────────────────────────────────────

function _initSurveyDateChangeListeners() {
  ['phq9', 'gad7'].forEach(type => {
    const dateEl = document.getElementById(type + 'DateInput');
    if (!dateEl) return;
    dateEl.addEventListener('change', async () => {
      const val = dateEl.value;
      if (val) await _checkAndPrefillSurvey(type, val);
    });
  });
}

// ── Save to Firestore ─────────────────────────────────────────────

async function saveSurvey(type, prefix, count, dateInputId, scoreFn, severityFn) {
  const dateVal = document.getElementById(dateInputId) && document.getElementById(dateInputId).value;
  if (!dateVal) { alert('Please select a date.'); return; }

  const { score, complete, answers } = calcSurveyScore(prefix, count);
  if (!complete) { alert('Please answer all questions before saving.'); return; }

  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) { alert('You must be signed in to save.'); return; }

  const sev   = severityFn(score);
  const now   = new Date().toISOString();
  const docId = uid + '_' + type + '_' + dateVal;

  try {
    // Upsert: one document per user / survey type / date
    await db.collection('surveys').doc(docId).set({
      type,
      userId: uid,
      date: dateVal,
      answers,
      score,
      severity: sev.label,
      createdAt: now
    });

    // Reset form and close modal
    resetSurveyForm(
      prefix, count, dateInputId,
      type === 'phq9' ? 'phq9ScoreNum' : 'gad7ScoreNum',
      severityFn,
      type === 'phq9' ? 'phq9SeverityBadge' : 'gad7SeverityBadge'
    );
    _setSurveyUpdateBadge(type, false);
    closeSurveyModal(type);

    // Reload history (and chart)
    if (type === 'phq9') await loadSurveyHistory('phq9', 'phq9HistoryBody', 'phq9HistoryCount', phq9Severity);
    if (type === 'gad7') await loadSurveyHistory('gad7', 'gad7HistoryBody', 'gad7HistoryCount', gad7Severity);

  } catch (err) {
    console.error('Error saving survey:', err);
    alert('Failed to save. Please try again.');
  }
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

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" class="mood-table-empty">No submissions yet.</td></tr>';
      renderSurveyTrendChart(type, []);
      return;
    }

    const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let rows = '';
    const chartEntries = [];

    snap.forEach(doc => {
      const d = doc.data();
      const dateObj = d.date ? new Date(d.date + 'T12:00:00') : null;
      const dateStr = dateObj ? MONTH[dateObj.getMonth()] + ' ' + dateObj.getDate() + ', ' + dateObj.getFullYear() : '—';
      const sev = severityFn(d.score || 0);
      rows += '<tr>' +
        '<td>' + dateStr + '</td>' +
        '<td class="mood-score-cell"><span class="mood-score-pill survey-severity-badge ' + sev.cls + '">' + d.score + '</span></td>' +
        '<td><span class="survey-severity-badge ' + sev.cls + '">' + sev.label + '</span></td>' +
        '<td><button class="atr-delete-btn" aria-label="Delete submission" onclick="deleteSurvey(\'' + doc.id + '\', \'' + type + '\')">Delete</button></td>' +
        '</tr>';
      // Collect for chart (push in ascending order after loop reversal)
      chartEntries.push({ date: d.date, score: d.score || 0, answers: d.answers || [] });
    });

    tbody.innerHTML = rows;

    // Firestore returned desc order — reverse for chronological chart display
    chartEntries.reverse();
    renderSurveyTrendChart(type, chartEntries);

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

// Guard flag: prevents duplicate auth listener if initSurveys() is called more than once
let _surveysAuthListenerAttached = false;

function initSurveys() {
  // Build question lists (questions render into modal DOM)
  buildSurveyQuestions('phq9Questions', PHQ9_QUESTIONS, 'phq9', updatePhq9Score);
  buildSurveyQuestions('gad7Questions', GAD7_QUESTIONS, 'gad7', updateGad7Score);

  // Selected-state visual feedback on Likert labels
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

  // Save buttons
  const savePhq9Btn = document.getElementById('savePhq9Btn');
  if (savePhq9Btn) savePhq9Btn.addEventListener('click', () =>
    saveSurvey('phq9', 'phq9', PHQ9_QUESTIONS.length, 'phq9DateInput', calcSurveyScore, phq9Severity)
  );
  const saveGad7Btn = document.getElementById('saveGad7Btn');
  if (saveGad7Btn) saveGad7Btn.addEventListener('click', () =>
    saveSurvey('gad7', 'gad7', GAD7_QUESTIONS.length, 'gad7DateInput', calcSurveyScore, gad7Severity)
  );

  // Modal backdrop / Escape key close
  _initSurveyModalBackdropClose();

  // Date-change re-fetch listeners
  _initSurveyDateChangeListeners();

  // ── Race-condition fix ────────────────────────────────────────
  // Do NOT call loadSurveyHistory() directly here — auth.currentUser may
  // still be null at this point during Firebase's async auth resolution.
  // Instead, attach a one-time onAuthStateChanged listener so history loads
  // only after the auth state is confirmed. The guard flag prevents a second
  // listener from being added if initSurveys() is called again.
  if (!_surveysAuthListenerAttached) {
    _surveysAuthListenerAttached = true;
    auth.onAuthStateChanged(user => {
      if (user) {
        loadSurveyHistory('phq9', 'phq9HistoryBody', 'phq9HistoryCount', phq9Severity);
        loadSurveyHistory('gad7', 'gad7HistoryBody', 'gad7HistoryCount', gad7Severity);
      }
    });
  } else if (auth.currentUser) {
    // Auth already resolved (e.g. tab revisited) — load immediately
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
