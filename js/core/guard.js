import { isAuthenticated, getSession, signOut } from '../auth/auth-service.js';

export function requireAuth() {
  if (!isAuthenticated()) {
    location.replace('login.html');
    return null;
  }
  return getSession();
}

export function redirectIfAuthed(target = 'dashboard.html') {
  if (isAuthenticated()) {
    location.replace(target);
  }
}

export function wireSignOut(selector = '[data-action="sign-out"]') {
  const buttons = document.querySelectorAll(selector);
  buttons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      await signOut();
      location.replace('login.html');
    });
  });
}

export function currentUser() {
  return getSession()?.user || null;
}
