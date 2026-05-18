/**
 * API client for URIMPACT backend.
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
 * Login step 1 — credentials.
 * When SKIP_LOGIN_OTP is enabled (default in development), response includes accessToken + user immediately.
 * Otherwise returns loginChallengeId for POST /auth/login/verify.
 */
export async function initiateLogin(email, password, rememberMe = false) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
    });

    const data = await res.json().catch(() => ({}));
    const errMsg = data?.error || data?.message || (res.ok ? null : `Login failed (${res.status})`);

    if (!res.ok) {
        throw new Error(errMsg || 'Login failed');
    }

    const payload = data?.data ?? data;
    return payload;
}

/**
 * Login step 2 — OTP (+ optional TOTP). Returns same shape as legacy login.
 */
export async function verifyLoginWithBackend(loginChallengeId, otp, totpCode) {
    const res = await fetch(`${API_BASE}/auth/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            loginChallengeId,
            otp,
            ...(totpCode ? { totpCode } : {}),
        }),
    });

    const data = await res.json().catch(() => ({}));
    const errMsg = data?.error || data?.message || (res.ok ? null : `Verification failed (${res.status})`);

    if (!res.ok) {
        throw new Error(errMsg || 'Verification failed');
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
 * Current session profile (onboarding flags, subscription, etc.)
 */
export async function fetchAuthProfile() {
    const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'GET',
        headers: authHeaders(),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Profile failed'));
    }

    const json = await res.json();
    return json?.data ?? json;
}

export async function changePasswordApi({ currentPassword, newPassword }) {
    const body = {};
    if (currentPassword !== undefined && currentPassword !== '') {
        body.currentPassword = currentPassword;
    }
    body.newPassword = newPassword;

    const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Password change failed'));
    }

    const json = await res.json();
    const payload = json?.data ?? json;
    if (payload?.accessToken) setAuthToken(payload.accessToken);
    if (payload?.refreshToken) setRefreshToken(payload.refreshToken);
    return payload;
}

export async function fetchOrganizationMe() {
    const res = await authFetch(`${API_BASE}/organizations/me`, {
        method: 'GET',
        headers: authHeaders(),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Organization failed'));
    }

    const json = await res.json();
    return json?.data ?? json;
}

export async function saveOnboardingDraftApi(payload) {
    const res = await authFetch(`${API_BASE}/organizations/me/onboarding/draft`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Save draft failed'));
    }

    return true;
}

export async function submitOnboardingApi(payload) {
    const res = await authFetch(`${API_BASE}/organizations/me/onboarding/submit`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Submit failed'));
    }

    return true;
}

/** Merge partial draft keys (e.g. { scope1 }, { scope2 }, or both). */
export async function saveScopeOnboardingDraftApi(draftPatch) {
    const res = await authFetch(`${API_BASE}/organizations/me/onboarding/scope-draft`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(draftPatch || {}),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Save draft failed'));
    }

    return true;
}

export async function submitScope1OnboardingApi(scope1Payload) {
    const res = await authFetch(`${API_BASE}/organizations/me/onboarding/scope1/submit`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(scope1Payload),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Submit failed'));
    }

    return true;
}

export async function submitScope2OnboardingApi(scope2Payload) {
    const res = await authFetch(`${API_BASE}/organizations/me/onboarding/scope2/submit`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(scope2Payload),
    });

    if (!res.ok) {
        throw new Error(await buildApiError(res, 'Submit failed'));
    }

    return true;
}

/**
 * Upload registration certificate with optional progress callback (0–100).
 */
export function uploadRegistrationDocument(file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fd = new FormData();
        fd.append('file', file);

        xhr.open('POST', `${API_BASE}/organizations/me/onboarding/registration-document`);
        const token = getAuthToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.responseType = 'json';

        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && typeof onProgress === 'function') {
                const pct = Math.round((ev.loaded / ev.total) * 100);
                onProgress(pct);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const body = xhr.response;
                const filename = body?.data?.filename ?? body?.filename;
                resolve({ filename });
                return;
            }
            let msg = `Upload failed (${xhr.status})`;
            try {
                const b = xhr.response;
                msg = b?.error || b?.message || msg;
            } catch (_) {
                /* ignore */
            }
            reject(new Error(msg));
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
    });
}

export function uploadOnboardingFacilityProof(file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fd = new FormData();
        fd.append('file', file);

        xhr.open('POST', `${API_BASE}/organizations/me/onboarding/facility-proof-document`);
        const token = getAuthToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.responseType = 'json';

        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && typeof onProgress === 'function') {
                const pct = Math.round((ev.loaded / ev.total) * 100);
                onProgress(pct);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const body = xhr.response;
                const filename = body?.data?.filename ?? body?.filename;
                resolve({ filename });
                return;
            }
            let msg = `Upload failed (${xhr.status})`;
            try {
                const b = xhr.response;
                msg = b?.error || b?.message || msg;
            } catch (_) {
                /* ignore */
            }
            reject(new Error(msg));
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
    });
}

/**
 * Register against backend. Does not issue JWT — user completes OTP login after signup.
 * Body: { email, password, firstName, lastName, company? }
 * Backend requires: min 8 chars, one uppercase, one special character.
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
 * GHG module — submit one activity row for a single Scope 1 or 2 category (POST /api/ghg/scope-{n}/categories/:slug/form).
 * @param {1|2} scopeNum
 * @param {string} categorySlug e.g. stationary-combustion, purchased-electricity
 * @param {object} payload { activityType, activityAmount, activityUnit, category?, region?, billingPeriodStart?, billingPeriodEnd?, notes?, siteId?, siteName?, dataEntryChannel? }
 */
export async function submitGhgCategoryForm(scopeNum, categorySlug, payload) {
  const path = `${API_BASE}/ghg/scope-${scopeNum}/categories/${encodeURIComponent(categorySlug)}/form`;
  const res = await authFetch(path, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'GHG activity save failed'));
  }

  const data = await res.json();
  return data?.data || data;
}

/**
 * GHG module — list emissions for one category card (GET /api/ghg/scope-{n}/categories/:slug/entries).
 * @param {1|2} scopeNum
 * @param {string} categorySlug
 * @param {object} [params] { page?, limit?, startDate?, endDate? } ISO datetimes when used
 */
export async function getGhgCategoryEntries(scopeNum, categorySlug, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const path = `${API_BASE}/ghg/scope-${scopeNum}/categories/${encodeURIComponent(categorySlug)}/entries${query}`;

  const res = await authFetch(path, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(await buildApiError(res, 'GHG entries failed'));
  }

  const json = await res.json();
  return {
    data: json?.data ?? [],
    pagination: json?.pagination ?? {},
  };
}

/**
 * Download official Excel template for Scope 1 — stationary combustion (sheet "Stationary Combustion").
 */
export async function downloadStationaryCombustionTemplate() {
  const res = await authFetch(
    `${API_BASE}/ghg/scope-1/categories/stationary-combustion/template`,
    {
      method: 'GET',
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text.slice(0, 240) || 'Template download failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stationary-combustion-template.xlsx';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parse workbook for stationary combustion bulk import (preview only). Form field name: `file`.
 * @returns { rows: Array<{ excelRow, status, errors, input, mappedPreview? }>, summary: { total, validCount, invalidCount } }
 */
export async function previewStationaryCombustionBulk(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/stationary-combustion/bulk/preview`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `Preview failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * Confirm reviewed stationary combustion rows (JSON). Each row is saved and calculated (Climatiq).
 * Body: { rows: Array<{ asset, fuelUsed, fuelUsedQuantity, fuelUsedUnit, facility, dateOfTransaction, notes?, excelRow? }> }
 * @returns { createdCount, emissionIds, failedCount, rowErrors }
 */
export async function confirmStationaryCombustionBulk(rows) {
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/stationary-combustion/bulk/confirm`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `Confirm failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * Facility and asset name suggestions for stationary combustion (org onboarding + past entries).
 * @returns {{ facilities: string[], assets: string[], pastActivityTypes: string[] }}
 */
export async function getStationaryCombustionLookupOptions() {
  const res = await authFetch(
    `${API_BASE}/ghg/scope-1/categories/stationary-combustion/lookup-options`,
    {
      method: 'GET',
      headers: authHeaders(),
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `Lookup failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const data = json?.data ?? json;
  return {
    facilities: Array.isArray(data?.facilities) ? data.facilities : [],
    assets: Array.isArray(data?.assets) ? data.assets : [],
    pastActivityTypes: Array.isArray(data?.pastActivityTypes) ? data.pastActivityTypes : [],
  };
}

/**
 * Download Excel template for Scope 1 — mobile combustion (sheet "Mobile Combustion").
 */
export async function downloadMobileCombustionTemplate() {
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/mobile-combustion/template`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text.slice(0, 240) || 'Template download failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mobile-combustion-template.xlsx';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Mobile combustion bulk preview. Form field name: `file`.
 * @returns { rows, summary }
 */
export async function previewMobileCombustionBulk(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/mobile-combustion/bulk/preview`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `Preview failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * Confirm mobile combustion bulk rows.
 * Body: { rows: Array<{ vehicleType, fuelUsed, fuelUsedQuantity, fuelUsedUnit, facility, dateOfTransaction, notes?, excelRow? }> }
 */
export async function confirmMobileCombustionBulk(rows) {
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/mobile-combustion/bulk/confirm`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `Confirm failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * @returns {{ facilities: string[], vehicleTypes: string[], pastActivityTypes: string[] }}
 */
export async function getMobileCombustionLookupOptions() {
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/mobile-combustion/lookup-options`, {
    method: 'GET',
    headers: authHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `Lookup failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const data = json?.data ?? json;
  return {
    facilities: Array.isArray(data?.facilities) ? data.facilities : [],
    vehicleTypes: Array.isArray(data?.vehicleTypes) ? data.vehicleTypes : [],
    pastActivityTypes: Array.isArray(data?.pastActivityTypes) ? data.pastActivityTypes : [],
  };
}

/**
 * AI receipt extraction — upload receipt image/PDF, get structured stationary combustion data.
 * @returns { asset, fuelUsed, fuelUsedQuantity, fuelUsedUnit, facility, dateOfTransaction, notes, confidence }
 */
export async function aiExtractReceipt(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/stationary-combustion/ai/extract`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `AI extraction failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * Confirm AI-extracted receipt data — validate, calculate via Climatiq, persist.
 * Body: { asset, fuelUsed, fuelUsedQuantity, fuelUsedUnit, facility, dateOfTransaction, notes? }
 * @returns emission object
 */
export async function aiConfirmReceipt(data) {
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/stationary-combustion/ai/confirm`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `AI confirm failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * AI receipt extraction — upload receipt image/PDF, get structured mobile combustion data.
 * @returns { vehicleType, fuelUsed, fuelUsedQuantity, fuelUsedUnit, facility, dateOfTransaction, notes, confidence }
 */
export async function aiExtractMobileReceipt(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/mobile-combustion/ai/extract`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `AI extraction failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * Confirm AI-extracted mobile combustion receipt data — validate, calculate via Climatiq, persist.
 * Body: { vehicleType, fuelUsed, fuelUsedQuantity, fuelUsedUnit, facility, dateOfTransaction, notes? }
 * @returns emission object
 */
export async function aiConfirmMobileReceipt(data) {
  const res = await authFetch(`${API_BASE}/ghg/scope-1/categories/mobile-combustion/ai/confirm`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `AI confirm failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json?.data ?? json;
}

/**
 * Fetch user's emissions list with optional filters. Requires auth.
 * Query: { scope?, category?, ghgCategorySlug?, region?, startDate?, endDate?, page?, limit? }
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
