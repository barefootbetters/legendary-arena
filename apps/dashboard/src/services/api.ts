import axios, { AxiosError } from 'axios';
import type { ApiError } from '../types/index.js';

const apiClient = axios.create({
  // why: the base URL is the API SERVER ROOT (e.g. https://api.legendary-arena.com),
  // NOT a `/api/dash` sub-path. Every endpoints.ts call passes an absolute path
  // (`/api/dash/...`), matching how `analyticsLiveFetchers` builds `/api/analytics/...`
  // — so a single `VITE_API_BASE_URL` (the server root) serves BOTH client families.
  // A `/api/dash` suffix here would double-prefix the analytics fetchers and 404 them.
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
