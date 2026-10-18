export function initMediaManager(root) {
  if (!root) return;
  let selected = null;
  let dragging = null;
  let resizing = null;
  let startX, startY, startLeft, startTop, startW, startH;

  root.addEventListener('click', (e) => {
    const wrapper = e.target.closest('.media-wrapper');
    if (wrapper) {
      select(wrapper);
      return;
    }
    clearSelection();
  }, true);

  root.addEventListener('mousedown', startDrag, true);
  root.addEventListener('touchstart', (e) => startDrag(e.touches[0]), { passive: false, capture: true });
  window.addEventListener('mousemove', drag);
  window.addEventListener('touchmove', (e) => drag(e.touches[0]), { passive: false });
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);

  function select(wrapper) {
    clearSelection();
    selected = wrapper;
    selected.classList.add('selected');
    makeHandles(selected);
  }

  function clearSelection() {
    if (selected) {
      selected.classList.remove('selected');
      selected.querySelectorAll('.media-handle').forEach(h => h.remove());
      selected = null;
    }
  }

  function makeHandles(wrapper) {
    const dirs = ['br', 'bl', 'tr', 'tl', 'move'];
    dirs.forEach(dir => {
      const h = document.createElement('div');
      h.className = `media-handle ${dir}`;
      h.dataset.dir = dir;
      wrapper.appendChild(h);
    });
  }

  function startDrag(ev) {
    const handle = ev.target.closest('.media-handle');
    const wrapper = ev.target.closest('.media-wrapper');
    if (handle && wrapper && wrapper.classList.contains('selected')) {
      resizing = handle.dataset.dir;
      dragging = wrapper;
      const rect = wrapper.getBoundingClientRect();
      startX = ev.clientX; startY = ev.clientY;
      startLeft = rect.left; startTop = rect.top;
      startW = rect.width; startH = rect.height;
      ev.preventDefault();
      ev.stopPropagation();
    } else if (wrapper) {
      // drag move
      if (!wrapper.classList.contains('selected')) select(wrapper);
      dragging = wrapper;
      const rect = wrapper.getBoundingClientRect();
      startX = ev.clientX; startY = ev.clientY;
      startLeft = rect.left; startTop = rect.top;
      startW = rect.width; startH = rect.height;
      resizing = 'move';
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  function drag(ev) {
    if (!dragging || !resizing) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const media = dragging.querySelector('.media');
    if (resizing === 'move') {
      dragging.style.position = dragging.style.position || 'absolute';
      dragging.style.left = (startLeft + dx) + 'px';
      dragging.style.top = (startTop + dy) + 'px';
    } else {
      let w = startW, h = startH;
      if (resizing.includes('r')) w = Math.max(40, startW + dx);
      if (resizing.includes('l')) w = Math.max(40, startW - dx);
      if (resizing.includes('b')) h = Math.max(40, startH + dy);
      if (resizing.includes('t')) h = Math.max(40, startH - dy);
      media.style.width = w + 'px';
      media.style.height = h + 'px';
    }
  }

  function endDrag() {
    dragging = null; resizing = null;
  }
}
