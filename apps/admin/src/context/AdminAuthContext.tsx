import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminRole, canPerformCapability } from '@calmeter/shared';
import {
  adminClient,
  getStoredAdminToken,
  setStoredAdminToken,
  clearStoredAdminToken,
} from '../api/adminClient';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  can: (capability: any) => boolean;
  refetchAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentAdmin = useCallback(async () => {
    const token = getStoredAdminToken();
    if (!token) {
      setAdmin(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await adminClient.getMe();
      setAdmin(data);
    } catch {
      clearStoredAdminToken();
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentAdmin();
  }, [fetchCurrentAdmin]);

  const login = async (token: string) => {
    setIsLoading(true);
    setStoredAdminToken(token);
    try {
      const data = await adminClient.getMe();
      setAdmin(data);
    } catch (err) {
      clearStoredAdminToken();
      setAdmin(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredAdminToken();
    setAdmin(null);
  };

  const can = (capability: any): boolean => {
    if (!admin) return false;
    return canPerformCapability(admin.role, capability);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isLoading,
        isAuthenticated: !!admin,
        login,
        logout,
        can,
        refetchAdmin: fetchCurrentAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
