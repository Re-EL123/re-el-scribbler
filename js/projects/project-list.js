import { api, ApiError } from '../core/api.js';
import { requireAuth, wireSignOut, currentUser } from '../core/guard.js';
import { signOut } from '../auth/auth-service.js';
import { initUI, refreshIcons, markReady } from '../core/ui.js';
const state = {
  projects: [],
  filter: 'all',
  view: 'grid'
};

const STATUS_LABELS = {
  in_progress: 'In Progress',
  draft: 'Draft Complete',
  review: 'Ready for Review',
  published: 'Published',
  archived: 'Archived'
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

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function projectCard(project) {
  const status = STATUS_LABELS[project.status] || 'In Progress';
  const progress = project.target_word_count
    ? Math.min(100, Math.round(((project.word_count || 0) / project.target_word_count) * 100))
    : null;
  return `
    <article class="project-card" data-id="${project.id}">
      <div class="project-card-body">
        <span class="project-status status-${escapeHtml(project.status)}">${escapeHtml(status)}</span>
        <h3 class="project-card-title">${escapeHtml(project.title)}</h3>
        <p class="project-card-author">${escapeHtml(project.author_name || '')}</p>
        <div class="project-card-meta">
          <span><i data-lucide="file-text"></i> ${(project.word_count || 0).toLocaleString()} words</span>
          <span>${formatDate(project.updated_at)}</span>
        </div>
        ${progress != null ? `<div class="project-progress"><div class="project-progress-bar" style="width:${progress}%"></div></div>` : ''}
      </div>
    </article>
  `;
}

function wireCards(container) {
  container.querySelectorAll('.project-card[data-id]').forEach((card) => {
    card.addEventListener('click', () => {
      location.href = `editor.html?projectId=${card.dataset.id}`;
    });
  });
}

function renderEmpty(container, message, actionLabel) {
  container.innerHTML = `
    <div class="project-card empty-state">
      <p>${escapeHtml(message)}</p>
      ${actionLabel ? `<button class="btn btn-primary" id="create-first-book">${escapeHtml(actionLabel)}</button>` : ''}
    </div>
  `;
  const button = container.querySelector('#create-first-book');
  if (button) button.addEventListener('click', openWizard);
}

function render() {
  const listEl = document.getElementById('projects-list');
  const recentEl = document.getElementById('recent-projects');

  const filtered = state.projects.filter((p) =>
    state.filter === 'all' ? true : p.status === state.filter
  );

  listEl.classList.toggle('view-list', state.view === 'list');

  if (filtered.length === 0) {
    renderEmpty(
      listEl,
      state.projects.length === 0 ? 'No projects yet' : 'No projects match this filter',
      state.projects.length === 0 ? 'Create Your First Book' : null
    );
  } else {
    listEl.innerHTML = filtered.map(projectCard).join('');
    wireCards(listEl);
  }

  const recent = state.projects.slice(0, 3);
  if (recent.length === 0) {
    recentEl.innerHTML = `
      <div class="project-card empty-state">
        <p>No recent projects</p>
        <small>Create your first book to get started</small>
      </div>`;
  } else {
    recentEl.innerHTML = recent.map(projectCard).join('');
    wireCards(recentEl);
  }
}

/* ---------- Modals ---------- */

function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function wireModalClose() {
  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.dataset.close));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach((m) => (m.style.display = 'none'));
    }
  });
}

function openPanel(title, bodyHtml, afterRender) {
  document.getElementById('panel-title').textContent = title;
  const body = document.getElementById('panel-body');
  body.innerHTML = bodyHtml;
  refreshIcons(body);
  openModal('panel-modal');
  if (afterRender) afterRender(body);
}

/* ---------- Wizard ---------- */

function openWizard() {
  openModal('project-wizard-modal');
  document.getElementById('book-title').focus();
}

function closeWizard() {
  closeModal('project-wizard-modal');
  document.getElementById('project-wizard-form').reset();
}

async function loadProjects() {
  try {
    const data = await api('/projects');
    state.projects = data.projects || [];
    render();
  } catch (err) {
    renderEmpty(document.getElementById('projects-list'), err.message || 'Could not load projects', null);
  } finally {
    markReady();
  }
}

