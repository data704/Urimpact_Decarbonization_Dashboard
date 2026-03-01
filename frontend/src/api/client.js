/**
 * API client for URIMPACT backend.
 * Receipt uploads are sent to the backend for AI extraction and emission calculation.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const AUTH_TOKEN_KEY = 'urimpact_access_token';

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

function authHeaders() {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
    const err = await uploadRes.json().catch(() => ({ error: uploadRes.statusText }));
    throw new Error(err.error || err.message || `Upload failed: ${uploadRes.status}`);
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
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Upload failed: ${res.status}`);
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
    const err = await processRes.json().catch(() => ({ error: processRes.statusText }));
    throw new Error(err.error || err.message || `Extraction failed: ${processRes.status}`);
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
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Submit failed: ${res.status}`);
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
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Batch submit failed: ${res.status}`);
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
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: email?.trim?.() ?? email,
      password,
      firstName: firstName?.trim?.() ?? firstName,
      lastName: lastName?.trim?.() ?? lastName,
      ...(company ? { company: company?.trim?.() ?? company } : {}),
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
  const res = await fetch(`${API_BASE}/reports/dashboard${query}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Dashboard failed: ${res.status}`);
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
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Emission calculation failed: ${res.status}`);
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

  const res = await fetch(`${API_BASE}/emissions${query}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Emissions failed: ${res.status}`);
  }

  const json = await res.json();
  return { data: json?.data ?? [], pagination: json?.pagination ?? {} };
}

/**
 * Delete an emission record. Requires auth.
 * DELETE /api/emissions/:id
 */
export async function deleteEmission(emissionId) {
  const res = await fetch(`${API_BASE}/emissions/${emissionId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Delete failed: ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  return data?.data ?? data;
}
