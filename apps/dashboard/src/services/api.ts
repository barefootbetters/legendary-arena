import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types/index.js';
import { readAuthToken } from './authToken.js';

/**
 * Attach the operator's Hanko bearer token to every `apiClient` request, from the
 * shared `authToken.ts` seam (the SAME seam `analyticsLiveFetchers` uses). The
 * server requires `Authorization: Bearer` and ignores cookies (D-11202 / D-24003);
 * without this header the `admin-session-required` `/api/dash/*` endpoints
 * (WP-373/374) return 401. A null token (operator not signed in) attaches no header
 * and the request fails closed at the server — the intended posture.
 *
 * @param config The outbound axios request config.
 * @returns The config with the bearer header set when a token is present.
 */
export function attachAuthHeader(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = readAuthToken();
  if (token !== null) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}

const apiClient = axios.create({
  // why: the base URL is the API SERVER ROOT (e.g. https://api.legendary-arena.com),
  // NOT a `/api/dash` sub-path. Every endpoints.ts call passes an absolute path
  // (`/api/dash/...`), matching how `analyticsLiveFetchers` builds `/api/analytics/...`
  // — so a single `VITE_API_BASE_URL` (the server root) serves BOTH client families.
  // A `/api/dash` suffix here would double-prefix the analytics fetchers and 404 them.
  // The `?.` guards the node:test runner (no Vite transform) where `import.meta.env`
  // is undefined — the fallback wins there (mirrors arena-client `lobbyApi.ts`).
  baseURL: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// why: attach the operator bearer on every request so the admin-gated
// /api/dash/* endpoints (WP-373/374) authenticate — the endpoints.ts family was
// mock-only until those WPs, so the apiClient never carried auth before.
apiClient.interceptors.request.use(attachAuthHeader);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; code?: string }>) => {
    const apiError: ApiError = normalizeError(error);
    return Promise.reject(apiError);
  },
);

function normalizeError(error: AxiosError<{ message?: string; code?: string }>): ApiError {
  if (error.response) {
    const responseData = error.response.data;
    return {
      message: responseData?.message ?? `Request failed with status ${error.response.status}.`,
      code: responseData?.code ?? String(error.response.status),
      retryable: error.response.status >= 500,
    };
  }

  if (error.code === 'ECONNABORTED') {
    return {
      message: 'The request timed out. Please check your connection and try again.',
      code: 'timeout',
      retryable: true,
    };
  }

  return {
    message: 'A network error occurred. Please check your connection and try again.',
    code: 'network_error',
    retryable: true,
  };
}

export { apiClient };
