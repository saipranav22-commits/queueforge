export interface AuthSession {
  authenticated: boolean;
  csrfToken: string | null;
  expiresAt: string | null;
}

export interface LoginPayload {
  adminKey: string;
}

export interface ApiMessageResponse {
  message: string;
  status: string;
  timestamp: string;
}
