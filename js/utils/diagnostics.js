/**
 * diagnostics.js — FibroTracker Console Diagnostics Module
 *
 * Usage in any JS file:
 *   FibroDiag.info('ModuleName', 'message', optionalData);
 *   FibroDiag.warn('ModuleName', 'message', optionalData);
 *   FibroDiag.error('ModuleName', 'message', errorObject);
 *   FibroDiag.debug('ModuleName', 'message', optionalData);
 *   FibroDiag.time('operationLabel');
 *   FibroDiag.timeEnd('operationLabel');
 *
 * Toggle verbose debug output (persists across refreshes for this tab):
 *   sessionStorage.setItem('FIBRO_DEBUG', '1');  // enable
 *   sessionStorage.removeItem('FIBRO_DEBUG');     // disable
 *
 * Or use the toggle in Settings > Developer Diagnostics.
 * window.FIBRO_DEBUG = true also works for the current page load only.
 */

(function () {
  const STYLES = {
    INFO:  'background:#0d6efd22;color:#0d6efd;padding:1px 6px;border-radius:3px;font-weight:600',
    WARN:  'background:#ff990022;color:#cc7700;padding:1px 6px;border-radius:3px;font-weight:600',
    ERROR: 'background:#dc354522;color:#dc3545;padding:1px 6px;border-radius:3px;font-weight:600',
    DEBUG: 'background:#6f42c122;color:#6f42c1;padding:1px 6px;border-radius:3px;font-weight:600',
    MODULE:'color:#555;font-weight:500',
  };

  function isDebugEnabled() {
    return !!(window.FIBRO_DEBUG || sessionStorage.getItem('FIBRO_DEBUG'));
  }

  function timestamp() {
    return new Date().toISOString().substring(11, 23);
  }

  function log(level, module, message, data) {
    if (level === 'DEBUG' && !isDebugEnabled()) return;
    const prefix = `%c${level}%c [${module}] ${timestamp()} — ${message}`;
    if (data !== undefined) {
      console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](
        prefix, STYLES[level], STYLES.MODULE, data
      );
    } else {
      console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](
        prefix, STYLES[level], STYLES.MODULE
      );
    }
  }

  const timers = {};

  window.FibroDiag = {
    info:    (module, msg, data) => log('INFO',  module, msg, data),
    warn:    (module, msg, data) => log('WARN',  module, msg, data),
    error:   (module, msg, data) => log('ERROR', module, msg, data),
    debug:   (module, msg, data) => log('DEBUG', module, msg, data),
    isDebugEnabled,

    time: (label) => {
      timers[label] = performance.now();
      log('DEBUG', 'Timer', `⏱ START: ${label}`);
    },
    timeEnd: (label) => {
      if (timers[label] == null) {
        log('WARN', 'Timer', `timeEnd called but no start found for: ${label}`);
        return;
      }
      const ms = (performance.now() - timers[label]).toFixed(1);
      delete timers[label];
      log('INFO', 'Timer', `⏱ END: ${label} — ${ms}ms`);
    },

    hookFirebase: function () {
      try {
        if (typeof firebase === 'undefined') {
          log('WARN', 'Firebase', 'firebase global not found — hookFirebase skipped');
          return;
        }
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            log('INFO', 'Auth', `User signed in: ${user.email} (uid: ${user.uid})`);
          } else {
            log('INFO', 'Auth', 'User signed out');
          }
        });
        log('INFO', 'Firebase', 'Diagnostics hooks attached (auth state listener active)');
      } catch (e) {
        log('ERROR', 'Firebase', 'hookFirebase failed', e);
      }
    }
  };

  // Global unhandled error catcher
  window.addEventListener('error', (event) => {
    log('ERROR', 'Global', `Unhandled error: ${event.message}`, {
      file:  event.filename,
      line:  event.lineno,
      col:   event.colno,
      error: event.error
    });
  });

  // Global unhandled promise rejection catcher
  window.addEventListener('unhandledrejection', (event) => {
    log('ERROR', 'Global', 'Unhandled promise rejection', event.reason);
  });

  if (isDebugEnabled()) {
    log('INFO', 'Diagnostics', 'FibroDiag loaded — DEBUG MODE ON (via sessionStorage)');
  } else {
    log('INFO', 'Diagnostics', 'FibroDiag loaded. Enable debug in Settings > Developer Diagnostics or: sessionStorage.setItem("FIBRO_DEBUG","1") then reload.');
  }
})();
