const TOKEN_KEY = 'mapix_access_token';

function apiBase() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem('token');
}

export function setAccessToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem('token', token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem('token');
  }
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, auth?: boolean }} [options]
 */
async function request(path, options = {}) {
  const { method = 'GET', body, auth = true } = options;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    /** @type {Error & { status?: number, data?: unknown }} */
    const err = new Error(data?.message || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function entityApi(name) {
  return {
    async list(options = {}) {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.sort) params.set('sort', options.sort);
      if (options.order) params.set('sort', options.order);
      if (options.cursor) params.set('cursor', options.cursor);
      if (Array.isArray(options.fields)) params.set('fields', options.fields.join(','));
      const qs = params.toString();
      return request(`/api/entities/${name}${qs ? `?${qs}` : ''}`);
    },
    async filter(query = {}, options = {}) {
      return request(`/api/entities/${name}/filter`, {
        method: 'POST',
        body: { query, options },
      });
    },
    async get(id) {
      return request(`/api/entities/${name}/${id}`);
    },
    async create(data) {
      return request(`/api/entities/${name}`, { method: 'POST', body: data });
    },
    async update(id, data) {
      return request(`/api/entities/${name}/${id}`, { method: 'PATCH', body: data });
    },
    async delete(id) {
      return request(`/api/entities/${name}/${id}`, { method: 'DELETE' });
    },
    async bulkCreate(items) {
      return request(`/api/entities/${name}/bulk`, { method: 'POST', body: items });
    },
    async count(query = {}) {
      const data = await request(`/api/entities/${name}/count`, { method: 'POST', body: query });
      return typeof data?.count === 'number' ? data.count : data;
    },
    async aggregate(payload = {}) {
      return request(`/api/entities/${name}/aggregate`, { method: 'POST', body: payload });
    },
  };
}

const ENTITY_NAMES = [
  'User', 'Localitate', 'Zona', 'SursaAct', 'TaxaAcces', 'Vehicul', 'Cursa', 'CursaTaxa', 'Alerta',
];

const entities = Object.fromEntries(ENTITY_NAMES.map((name) => [name, entityApi(name)]));

export const api = {
  entities,
  app: {
    async getPublicSettings() {
      return request('/api/auth/public-settings', { auth: false });
    },
  },
  auth: {
    getAccessToken,
    setToken(token) {
      setAccessToken(token);
    },
    async me() {
      return request('/api/auth/me');
    },
    async updateMe(data) {
      return request('/api/auth/me', { method: 'PATCH', body: data });
    },
    async loginViaEmailPassword(email, password) {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      if (result?.access_token) setAccessToken(result.access_token);
      return result;
    },
    async register({ email, password }) {
      return request('/api/auth/register', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
    },
    async verifyOtp({ email, otpCode }) {
      return request('/api/auth/verify-otp', {
        method: 'POST',
        body: { email, otpCode },
        auth: false,
      });
    },
    async resendOtp(email) {
      return request('/api/auth/resend-otp', {
        method: 'POST',
        body: { email },
        auth: false,
      });
    },
    async resetPasswordRequest(email) {
      return request('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
        auth: false,
      });
    },
    async resetPassword({ resetToken, newPassword }) {
      return request('/api/auth/reset-password', {
        method: 'POST',
        body: { resetToken, newPassword },
        auth: false,
      });
    },
    loginWithProvider(_provider, _returnTo) {
      throw new Error('Autentificarea Google nu este configurată. Folosește email și parolă.');
    },
    logout(redirectTo) {
      setAccessToken(null);
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    },
    redirectToLogin(returnTo) {
      const target = returnTo
        ? `/login?returnTo=${encodeURIComponent(returnTo)}`
        : '/login';
      window.location.href = target;
    },
    isAuthenticated() {
      return Boolean(getAccessToken());
    },
  },
  users: {
    async inviteUser(email, role) {
      return request('/api/auth/invite', {
        method: 'POST',
        body: { email, role },
      });
    },
  },
};
