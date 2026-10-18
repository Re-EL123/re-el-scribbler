import { toast } from './toast.js';

export function initSelectionBubble(root, apiFn) {
  if (!root) return;

  const bubble = document.createElement('div');
  bubble.className = 'selection-bubble';
  bubble.innerHTML = `
    <button class="bubble-btn" data-act="rephrase">Rephrase</button>
    <button class="bubble-btn" data-act="expand">Expand</button>
    <button class="bubble-btn" data-act="shorten">Shorten</button>
    <button class="bubble-btn" data-act="tone">Tone</button>
    <button class="bubble-btn" data-act="continue">Continue</button>
    <button class="bubble-btn" data-act="fix">Fix</button>
  `;
  document.body.appendChild(bubble);

  const panel = document.createElement('div');
  panel.className = 'selection-panel';
  panel.innerHTML = `
    <textarea id="ai-result" placeholder="AI suggestion..."></textarea>
    <div class="selection-actions">
      <button class="btn btn-secondary" data-act="discard">Discard</button>
      <button class="btn btn-primary" data-act="apply">Apply</button>
    </div>
  `;
  document.body.appendChild(panel);

  let selectedText = '';
  let range = null;

  function getSelectionRange() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && sel.toString().trim()) {
      return { text: sel.toString(), range: sel.getRangeAt(0) };
    }
    return null;
  }

  function showBubble(rect) {
    bubble.style.left = (rect.left + rect.width / 2 - bubble.offsetWidth / 2) + 'px';
    bubble.style.top = (rect.top - bubble.offsetHeight - 8) + 'px';
    bubble.classList.add('show');
  }

  function hideBubble() { bubble.classList.remove('show'); }

  function showPanel(rect, text) {
    panel.querySelector('#ai-result').value = text;
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.bottom + 8 + 'px';
    panel.classList.add('show');
  }

  function hidePanel() { panel.classList.remove('show'); }

  async function callAI(prompt, selected) {
    try {
      if (!apiFn) return;
      const res = await apiFn({ prompt, context: selected });
      if (res?.result) return res.result;
      if (res?.message) return res.message;
      return '';
    } catch (e) {
      toast(e.message || 'AI failed', 'error');
      return '';
    }
  }

  root.addEventListener('mouseup', () => {
    setTimeout(() => {
      const s = getSelectionRange();
      if (s && s.text.trim().length > 0) {
        selectedText = s.text; range = s.range;
        const rect = range.getBoundingClientRect();
        showBubble(rect);
        hidePanel();
      } else {
        hideBubble();
      }
    }, 10);
  });

  bubble.addEventListener('click', async (e) => {
    const btn = e.target.closest('.bubble-btn');
    if (!btn) return;
    const act = btn.dataset.act;
    let prompt = '';
    if (act === 'rephrase') prompt = `Rephrase clearly and naturally:`;
    if (act === 'expand') prompt = `Expand with relevant detail, keep tone consistent:`;
    if (act === 'shorten') prompt = `Shorten while preserving meaning:`;
    if (act === 'tone') prompt = `Adjust tone to be professional and readable:`;
    if (act === 'continue') prompt = `Continue from where this ends:`;
    if (act === 'fix') prompt = `Fix grammar, clarity, punctuation:`;
    hideBubble();
    const res = await callAI(`${prompt}\n\n${selectedText}`, selectedText);
    if (res) {
      const sel = window.getSelection();
      let r = range;
      if (!r || sel.rangeCount === 0) {
        const s2 = getSelectionRange(); r = s2?.range;
      }
      const rect = r?.getBoundingClientRect() || { left: 0, bottom: window.innerHeight / 2 };
      showPanel(rect, res);
    }
  });

  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'discard') { hidePanel(); }
    if (act === 'apply') {
      const val = panel.querySelector('#ai-result').value;
      if (val && range) {
        range.deleteContents();
        range.insertNode(document.createTextNode(val));
        const sel = window.getSelection();
        sel.removeAllRanges();
        const nr = document.createRange();
        nr.selectNodeContents(range.endContainer.parentNode);
        nr.collapse(false);
        sel.addRange(nr);
      }
      hidePanel();
    }
  });
}
