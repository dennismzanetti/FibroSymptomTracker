// analysis.js — AI Insights panel for the Analysis (History) tab
// Fetches Gemini API key from Firestore config, builds a structured prompt
// from loaded history data, calls Gemini 2.5 Flash, and renders insight cards.

(function () {

  // ---------- Gemini config ----------
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  // ---------- fetch API key from Firestore (auth-gated) ----------
  async function getGeminiKey() {
    try {
      const doc = await db.collection('config').doc('apiKeys').get();
      if (!doc.exists) throw new Error('config/apiKeys document not found in Firestore');
      const key = doc.data().geminiKey;
      if (!key) throw new Error('geminiKey field missing in config/apiKeys');
      return key;
    } catch (err) {
      throw new Error('Could not retrieve Gemini API key: ' + err.message);
    }
  }

  // ---------- build a compact summary object from history data ----------
  function buildSummary(dataByDate, days) {
    function getVal(obj, path) {
      if (!obj) return undefined;
      return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }

    return days.map(date => {
      const d = dataByDate[date];
      if (!d) return null;
      return {
        date,
        functionality: {
          avg:            getVal(d, 'avgFunctionality'),
          earlyMorning:   getVal(d, 'functionality.earlyMorning.score'),
          lateMorning:    getVal(d, 'functionality.lateMorning.score'),
          earlyAfternoon: getVal(d, 'functionality.earlyAfternoon.score'),
          lateAfternoon:  getVal(d, 'functionality.lateAfternoon.score'),
          earlyEvening:   getVal(d, 'functionality.earlyEvening.score'),
          lateEvening:    getVal(d, 'functionality.lateEvening.score'),
        },
        fatigue:      getVal(d, 'fatigueScore'),
        sleep: {
          hours:   getVal(d, 'sleep.hours'),
          quality: getVal(d, 'sleep.quality'),
        },
        mood:         getVal(d, 'mood.score'),
        symptomTags:  (d.tags || []).map(t => t.replace(/_/g, ' ')),
      };
    }).filter(Boolean);
  }

  // ---------- build the prompt ----------
  function buildPrompt(summary, startStr, endStr) {
    const dataJson = JSON.stringify(summary, null, 2);
    return `You are a compassionate health data analyst helping someone who has Fibromyalgia track and understand their symptoms. Analyze the following daily symptom data and provide clear, empathetic, actionable insights.

Date range: ${startStr} to ${endStr}
Number of days with data: ${summary.length}

Data (scores are 1-10 unless noted; for pain/fatigue lower is better; for mood/sleep/functionality higher is better):
${dataJson}

Please respond with ONLY a valid JSON object in this exact format (no markdown, no code fences, just raw JSON):
{
  "patterns": [
    "A specific pattern you noticed (e.g. sleep quality below 5 tends to precede higher fatigue)",
    "Another pattern..."
  ],
  "bestDays": {
    "dates": ["YYYY-MM-DD", "YYYY-MM-DD"],
    "commonFactors": "What these good days had in common"
  },
  "challengingDays": {
    "dates": ["YYYY-MM-DD", "YYYY-MM-DD"],
    "commonFactors": "What these harder days had in common"
  },
  "recommendations": [
    "A gentle, specific recommendation based on the data",
    "Another recommendation..."
  ],
  "summary": "A 2-3 sentence compassionate overview of this period."
}

Keep language warm, supportive, and specific to the data. Do not give medical advice. Focus on observable patterns only.`;
  }

  // ---------- call Gemini API ----------
  async function callGemini(apiKey, prompt) {
    const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty response from Gemini');

    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  }

  // ---------- render the insights panel ----------
  function renderInsights(insights, container) {
    const fmt = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const patternItems = (insights.patterns || []).map(p =>
      `<li class="ai-insight-item">${p}</li>`
    ).join('');

    const recItems = (insights.recommendations || []).map(r =>
      `<li class="ai-insight-item">${r}</li>`
    ).join('');

    const bestDates = (insights.bestDays?.dates || []).map(fmt).join(', ') || '—';
    const hardDates = (insights.challengingDays?.dates || []).map(fmt).join(', ') || '—';

    container.innerHTML = `
      <div class="ai-insights-panel">
        <div class="ai-insights-header">
          <span class="ai-insights-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
          </span>
          <h3 class="ai-insights-title">AI Insights</h3>
          <span class="ai-insights-badge">Gemini</span>
        </div>

        <p class="ai-insights-summary">${insights.summary || ''}</p>

        <div class="ai-insights-grid">

          <div class="ai-insights-card ai-insights-card--patterns">
            <div class="ai-insights-card-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Patterns
            </div>
            <ul class="ai-insight-list">${patternItems || '<li class="ai-insight-item ai-insight-item--empty">No clear patterns detected in this range.</li>'}</ul>
          </div>

          <div class="ai-insights-card ai-insights-card--days">
            <div class="ai-insights-card-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Notable Days
            </div>
            <div class="ai-day-group">
              <span class="ai-day-label ai-day-label--good">&#9650; Best</span>
              <span class="ai-day-dates">${bestDates}</span>
            </div>
            <p class="ai-day-note">${insights.bestDays?.commonFactors || ''}</p>
            <div class="ai-day-group" style="margin-top: var(--space-3);">
              <span class="ai-day-label ai-day-label--hard">&#9660; Hardest</span>
              <span class="ai-day-dates">${hardDates}</span>
            </div>
            <p class="ai-day-note">${insights.challengingDays?.commonFactors || ''}</p>
          </div>

          <div class="ai-insights-card ai-insights-card--recs">
            <div class="ai-insights-card-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Recommendations
            </div>
            <ul class="ai-insight-list">${recItems || '<li class="ai-insight-item ai-insight-item--empty">Not enough data for recommendations yet.</li>'}</ul>
          </div>

        </div>

        <p class="ai-insights-disclaimer">AI insights are observational only and not medical advice. Always consult your healthcare provider.</p>
      </div>
    `;
  }

  // ---------- render error state ----------
  function renderError(message, container) {
    container.innerHTML = `
      <div class="ai-insights-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>${message}</span>
      </div>
    `;
  }

  // ---------- render loading state ----------
  function renderLoading(container) {
    container.innerHTML = `
      <div class="ai-insights-loading">
        <div class="ai-insights-spinner" aria-hidden="true"></div>
        <span>Generating AI insights&hellip;</span>
      </div>
    `;
  }

  // ---------- public entry point ----------
  // Call this after history data is loaded.
  // dataByDate: { 'YYYY-MM-DD': { ...firestoreData } }
  // days: array of 'YYYY-MM-DD' strings that have data
  // startStr / endStr: range strings
  async function generateInsights(dataByDate, days, startStr, endStr) {
    const container = document.getElementById('aiInsightsContainer');
    if (!container) return;

    // Auth guard — only run if user is signed in
    const user = auth.currentUser;
    if (!user) {
      renderError('Sign in to enable AI insights.', container);
      return;
    }

    if (!days || days.length < 3) {
      container.innerHTML = `<p class="ai-insights-min-data">Load at least 3 days of data to generate insights.</p>`;
      return;
    }

    renderLoading(container);

    try {
      const apiKey  = await getGeminiKey();
      const summary = buildSummary(dataByDate, days);
      const prompt  = buildPrompt(summary, startStr, endStr);
      const insights = await callGemini(apiKey, prompt);
      renderInsights(insights, container);
    } catch (err) {
      console.error('AI Insights error:', err);
      renderError('Could not generate insights: ' + err.message, container);
    }
  }

  window.generateInsights = generateInsights;

})();
