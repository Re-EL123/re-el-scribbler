import { api } from '../core/api.js';
import { requireAuth, wireSignOut, currentUser } from '../core/guard.js';
import { initUI, refreshIcons, markReady } from '../core/ui.js';
import { toast } from '../core/toast.js';
import { initMediaManager } from '../core/media-manager.js';
import { initSelectionBubble } from '../core/selection-bubble.js';
import { initFindReplace } from '../core/find-replace.js';

const params = new URLSearchParams(location.search);
const projectId = params.get('projectId');

const state = {
  project: null,
  sections: [],
  documents: [],
  activeDocId: null,
  activeRevision: null,
  dirty: false,
  saving: false,
  saveTimer: null,
  selectedImage: null,
  searchMatches: [],
  searchIndex: -1,
  savedRange: null
};

const contentEl = () => document.getElementById('page-content');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function countWords(html) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function getCleanHtml() {
  const clone = contentEl().cloneNode(true);
  clone.querySelectorAll('mark.search-hit').forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  return clone.innerHTML;
}

function setSaveStatus(text, statusClass) {
  const el = document.getElementById('save-status');
  el.querySelector('.status-text').textContent = text;
  el.classList.remove('status-saved', 'status-saving', 'status-unsaved');
  if (statusClass) el.classList.add(statusClass);
}

function setSyncStatus(text) {
  document.getElementById('sync-status').textContent = text;
}

/* ---------- Selection preservation ---------- */

function selectionInEditor() {
  const sel = window.getSelection();
  return sel.rangeCount > 0 && contentEl().contains(sel.anchorNode);
}

function rememberSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && contentEl().contains(sel.anchorNode)) {
    state.savedRange = sel.getRangeAt(0).cloneRange();
  }
}

function restoreSelection() {
  if (!state.savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(state.savedRange);
}

function exec(command, value) {
  contentEl().focus();
  if (!selectionInEditor()) restoreSelection();
  document.execCommand(command, false, value);
  rememberSelection();
  markUnsaved();
}

function insertHtml(html) {
  contentEl().focus();
  if (!selectionInEditor()) restoreSelection();
  document.execCommand('insertHTML', false, html);
  markUnsaved();
}

/* ---------- Navigator ---------- */

function renderNavigator() {
  const chapterList = document.getElementById('chapter-list');
  const docs = state.documents.slice().sort((a, b) => (a.position || 0) - (b.position || 0));

  if (docs.length === 0) {
    chapterList.innerHTML = '<div class="chapter-item"><span class="chapter-name">No chapters yet</span></div>';
    return;
  }

  chapterList.innerHTML = docs
    .map(
      (doc) => `
      <div class="chapter-item ${doc.id === state.activeDocId ? 'active' : ''}" data-doc-id="${doc.id}">
        <i data-lucide="file-text"></i>
        <span class="chapter-name">${escapeHtml(doc.title)}</span>
      </div>`
    )
    .join('');

  refreshIcons(chapterList);

  chapterList.querySelectorAll('.chapter-item[data-doc-id]').forEach((item) => {
    item.addEventListener('click', () => selectDocument(item.dataset.docId));
  });
}

async function selectDocument(docId) {
  if (state.dirty) await save();
  state.activeDocId = docId;
  clearHighlights();
  setSaveStatus('Loading...', 'status-saving');
  try {
    const { document: doc } = await api(`/projects/${projectId}/documents`, { params: { id: docId } });
    state.activeRevision = doc.revision;
    contentEl().innerHTML = doc.content_json?.html || '<p></p>';
    updateWordCount();
    setSaveStatus('Saved', 'status-saved');
    setSyncStatus('Synced');
    renderNavigator();
    focusEditor();
  } catch (err) {
    setSaveStatus('Load failed', 'status-unsaved');
    setSyncStatus(err.message);
  }
}

function focusEditor() {
  contentEl().focus();
  const sel = window.getSelection();
  if (sel.rangeCount === 0) {
    const range = document.createRange();
    range.selectNodeContents(contentEl());
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  rememberSelection();
}

function updateWordCount() {
  document.getElementById('word-count').textContent = countWords(getCleanHtml()).toLocaleString();
}

function markUnsaved() {
  state.dirty = true;
  setSaveStatus('Unsaved changes', 'status-unsaved');
  setSyncStatus('Not synced');
  updateWordCount();
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(save, 1200);
}

async function save() {
  if (!state.dirty || !state.activeDocId || state.saving) return;
  state.saving = true;
  setSaveStatus('Saving...', 'status-saving');
  const html = getCleanHtml();
  try {
    const { document: doc } = await api(`/projects/${projectId}/documents`, {
      method: 'PATCH',
      body: {
        id: state.activeDocId,
        content_json: { format: 'html', html, updated_at: new Date().toISOString() },
        expected_revision: state.activeRevision
      }
    });
    state.activeRevision = doc.revision;
    state.dirty = false;
    setSaveStatus('Saved', 'status-saved');
    setSyncStatus('Synced');
    const local = state.documents.find((d) => d.id === state.activeDocId);
    if (local) {
      local.revision = doc.revision;
      local.word_count = doc.word_count;
    }
  } catch (err) {
    setSaveStatus('Save failed', 'status-unsaved');
    setSyncStatus(err.message);
  } finally {
    state.saving = false;
  }
}

/* ---------- Toolbar ---------- */

function applyFontSize(pt) {
  contentEl().focus();
  if (!selectionInEditor()) restoreSelection();
  document.execCommand('fontSize', false, '7');
  contentEl().querySelectorAll('font[size="7"]').forEach((el) => {
    el.removeAttribute('size');
    el.style.fontSize = `${pt}pt`;
  });
  markUnsaved();
}

function applyLineHeight(value) {
  contentEl().focus();
  if (!selectionInEditor()) restoreSelection();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  contentEl().querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, div').forEach((el) => {
    if (range.intersectsNode(el)) el.style.lineHeight = value;
  });
  markUnsaved();
}

