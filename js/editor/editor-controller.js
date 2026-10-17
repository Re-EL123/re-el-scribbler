import { api } from '../core/api.js';
import { requireAuth } from '../core/guard.js';

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
  saveTimer: null
};

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

function setSaveStatus(text, statusClass) {
  const el = document.getElementById('save-status');
  el.querySelector('.status-text').textContent = text;
  el.classList.remove('status-saved', 'status-saving', 'status-unsaved');
  if (statusClass) el.classList.add(statusClass);
}

function setSyncStatus(text) {
  document.getElementById('sync-status').textContent = text;
}

const contentEl = () => document.getElementById('page-content');

function renderNavigator() {
  const chapterList = document.getElementById('chapter-list');
  const sectionDocs = state.documents.filter((d) => {
    const section = state.sections.find((s) => s.id === d.section_id);
    return !section || section.section_type === 'chapter';
  });

  if (sectionDocs.length === 0) {
    chapterList.innerHTML = '<div class="chapter-item"><span class="chapter-name">No chapters yet</span></div>';
    return;
  }

  chapterList.innerHTML = sectionDocs
    .map(
      (doc) => `
      <div class="chapter-item ${doc.id === state.activeDocId ? 'active' : ''}" data-doc-id="${doc.id}">
        <span class="chapter-name">${escapeHtml(doc.title)}</span>
      </div>`
    )
    .join('');

  chapterList.querySelectorAll('.chapter-item[data-doc-id]').forEach((item) => {
    item.addEventListener('click', () => selectDocument(item.dataset.docId));
  });
}

async function selectDocument(docId) {
  if (state.dirty) await save();
  state.activeDocId = docId;
  setSaveStatus('Loading...', 'status-saving');
  try {
    const { document: doc } = await api(`/projects/${projectId}/documents`, { params: { id: docId } });
    state.activeRevision = doc.revision;
    contentEl().innerHTML = doc.content_json?.html || '<p></p>';
    updateWordCount();
    setSaveStatus('Saved', 'status-saved');
    setSyncStatus('Synced');
    renderNavigator();
  } catch (err) {
    setSaveStatus('Load failed', 'status-unsaved');
    setSyncStatus(err.message);
  }
}

function updateWordCount() {
  const words = countWords(contentEl().innerHTML);
  document.getElementById('word-count').textContent = words.toLocaleString();
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
  const html = contentEl().innerHTML;
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

async function reloadStructure() {
  const data = await api(`/projects/${projectId}`);
  state.sections = data.structure.sections || [];
  state.documents = data.structure.documents || [];
  renderNavigator();
}

function wireToolbar() {
  const exec = (command, value) => {
    contentEl().focus();
    document.execCommand(command, false, value);
    markUnsaved();
  };

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

  document.getElementById('font-family').addEventListener('change', (e) =>
    exec('fontName', e.target.value)
  );
  document.getElementById('text-style').addEventListener('change', (e) => {
    const map = { normal: 'p', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', quote: 'blockquote', caption: 'small' };
    exec('formatBlock', map[e.target.value] || 'p');
    e.target.value = 'normal';
  });

  ['insert-image', 'insert-drawing', 'insert-table', 'search-btn', 'preview-btn'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (id === 'preview-btn') {
        window.open(`editor.html?projectId=${projectId}`, '_blank');
      } else {
        alert('This feature is coming soon.');
      }
    });
  });
}

function wireStructure() {
  const addChapter = async () => {
    const title = prompt('Chapter title:', `Chapter ${state.sections.filter((s) => s.section_type === 'chapter').length + 1}`);
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
      await reloadStructure();
      selectDocument(doc.id);
    } catch (err) {
      alert(err.message);
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
    } catch (err) {
      alert(err.message);
    }
  });
}

function wireExport() {
  document.getElementById('export-btn').addEventListener('click', async () => {
    try {
      const { export: data } = await api(`/projects/${projectId}/export`, { params: { format: 'html' } });
      const body = data.documents.map((d) => d.html).join('\n');
      const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(data.project.title)}</title></head><body><h1>${escapeHtml(data.project.title)}</h1>${data.project.author_name ? `<p>by ${escapeHtml(data.project.author_name)}</p>` : ''}${body}</body></html>`;
      const blob = new Blob([full], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data.project.title || 'book').replace(/[^\w\-]+/g, '_')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  });
}

async function init() {
  if (!requireAuth()) return;
  if (!projectId) {
    location.replace('dashboard.html');
    return;
  }

  try {
    const data = await api(`/projects/${projectId}`);
    state.project = data.project;
    state.sections = data.structure.sections || [];
    state.documents = data.structure.documents || [];
  } catch (err) {
    alert(err.message);
    location.replace('dashboard.html');
    return;
  }

  document.getElementById('book-title').textContent = state.project.title;
  document.getElementById('target-words').textContent = (
    state.project.target_word_count || 85000
  ).toLocaleString();
  document.title = `${state.project.title} - Re-EL Scribbler`;

  wireToolbar();
  wireStructure();
  wireTitle();
  wireExport();
  renderNavigator();

  contentEl().addEventListener('input', markUnsaved);
  contentEl().addEventListener('blur', save);
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  if (state.documents.length > 0) {
    selectDocument(state.documents[0].id);
  } else {
    setSaveStatus('No chapters', 'status-unsaved');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
