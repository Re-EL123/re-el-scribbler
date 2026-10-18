import { isAuthenticated } from './auth/auth-service.js';
import { initUI, refreshIcons, markReady } from './core/ui.js';

function initLanding() {
  const primary = document.querySelector('a[href="login.html"].btn-primary');
  const dashboard = document.querySelector('a[href="dashboard.html"]');

  if (isAuthenticated()) {
    if (primary) {
      primary.href = 'dashboard.html';
      primary.querySelector('span').textContent = 'Open Dashboard';
    }
    if (dashboard) {
      dashboard.href = 'dashboard.html';
      dashboard.querySelector('span').textContent = 'My Books';
    }
  } else if (dashboard) {
    dashboard.href = 'login.html';
    dashboard.querySelector('span').textContent = 'Sign In';
  }
  refreshIcons(primary?.parentElement || document);
}

function init() {
  initUI();
  initLanding();
  markReady();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
