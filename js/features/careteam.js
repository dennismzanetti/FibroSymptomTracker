// ============================================================
// CARE TEAM TAB
// Collections:
//   careTeam        — provider records
//   appointments    — appointment records (linked to careTeam docs)
// ============================================================

// Defensive escHtml fallback in case ui.js hasn't loaded yet
if (typeof escHtml !== 'function') {
  window.escHtml = function(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'block';
  const inner = modal.querySelector('div');
  if (inner) inner.scrollTop = 0;
  const focusable = modal.querySelector('select, input, textarea, button:not([aria-label="Close"])');
  if (focusable) setTimeout(() => focusable.focus(), 50);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// ---- Sub-tab switching ----
function setupCareTeamTab() {
  document.querySelectorAll('.ct-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetViewId = btn.getAttribute('data-ct-view');
      document.querySelectorAll('.ct-sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.ct-view').forEach(view => {
        view.style.display = view.id === targetViewId ? '' : 'none';
      });
      if (targetViewId === 'ctProvidersView') refreshProviderList();
      if (targetViewId === 'ctApptsView') {
        populateProviderDropdown();
        refreshAppointmentList();
      }
      if (targetViewId === 'ctPrintView') renderCTPrintPreviews();
    });
  });

  // Provider ADD modal
  document.getElementById('openCtAddModalBtn')?.addEventListener('click', () => {
    resetProviderForm();
    openModal('ctProviderAddModal');
  });
  document.getElementById('saveProviderBtn')?.addEventListener('click', saveProvider);
  document.getElementById('cancelProviderAddBtn')?.addEventListener('click', () => closeModal('ctProviderAddModal'));
  document.getElementById('ctProviderAddModalClose')?.addEventListener('click', () => closeModal('ctProviderAddModal'));

  // Provider EDIT modal
  document.getElementById('saveProviderEditBtn')?.addEventListener('click', saveProviderEdit);
  document.getElementById('cancelProviderEditBtn')?.addEventListener('click', () => closeModal('ctProviderModal'));
  document.getElementById('ctProviderModalClose')?.addEventListener('click', () => closeModal('ctProviderModal'));

  // Appointment modal
  document.getElementById('openApptAddModalBtn')?.addEventListener('click', () => {
    resetApptForm();
    populateProviderDropdown().then(() => openModal('ctApptModal'));
  });
  document.getElementById('saveApptBtn')?.addEventListener('click', saveAppointment);
  document.getElementById('cancelApptEditBtn')?.addEventListener('click', () => {
    resetApptForm();
    closeModal('ctApptModal');
  });
  document.getElementById('ctApptModalClose')?.addEventListener('click', () => {
    resetApptForm();
    closeModal('ctApptModal');
  });

  // Print button
  document.getElementById('printCareTeamBtn')?.addEventListener('click', printCareTeam);

  // Close modals on backdrop click
  ['ctApptModal', 'ctProviderModal', 'ctProviderAddModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      if (e.target.id === id) closeModal(id);
    });
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('ctApptModal');
      closeModal('ctProviderModal');
      closeModal('ctProviderAddModal');
    }
  });

  // Default to Providers sub-tab on first load
  const defaultBtn = document.querySelector('.ct-sub-tab-btn[data-ct-view="ctProvidersView"]');
  if (defaultBtn) {
    defaultBtn.click();
  } else {
    refreshProviderList();
    populateProviderDropdown();
  }
}
