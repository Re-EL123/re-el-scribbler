import { api, ApiError } from '../core/api.js';
import { requireAuth, wireSignOut, currentUser } from '../core/guard.js';

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
          <span>${(project.word_count || 0).toLocaleString()} words</span>
          <span>${formatDate(project.updated_at)}</span>
        </div>
        ${progress != null ? `<div class="project-progress"><div class="project-progress-bar" style="width:${progress}%"></div></div>` : ''}
      </div>
    </article>
  `;
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
    listEl.querySelectorAll('.project-card[data-id]').forEach((card) => {
      card.addEventListener('click', () => {
        location.href = `editor.html?projectId=${card.dataset.id}`;
      });
    });
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
    recentEl.querySelectorAll('.project-card[data-id]').forEach((card) => {
      card.addEventListener('click', () => {
        location.href = `editor.html?projectId=${card.dataset.id}`;
      });
    });
  }
}

function openWizard() {
  const modal = document.getElementById('project-wizard-modal');
  modal.style.display = 'flex';
  document.getElementById('book-title').focus();
}

function closeWizard() {
  const modal = document.getElementById('project-wizard-modal');
  modal.style.display = 'none';
  document.getElementById('project-wizard-form').reset();
}

async function loadProjects() {
  try {
    const data = await api('/projects');
    state.projects = data.projects || [];
    render();
  } catch (err) {
    const listEl = document.getElementById('projects-list');
    renderEmpty(listEl, err.message || 'Could not load projects', null);
  }
}

function wireWizard() {
  const form = document.getElementById('project-wizard-form');
  const submitButton = form.querySelector('button[type="submit"]');

  document.getElementById('new-book-btn').addEventListener('click', openWizard);
  document.getElementById('new-book-btn-header').addEventListener('click', openWizard);
  document.getElementById('wizard-close').addEventListener('click', closeWizard);
  document.getElementById('wizard-cancel').addEventListener('click', closeWizard);
  document.querySelector('.modal-backdrop').addEventListener('click', closeWizard);

  document.getElementById('import-project-btn').addEventListener('click', () => {
    alert('Project import is coming soon.');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Creating...';
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
      submitButton.textContent = 'Create Book';
      alert(err instanceof ApiError ? err.message : 'Could not create the book');
    }
  });
}

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

function init() {
  const session = requireAuth();
  if (!session) return;

  const user = currentUser();
  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  if (nameEl && user) nameEl.textContent = user.display_name || 'Writer';
  if (emailEl && user) emailEl.textContent = user.email || '';

  wireSignOut();
  wireWizard();
  wireFilters();
  loadProjects();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
