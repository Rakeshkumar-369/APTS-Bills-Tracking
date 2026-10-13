// src/services/apiClient.js
import { decodeEntities } from '../utils/text';

// Relative by default: in development Vite proxies /api to the backend, in
// production the backend serves the SPA from the same origin.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// The access token lives ONLY in memory. It is never written to localStorage /
// sessionStorage, so an injected script cannot read a long-lived credential.
// After a page reload the session is restored from the HttpOnly refresh cookie.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

let refreshPromise = null;

/**
 * Exchange the HttpOnly refresh cookie for a new access token.
 * Concurrent callers share one in-flight request (refresh tokens rotate, so
 * parallel refreshes would invalidate each other).
 * Resolves to { accessToken, user }.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError('Session expired', res.status);
        const body = await res.json();
        const entry = decodeDeep(body?.data?.[0] || {});
        if (!entry.accessToken) throw new ApiError('Refresh response missing token', 500);
        setAccessToken(entry.accessToken);
        return { accessToken: entry.accessToken, user: entry.user };
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function refreshAccessToken() {
  const { accessToken: token } = await refreshSession();
  return token;
}

let onSessionExpired = () => {};
export function setOnSessionExpired(fn) {
  onSessionExpired = fn;
}

// The API HTML-escapes free text when it is saved. Decode it once here so every
// screen (and every edit form that re-submits a value) works with plain text;
// React escapes again when rendering, so this is safe.
function decodeDeep(value) {
  if (typeof value === 'string') return value.includes('&') ? decodeEntities(value) : value;
  if (Array.isArray(value)) return value.map(decodeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = decodeDeep(v);
    return out;
  }
  return value;
}

function extractResponseData(payload) {
  if (!payload) return null;
  return decodeDeep(payload.data !== undefined ? payload.data : payload);
}

function filenameFromDisposition(header) {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try { return decodeURIComponent(star[1]); } catch { /* fall through */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

async function request(path, options = {}) {
  const {
    method = 'GET', body, headers = {}, isForm = false, skipAuth = false,
    responseType = 'json', withMeta = false, signal,
  } = options;

  const doFetch = () => {
    const finalHeaders = { ...headers };
    if (!isForm && body !== undefined) finalHeaders['Content-Type'] = 'application/json';
    if (!skipAuth && accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;

    return fetch(`${BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  };

  let res = await doFetch();

  // Access token expired → refresh once and retry
  if (res.status === 401 && !skipAuth && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
    } catch {
      setAccessToken(null);
      onSessionExpired();
      throw new ApiError('Session expired, please log in again', 401);
    }
    res = await doFetch();
  }

  if (responseType === 'blob' && res.ok) {
    return {
      blob: await res.blob(),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      filename: filenameFromDisposition(res.headers.get('content-disposition')),
    };
  }

  const contentType = res.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await res.json().catch(() => null);
  } else if (res.status !== 204) {
    payload = await res.text().catch(() => null);
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    if (payload && typeof payload === 'object') message = payload.message || payload.error || message;
    else if (typeof payload === 'string' && payload && payload.length < 300) message = payload;
    throw new ApiError(message, res.status, payload);
  }

  if (withMeta) {
    return { data: extractResponseData(payload) || [], meta: payload?.meta || {} };
  }
  return extractResponseData(payload);
}

/** Save a Blob to disk via a temporary object URL. */
export function saveBlob(blob, filename = 'file') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  postForm: (path, formData, options) => request(path, { ...options, method: 'POST', body: formData, isForm: true }),
  blob: (path, options) => request(path, { ...options, method: 'GET', responseType: 'blob' }),
};

export { extractResponseData };
export default api;
