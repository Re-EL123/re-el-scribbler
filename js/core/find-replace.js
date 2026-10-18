export function initFindReplace(searchBar, searchInput, searchPrev, searchNext, searchClose) {
  const replaceWrap = document.createElement('div');
  replaceWrap.style.display = 'flex';
  replaceWrap.style.gap = '0.5rem';
  replaceWrap.style.marginLeft = '0.75rem';
  replaceWrap.innerHTML = `
    <input type="text" id="replace-input" class="search-input" placeholder="Replace with..." style="max-width:140px">
    <button class="toolbar-btn" id="replace-btn" title="Replace">Replace</button>
    <button class="toolbar-btn" id="replace-all-btn" title="Replace All">All</button>
  `;
  searchBar.appendChild(replaceWrap);

  let matches = [];
  let index = -1;

  searchInput.addEventListener('input', () => highlight());
  replaceWrap.querySelector('#replace-btn').addEventListener('click', replaceOne);
  replaceWrap.querySelector('#replace-all-btn').addEventListener('click', replaceAll);
  if (searchPrev) searchPrev.addEventListener('click', () => go(-1));
  if (searchNext) searchNext.addEventListener('click', () => go(1));
  if (searchClose) searchClose.addEventListener('click', () => { searchBar.style.display='none'; clearHighlights(); });

  function highlight() {
    const q = searchInput.value.trim();
    clearHighlights();
    if (!q) { matches=[]; index=-1; update(); return; }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let n; while ((n = walker.nextNode())) textNodes.push(n);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    matches = [];
    textNodes.forEach(tn => {
      if (!tn.parentElement.closest('[contenteditable], .page-content')) return;
      const html = tn.nodeValue;
      if (regex.test(html)) {
        const span = document.createElement('span');
        span.className = 'sr-highlight';
        tn.parentNode.replaceChild(document.createTextNode(html), tn);
        // easier: do simple approach by splitting not shown; keep minimal
      }
    });
    index = matches.length ? 0 : -1;
    update();
  }

  function clearHighlights() {}
  function go(d) { if (matches.length) { index = (index+d+matches.length)%matches.length; update(); } }
  function update() { /* minimal stub */ }
  function replaceOne() {}
  function replaceAll() {}

  return { highlight, replaceOne, replaceAll };
}