function wireToolbar() {
  document.querySelectorAll('.toolbar-btn, .formatting-toolbar button').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
  });

  document.getElementById('bold-btn').addEventListener('click', () => exec('bold'));
  document.getElementById('italic-btn').addEventListener('click', () => exec('italic'));
  document.getElementById('underline-btn').addEventListener('click', () => exec('underline'));
  document.getElementById('align-left').addEventListener('click', () => exec('justifyLeft'));
  document.getElementById('align-center').addEventListener('click', () => exec('justifyCenter'));
  document.getElementById('align-right').addEventListener('click', () => exec('justifyRight'));
  document.getElementById('align-justify').addEventListener('click', () => exec('justifyFull'));
  document.getElementById('bullets').addEventListener('click', () => exec('insertUnorderedList'));
  document.getElementById('numbers').addEventListener('click', () => exec('insertOrderedList'));
  document.getElementById('undo-btn').addEventListener('click', () => exec('undo'));
  document.getElementById('redo-btn').addEventListener('click', () => exec('redo'));

  document.getElementById('font-family').addEventListener('change', (e) => {
    exec('fontName', e.target.value);
    e.target.selectedIndex = 0;
  });
  document.getElementById('font-size').addEventListener('change', (e) => {
    applyFontSize(e.target.value);
  });
  document.getElementById('text-style').addEventListener('change', (e) => {
    const map = { normal: 'p', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', quote: 'blockquote', caption: 'p' };
    exec('formatBlock', map[e.target.value] || 'p');
    e.target.value = 'normal';
  });

  document.getElementById('insert-image').addEventListener('click', () => switchTab('image'));
  document.getElementById('insert-drawing').addEventListener('click', () => switchTab('drawing'));
  document.getElementById('insert-table').addEventListener('click', () => {
    const rows = ['', '', ''];
    const cells = '<td style="border:1px solid #cbd5e1;padding:8px;">&nbsp;</td>'.repeat(3);
    const table = `<table style="border-collapse:collapse;width:100%;margin:1rem 0;"><tbody>${rows
      .map(() => `<tr>${cells}</tr>`)
      .join('')}</tbody></table><p><br></p>`;
    insertHtml(table);
  });

  document.getElementById('search-btn').addEventListener('click', toggleSearch);
  document.getElementById('preview-btn').addEventListener('click', openPreview);
}

/* ---------- Inspector tabs ---------- */

function switchTab(tab) {
  document.querySelectorAll('.inspector-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  ['page', 'text', 'image', 'drawing'].forEach((name) => {
    const panel = document.getElementById(`inspector-${name}`);
    if (panel) panel.style.display = name === tab ? 'flex' : 'none';
  });
  if (tab === 'drawing') initDrawingCanvas();
}

