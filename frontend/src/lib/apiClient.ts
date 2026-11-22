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

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include QF_SESSION cookie
    });
  } catch (netErr: any) {
    if (netErr instanceof ApiError) {
      throw netErr;
    }
    throw new ApiError(
      0,
      'Backend service unavailable. Unable to connect to QueueForge API server.',
      { originalError: netErr?.message }
    );
  }

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
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // Reject HTML documents (e.g., SPA routing fallbacks returning index.html with HTTP 200)
  if (contentType.includes('text/html')) {
    throw new ApiError(
      response.status,
      `Received HTML response instead of JSON from API endpoint '${url}'. The backend service may be offline or unreachable on this host.`,
      { contentType, url }
    );
  }

  // Parse JSON responses
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return (await response.json()) as T;
    } catch (parseErr: any) {
      throw new ApiError(
        response.status,
        `Malformed JSON received from API endpoint '${url}': ${parseErr?.message}`,
        { contentType, url, originalError: parseErr?.message }
      );
    }
  }

  // Reject any unexpected non-JSON content type for API requests
  const text = await response.text();
  if (!text || text.trim() === '') {
    return undefined as unknown as T;
  }

  throw new ApiError(
    response.status,
    `Unexpected content-type '${contentType}' received from API endpoint '${url}'. Expected 'application/json'.`,
    { contentType, url, bodyPreview: text.slice(0, 200) }
  );
}