function wireWizard() {
  const form = document.getElementById('project-wizard-form');
  const submitButton = form.querySelector('button[type="submit"]');

  document.getElementById('new-book-btn').addEventListener('click', openWizard);
  document.getElementById('new-book-btn-header').addEventListener('click', openWizard);
  document.getElementById('wizard-close').addEventListener('click', closeWizard);
  document.getElementById('wizard-cancel').addEventListener('click', closeWizard);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = document.getElementById('wizard-submit-label');
    submitButton.disabled = true;
    if (label) label.textContent = 'Creating...';
    try {
      const payload = {
        title: document.getElementById('book-title').value.trim(),
        author_name: document.getElementById('book-author').value.trim(),
        subtitle: document.getElementById('book-subtitle').value.trim(),
        description: document.getElementById('book-description').value.trim(),
        language: document.getElementById('book-language').value,
        category: document.getElementById('book-category').value,
        page_size: document.getElementById('page-size').value,
        template: document.getElementById('template').value
      };
      const data = await api('/projects', { method: 'POST', body: payload });
      location.href = `editor.html?projectId=${data.project.id}`;
    } catch (err) {
      submitButton.disabled = false;
      if (label) label.textContent = 'Create Book';
      alert(err instanceof ApiError ? err.message : 'Could not create the book');
    }
  });
}

/* ---------- Import ---------- */

function toHtml(raw) {
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function importProject(file) {
  const text = await file.text();
  const lower = file.name.toLowerCase();
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const author = currentUser()?.display_name || 'Unknown Author';

  let projectMeta = { title: baseName, author_name: author };
  let jsonDocs = null;

  if (lower.endsWith('.json')) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    const proj = parsed.export?.project || parsed.project || {};
    projectMeta = {
      title: proj.title || baseName,
      author_name: proj.author_name || author,
      subtitle: proj.subtitle || undefined
    };
    jsonDocs = parsed.export?.documents || parsed.documents || [];
  }

  const created = await api('/projects', { method: 'POST', body: projectMeta });
  const projectId = created.project.id;
  const firstDocId = created.structure.documents[0].id;

  async function setContent(docId, content) {
    await api(`/projects/${projectId}/documents`, {
      method: 'PATCH',
      body: { id: docId, content_json: { format: 'html', html: toHtml(content) } }
    });
  }

  if (jsonDocs && jsonDocs.length) {
    await setContent(firstDocId, jsonDocs[0].html || '');
    for (const doc of jsonDocs.slice(1)) {
      const { document: created2 } = await api(`/projects/${projectId}/documents`, {
        method: 'POST',
        body: { title: doc.title || 'Chapter' }
      });
      await setContent(created2.id, doc.html || '');
    }
  } else {
    await setContent(firstDocId, text);
  }

  return projectId;
}

function wireImport() {
  document.getElementById('import-project-btn').addEventListener('click', () => {
    openModal('import-modal');
  });

  const input = document.getElementById('import-file');
  const confirm = document.getElementById('import-confirm');

  confirm.addEventListener('click', async () => {
    const file = input.files[0];
    if (!file) {
      alert('Choose a file to import first.');
      return;
    }
    confirm.disabled = true;
    const confirmLabel = document.getElementById('import-confirm-label');
    if (confirmLabel) confirmLabel.textContent = 'Importing...';
    try {
      const projectId = await importProject(file);
      location.href = `editor.html?projectId=${projectId}`;
    } catch (err) {
      confirm.disabled = false;
      if (confirmLabel) confirmLabel.textContent = 'Import';
      alert(err.message || 'Import failed.');
    }
  });
}

/* ---------- Filters ---------- */

function wireFilters() {
  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      state.filter = button.dataset.filter;
      render();
    });
  });

  document.querySelectorAll('.toggle-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      state.view = button.dataset.view;
      render();
    });
  });
}

/* ---------- Sidebar navigation ---------- */

function navTo(hash, updateActive = true) {
  if (updateActive) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => item.classList.remove('active'));
    const link = document.querySelector(`.sidebar-nav .nav-item[href="${hash}"]`);
    if (link) link.classList.add('active');
  }
  if (hash === 'dashboard.html') return;
  if (hash === '#my-books') {
    document.querySelector('.my-projects-section').scrollIntoView({ behavior: 'smooth' });
  } else if (hash === '#recent') {
    document.querySelector('.continue-writing-section').scrollIntoView({ behavior: 'smooth' });
  } else if (hash === '#templates') {
    showTemplates();
  } else if (hash === '#assets') {
    showAssets();
  } else if (hash === '#trash') {
    showTrash();
  } else if (hash === '#settings') {
    showSettings();
  } else if (hash === '#help') {
    showHelp();
  }
}