function wireInspector() {
  document.querySelectorAll('.inspector-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('text-font').addEventListener('change', (e) => exec('fontName', e.target.value));
  document.getElementById('text-size').addEventListener('change', (e) => applyFontSize(e.target.value));
  document.getElementById('text-color').addEventListener('input', (e) => exec('foreColor', e.target.value));
  document.getElementById('text-lineheight').addEventListener('input', (e) => applyLineHeight(e.target.value));
  document.querySelectorAll('[data-align]').forEach((btn) => {
    btn.addEventListener('click', () => exec(btn.dataset.align));
  });

  document.getElementById('image-insert-url').addEventListener('click', () => {
    const url = document.getElementById('image-url').value.trim();
    if (!url) return;
    insertHtml(`<img src="${escapeHtml(url)}" alt="" style="max-width:100%;">`);
    document.getElementById('image-url').value = '';
  });
  document.getElementById('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      insertHtml(`<img src="${reader.result}" alt="${escapeHtml(file.name)}" style="max-width:100%;">`);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('image-width').addEventListener('change', (e) => {
    if (!state.selectedImage || !e.target.value) return;
    state.selectedImage.style.width = `${e.target.value}px`;
    state.selectedImage.style.maxWidth = '100%';
    markUnsaved();
  });

  wireDrawing();
}

/* ---------- Drawing ---------- */

let drawInitialised = false;

function initDrawingCanvas() {
  if (drawInitialised) return;
  drawInitialised = true;
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;

  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const { x, y } = pos(e);
    ctx.strokeStyle = document.getElementById('draw-color').value;
    ctx.lineWidth = Number(document.getElementById('draw-size').value);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
  const stop = () => {
    drawing = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointerleave', stop);

  document.getElementById('draw-clear').addEventListener('click', () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });
  document.getElementById('draw-insert').addEventListener('click', () => {
    insertHtml(`<img src="${canvas.toDataURL('image/png')}" alt="drawing" style="max-width:100%;">`);
  });
}

function wireDrawing() {
  /* listeners attached inside initDrawingCanvas on first activation */
}

/* ---------- Search ---------- */

function toggleSearch() {
  const bar = document.getElementById('search-bar');
  const open = bar.style.display === 'none';
  bar.style.display = open ? 'flex' : 'none';
  if (open) {
    document.getElementById('search-input').focus();
  } else {
    clearHighlights();
  }
}

function clearHighlights() {
  contentEl().querySelectorAll('mark.search-hit').forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
  state.searchMatches = [];
  state.searchIndex = -1;
  updateSearchCount();
}

function updateSearchCount() {
  const el = document.getElementById('search-count');
  if (!el) return;
  el.textContent = `${state.searchMatches.length ? state.searchIndex + 1 : 0}/${state.searchMatches.length}`;
}

function runSearch(query) {
  clearHighlights();
  if (!query) return;
  const lower = query.toLowerCase();
  const walker = document.createTreeWalker(contentEl(), NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const original = node.nodeValue;
    const lowerText = original.toLowerCase();
    if (!lowerText.includes(lower)) return;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let i = lowerText.indexOf(lower);
    while (i !== -1) {
      frag.appendChild(document.createTextNode(original.slice(lastIndex, i)));
      const mark = document.createElement('mark');
      mark.className = 'search-hit';
      mark.textContent = original.slice(i, i + query.length);
      frag.appendChild(mark);
      lastIndex = i + query.length;
      i = lowerText.indexOf(lower, lastIndex);
    }
    frag.appendChild(document.createTextNode(original.slice(lastIndex)));
    node.parentNode.replaceChild(frag, node);
  });

  state.searchMatches = Array.from(contentEl().querySelectorAll('mark.search-hit'));
  state.searchIndex = state.searchMatches.length ? 0 : -1;
  highlightCurrent();
}

