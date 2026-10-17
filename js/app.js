import { isAuthenticated } from './auth/auth-service.js';

function initLanding() {
  const primary = document.querySelector('a[href="login.html"].btn-primary');
  const dashboard = document.querySelector('a[href="dashboard.html"]');

  if (isAuthenticated()) {
    if (primary) {
      primary.href = 'dashboard.html';
      primary.textContent = 'Open Dashboard';
    }
    if (dashboard) {
      dashboard.href = 'dashboard.html';
      dashboard.textContent = 'My Books';
    }
  } else if (dashboard) {
    dashboard.href = 'login.html';
    dashboard.textContent = 'Sign In';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanding);
} else {
  initLanding();
}
