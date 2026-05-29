export function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-button');
  const tabs    = document.querySelectorAll('.tab');
  const floatBtn = document.getElementById('saveDayFloat');

  function activate(id) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    tabs.forEach(t => t.classList.toggle('active', t.id === id));
    if (floatBtn) floatBtn.style.display = (id === 'entry-tab') ? '' : 'none';
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  // Init
  activate('entry-tab');
}

export function showStatus(msg, isError = false) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--color-error)' : 'var(--color-success)';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

export function showToast(msg, isError = false) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
