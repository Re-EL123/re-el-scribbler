import { createIcons } from '../../vendor/lucide-subset.js';

export function refreshIcons(root = document) {
  try {
    createIcons({ root, attrs: { 'aria-hidden': 'true' } });
  } catch (err) {
    console.warn('Icon render failed', err);
  }
}

/* ---------- Preloader ---------- */
let revealed = false;
let windowLoaded = document.readyState === 'complete';
let pageReady = false;
let minTimePassed = false;

function hideLoader() {
  if (revealed) return;
  revealed = true;
  const loader = document.getElementById('app-loader');
  document.body.classList.add('app-ready');
  if (loader) {
    loader.classList.add('hidden');
    window.setTimeout(() => loader.remove(), 500);
  }
}

function tryReveal() {
  if (windowLoaded && pageReady && minTimePassed) hideLoader();
}

export function markReady() {
  pageReady = true;
  tryReveal();
}

/* ---------- Sidebar toggles ---------- */
function resolveSidebar(button) {
  const target = button.getAttribute('data-sidebar-target');
  if (target) return document.getElementById(target);
  return button.closest('.app-sidebar');
}

function syncSidebarButtons(sidebar) {
  const collapsed = sidebar.classList.contains('collapsed');
  document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
    if (resolveSidebar(button) === sidebar) {
      button.setAttribute('aria-expanded', String(!collapsed));
    }
  });
}

function setupSidebarToggles() {
  document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const sidebar = resolveSidebar(button);
      if (!sidebar) return;
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      syncSidebarButtons(sidebar);
      try {
        if (sidebar.id) {
          localStorage.setItem(`scribbler.sidebar.${sidebar.id}`, collapsed ? 'collapsed' : 'expanded');
        }
      } catch {
        /* ignore storage errors */
      }
      window.dispatchEvent(new Event('resize'));
    });
  });

  document.querySelectorAll('.app-sidebar[id]').forEach((sidebar) => {
    try {
      const saved = localStorage.getItem(`scribbler.sidebar.${sidebar.id}`);
      if (saved) sidebar.classList.toggle('collapsed', saved === 'collapsed');
    } catch {
      /* ignore */
    }
    syncSidebarButtons(sidebar);
  });
}

export function initUI() {
  refreshIcons();
  setupSidebarToggles();
  observeIcons();

  if (windowLoaded) {
    windowLoaded = true;
  } else {
    window.addEventListener('load', () => {
      windowLoaded = true;
      tryReveal();
    });
  }

  window.setTimeout(() => {
    minTimePassed = true;
    tryReveal();
  }, 250);

  window.setTimeout(() => {
    minTimePassed = true;
    pageReady = true;
    windowLoaded = true;
    tryReveal();
  }, 5000);
}

/* Re-render icons injected after initial load */
export function observeIcons() {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (document.querySelector('i[data-lucide]')) refreshIcons();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
