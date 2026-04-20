/**
 * API client for URIMPACT backend.
 * Receipt uploads are sent to the backend for AI extraction and emission calculation.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const AUTH_TOKEN_KEY = 'urimpact_access_token';
const REFRESH_TOKEN_KEY = 'urimpact_refresh_token';
const AUTH_USER_KEY = 'urimpact_user';
const SESSION_EXPIRED_EVENT = 'urimpact:session-expired';

export function getApiUrl() {
  return API_BASE;
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function authHeaders() {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function handleAuthFailure() {
  setAuthToken(null);
  setRefreshToken(null);
  localStorage.removeItem(AUTH_USER_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  // Endpoint is assumed to exist. If it doesn't, we fall back to normal session-expired handling.
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) return null;

  const data = await res.json().catch(() => ({}));
  const payload = data?.data ?? data;
  const nextAccessToken = payload?.accessToken;
  const nextRefreshToken = payload?.refreshToken;

  if (!nextAccessToken) return null;

  setAuthToken(nextAccessToken);
  if (nextRefreshToken) setRefreshToken(nextRefreshToken);
  return nextAccessToken;
}

async function authFetch(url, options, { retryOnAuth = true } = {}) {
  const mergedHeaders = { ...(options?.headers ? options.headers : {}), ...authHeaders() };
  let res = await fetch(url, { ...options, headers: mergedHeaders });

  // Retry once after access-token expiration (401 or error-body token messages).
  if (retryOnAuth) {
    let shouldRefresh = res.status === 401;

    if (!shouldRefresh && !res.ok) {
      const cloned = res.clone();
      const err = await cloned.json().catch(() => ({}));
      const message = err?.error || err?.message;
      shouldRefresh = isAuthErrorMessage(message);
    }

    if (shouldRefresh) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const retryHeaders = { ...(options?.headers ? options.headers : {}), ...authHeaders() };
        res = await fetch(url, { ...options, headers: retryHeaders });
      } else {
        handleAuthFailure();
      }
    }
  }

  return res;
}

function isAuthErrorMessage(message = '') {
  // Backend sometimes returns auth errors as:
  // - plain string (e.g. "Token has expired")
  // - { message: "Token has expired" }
  // - { error: "..." } or nested objects.
  // Normalize to a lowercase string for reliable detection.
  const value =
    typeof message === 'string'
      ? message
      : (message && typeof message === 'object'
          ? JSON.stringify(message)
          : String(message || '')
        );
  const normalized = String(value || '').toLowerCase();
  return (
    normalized.includes('token has expired') ||
    normalized.includes('access token is required') ||
    normalized.includes('invalid token') ||
    normalized.includes('authentication failed') ||
    normalized.includes('jwt expired') ||
    normalized.includes('expired') // broad fallback; guarded by auth keywords above in practice
  );
}

async function buildApiError(response, fallbackLabel) {
  const err = await response.json().catch(() => ({ error: response.statusText }));
  const message = err.error || err.message || `${fallbackLabel}: ${response.status}`;

  if (response.status === 401 || isAuthErrorMessage(message)) {
    handleAuthFailure();
    return 'Session expired. Please log in again.';
  }

  return message;
}

/**
 * Upload a receipt and run AI extraction. Returns { documentId, extractedFields } for verification.
 */
export async function uploadReceiptAndExtract(file) {
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(await buildApiError(uploadRes, 'Upload failed'));
  }

  const uploadData = await uploadRes.json();
  const documentId = uploadData?.data?.id;
  if (!documentId) throw new Error('Upload did not return document id');

  return processDocument(documentId, file.name);
}

/**
 * Upload multiple receipts in one request. Returns array of documents (each with id, fileName, etc.).
 */
export async function uploadReceiptsMultiple(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('file', files[i]);
  }

  const res = await fetch(`${API_BASE}/documents/upload-multiple`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Upload failed'));
  }

  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

/**
 * Run AI extraction on an already-uploaded document. Returns { documentId, fileName, extractedFields }.
 */
export async function processDocument(documentId, fileName = '') {
  const processRes = await fetch(`${API_BASE}/documents/${documentId}/process`, {
    method: 'POST',
    headers: authHeaders(),
  });

  if (!processRes.ok) {
    throw new Error(await buildApiError(processRes, 'Extraction failed'));
  }

  const processData = await processRes.json();
  const data = processData?.data || processData;
  return { documentId, fileName, ...data };
}

/**
 * Submit verified (and optionally edited) extraction and store emission.
 * Payload: { activityType, activityAmount, activityUnit, region?, scope?, category?, billingPeriodStart?, billingPeriodEnd? }
 */
export async function submitReceiptExtraction(documentId, payload) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/submit`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Submit failed'));
  }

  const data = await res.json();
  return data?.data || data;
}

/**
 * Submit multiple entries (e.g. from multi-row Excel). Creates one emission per entry.
 * Payload: { entries: Array<{ activityType, activityAmount, activityUnit, region?, ... }> }
 */
export async function submitReceiptBatch(documentId, entries) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/submit-batch`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Batch submit failed'));
  }

  const data = await res.json();
  return data?.data || data;
}

/**
 * Login against backend. Returns { user, accessToken, refreshToken, expiresIn } or throws.
 */