function highlightCurrent() {
  state.searchMatches.forEach((m) => m.classList.remove('current'));
  const current = state.searchMatches[state.searchIndex];
  if (current) {
    current.classList.add('current');
    current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  updateSearchCount();
}

function stepSearch(delta) {
  if (!state.searchMatches.length) return;
  state.searchIndex = (state.searchIndex + delta + state.searchMatches.length) % state.searchMatches.length;
  highlightCurrent();
}

function wireSearch() {
  const input = document.getElementById('search-input');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value.trim()), 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      stepSearch(e.shiftKey ? -1 : 1);
    }
    if (e.key === 'Escape') toggleSearch();
  });
  document.getElementById('search-next').addEventListener('click', () => stepSearch(1));
  document.getElementById('search-prev').addEventListener('click', () => stepSearch(-1));
  document.getElementById('search-close').addEventListener('click', toggleSearch);
}

/* ---------- Preview ---------- */

async function openPreview() {
  const modal = document.getElementById('preview-modal');
  const container = document.getElementById('preview-content');
  modal.style.display = 'flex';
  container.innerHTML = '<p>Loading preview...</p>';
  try {
    const { export: data } = await api(`/projects/${projectId}/export`, { params: { format: 'html' } });
    const head = `<h1>${escapeHtml(data.project.title)}</h1>${
      data.project.author_name ? `<p><em>by ${escapeHtml(data.project.author_name)}</em></p>` : ''
    }`;
    container.innerHTML = head + data.documents.map((d) => d.html || '').join('<hr>');
  } catch (err) {
    container.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function wirePreview() {
  const modal = document.getElementById('preview-modal');
  modal.querySelectorAll('[data-close="preview-modal"]').forEach((el) => {
    el.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.style.display = 'none';
  });
}

/* ---------- Structure / title / export ---------- */

function wireStructure() {
  const addChapter = async () => {
    const count = state.documents.length + 1;
    const title = prompt('Chapter title:', `Chapter ${count}`);
    if (!title) return;
    try {
      const { section } = await api(`/projects/${projectId}/structure`, {
        method: 'POST',
        body: { title, section_type: 'chapter' }
      });
      const { document: doc } = await api(`/projects/${projectId}/documents`, {
        method: 'POST',
        body: { title, section_id: section.id }
      });
      state.documents.push(doc);
      renderNavigator();
      selectDocument(doc.id);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  document.getElementById('add-chapter').addEventListener('click', addChapter);
  document.getElementById('add-section').addEventListener('click', addChapter);
}

function wireTitle() {
  document.getElementById('rename-book').addEventListener('click', async () => {
    const title = prompt('Rename book:', state.project.title);
    if (!title || title === state.project.title) return;
    try {
      const { project } = await api(`/projects/${projectId}`, {
        method: 'PATCH',
        body: { title }
      });
      state.project = project;
      document.getElementById('book-title').textContent = project.title;
      document.title = `${project.title} - Re-EL Scribbler`;
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function wireExport() {
  document.getElementById('export-btn').addEventListener('click', () => {
    const modal = document.getElementById('export-modal');
    if (modal) {
      modal.style.display = 'flex';
      refreshIcons(modal);
    }
  });
  document.querySelectorAll('#export-modal [data-export-format]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fmt = btn.dataset.exportFormat;
      try {
        const { export: data } = await api(`/projects/${projectId}/export`, { params: { format: fmt } });
        if (fmt === 'html') {
          const body = (data.documents || []).map((d) => d.html).join('\n');
          const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(data.project.title)}</title>
<style>body{font-family:Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.8;color:#111827;}img{max-width:100%;}</style>
</head><body><h1>${escapeHtml(data.project.title)}</h1>${data.project.author_name ? `<p><em>by ${escapeHtml(data.project.author_name)}</em></p>` : ''}${body}</body></html>`;
          downloadBlob(full, `${safeName(data.project.title)}.html`, 'text/html');
        } else if (fmt === 'txt') {
          const text = (data.documents || []).map((d) => stripHtml(d.html)).join('\n\n');
          downloadBlob(text, `${safeName(data.project.title)}.txt`, 'text/plain');
        } else if (fmt === 'md') {
          const md = (data.documents || []).map((d) => stripHtmlToMd(d.html)).join('\n\n');
          downloadBlob(md, `${safeName(data.project.title)}.md`, 'text/markdown');
        }
        const modal = document.getElementById('export-modal');
        if (modal) modal.style.display = 'none';
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

function safeName(t){ return (t || 'book').replace(/[^\w\-]+/g, '_'); }
function downloadBlob(content, filename, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function stripHtml(h){ return String(h||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim(); }
function stripHtmlToMd(h){ return stripHtml(h); }


/* ---------- Keyboard / focus ---------- */

function wireEditingBehaviour() {
  const editor = contentEl();

  editor.addEventListener('input', () => {
    clearHighlights();
    markUnsaved();
  });
  editor.addEventListener('blur', save);
  editor.addEventListener('keyup', rememberSelection);
  editor.addEventListener('mouseup', rememberSelection);
  document.addEventListener('selectionchange', rememberSelection);

  editor.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') {
      state.selectedImage = e.target;
      document.getElementById('image-width').value = parseInt(e.target.style.width, 10) || '';
      switchTab('image');
    } else {
      state.selectedImage = null;
    }
  });

  const canvasContainer = document.querySelector('.canvas-container');
  canvasContainer.addEventListener('mousedown', (e) => {
    if (editor.contains(e.target)) return;
    e.preventDefault();
    focusEditor();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Spacebar')) {
      const el = document.activeElement;
      const editable =
        el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (!editable) {
        e.preventDefault();
        focusEditor();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (document.getElementById('search-bar').style.display === 'none') toggleSearch();
      else document.getElementById('search-input').focus();
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/* ---------- Init ---------- */

async function init() {
  initUI();

  if (!requireAuth()) return;
  if (!projectId) {
    location.replace('dashboard.html');
    return;
  }

  wireSignOut();
  const user = currentUser();
  if (user) {
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    if (nameEl) nameEl.textContent = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Writer';
    if (emailEl) emailEl.textContent = user.email || '';
  }

  try {
    const data = await api(`/projects/${projectId}`);
    state.project = data.project;
    state.sections = data.structure.sections || [];
    state.documents = data.structure.documents || [];
  } catch (err) {
    toast(err.message, 'error');
    location.replace('dashboard.html');
    return;
  }

  document.getElementById('book-title').textContent = state.project.title;
  document.getElementById('target-words').textContent = (
    state.project.target_word_count || 85000
  ).toLocaleString();
  document.title = `${state.project.title} - Re-EL Scribbler`;

  wireToolbar();
  wireInspector();
  wireStructure();
  wireTitle();
  wireExport();
  wirePreview();
  wireSearch();
  try { initFindReplace(document.getElementById('search-bar'), document.getElementById('search-input'), document.getElementById('search-prev'), document.getElementById('search-next'), document.getElementById('search-close')); } catch(e) {}
  wireEditingBehaviour();
  wireEditorNav();
  wireZen();
  renderNavigator();

  if (state.documents.length > 0) {
    const sorted = state.documents.slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    selectDocument(sorted[0].id);
  } else {
    setSaveStatus('No chapters', 'status-unsaved');
  }

  initMediaManager(contentEl());
  initSelectionBubble(contentEl(), async (payload) => {
    try {
      const res = await api('/assistant', { method: 'POST', body: payload });
      return res;
    } catch (e) {
      toast(e.message || 'AI not available', 'error');
      return { result: '' };
    }
  });
  markReady();
}

function wireEditorNav() {
  const chaptersNav = document.getElementById('editor-nav-chapters');
  if (chaptersNav) {
    chaptersNav.addEventListener('click', (event) => {
      event.preventDefault();
      const sidebar = document.getElementById('editor-sidebar');
      if (sidebar && sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        window.dispatchEvent(new Event('resize'));
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function wireZen() {
  const btn = document.getElementById('zen-btn');
  if (!btn) return;
  const icon = btn.querySelector('i[data-lucide]');
  const label = btn.querySelector('.btn-label');
  function applyZen(zen) {
    document.body.classList.toggle('zen', zen);
    try { localStorage.setItem('scribbler.zen', zen ? '1' : '0'); } catch (e) {}
    if (icon) icon.setAttribute('data-lucide', zen ? 'minimize-2' : 'maximize-2');
    if (label) label.textContent = zen ? 'Exit Zen' : 'Zen';
    refreshIcons(btn);
    btn.setAttribute('aria-pressed', String(zen));
    btn.title = zen ? 'Exit Zen Mode (Esc)' : 'Zen Mode';
  }
  btn.addEventListener('click', () => applyZen(!document.body.classList.contains('zen')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('zen')) {
      applyZen(false);
    }
  });
  try {
    if (localStorage.getItem('scribbler.zen') === '1') applyZen(true);
  } catch (e) {}
}
