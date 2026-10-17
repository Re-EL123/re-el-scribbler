import { CONFIG } from '../config.js';

const STORAGE_KEY = 'scribbler.session';

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function normalise(authPayload) {
  return {
    access_token: authPayload.access_token,
    refresh_token: authPayload.refresh_token,
    expires_at: Date.now() + (authPayload.expires_in ? authPayload.expires_in * 1000 : 3600 * 1000),
    user: {
      id: authPayload.user.id,
      email: authPayload.user.email,
      display_name:
        authPayload.user.user_metadata?.display_name ||
        authPayload.user.display_name ||
        (authPayload.user.email || '').split('@')[0]
    }
  };
}

export function getSession() {
  return loadSession();
}

export function getToken() {
  const session = loadSession();
  return session ? session.access_token : null;
}

export function isAuthenticated() {
  return Boolean(loadSession()?.access_token);
}

export async function refreshSession() {
  const session = loadSession();
  if (!session?.refresh_token) return null;
  const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  const data = await res.json();
  const next = normalise(data);
  saveSession(next);
  return next;
}

export async function signIn(email, password) {
  const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.error_description || data.msg || data.error || 'Invalid email or password';
    throw new Error(message);
  }
  const session = normalise(data);
  saveSession(session);
  return session;
}

export async function signUp(email, password, displayName) {
  const res = await fetch(`${CONFIG.API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message || 'Could not create your account');
  }
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000),
    user: data.user
  };
  saveSession(session);
  return session;
}

export async function signOut() {
  const session = loadSession();
  clearSession();
  if (session?.access_token) {
    fetch(`${CONFIG.SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`
      }
    }).catch(() => {});
  }
}

function setStatus(el, message, type) {
  if (!el) return;
  let box = el.querySelector('.auth-status');
  if (!box) {
    box = document.createElement('div');
    box.className = 'auth-status';
    el.insertBefore(box, el.firstChild);
  }
  box.textContent = message;
  box.classList.remove('auth-status-error', 'auth-status-success');
  if (type) box.classList.add(`auth-status-${type}`);
}

function initAuthPages() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (!loginForm && !registerForm) return;

  if (isAuthenticated()) {
    location.replace('dashboard.html');
    return;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = loginForm.querySelector('button[type="submit"]');
      button.disabled = true;
      setStatus(loginForm, 'Signing in...', null);
      try {
        await signIn(
          document.getElementById('email').value.trim(),
          document.getElementById('password').value
        );
        location.replace('dashboard.html');
      } catch (err) {
        setStatus(loginForm, err.message, 'error');
        button.disabled = false;
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = registerForm.querySelector('button[type="submit"]');
      button.disabled = true;
      setStatus(registerForm, 'Creating your account...', null);
      try {
        await signUp(
          document.getElementById('email').value.trim(),
          document.getElementById('password').value,
          document.getElementById('display_name').value.trim()
        );
        location.replace('dashboard.html');
      } catch (err) {
        setStatus(registerForm, err.message, 'error');
        button.disabled = false;
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthPages);
} else {
  initAuthPages();
}
