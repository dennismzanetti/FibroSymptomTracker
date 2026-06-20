/**
 * loader.js
 * Fetches HTML partials and injects them into mount-point divs.
 * Dispatches a custom "partialsLoaded" event when all are done,
 * so app.js and other scripts can safely query the DOM.
 */
(function () {
  const partials = [
    { id: 'partial-auth',            src: 'partials/auth.html' },
    { id: 'partial-modals',          src: 'partials/modals.html' },
    { id: 'partial-header',          src: 'partials/header.html' },
    { id: 'partial-tab-today',       src: 'partials/tab-today.html' },
    { id: 'partial-tab-journal',     src: 'partials/tab-journal.html' },
    { id: 'partial-tab-history',     src: 'partials/tab-history.html' },
    { id: 'partial-tab-trends',      src: 'partials/tab-trends.html' },
    { id: 'partial-tab-mood',        src: 'partials/tab-mood.html' },
    { id: 'partial-tab-medications', src: 'partials/tab-medications.html' },
    { id: 'partial-tab-conditions',  src: 'partials/tab-conditions.html' },
    { id: 'partial-tab-careteam',    src: 'partials/tab-careteam.html' },
    { id: 'partial-tab-settings',    src: 'partials/tab-settings.html' },
  ];

  Promise.all(
    partials.map(({ id, src }) =>
      fetch(src)
        .then(r => {
          if (!r.ok) throw new Error('Failed to load ' + src + ': ' + r.status);
          return r.text();
        })
        .then(html => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = html;
        })
        .catch(err => console.error(err))
    )
  ).then(() => {
    document.dispatchEvent(new Event('partialsLoaded'));
  });
})();
