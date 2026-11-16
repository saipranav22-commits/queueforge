import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest, setCsrfToken } from '../lib/apiClient';
import type { AuthSession, ApiMessageResponse } from '../types/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  csrfToken: string | null;
  isUnlockModalOpen: boolean;
  openUnlockModal: (onSuccessCallback?: () => void) => void;
  closeUnlockModal: () => void;
  login: (adminKey: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [csrfToken, setLocalCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const [pendingSuccessCallback, setPendingSuccessCallback] = useState<(() => void) | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const data = await apiRequest<AuthSession>('/auth/session');
      setIsAuthenticated(data.authenticated);
      if (data.authenticated && data.csrfToken) {
        setCsrfToken(data.csrfToken);
        setLocalCsrfToken(data.csrfToken);
      } else {
        setCsrfToken(null);
        setLocalCsrfToken(null);
      }
    } catch {
      setIsAuthenticated(false);
      setCsrfToken(null);
      setLocalCsrfToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (adminKey: string) => {
    const res = await apiRequest<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ adminKey }),
    });

    if (res.authenticated && res.csrfToken) {
      setCsrfToken(res.csrfToken);
      setLocalCsrfToken(res.csrfToken);
      setIsAuthenticated(true);
      setIsUnlockModalOpen(false);
      if (pendingSuccessCallback) {
        pendingSuccessCallback();
        setPendingSuccessCallback(null);
      }
    } else {
      throw new Error('Authentication failed');
    }
  };

  const logout = async () => {
    try {
      await apiRequest<ApiMessageResponse>('/auth/logout', { method: 'POST' });
    } finally {
      setCsrfToken(null);
      setLocalCsrfToken(null);
      setIsAuthenticated(false);
    }
  };

  const openUnlockModal = (onSuccess?: () => void) => {
    if (onSuccess) {
      setPendingSuccessCallback(() => onSuccess);
    }
    setIsUnlockModalOpen(true);
  };

  const closeUnlockModal = () => {
    setIsUnlockModalOpen(false);
    setPendingSuccessCallback(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        csrfToken,
        isUnlockModalOpen,
        openUnlockModal,
        closeUnlockModal,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