function showTemplates() {
  const templates = [
    { id: 'blank', name: 'Blank', desc: 'Start from a clean slate.', icon: 'file-text' },
    { id: 'novel', name: 'Novel', desc: 'Chapter-based fiction layout.', icon: 'book-open' },
    { id: 'business', name: 'Business Book', desc: 'Structured, professional layout.', icon: 'type' },
    { id: 'academic', name: 'Academic Book', desc: 'Citations and references ready.', icon: 'library' },
    { id: 'workbook', name: 'Workbook', desc: 'Exercises and worksheets.', icon: 'pencil' }
  ];
  openPanel(
    'Templates',
    `<div class="panel-list">${templates
      .map(
        (t) => `<button class="panel-item" data-template="${t.id}">
          <i data-lucide="${t.icon}"></i>
          <span class="panel-item-text">
            <span class="panel-item-name">${t.name}</span>
            <span class="panel-item-desc">${t.desc}</span>
          </span>
        </button>`
      )
      .join('')}</div>`,
    (body) => {
      body.querySelectorAll('[data-template]').forEach((btn) => {
        btn.addEventListener('click', () => {
          closeModal('panel-modal');
          document.getElementById('template').value = btn.dataset.template;
          openWizard();
        });
      });
    }
  );
}

function showAssets() {
  openPanel(
    'Asset Library',
    `<p class="panel-empty"><i data-lucide="image"></i> Assets belong to individual books. Open a book and use the Image or Drawing tools in the editor to add images.</p>`
  );
}

function showTrash() {
  openPanel(
    'Recycle Bin',
    `<p class="panel-empty"><i data-lucide="trash-2"></i> Deleted books are removed from your dashboard. There are no deleted books to restore.</p>`
  );
}

function showSettings() {
  const user = currentUser() || {};
  openPanel(
    'Settings',
    `<div class="panel-field"><span class="panel-label"><i data-lucide="user"></i> Name</span><span>${escapeHtml(user.display_name || 'Writer')}</span></div>
     <div class="panel-field"><span class="panel-label"><i data-lucide="feather"></i> Email</span><span>${escapeHtml(user.email || '')}</span></div>
     <div class="modal-actions"><button type="button" class="btn btn-secondary btn-with-icon" id="settings-signout"><i data-lucide="log-out"></i> Sign Out</button></div>`,
    (body) => {
      body.querySelector('#settings-signout').addEventListener('click', async () => {
        await signOut();
        location.replace('login.html');
      });
    }
  );
}

function showHelp() {
  const shortcuts = [
    ['Ctrl / Cmd + S', 'Save the current chapter', 'save'],
    ['Ctrl / Cmd + F', 'Find within the chapter', 'search'],
    ['Ctrl / Cmd + B', 'Bold', 'bold'],
    ['Ctrl / Cmd + I', 'Italic', 'italic'],
    ['Ctrl / Cmd + U', 'Underline', 'underline'],
    ['Ctrl / Cmd + Z', 'Undo', 'undo-2'],
    ['Esc', 'Close dialogs', 'x']
  ];
  openPanel(
    'Help & Shortcuts',
    `<div class="panel-list">${shortcuts
      .map(
        ([key, desc, icon]) =>
          `<div class="panel-field"><span class="panel-label"><i data-lucide="${icon}"></i> ${key}</span><span>${desc}</span></div>`
      )
      .join('')}
     <p class="panel-empty"><i data-lucide="circle-help"></i> Need more help? Email <a href="mailto:dev@re-el.com">dev@re-el.com</a>.</p></div>`
  );
}

function wireSidebarNav() {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      const hash = item.getAttribute('href');
      if (hash.startsWith('#')) {
        event.preventDefault();
        navTo(hash);
      } else if (hash === 'dashboard.html') {
        event.preventDefault();
        document.querySelector('.my-projects-section').scrollIntoView({ behavior: 'smooth' });
        navTo('#my-books');
      }
    });
  });
}

/* ---------- Init ---------- */

function init() {
  const session = requireAuth();
  if (!session) return;

  initUI();

  const user = currentUser();
  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  if (nameEl && user) nameEl.textContent = user.display_name || 'Writer';
  if (emailEl && user) emailEl.textContent = user.email || '';

  wireSignOut();
  wireWizard();
  wireImport();
  wireFilters();
  wireModalClose();
  wireSidebarNav();
  loadProjects();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