export async function loginWithBackend(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  const errMsg = data?.error || data?.message || (res.ok ? null : `Login failed (${res.status})`);

  if (!res.ok) {
    throw new Error(errMsg || 'Login failed');
  }

  const payload = data?.data ?? data;
  return {
    user: payload.user,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresIn: payload.expiresIn,
  };
}

/**
 * Register against backend. Returns created user. Does not return tokens; call loginWithBackend after to get token.
 * Body: { email, password, firstName, lastName, company? }
 * Backend requires: password min 8 chars, at least one uppercase, one lowercase, one number.
 */
export async function registerWithBackend({ email, password, firstName, lastName, company }) {
  const trimmedCompany = company != null && String(company).trim() !== '' ? String(company).trim() : undefined;
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: email?.trim?.() ?? email,
      password,
      firstName: firstName?.trim?.() ?? firstName,
      lastName: lastName?.trim?.() ?? lastName,
      ...(trimmedCompany !== undefined ? { company: trimmedCompany } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  const errMsg = data?.error || data?.message || (res.ok ? null : `Registration failed (${res.status})`);

  if (!res.ok) {
    throw new Error(errMsg || 'Registration failed');
  }

  return data?.data ?? data;
}

/**
 * Fetch dashboard data (emissions totals, by scope, trend). Requires auth.
 * Params: { startDate?, endDate? } - optional ISO date strings to filter emissions by date range.
 * Returns { emissions: { total, byScope, byCategory, trend }, documents, compliance }.
 */
export async function getDashboard(params = {}) {
  const qs = new URLSearchParams();
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await authFetch(`${API_BASE}/reports/dashboard${query}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Dashboard failed'));
  }

  const json = await res.json();
  return json?.data ?? json;
}

/**
 * Submit manual emission entry and save (no document).
 * Body: { activityType, activityAmount, activityUnit, scope?, category?, region?, billingPeriodStart?, billingPeriodEnd?, notes? }
 * Returns created emission.
 */
export async function submitManualEmission(payload) {
  const res = await fetch(`${API_BASE}/emissions/calculate`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Emission calculation failed'));
  }

  const data = await res.json();
  return data?.data || data;
}

/**
 * Fetch user's emissions list with optional filters. Requires auth.
 * Query: { scope?, category?, region?, startDate?, endDate?, page?, limit? }
 * Returns { data: emissions[], pagination: { page, limit, total, totalPages } }.
 */
export async function getEmissions(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';

  const res = await authFetch(`${API_BASE}/emissions${query}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Emissions failed'));
  }

  const json = await res.json();
  return { data: json?.data ?? [], pagination: json?.pagination ?? {} };
}

/**
 * Generate per-section AI narrative text for the V2 Decarbonisation Report.
 * Requires auth.
 * Body: { sections: Array<{ section_id, slot_id, bindings }>, language?: 'en' | 'ar' }
 * Returns: { narratives: Array<{ slot_id, text }> }
 */
export async function getReportNarratives(sections, options = {}) {
  const language = options.language === 'ar' ? 'ar' : 'en';
  const res = await fetch(`${API_BASE}/reports/narrative`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sections, language }),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Narrative generation failed'));
  }

  const json = await res.json();
  return (json?.data?.narratives ?? json?.narratives ?? []);
}

/**
 * Delete an emission record. Requires auth.
 * DELETE /api/emissions/:id
 */
/**
 * Admin: list users. Requires ADMIN or SUPER_ADMIN.
 * Query: { search?, role?, isActive?, page?, limit? }
 */
export async function getAdminUsers(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/admin/users${query}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Failed to load users'));
  }
  const json = await res.json();
  return {
    data: json?.data ?? [],
    pagination: json?.pagination ?? {},
    organizationLimit: json?.organizationLimit,
  };
}

/**
 * Admin: create user so they can sign in. Body: { email, password, firstName, lastName, company?, role? }
 */
export async function createAdminUser(payload) {
  const res = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Create user failed'));
  }
  const json = await res.json();
  return json?.data ?? json;
}

/**
 * Admin: update user (isActive, role, emailVerified).
 */
export async function updateAdminUser(userId, payload) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Update user failed'));
  }
  const json = await res.json();
  return json?.data ?? json;
}

/**
 * Admin: delete user (within organization for org admins, any non-super-admin for super admins).
 */
export async function deleteAdminUser(userId) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Delete user failed'));
  }
  const json = await res.json().catch(() => ({}));
  return json?.data ?? json;
}

/**
 * Recent activity (audit log) for dashboard — who did what.
 */
export async function getRecentActivity(limit = 25) {
  const res = await authFetch(`${API_BASE}/activity/recent?limit=${limit}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Activity failed'));
  }
  const json = await res.json();
  return json?.data?.activities ?? json?.activities ?? [];
}

export async function deleteEmission(emissionId) {
  const res = await authFetch(`${API_BASE}/emissions/${emissionId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Delete failed'));
  }

  const data = await res.json().catch(() => ({}));
  return data?.data ?? data;
}

export async function deleteEmissionsBulk(ids) {
  const res = await authFetch(`${API_BASE}/emissions/bulk-delete`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [] }),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'Bulk delete failed'));
  }

  const data = await res.json().catch(() => ({}));
  return data?.data ?? data;
}
