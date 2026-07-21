// src/services/apiClient.js
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Log the base URL for debugging
console.log('🔧 API Base URL:', BASE_URL);

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

export function getAccessToken() {
  return accessToken || localStorage.getItem('accessToken');
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new ApiError('Session expired', res.status);
        }
        const body = await res.json();
        const token = body?.data?.[0]?.accessToken || 
                     body?.data?.accessToken || 
                     body?.accessToken;
        if (!token) {
          throw new ApiError('Refresh response missing token', 500);
        }
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

let onSessionExpired = () => {};
export function setOnSessionExpired(fn) {
  onSessionExpired = fn;
}

// Extract data from API response
function extractResponseData(payload) {
  if (!payload) return null;
  
  // If payload has success and data (your API format)
  if (payload.success && payload.data !== undefined) {
    if (Array.isArray(payload.data)) {
      return payload.data;
    }
    return payload.data;
  }
  
  // If payload has data directly
  if (payload.data !== undefined) {
    return payload.data;
  }
  
  // If payload is array
  if (Array.isArray(payload)) {
    return payload;
  }
  
  return payload;
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {}, isForm = false, skipAuth = false, ...rest } = options;

  const doFetch = async () => {
    const finalHeaders = { ...headers };
    if (!isForm && body !== undefined) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    const token = getAccessToken();
    if (!skipAuth && token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      ...rest,
    });

    return response;
  };

  let res = await doFetch();

  // Handle 401 - try refresh
  if (res.status === 401 && !skipAuth && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
    try {
      await refreshAccessToken();
      res = await doFetch();
    } catch (err) {
      setAccessToken(null);
      onSessionExpired();
      throw new ApiError('Session expired, please log in again', 401);
    }
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  let payload = null;
  
  if (isJson) {
    try {
      payload = await res.json();
    } catch (e) {
      payload = null;
    }
  } else if (res.status !== 204) {
    try {
      payload = await res.text();
    } catch (e) {
      payload = null;
    }
  }

  if (!res.ok) {
    let errorMessage = `Request failed with status ${res.status}`;
    
    if (payload && typeof payload === 'object') {
      errorMessage = payload?.message || payload?.error || errorMessage;
    } else if (typeof payload === 'string' && payload) {
      errorMessage = payload;
    }
    
    throw new ApiError(errorMessage, res.status, payload);
  }

  return extractResponseData(payload);
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  postForm: (path, formData, options) => request(path, { ...options, method: 'POST', body: formData, isForm: true }),
  raw: (path, options) => request(path, { ...options, raw: true }),
};

export { refreshAccessToken, extractResponseData };
export default api;