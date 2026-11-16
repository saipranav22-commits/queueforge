let currentCsrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  currentCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return currentCsrfToken;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Include CSRF token on state-changing requests
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && currentCsrfToken) {
    headers.set('X-CSRF-Token', currentCsrfToken);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include QF_SESSION cookie
  });

  if (!response.ok) {
    let errorData: any = null;
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;

    try {
      errorData = await response.json();
      if (errorData && (errorData.message || errorData.error)) {
        errorMessage = errorData.message || errorData.error;
      }
    } catch {
      // Body is not JSON
    }

    throw new ApiError(response.status, errorMessage, errorData);
  }

  // Check if response has content
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}
