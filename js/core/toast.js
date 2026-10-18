export function toast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-message">${escapeHtml(String(message))}</span>
    <button class="toast-close" aria-label="Close">×</button>
  `;
  const close = () => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector('.toast-close').addEventListener('click', close);
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (duration > 0) {
    setTimeout(close, duration);
  }
  return { close };
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
