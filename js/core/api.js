import { CONFIG } from '../config.js';
import { getToken, refreshSession, signOut } from '../auth/auth-service.js';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, params, retry = true } = {}) {
  let url = `${CONFIG.API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return api(path, { method, body, params, retry: false });
    }
    await signOut();
    location.replace('login.html');
    throw new ApiError('UNAUTHENTICATED', 'Your session has expired', 401);
  }

  if (!res.ok || data.success === false) {
    const code = data?.error?.code || 'INTERNAL';
    const message = data?.error?.message || `Request failed (${res.status})`;
    throw new ApiError(code, message, res.status);
  }

  return data;
}
