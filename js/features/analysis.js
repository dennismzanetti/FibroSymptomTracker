// analysis.js — AI Insights panel for the Analysis (History) tab
// Fetches Gemini API key from Firestore config, builds a structured prompt
// from loaded history data, calls Gemini 2.5 Flash Lite, and renders insight cards.
// On 503 overload: retries up to 3x with exponential backoff, then falls back to
// gemini-2.5-flash if lite remains unavailable.
// In-flight guard: if a call is already running, subsequent calls are ignored
// until the current one completes.

(function () {

  // ---------- Gemini config ----------
  const GEMINI_MODELS = [
    'gemini-2.5-flash-lite',  // preferred: fast, cheap
    'gemini-2.5-flash',       // fallback: if lite is overloaded
  ];
  const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  // ---------- in-flight guard ----------
  // Prevents duplicate concurrent calls (e.g. partialsLoaded + tab activate firing together)
  let _inflight = false;
  let _hasRenderedInsights = false;

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
        funcAvg:  getVal(d, 'avgFunctionality'),
        fatigue:  getVal(d, 'fatigueScore'),
        sleepHrs: getVal(d, 'sleep.hours'),
        sleepQ:   getVal(d, 'sleep.quality'),
        mood:     getVal(d, 'mood.score'),
        tags:     (d.tags || []).map(t => t.replace(/_/g, ' ')),
      };
    }).filter(Boolean);
  }

  // ---------- build the prompt ----------
  function buildPrompt(summary, startStr, endStr) {
    const dataJson = JSON.stringify(summary);
    return `Health data analyst for a Fibromyalgia patient. Analyze data and return ONLY raw JSON (no markdown, no code fences).
Date range: ${startStr} to ${endStr} (${summary.length} days). Scores 1-10: fatigue lower=better; mood/sleep/funcAvg higher=better.
Data: ${dataJson}
Return exactly this JSON (no extra keys, keep strings under 20 words each):
{"patterns":["string","string"],"bestDays":{"dates":["YYYY-MM-DD"],"commonFactors":"string"},"challengingDays":{"dates":["YYYY-MM-DD"],"commonFactors":"string"},"recommendations":["string","string"],"summary":"string under 40 words"}`;
  }

  // ---------- sleep helper ----------
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---------- call one Gemini model with retry on 503 ----------
  async function callModel(apiKey, model, prompt, maxRetries = 3) {
    const url = `${GEMINI_ENDPOINT_BASE}/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      }
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Gemini response cut off (finishReason: ${finishReason}). Try a shorter date range.`);
        }
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) throw new Error('Empty response from Gemini');
        const cleaned = raw
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        return JSON.parse(cleaned);
      }

      const errText = await res.text();

      // 429 — rate limited
      if (res.status === 429) {
        let retrySeconds = null;
        try {
          const errJson = JSON.parse(errText);
          const retryInfo = errJson?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
          if (retryInfo?.retryDelay) retrySeconds = parseInt(retryInfo.retryDelay, 10) || null;
        } catch (_) {}
        const err = new Error('RATE_LIMITED');
        err.isRateLimit = true;
        err.retrySeconds = retrySeconds;
        throw err;
      }

      // 503 — overloaded: retry with exponential backoff
      if (res.status === 503 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`[Gemini] ${model} 503 on attempt ${attempt + 1}, retrying in ${Math.round(delay)}ms…`);
        await sleep(delay);
        continue;
      }

      const err = new Error(`Gemini API error ${res.status}: ${errText}`);
      err.status = res.status;
      throw err;
    }
  }

  // ---------- call Gemini with model fallback ----------
  async function callGemini(apiKey, prompt) {
    let lastErr;
    for (const model of GEMINI_MODELS) {
      try {
        return await callModel(apiKey, model, prompt);
      } catch (err) {
        if (err.isRateLimit) throw err;
        lastErr = err;
        console.warn(`[Gemini] Model ${model} failed (${err.message}), trying next…`);
      }
    }
    throw lastErr;
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

    const bestDates = (insights.bestDays?.dates || []).map(fmt).join(', ') || '\u2014';
    const hardDates = (insights.challengingDays?.dates || []).map(fmt).join(', ') || '\u2014';

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

    _hasRenderedInsights = true;
  }

  // ---------- render rate-limit state with retry ----------
  function renderRateLimit(retrySeconds, container, dataByDate, days, startStr, endStr) {
    const retryMsg = retrySeconds
      ? `The API will be ready in about ${retrySeconds} second${retrySeconds !== 1 ? 's' : ''}.`
      : 'The daily quota has been reached — insights will be available again tomorrow.';

    container.innerHTML = `
      <div class="ai-insights-rate-limit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <div class="ai-insights-rate-limit-text">
          <strong>AI Insights quota reached.</strong>
          <span>${retryMsg}</span>
          ${retrySeconds ? `<button class="ai-insights-retry-btn" data-retry-after="${retrySeconds}">Retry in <span class="ai-retry-countdown">${retrySeconds}s</span></button>` : ''}
        </div>
      </div>
    `;

    if (retrySeconds) {
      const btn = container.querySelector('.ai-insights-retry-btn');
      const countdownEl = container.querySelector('.ai-retry-countdown');
      let remaining = retrySeconds;
      btn.disabled = true;
      const tick = setInterval(() => {
        remaining--;
        if (countdownEl) countdownEl.textContent = `${remaining}s`;
        if (remaining <= 0) {
          clearInterval(tick);
          btn.disabled = false;
          btn.innerHTML = 'Retry now';
          btn.addEventListener('click', () => {
            _hasRenderedInsights = false; // allow fresh call on manual retry
            generateInsights(dataByDate, days, startStr, endStr);
          }, { once: true });
        }
      }, 1000);
    }
  }

  // ---------- render generic error state ----------
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
  async function generateInsights(dataByDate, days, startStr, endStr) {
    const container = document.getElementById('aiInsightsContainer');
    if (!container) return;

    // Skip if insights are already successfully rendered
    if (_hasRenderedInsights) {
      console.log('[Gemini] Insights already rendered — skipping duplicate call.');
      return;
    }

    // Skip if a call is already in flight
    if (_inflight) {
      console.log('[Gemini] Call already in flight — ignoring duplicate request.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      renderError('Sign in to enable AI insights.', container);
      return;
    }

    if (!days || days.length < 3) {
      container.innerHTML = `<p class="ai-insights-min-data">Load at least 3 days of data to generate insights.</p>`;
      return;
    }

    _inflight = true;
    renderLoading(container);

    try {
      const apiKey   = await getGeminiKey();
      const summary  = buildSummary(dataByDate, days);
      const prompt   = buildPrompt(summary, startStr, endStr);
      const insights = await callGemini(apiKey, prompt);
      renderInsights(insights, container);  // sets _hasRenderedInsights = true
    } catch (err) {
      console.error('AI Insights error:', err);
      if (err.isRateLimit) {
        renderRateLimit(err.retrySeconds, container, dataByDate, days, startStr, endStr);
      } else {
        renderError('Could not generate insights: ' + err.message, container);
      }
    } finally {
      _inflight = false;
    }
  }

  // Expose a reset function so app.js can force a fresh fetch on date range change
  function resetInsights() {
    _hasRenderedInsights = false;
    _inflight = false;
  }

  window.generateInsights = generateInsights;
  window.resetInsights = resetInsights;

})();
